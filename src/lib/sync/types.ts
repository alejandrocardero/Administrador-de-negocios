// Tipos compartidos del motor de sincronización (plan offline-responsive, §4 y §5).
// Este módulo NO importa nada de red ni de Dexie: es contrato puro entre
// localDb/outbox/pull/push y la UI (useSyncStatus, SyncIndicator).

import type { Database } from '@/types/database'

/** Nombre de cualquier tabla de la BD, reutilizado de los tipos generados (src/types/database.ts). */
export type TableName = keyof Database['public']['Tables']

/** Tablas con espejo local en IndexedDB (§5 del plan). Fuente de verdad del pull/push. */
const SYNCED_TABLES = [
  'productos',
  'vendedores',
  'compradores',
  'ventas_diarias',
  'compras',
  'detalles_compra',
  'gastos',
  'impuestos',
  'movimientos_caja',
  'configuracion_negocio',
  'registros_ipve',
  'pedidos',
  'solicitudes_producto_nuevo',
  'salarios_fijos',
  'fiados',
] as const

/**
 * Tablas sincronizadas: subconjunto tipado de `TableName`.
 * Si un nombre no existiera en la BD, `Extract` lo reduce a `never` y el store
 * correspondiente en localDb.ts falla al compilar.
 */
export type SyncedTableName = Extract<TableName, (typeof SYNCED_TABLES)[number]>

/** Lista de tablas sincronizadas (para el bucle de pull de la Fase 5). */
export { SYNCED_TABLES }

/**
 * Operación de mutación aplicable vía `apply_mutation` (§4.6).
 * - `stock_delta`: contador atómico; el motor de push (Fase 5) la traduce al RPC
 *   `ajustar_stock(p_mutation_id, p_producto_id, p_delta)` (§4.6), idempotente
 *   vía `applied_ops`. El payload lleva `{ delta: number }` y `rowId` es el producto.
 */
export type MutationOp = 'insert' | 'update' | 'delete' | 'stock_delta'

/**
 * Clases de conflicto (§4.4). Coinciden con el CHECK de `sync_conflicts.kind`.
 * `delete_delete` no es pérdida de datos pero se registra para auditabilidad.
 */
export type ConflictKind = 'update_update' | 'insert_insert' | 'delete_update' | 'delete_delete'

/** Estado del motor de sync expuesto a la UI (useSyncStatus / SyncIndicator, Fases 5 y 7). */
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'paused'

/**
 * Respuesta del RPC `apply_mutation` (§4.6):
 * - `ok`: aplicada; `rev` es el nuevo `sync_rev` de la fila (null cuando no aplica).
 * - `conflict`: el servidor NO sobrescribió nada; `server` es la versión del
 *   servidor (null si la borraron) e `id` el identificador en `sync_conflicts`
 *   para pasarlo luego a `resolver_conflicto` (§4.6).
 */
export type ApplyMutationResult =
  | { status: 'ok'; rev: number | null }
  | { status: 'conflict'; kind: ConflictKind; server: Record<string, unknown> | null; id: string }

// ─────────────────────────────────────────────────────────────────────────────
// Adiciones de la Fase 5 (motor de sync). SOLO aditivo: nada de lo anterior
// cambia. Estas variantes las producen pull.ts/push.ts, las consume
// syncEngine.ts y la UI las ve a través de useSyncStatus.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Respuesta del RPC `ajustar_stock` (§4.6): rev del producto tras el ajuste
 * atómico y stock resultante (`greatest(0, stock + p_delta)`).
 */
export type AjustarStockResult = {
  status: 'ok'
  rev: number
  stock: number
}

/**
 * Instantánea completa del motor de sync para la UI. `SyncStatus` sigue siendo
 * el estado plano que expone `getStatus()`; esto añade el contexto del estado
 * (`needsRelogin`, `lastError`) y la marca del último pull con éxito.
 */
export interface SyncEngineState {
  status: SyncStatus
  /**
   * Pausa por token no renovable (§7 trampa 13): hay que volver a iniciar
   * sesión; la cola se conserva intacta mientras tanto (nunca se descarta).
   */
  needsRelogin: boolean
  /** Último error de red/servidor (para toasts de la Fase 7); null si ninguno. */
  lastError: string | null
  /** ISO de la última pasada de pull completada; null si nunca sincronizó. */
  lastSyncAt: string | null
}

/**
 * Resultado de drenar el outbox en una pasada de push (push.ts):
 * - `completed`: la cola quedó drenada (o no había ops listas).
 * - `aborted`: se cortó el drenaje por red caída (reintentar tras backoff) o
 *   porque el backoff de un intento anterior aún está activo.
 * - `paused`: 401 no recuperable; `needsRelogin` distingue token inválido
 *   (re-login) de fallo de red al renovar la sesión.
 */
export type PushOutcome =
  | { kind: 'completed' }
  | { kind: 'aborted'; reason: 'network' | 'backoff' }
  | { kind: 'paused'; needsRelogin: boolean }

/**
 * Resultado de una pasada de pull (pull.ts):
 * - `completed`: watermarks actualizados; `fullResync` indica que se vació el
 *   espejo y se repulló todo (§4.5); `errors` son fallos no fatales por tabla
 *   (esa tabla se reintenta en la próxima pasada al no avanzar su watermark).
 * - `failed`: abortada; `offline` distingue red caída de error de servidor.
 * - `paused`: 401 no recuperable (misma semántica que en push).
 */
export type PullOutcome =
  | { kind: 'completed'; fullResync: boolean; errors: string[] }
  | { kind: 'failed'; offline: boolean; error: string }
  | { kind: 'paused'; needsRelogin: boolean }
