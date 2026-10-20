// Conflictos detectados por el motor de sync, conservando SIEMPRE ambas
// versiones (regla de oro 3, §3): nunca hay sobrescritura silenciosa.
// El espejo local vive en el store `conflicts`; el historial auditable
// completo vive en el servidor (`sync_conflicts`, §4.4) y nunca se borra.

import { db } from './localDb'
import { uuid } from '@/lib/id'
import type { ConflictKind, SyncedTableName } from '@/lib/sync/types'

/** Conflicto local pendiente (o resuelto) de una fila espejada. */
export interface LocalConflict {
  /**
   * Identificador: coincide con `sync_conflicts.id` cuando el conflicto
   * viene de una respuesta de push (`ApplyMutationResult`); si se detecta en
   * pull (Fase 5) se genera localmente con `uuid()`.
   */
  id: string
  businessId: string
  tableName: SyncedTableName
  rowId: string
  kind: ConflictKind
  /** Versión del servidor (null si el servidor borró la fila). */
  serverVersion?: Record<string, unknown> | null
  /** Versión local entrante (null si el cliente borró la fila). */
  incomingVersion?: Record<string, unknown> | null
  /** `sync_rev` local en el momento de la mutación. */
  baseRev?: number | null
  detectedAt: string
  resolved: boolean
}

/** Datos para registrar un conflicto; `id`, `detectedAt` y `resolved` se rellenan. */
export type NewLocalConflict = Omit<LocalConflict, 'id' | 'detectedAt' | 'resolved'> & {
  id?: string
}

/** Registra un conflicto como no resuelto. */
export async function save(conflict: NewLocalConflict): Promise<LocalConflict> {
  const record: LocalConflict = {
    ...conflict,
    id: conflict.id ?? uuid(),
    detectedAt: new Date().toISOString(),
    resolved: false,
  }
  await db.conflicts.put(record)
  return record
}

/**
 * Conflictos sin resolver, del más antiguo al más reciente. Requiere un
 * recorrido completo del store (no hay índice por `resolved`), pero la
 * tabla de conflictos es pequeña por naturaleza.
 */
export async function open(): Promise<LocalConflict[]> {
  return db.conflicts.filter((c) => !c.resolved).sortBy('detectedAt')
}

/**
 * Marca el conflicto como resuelto. El detalle de la resolución
 * (mine/server/both/merged) queda auditado en el servidor vía
 * `resolver_conflicto` (§4.6); localmente solo interesa quitarlo de la lista.
 */
export async function markResolved(id: string): Promise<void> {
  await db.conflicts.update(id, { resolved: true })
}

/** Elimina del espejo local los conflictos ya resueltos; devuelve cuántos borró. */
export async function clearResolved(): Promise<number> {
  return db.conflicts.filter((c) => c.resolved).delete()
}
