// Pull incremental (Fase 5, §5 del plan). Por tabla (PULL_ORDER) consulta las
// filas con `sync_rev > watermark` (cursor paginado de 500) y las aplica al
// espejo local; `compras` se trae con `detalles_compra(*)` embebido y se
// escribe compra + reemplazo de detalles en una transacción (§4.7). Después
// procesa el feed de tombstones (`sync_deletions`, `seq > delWatermark`).
//
// Merge (regla de oro 3, §3): si la fila local tiene ops pendientes en el
// outbox para ese rowId y el `sync_rev` remoto supera el `baseRev` de la op,
// NO se sobrescribe: se registra un `LocalConflict` (ambas versiones se
// conservan) y se deja la local; si no → put por id (idempotente).
//
// Reconciliación (§4.5): si `delWatermark < sync_meta.tombstones_pruned_through`
// hay tombstones podados que este dispositivo nunca vio → resync completo
// (vaciar espejos —salvo filas con ops pendientes, que son trabajo no
// empujado que jamás se descarta—, watermarks a 0, pull total y
// `last_full_sync`).

import type { Table } from 'dexie'
import { db } from '@/lib/db/localDb'
import { open as openConflicts, save as saveConflict, type NewLocalConflict } from '@/lib/db/conflicts'
import type { OutboxOp } from '@/lib/db/outbox'
import {
  getPullDeletionsWatermark,
  getPullWatermark,
  getOrCreateDeviceId,
  setLastFullSync,
  setPullDeletionsWatermark,
  setPullWatermark,
} from '@/lib/db/meta'
import { SYNCED_TABLES, type ConflictKind, type PullOutcome, type SyncedTableName } from './types'
import {
  ensureFreshSession,
  errorText,
  isNetworkResult,
  isUnauthorizedResult,
  looseFrom,
  type LooseQuery,
} from './loose'

/**
 * Orden de pull (spec Fase 5): configuración primero (la UI depende de ella),
 * maestros (vendedores/compradores/productos/salarios), luego transaccionales
 * y por último caja/impuestos/fiados. `detalles_compra` no está: viaja
 * embebido en su compra (§4.7).
 */
export const PULL_ORDER = [
  'configuracion_negocio',
  'vendedores',
  'compradores',
  'productos',
  'salarios_fijos',
  'pedidos',
  'solicitudes_producto_nuevo',
  'registros_ipve',
  'ventas_diarias',
  'compras',
  'gastos',
  'impuestos',
  'movimientos_caja',
  'fiados',
] as const satisfies readonly SyncedTableName[]

/** Tabla pullable (las 14 replicadas con watermark propio). */
export type PullEntity = (typeof PULL_ORDER)[number]

/** Tamaño de página del pull (spec: limit 500). */
export const PULL_PAGE_SIZE = 500

/** Contexto de una pasada de pull. */
interface PullCtx {
  businessId: string
  /** Índice de ops pendientes/en vuelo por `${entity}:${rowId}` (orden FIFO). */
  pending: Map<string, OutboxOp[]>
  /** Claves `${tableName}|${rowId}|${kind}` de conflictos ya registrados. */
  dedupe: Set<string>
  /** El reintento de 401 solo se permite UNA vez por pasada. */
  authRetried: boolean
}

/** PK del servidor según la tabla (trampa 10, §7: configuración usa business_id). */
function primaryKeyOf(entity: SyncedTableName): 'id' | 'business_id' {
  return entity === 'configuracion_negocio' ? 'business_id' : 'id'
}

/** Espejo local de la tabla (acceso dinámico por nombre de entidad). */
function mirrorTable(entity: SyncedTableName): Table<Record<string, unknown>, string> {
  return db[entity] as unknown as Table<Record<string, unknown>, string>
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Valida la forma mínima de una fila remota: `sync_rev` numérico (PostgREST
 * serializa bigint como número) y PK string. La forma completa es la del
 * servidor (fuente de verdad), no se re-valida campo a campo.
 */
function validatedRowId(entity: SyncedTableName, raw: Record<string, unknown>): string | null {
  if (typeof raw.sync_rev !== 'number' || !Number.isFinite(raw.sync_rev)) {
    console.warn(`[sync] fila de ${entity} sin sync_rev válido; ignorada`)
    return null
  }
  const pk = primaryKeyOf(entity)
  const id = raw[pk]
  if (typeof id !== 'string') {
    console.warn(`[sync] fila de ${entity} sin ${pk}; ignorada`)
    return null
  }
  return id
}

function lastSyncRev(rows: Record<string, unknown>[]): number | null {
  const last = rows[rows.length - 1]
  return typeof last?.sync_rev === 'number' ? last.sync_rev : null
}

function lastSeqOf(rows: Record<string, unknown>[]): number | null {
  const last = rows[rows.length - 1]
  return typeof last?.seq === 'number' ? last.seq : null
}

/** Índice de ops pendientes/en vuelo por fila (FIFO por seq). */
async function loadPendingOps(): Promise<Map<string, OutboxOp[]>> {
  const ops = await db.outbox
    .where('status')
    .anyOf(['pending', 'in_flight'])
    .sortBy('seq')
  const map = new Map<string, OutboxOp[]>()
  for (const op of ops) {
    const key = `${op.entity}:${op.rowId}`
    const list = map.get(key)
    if (list) list.push(op)
    else map.set(key, [op])
  }
  return map
}

/**
 * Conflicto detectado en pull. `incoming: 'local-row'` marca que la versión
 * entrante es la fila local actual (se lee del espejo al registrarlo).
 */
interface RowConflict {
  kind: ConflictKind
  server: Record<string, unknown> | null
  incoming: Record<string, unknown> | null | 'local-row'
  baseRev: number | null
}

/**
 * Decide el merge de una fila remota entrante frente a las ops pendientes de
 * esa misma fila:
 * - sin ops de escritura (o solo stock_delta) → put (los deltas se componen
 *   en el servidor sobre la versión que haya);
 * - op delete pendiente → nunca se re-resucita la fila localmente; si el rev
 *   remoto superó su base → conflicto 'delete_update' (incoming null);
 * - op insert/update pendiente y rev remoto > baseRev → conflicto
 *   (insert_insert / update_update según la op más reciente), se conserva la
 *   local;
 * - en el resto de casos → put por id.
 */
function decideRowMerge(
  remote: Record<string, unknown>,
  ops: OutboxOp[],
): { action: 'put' | 'skip'; conflict: RowConflict | null } {
  const writeOps = ops.filter((o) => o.op === 'insert' || o.op === 'update' || o.op === 'delete')
  if (writeOps.length === 0) return { action: 'put', conflict: null }

  const remoteRev = typeof remote.sync_rev === 'number' ? remote.sync_rev : 0
  const maxBaseRev = Math.max(...writeOps.map((o) => o.baseRev ?? 0))
  const latest = writeOps[writeOps.length - 1]

  if (writeOps.some((o) => o.op === 'delete')) {
    // Borrada localmente (borrado físico del espejo): no se re-resucita
    let conflict: RowConflict | null = null
    if (remoteRev > maxBaseRev) {
      conflict = { kind: 'delete_update', server: remote, incoming: null, baseRev: maxBaseRev }
    }
    return { action: 'skip', conflict }
  }

  if (remoteRev > maxBaseRev) {
    return {
      action: 'skip',
      conflict: {
        kind: latest.op === 'insert' ? 'insert_insert' : 'update_update',
        server: remote,
        incoming: 'local-row',
        baseRev: maxBaseRev,
      },
    }
  }
  return { action: 'put', conflict: null }
}

/** Registra un conflicto UNA sola vez por fila+kind (idempotencia de pull). */
async function saveConflictOnce(ctx: PullCtx, conflict: NewLocalConflict): Promise<void> {
  const key = `${conflict.tableName}|${conflict.rowId}|${conflict.kind}`
  if (ctx.dedupe.has(key)) return
  ctx.dedupe.add(key)
  await saveConflict(conflict)
}

/** Fila local actual del espejo (versión entrante de un conflicto de pull). */
async function readLocalRow(
  entity: SyncedTableName,
  rowId: string,
): Promise<Record<string, unknown> | null> {
  const row = await mirrorTable(entity).get(rowId)
  return row ? { ...row } : null
}

/**
 * Registra (si procede) el conflicto de la decisión de merge y devuelve si la
 * fila remota debe aplicarse al espejo.
 */
async function handleDecision(
  ctx: PullCtx,
  entity: SyncedTableName,
  rowId: string,
  decision: { action: 'put' | 'skip'; conflict: RowConflict | null },
  ops: OutboxOp[],
): Promise<boolean> {
  const c = decision.conflict
  if (c) {
    // 'local-row' = la versión entrante es la fila local; si ya desapareció
    // del espejo, se cae al payload de la op más reciente.
    const incoming =
      c.incoming === 'local-row'
        ? (await readLocalRow(entity, rowId)) ?? (ops[ops.length - 1]?.payload ?? null)
        : c.incoming
    await saveConflictOnce(ctx, {
      businessId: ctx.businessId,
      tableName: entity,
      rowId,
      kind: c.kind,
      serverVersion: c.server,
      incomingVersion: incoming,
      baseRev: c.baseRev,
    })
  }
  return decision.action === 'put'
}

/** Aplica una fila remota de una tabla normal (put por id). */
async function applyIncomingRow(entity: PullEntity, raw: Record<string, unknown>, ctx: PullCtx): Promise<void> {
  const rowId = validatedRowId(entity, raw)
  if (rowId === null) return
  const ops = ctx.pending.get(`${entity}:${rowId}`) ?? []
  const decision = decideRowMerge(raw, ops)
  if (!(await handleDecision(ctx, entity, rowId, decision, ops))) return
  await mirrorTable(entity).put(raw)
}

/**
 * Aplica una compra remota: compra + reemplazo de sus detalles en UNA
 * transacción (§4.7, unidad transaccional). Los detalles no tienen
 * `sync_rev` propio en el servidor: heredan el de su compra en el espejo.
 */
async function applyIncomingCompra(raw: Record<string, unknown>, ctx: PullCtx): Promise<void> {
  const compraId = validatedRowId('compras', raw)
  if (compraId === null) return
  const ops = ctx.pending.get(`compras:${compraId}`) ?? []
  const decision = decideRowMerge(raw, ops)
  if (!(await handleDecision(ctx, 'compras', compraId, decision, ops))) return

  const parentRev = typeof raw.sync_rev === 'number' ? raw.sync_rev : 0
  const detallesRaw = Array.isArray(raw['detalles_compra'])
    ? (raw['detalles_compra'] as unknown[])
    : []
  const detalles: Record<string, unknown>[] = []
  for (const item of detallesRaw) {
    if (typeof item !== 'object' || item === null) continue
    const det = item as Record<string, unknown>
    if (typeof det.id !== 'string' || typeof det.compra_id !== 'string') continue
    detalles.push({ ...det, sync_rev: parentRev })
  }

  const compra = { ...raw }
  delete compra['detalles_compra']

  await db.transaction('rw', [db.compras, db.detalles_compra], async () => {
    await mirrorTable('compras').put(compra)
    await mirrorTable('detalles_compra').filter((d) => d.compra_id === compraId).delete()
    if (detalles.length > 0) await mirrorTable('detalles_compra').bulkPut(detalles)
  })
}

/** Tombstone validado del feed `sync_deletions`. */
interface Tombstone {
  seq: number
  table_name: string
  row_id: string
}

function toTombstone(raw: Record<string, unknown>): Tombstone | null {
  if (
    typeof raw.seq !== 'number' ||
    typeof raw.table_name !== 'string' ||
    typeof raw.row_id !== 'string'
  ) {
    console.warn('[sync] tombstone malformado; ignorado')
    return null
  }
  return { seq: raw.seq, table_name: raw.table_name, row_id: raw.row_id }
}

/** Borra la fila local (y sus detalles si es compras) — no hay ops pendientes. */
async function deleteLocalRow(entity: SyncedTableName, rowId: string): Promise<void> {
  if (entity === 'compras') {
    await db.transaction('rw', [db.compras, db.detalles_compra], async () => {
      await mirrorTable('compras').delete(rowId)
      await mirrorTable('detalles_compra').filter((d) => d.compra_id === rowId).delete()
    })
    return
  }
  await mirrorTable(entity).delete(rowId)
}

/**
 * Aplica un tombstone: si hay op pendiente para la fila → conflicto (kind
 * real: delete_delete si nuestra op era delete; delete_update si teníamos
 * cambios sin empujar) y se conserva el estado local; si no → borrado local.
 */
async function applyTombstone(tomb: Tombstone, ctx: PullCtx): Promise<void> {
  const entity = tomb.table_name as SyncedTableName
  if (!SYNCED_TABLES.includes(entity) || entity === 'detalles_compra') {
    // Tabla fuera del espejo o detalles (los detalles nunca se tombstonean,
    // §4.2: se propagan por cascade/parentezco con su compra)
    return
  }
  const ops = ctx.pending.get(`${entity}:${tomb.row_id}`) ?? []
  if (ops.length === 0) {
    await deleteLocalRow(entity, tomb.row_id)
    return
  }
  const hasDelete = ops.some((o) => o.op === 'delete')
  const latest = ops[ops.length - 1]
  await saveConflictOnce(ctx, {
    businessId: ctx.businessId,
    tableName: entity,
    rowId: tomb.row_id,
    kind: hasDelete ? 'delete_delete' : 'delete_update',
    serverVersion: null, // el servidor borró la fila
    incomingVersion: hasDelete ? null : (latest.payload ?? null),
    baseRev: latest.baseRev ?? null,
  })
}

/** Resultado interno de una consulta de página. */
type RunQueryOutcome =
  | { kind: 'data'; rows: Record<string, unknown>[] }
  | { kind: 'fatal'; outcome: PullOutcome }
  | { kind: 'error'; error: string }

/**
 * Ejecuta una consulta con el manejo de errores de la pasada: 401 → refresh
 * UNA vez + reintento; red → fatal (offline); el resto (4xx/5xx puntuales) →
 * no fatal: la consulta se reintenta en la próxima pasada.
 */
async function runQuery(query: LooseQuery, ctx: PullCtx): Promise<RunQueryOutcome> {
  let result = await query
  if (isUnauthorizedResult(result)) {
    if (ctx.authRetried) {
      return { kind: 'fatal', outcome: { kind: 'paused', needsRelogin: true } }
    }
    ctx.authRetried = true
    const recovery = await ensureFreshSession()
    if (!recovery.ok) {
      return {
        kind: 'fatal',
        outcome: { kind: 'paused', needsRelogin: recovery.reason === 'token' },
      }
    }
    // El builder es re-ejecutable: cada await dispara una petición nueva
    result = await query
    if (isUnauthorizedResult(result)) {
      return { kind: 'fatal', outcome: { kind: 'paused', needsRelogin: true } }
    }
  }
  if (isNetworkResult(result)) {
    return {
      kind: 'fatal',
      outcome: { kind: 'failed', offline: true, error: errorText(result) },
    }
  }
  if (result.error) {
    return { kind: 'error', error: errorText(result) }
  }
  const rows = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : []
  return { kind: 'data', rows }
}

/**
 * Pull de UNA tabla con paginación por cursor (`gt(sync_rev, cursor)`): sin
 * solapamientos aunque haya escrituras durante la pasada. El watermark se
 * persistite al terminar la tabla (checkpoint; una tabla fallida se repite
 * completa la próxima vez, que es idempotente).
 * Devuelve un outcome fatal (aborta el pull) o null.
 */
async function pullEntity(entity: PullEntity, ctx: PullCtx, errors: string[]): Promise<PullOutcome | null> {
  const columns = entity === 'compras' ? '*, detalles_compra(*)' : '*'
  let cursor = await getPullWatermark(entity)

  for (;;) {
    const query = looseFrom(entity)
      .select(columns)
      .eq('business_id', ctx.businessId)
      .gt('sync_rev', cursor)
      .order('sync_rev', { ascending: true })
      .limit(PULL_PAGE_SIZE)
    const outcome = await runQuery(query, ctx)
    if (outcome.kind === 'fatal') return outcome.outcome
    if (outcome.kind === 'error') {
      errors.push(`${entity}: ${outcome.error}`)
      break
    }

    const rows = outcome.rows
    try {
      for (const raw of rows) {
        if (entity === 'compras') await applyIncomingCompra(raw, ctx)
        else await applyIncomingRow(entity, raw, ctx)
      }
    } catch (err) {
      // Error local (p. ej. cuota de IndexedDB): aborta la pasada completa
      return { kind: 'failed', offline: false, error: `error local aplicando ${entity}: ${errorMessage(err)}` }
    }

    if (rows.length < PULL_PAGE_SIZE) {
      const rev = lastSyncRev(rows)
      if (rev !== null) cursor = rev
      break
    }
    const rev = lastSyncRev(rows)
    if (rev === null || rev <= cursor) break // defensa: cursor no avanza
    cursor = rev
  }

  await setPullWatermark(entity, cursor)
  return null
}

/** Pull del feed de tombstones (paginado por seq). */
async function pullDeletions(ctx: PullCtx, errors: string[]): Promise<PullOutcome | null> {
  let cursor = await getPullDeletionsWatermark()

  for (;;) {
    const query = looseFrom('sync_deletions')
      .select('*')
      .eq('business_id', ctx.businessId)
      .gt('seq', cursor)
      .order('seq', { ascending: true })
      .limit(PULL_PAGE_SIZE)
    const outcome = await runQuery(query, ctx)
    if (outcome.kind === 'fatal') return outcome.outcome
    if (outcome.kind === 'error') {
      errors.push(`sync_deletions: ${outcome.error}`)
      break
    }

    const rows = outcome.rows
    try {
      for (const raw of rows) {
        const tomb = toTombstone(raw)
        if (tomb) await applyTombstone(tomb, ctx)
      }
    } catch (err) {
      return { kind: 'failed', offline: false, error: `error local aplicando tombstones: ${errorMessage(err)}` }
    }

    if (rows.length < PULL_PAGE_SIZE) {
      const seq = lastSeqOf(rows)
      if (seq !== null) cursor = seq
      break
    }
    const seq = lastSeqOf(rows)
    if (seq === null || seq <= cursor) break
    cursor = seq
  }

  await setPullDeletionsWatermark(cursor)
  return null
}

/**
 * Resync completo (§4.5): vacía los espejos (SALVO las filas con ops
 * pendientes —trabajo no empujado que nunca se descarta, trampa 12, §7—),
 * resetea los watermarks a 0 y deja que la pasada repulle todo. Reprocesar
 * los tombstones desde 0 recupera los que fueron podados.
 */
async function performFullResync(pending: Map<string, OutboxOp[]>): Promise<void> {
  const keep = new Set<string>(pending.keys())
  for (const entity of SYNCED_TABLES) {
    const pk = primaryKeyOf(entity)
    await mirrorTable(entity)
      .filter((row) => !keep.has(`${entity}:${String(row[pk])}`))
      .delete()
  }
  for (const entity of PULL_ORDER) {
    await setPullWatermark(entity, 0)
  }
  await setPullDeletionsWatermark(0)
}

/** Heartbeat en `sync_devices` (upsert device_id/business_id/…, §4.5). */
async function sendHeartbeat(businessId: string, userId: string | null): Promise<void> {
  const deviceId = await getOrCreateDeviceId()
  const now = new Date().toISOString()
  const result = await looseFrom('sync_devices').upsert(
    {
      device_id: deviceId,
      business_id: businessId,
      user_id: userId,
      last_seen_at: now,
      last_pull_at: now,
    },
    { onConflict: 'device_id,business_id' },
  )
  if (result.error) {
    // No fatal: los datos ya se aplicaron y los watermarks quedaron a salvo
    console.warn('[sync] heartbeat en sync_devices fallido:', result.error.message)
  }
}

/**
 * Pasada de pull completa (la llama syncEngine tras el push):
 * 1. índice de ops pendientes + conflictos abiertos (dedupe);
 * 2. reconciliación con `sync_meta.tombstones_pruned_through` → resync;
 * 3. pull por tabla (PULL_ORDER);
 * 4. tombstones;
 * 5. heartbeat + `last_full_sync` si hubo resync.
 */
export async function pullAll(businessId: string, userId: string | null): Promise<PullOutcome> {
  const ctx: PullCtx = {
    businessId,
    pending: await loadPendingOps(),
    dedupe: new Set<string>(),
    authRetried: false,
  }
  for (const conflict of await openConflicts()) {
    ctx.dedupe.add(`${conflict.tableName}|${conflict.rowId}|${conflict.kind}`)
  }
  const errors: string[] = []

  try {
    // ── 2) Reconciliación con la poda de tombstones (§4.5) ──
    const delWatermark = await getPullDeletionsWatermark()
    const metaQuery = looseFrom('sync_meta')
      .select('tombstones_pruned_through')
      .eq('business_id', businessId)
      .limit(1)
    const metaOutcome = await runQuery(metaQuery, ctx)
    if (metaOutcome.kind === 'fatal') return metaOutcome.outcome
    let pruned = 0
    if (metaOutcome.kind === 'data') {
      const value = metaOutcome.rows[0]?.['tombstones_pruned_through']
      if (typeof value === 'number') pruned = value
    } else {
      // Sin sync_meta fiable no sabemos si hubo poda: conservador (0), el
      // feed de tombstones sigue entregando borrados no podados
      errors.push(`sync_meta: ${metaOutcome.error}`)
    }
    let fullResync = false
    if (delWatermark < pruned) {
      // Hay tombstones podados que nunca vimos → resync completo (evita
      // resurrecciones de filas borradas, trampa 5, §7)
      await performFullResync(ctx.pending)
      fullResync = true
    }

    // ── 3) Pull por tabla ──
    for (const entity of PULL_ORDER) {
      const fatal = await pullEntity(entity, ctx, errors)
      if (fatal) return fatal
    }

    // ── 4) Tombstones ──
    const fatalDeletions = await pullDeletions(ctx, errors)
    if (fatalDeletions) return fatalDeletions

    // ── 5) Heartbeat y marca de resync ──
    await sendHeartbeat(businessId, userId)
    if (fullResync) await setLastFullSync(new Date().toISOString())

    return { kind: 'completed', fullResync, errors }
  } catch (err) {
    return { kind: 'failed', offline: false, error: errorMessage(err) }
  }
}
