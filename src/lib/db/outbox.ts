// Cola de mutaciones optimistas (outbox). Fase 3: solo persistencia en
// IndexedDB; aquí NADA de red. El motor de push (Fase 5) drena la cola con
// `apply_mutation` usando el `mutationId` para idempotencia (§4.3).

import { db } from './localDb'
import { uuid } from '@/lib/id'
import type { MutationOp, SyncedTableName } from '@/lib/sync/types'

/** Operación encolada lista para push. */
export interface OutboxOp {
  /** Clave primaria autoincremental (`++seq`) asignada por el store. */
  seq?: number
  /**
   * Identificador único de la mutación: el servidor guarda su respuesta en
   * `applied_ops` y la repite tal cual en reintentos (idempotencia, §4.3).
   */
  mutationId: string
  businessId: string
  /** Tabla espejada destino. */
  entity: SyncedTableName
  op: MutationOp
  /** Id de la fila afectada (en configuracion_negocio es el business_id). */
  rowId: string
  /**
   * Campos a escribir (snake_case, sin columnas generadas/protegidas:
   * id, business_id, created_at, updated_at, sync_rev, subtotal,
   * total_vendido). Va vacío en `delete`.
   */
  payload?: Record<string, unknown>
  /** `sync_rev` de la fila local sobre la que se basó la mutación (null si no existía). */
  baseRev?: number | null
  /** Número de intentos de push (para backoff y dead-letter). */
  attempts: number
  /**
   * - `pending`: en cola.
   * - `in_flight`: el motor la está empujando (solo mientras la pestaña vive).
   * - `dead_letter`: error permanente (p. ej. validación); requiere revisión,
   *   NUNCA se descarta (trampa 12, §7).
   */
  status: 'pending' | 'in_flight' | 'dead_letter'
  createdAt: string
  /** Último error registrado por el motor de push (diagnóstico/aviso). */
  lastError?: string
}

/** Datos necesarios para encolar; lo demás lo rellena `enqueue`. */
export interface NewOutboxOp {
  /** Si no se pasa, se genera con `uuid()`. */
  mutationId?: string
  businessId: string
  entity: SyncedTableName
  op: MutationOp
  rowId: string
  payload?: Record<string, unknown>
  baseRev?: number | null
}

/** Encola una mutación optimista como `pending` (FIFO por `seq`). */
export async function enqueue(op: NewOutboxOp): Promise<OutboxOp> {
  const record: OutboxOp = {
    mutationId: op.mutationId ?? uuid(),
    businessId: op.businessId,
    entity: op.entity,
    op: op.op,
    rowId: op.rowId,
    payload: op.payload,
    baseRev: op.baseRev ?? null,
    attempts: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  const seq = await db.outbox.add(record)
  return { ...record, seq }
}

/**
 * Ops pendientes listas para push, ordenadas por `seq` (FIFO).
 * Excluye `dead_letter`; no incluye `in_flight` (el motor de la Fase 5
 * debe reclamar las `in_flight` huérfanas de una sesión caída al arrancar).
 */
export async function ready(): Promise<OutboxOp[]> {
  return db.outbox.where('status').equals('pending').sortBy('seq')
}

/** Marca una op como en vuelo e incrementa el contador de intentos. */
export async function markInFlight(seq: number): Promise<void> {
  await db.outbox.where('seq').equals(seq).modify((op) => {
    op.status = 'in_flight'
    op.attempts += 1
  })
}

/** Marca una op como dead-letter: deja de reintentarse pero no se borra. */
export async function markDeadLetter(seq: number, lastError: string): Promise<void> {
  await db.outbox.update(seq, { status: 'dead_letter', lastError })
}

/** Elimina la op de la cola (tras aplicarla con éxito o resolver su conflicto). */
export async function remove(seq: number): Promise<void> {
  await db.outbox.delete(seq)
}

/**
 * Número de ops `pending` (excluye `in_flight`, que ya están siendo
 * empujadas, y `dead_letter`, que la UI muestra aparte).
 */
export async function countPending(): Promise<number> {
  return db.outbox.where('status').equals('pending').count()
}
