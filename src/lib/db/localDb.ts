// Espejo local-first de la base de datos en IndexedDB (Fase 3 del plan
// offline-responsive). Regla de oro 1 (§3): la UI lee y escribe AQUÍ;
// Supabase queda exclusivamente para el motor de sync (Fase 5).
//
// Las filas usan el formato snake_case del servidor (src/types/database.ts),
// NO el camelCase de types/index.ts. Cada fila guarda además `sync_rev`
// (token de concurrencia + cursor de pull, §4.1). No existe `deleted`:
// el borrado local es físico (remove de la fila) y el servidor propaga los
// borrados por el feed de tombstones (§4.2).

import Dexie, { type Table } from 'dexie'
import type { Tables } from '@/types/database'
import type { SyncedTableName } from '@/lib/sync/types'
import type { OutboxOp } from './outbox'
import type { LocalConflict } from './conflicts'
import type { MetaEntry } from './meta'

/** Metadatos locales añadidos a toda fila espejada. */
export interface LocalRowMeta {
  /**
   * Revisión global del servidor (§4.1): token de concurrencia (se envía como
   * `baseRev` en el outbox) y cursor de pull. `0` = fila creada localmente que
   * aún no tiene confirmación del servidor.
   */
  sync_rev: number
}

/** Fila espejada: la fila snake_case del servidor + metadatos locales. */
export type LocalRow<T extends SyncedTableName> = Tables<T> & LocalRowMeta

/** Dispositivo registrado para la poda segura de tombstones (sync_devices, §4.5). */
export interface SyncDevice {
  device_id: string
  business_id: string
  user_id: string | null
  last_seen_at: string
  last_pull_at: string | null
}

/**
 * IndexedDB local-first. Versión 1: espejo por tabla + outbox + conflictos +
 * meta + dispositivos. Solo se accede desde los repositorios (Fase 4) y el
 * motor de sync (Fase 5); la UI nunca toca `db` directamente.
 */
export class AppDB extends Dexie {
  // ── Espejo de tablas sincronizadas (fila snake_case + sync_rev) ──
  productos!: Table<LocalRow<'productos'>, string>
  vendedores!: Table<LocalRow<'vendedores'>, string>
  compradores!: Table<LocalRow<'compradores'>, string>
  ventas_diarias!: Table<LocalRow<'ventas_diarias'>, string>
  compras!: Table<LocalRow<'compras'>, string>
  detalles_compra!: Table<LocalRow<'detalles_compra'>, string>
  gastos!: Table<LocalRow<'gastos'>, string>
  impuestos!: Table<LocalRow<'impuestos'>, string>
  movimientos_caja!: Table<LocalRow<'movimientos_caja'>, string>
  // La PK del servidor es business_id (la fila no tiene `id`); caso especial
  // del plan (trampa 10, §7). La clave de este store es business_id.
  configuracion_negocio!: Table<LocalRow<'configuracion_negocio'>, string>
  registros_ipve!: Table<LocalRow<'registros_ipve'>, string>
  pedidos!: Table<LocalRow<'pedidos'>, string>
  solicitudes_producto_nuevo!: Table<LocalRow<'solicitudes_producto_nuevo'>, string>
  salarios_fijos!: Table<LocalRow<'salarios_fijos'>, string>
  fiados!: Table<LocalRow<'fiados'>, string>

  // ── Infraestructura de sync ──
  /** Cola de mutaciones pendientes de push (Fase 4/5). */
  outbox!: Table<OutboxOp, number>
  /** Conflictos detectados en push/pull, pendientes de resolución (Fase 6). */
  conflicts!: Table<LocalConflict, string>
  /** Watermarks, device_id y perfil cacheado. */
  meta!: Table<MetaEntry, string>
  /** Dispositivos vistos (poda de tombstones, §4.5). */
  syncDevices!: Table<SyncDevice, string>

  constructor() {
    super('adminnegocio-pro')
    // Nota: los índices incluyen columnas que la migración 004 (Fase 0) añade
    // (detalles_compra.business_id, movimientos_caja.updated_at). Las filas que
    // aún no tengan esas propiedades simplemente quedan fuera de ese índice;
    // al aplicar la migración y regenerar tipos, el índice ya está listo.
    this.version(1).stores({
      productos: 'id, business_id, sync_rev, updated_at',
      vendedores: 'id, business_id, sync_rev, updated_at',
      compradores: 'id, business_id, sync_rev, updated_at',
      ventas_diarias: 'id, business_id, sync_rev, updated_at',
      compras: 'id, business_id, sync_rev, updated_at',
      detalles_compra: 'id, business_id, sync_rev, updated_at',
      gastos: 'id, business_id, sync_rev, updated_at',
      impuestos: 'id, business_id, sync_rev, updated_at',
      movimientos_caja: 'id, business_id, sync_rev, updated_at',
      // PK del servidor = business_id (la fila no tiene `id`).
      configuracion_negocio: 'business_id, sync_rev, updated_at',
      registros_ipve: 'id, business_id, sync_rev, updated_at',
      pedidos: 'id, business_id, sync_rev, updated_at',
      solicitudes_producto_nuevo: 'id, business_id, sync_rev, updated_at',
      salarios_fijos: 'id, business_id, sync_rev, updated_at',
      fiados: 'id, business_id, sync_rev, updated_at',
      outbox: '++seq, mutationId, status',
      conflicts: 'id, tableName, rowId',
      meta: 'key',
      syncDevices: 'device_id, business_id, last_seen_at',
    })
  }
}

/** Instancia única (singleton) de la base local. */
export const db = new AppDB()
