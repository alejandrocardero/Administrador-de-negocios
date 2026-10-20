// Drenaje FIFO del outbox (Fase 5, §5 del plan). Cada op viaja por el RPC
// `apply_mutation` (§4.6) —idempotente por `mutation_id` (§4.3)— y los
// contadores de stock usan el RPC atómico `ajustar_stock` (regla de oro 4, §3).
// Clasificación de respuestas:
//   - `ok`       → se actualiza el `sync_rev` local de la fila con `rev` y se
//                  retira la op de la cola.
//   - `conflict` → el servidor NO sobrescribió nada: se registra un
//                  `LocalConflict` con el id del servidor (la UI de resolución
//                  es la Fase 6) y se retira la op.
//   - red/5xx    → attempts++ y backoff exponencial con jitter (cap 60 s);
//                  a los MAX_ATTEMPTS la op pasa a dead-letter (NUNCA se
//                  descarta, trampa 12, §7).
//   - 401        → `auth.getSession()` + refresh UNA vez y reintento único;
//                  si falla por red → pausa; si falla por token → pausa con
//                  needsRelogin (trampa 13, §7).
//   - 4xx valid. → dead-letter inmediato con lastError (error permanente).

import type { Table } from 'dexie'
import { db } from '@/lib/db/localDb'
import { markDeadLetter, markInFlight, ready, remove, type OutboxOp } from '@/lib/db/outbox'
import { save as saveConflict, type NewLocalConflict } from '@/lib/db/conflicts'
import type { ApplyMutationResult, ConflictKind, PushOutcome, SyncedTableName } from './types'
import {
  ensureFreshSession,
  errorText,
  isNetworkResult,
  isServerErrorResult,
  isUnauthorizedResult,
  looseRpc,
  type LooseResult,
} from './loose'

/** Intentos máximos por op antes de dead-letter (spec Fase 5). */
const MAX_ATTEMPTS = 8
/** Base del backoff exponencial (1 s, 2 s, 4 s…). */
const BACKOFF_BASE_MS = 1_000
/** Techo del backoff (spec: cap 60 s). */
const BACKOFF_CAP_MS = 60_000

/**
 * Marca temporal hasta la que NO se reintenta el push (backoff del último
 * fallo de red/5xx). El outbox (Fase 3) no tiene campo `nextAttemptAt`, así
 * que el backoff se aplica a la cola completa desde el motor: los errores de
 * red afectan a todas las ops por igual. Se resetea al (re)arrancar el motor.
 */
let notBefore = 0

/** Reinicia el backoff (lo llama syncEngine.init tras un arranque/re-login). */
export function resetPushBackoff(): void {
  notBefore = 0
}

/** Backoff exponencial con jitter (0.5–1.5×), cap 60 s. */
function backoffDelay(attempts: number): number {
  const exponential = BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1)
  const capped = Math.min(exponential, BACKOFF_CAP_MS)
  const jitter = 0.5 + Math.random()
  return Math.round(capped * jitter)
}

const CONFLICT_KINDS: readonly string[] = ['update_update', 'insert_insert', 'delete_update', 'delete_delete']

/**
 * Valida la respuesta de `apply_mutation`/`ajustar_stock` contra el contrato
 * del §4.6. Devuelve null si el cuerpo no encaja (se trata como error de
 * servidor: reintentable vía backoff).
 */
function parseApplyResult(data: unknown): ApplyMutationResult | null {
  if (typeof data !== 'object' || data === null) return null
  const r = data as Record<string, unknown>
  if (r.status === 'ok') {
    // rev null = delete idempotente (la fila ya no existía en el servidor)
    return { status: 'ok', rev: typeof r.rev === 'number' ? r.rev : null }
  }
  if (r.status === 'conflict' && typeof r.kind === 'string' && CONFLICT_KINDS.includes(r.kind)) {
    const id = typeof r.id === 'string' ? r.id : null
    if (!id) return null // sin id de sync_conflicts no se podría resolver (Fase 6)
    const server =
      r.server !== null && typeof r.server === 'object' ? (r.server as Record<string, unknown>) : null
    return { status: 'conflict', kind: r.kind as ConflictKind, server, id }
  }
  return null
}

/** Delta entero del payload de una op `stock_delta`; null si es inválido. */
function extractDelta(op: OutboxOp): number | null {
  const delta = op.payload?.['delta']
  return typeof delta === 'number' && Number.isInteger(delta) ? delta : null
}

/**
 * Envía UNA op al servidor con la firma EXACTA de la migración 004:
 * - `stock_delta` → `ajustar_stock(p_mutation_id, p_producto_id, p_delta)`;
 * - insert/update/delete → `apply_mutation(p_mutation_id, p_business_id,
 *   p_entity, p_op, p_id, p_payload, p_base_rev)`.
 */
async function sendOp(op: OutboxOp): Promise<LooseResult<unknown>> {
  if (op.op === 'stock_delta') {
    const delta = extractDelta(op)
    if (delta === null) {
      // Error local permanente de la op: 422 sintético → dead-letter inmediato
      return { data: null, error: { message: 'payload.delta inválido (entero requerido) en stock_delta' }, status: 422 }
    }
    return looseRpc('ajustar_stock', {
      p_mutation_id: op.mutationId,
      p_producto_id: op.rowId,
      p_delta: delta,
    })
  }
  return looseRpc('apply_mutation', {
    p_mutation_id: op.mutationId,
    p_business_id: op.businessId,
    p_entity: op.entity,
    p_op: op.op,
    p_id: op.rowId,
    p_payload: op.payload ?? {},
    p_base_rev: op.baseRev ?? null,
  })
}

/** Vuelve a dejar la op como `pending` (abort de la pasada: nada se pierde). */
async function revertToPending(op: OutboxOp, lastError?: string): Promise<void> {
  if (op.seq === undefined) return
  await db.outbox.update(op.seq, {
    status: 'pending',
    ...(lastError !== undefined ? { lastError } : {}),
  })
}

/** Espejo local de la tabla (acceso dinámico por nombre de entidad). */
function mirrorTable(entity: SyncedTableName): Table<Record<string, unknown>, string> {
  return db[entity] as unknown as Table<Record<string, unknown>, string>
}

/** `ok` → actualiza el `sync_rev` local de la fila con el rev del servidor. */
async function bumpLocalRev(entity: SyncedTableName, rowId: string, rev: number): Promise<void> {
  await mirrorTable(entity).update(rowId, { sync_rev: rev })
}

/**
 * Encadena en FIFO: tras aplicar con éxito una op de la fila, las ops
 * posteriores de ESA MISMA fila deben basarse en el rev resultante (si no,
 * el servidor las vería como update_update con baseRev obsoleta). Solo para
 * insert/update/stock_delta: el `rev` del delete-ok es el seq del tombstone
 * (§4.2, otra secuencia) y NO sirve como token de concurrencia.
 */
async function chainBaseRev(op: OutboxOp, rev: number): Promise<void> {
  if (op.seq === undefined) return
  await db.outbox
    .where('status')
    .anyOf(['pending', 'in_flight'])
    .filter(
      (o) =>
        o.seq !== op.seq && o.entity === op.entity && o.rowId === op.rowId && o.op !== 'stock_delta',
    )
    .modify((o) => {
      o.baseRev = rev
    })
}

/**
 * Un `ok` deja obsoletos los conflictos abiertos de la fila detectados en pull
 * (p. ej. un insert_insert por ack perdido: la fila remota era la nuestra).
 * Solo para ops de escritura de la fila; un stock_delta no "posee" la fila.
 */
async function clearOpenConflictsForRow(entity: SyncedTableName, rowId: string): Promise<void> {
  await db.conflicts
    .where('tableName')
    .equals(entity)
    .filter((c) => c.rowId === rowId && !c.resolved)
    .delete()
}

/**
 * Registra el conflicto devuelto por el servidor con SU id (necesario para
 * `resolver_conflicto` en la Fase 6). Antes de guardar, retira los conflictos
 * abiertos de la misma fila+kind (p. ej. el detectado en pull con uuid local):
 * queda exactamente uno, con identificador de servidor.
 */
async function registerPushConflict(
  op: OutboxOp,
  parsed: Extract<ApplyMutationResult, { status: 'conflict' }>,
): Promise<void> {
  await db.conflicts
    .where('tableName')
    .equals(op.entity)
    .filter((c) => c.rowId === op.rowId && c.kind === parsed.kind && !c.resolved && c.id !== parsed.id)
    .delete()
  const conflict: NewLocalConflict = {
    id: parsed.id,
    businessId: op.businessId,
    tableName: op.entity,
    rowId: op.rowId,
    kind: parsed.kind,
    serverVersion: parsed.server,
    // incoming null si el cliente borró (la op delete no lleva payload)
    incomingVersion: op.op === 'delete' ? null : (op.payload ?? null),
    baseRev: op.baseRev ?? null,
  }
  await saveConflict(conflict)
}

/**
 * Drena el outbox FIFO. Aborta al primer error de red/5xx (reintentable con
 * backoff); las 4xx de validación separen la op a dead-letter y el drenaje
 * continúa. Nunca descarta nada (trampa 12, §7).
 */
export async function pushAll(): Promise<PushOutcome> {
  // Backoff activo de un fallo anterior: no tocar la cola todavía
  if (Date.now() < notBefore) return { kind: 'aborted', reason: 'backoff' }

  // Instantánea FIFO; las ops que lleguen durante la pasada se drenan en el
  // siguiente ciclo (el motor re-dispara si quedan pendientes).
  const ops = await ready()
  if (ops.length === 0) return { kind: 'completed' }

  for (const op of ops) {
    if (op.seq === undefined) continue // sin clave: inmanejable, no se toca
    // Red de seguridad: op que ya agotó intentos en sesiones previas
    if (op.attempts >= MAX_ATTEMPTS) {
      await markDeadLetter(op.seq, op.lastError ?? `demasiados intentos (${op.attempts})`)
      continue
    }

    await markInFlight(op.seq) // marca in_flight e incrementa attempts
    const attempts = op.attempts + 1

    let result: LooseResult<unknown>
    try {
      result = await sendOp(op)

      // 401: refresh UNA vez y reintento único de la misma op
      if (isUnauthorizedResult(result)) {
        const recovery = await ensureFreshSession()
        if (!recovery.ok) {
          await revertToPending(op)
          return { kind: 'paused', needsRelogin: recovery.reason === 'token' }
        }
        result = await sendOp(op)
        if (isUnauthorizedResult(result)) {
          // La renovación no sirvió: el token sigue siendo inválido
          await revertToPending(op)
          return { kind: 'paused', needsRelogin: true }
        }
        if (isNetworkResult(result)) {
          await revertToPending(op)
          return { kind: 'aborted', reason: 'network' }
        }
      }
    } catch {
      // supabase-js resuelve los errores en vez de rechazar; esto es una redada
      await revertToPending(op)
      notBefore = Date.now() + backoffDelay(attempts)
      return { kind: 'aborted', reason: 'network' }
    }

    // ── Red / timeout / 5xx: reintentable con backoff ──
    if (isNetworkResult(result) || isServerErrorResult(result)) {
      const message = errorText(result)
      if (attempts >= MAX_ATTEMPTS) {
        // NUNCA se descarta: queda en dead_letter para revisión
        await markDeadLetter(op.seq, message)
        continue
      }
      await revertToPending(op, message)
      notBefore = Date.now() + backoffDelay(attempts)
      return { kind: 'aborted', reason: 'network' }
    }

    // ── 4xx de validación: error permanente → dead-letter inmediato ──
    if (result.error) {
      await markDeadLetter(op.seq, errorText(result))
      continue
    }

    // ── Respuesta 200: parsear el contrato del RPC ──
    const parsed = parseApplyResult(result.data)
    if (!parsed) {
      // Cuerpo inesperado (¿proxy?, ¿versión de migración?): reintentable
      if (attempts >= MAX_ATTEMPTS) {
        await markDeadLetter(op.seq, 'respuesta inesperada del servidor')
        continue
      }
      await revertToPending(op)
      notBefore = Date.now() + backoffDelay(attempts)
      return { kind: 'aborted', reason: 'network' }
    }

    if (parsed.status === 'ok') {
      if (parsed.rev !== null && op.op !== 'delete') {
        // El delete-ok devuelve el seq del tombstone: no se escribe en el
        // espejo (la fila ya no existe localmente) ni encadena baseRevs.
        await bumpLocalRev(op.entity, op.rowId, parsed.rev)
        await chainBaseRev(op, parsed.rev)
      }
      if (op.op !== 'stock_delta') {
        await clearOpenConflictsForRow(op.entity, op.rowId)
      }
    } else {
      await registerPushConflict(op, parsed)
    }
    await remove(op.seq)
  }

  return { kind: 'completed' }
}
