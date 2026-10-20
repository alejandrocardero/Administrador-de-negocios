// Fábrica de repositorios local-first (Fase 4 del plan offline-responsive).
//
// Un repositorio es la ÚNICA vía de lectura/escritura de la UI (regla de oro
// 1, §3): lectura reactiva del store espejo de Dexie (`useLiveQuery`) y
// escritura optimista (store + outbox dentro de la MISMA transacción).
// Aquí NO hay red: el motor de push (Fase 5, src/lib/sync) drena la cola
// con `apply_mutation` usando el `mutationId` para idempotencia (§4.3) y
// los conflictos se resuelven en la Fase 6 (nunca sobrescribir a ciegas).
//
// Contratos (§4.6 del plan y el antiguo README de este directorio):
// - insert: id de cliente (`uuid()`, regla 2), `sync_rev: 0` (sin
//   confirmación del servidor), payload = fila snake_case SIN columnas
//   generadas/protegidas (trampa 9) y SIN business_id (el outbox lo lleva
//   aparte; el RPC lo fija explícito).
// - update: `baseRev` SIEMPRE sale de la fila local (`fila.sync_rev`);
//   payload = solo el patch (columnas a cambiar).
// - delete: borrado físico local + op `delete` con `baseRev` de la fila.

import { useLiveQuery } from 'dexie-react-hooks'
import type { Table } from 'dexie'
import { db, type LocalRow } from '@/lib/db/localDb'
import { enqueue } from '@/lib/db/outbox'
import { uuid } from '@/lib/id'
import type { SyncedTableName } from '@/lib/sync/types'
import type { TablesInsert, TablesUpdate } from '@/types/database'

/** Input de alta en snake_case (lo que producen los mappers `from*`). */
export type InsertInput<T extends SyncedTableName> = Partial<TablesInsert<T>>

/** Patch de actualización en snake_case (solo columnas a cambiar). */
export type UpdateInput<T extends SyncedTableName> = Partial<TablesUpdate<T>>

/**
 * Acceso tipado al store espejado de una tabla sincronizada. La AppDB ya
 * declara un store por tabla (localDb.ts); el cast correlaciona el nombre
 * con su tipo sin recorrer la instancia con un genérico abierto.
 */
export function getStore<T extends SyncedTableName>(entity: T): Table<LocalRow<T>, string> {
  return (db as unknown as Record<SyncedTableName, Table<LocalRow<T>, string>>)[entity]
}

/** Fecha ISO de ahora: para created_at/updated_at/fecha* optimistas. */
export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Columnas que NUNCA van en el payload del outbox (trampa 9, §7):
 * - protegidas: las fija el servidor (id, business_id, created_at,
 *   updated_at, sync_rev); `business_id` viaja en el outbox aparte.
 * - generadas: `subtotal` (compras/detalles_compra) y `total_vendido`
 *   (ventas_diarias).
 * - `detalles`: clave del agregado de compras que `apply_mutation` trata
 *   aparte (§4.7); el repositorio de compras la añade explícitamente.
 */
const STRIPPED_PAYLOAD_KEYS = new Set([
  'id',
  'business_id',
  'created_at',
  'updated_at',
  'sync_rev',
  'subtotal',
  'total_vendido',
  'detalles',
])

/**
 * Payload snake_case para el outbox: copia superficial del origen sin
 * columnas generadas/protegidas y sin claves con valor undefined.
 */
export function buildPayload(source: object): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source) as [string, unknown][]) {
    if (STRIPPED_PAYLOAD_KEYS.has(key) || value === undefined) continue
    payload[key] = value
  }
  return payload
}

/** Copia en `target` las claves definidas de `source` (undefined no pisa). */
export function mergeDefined(target: Record<string, unknown>, source: object): void {
  for (const [key, value] of Object.entries(source) as [string, unknown][]) {
    if (value !== undefined) target[key] = value
  }
}

/** Valor por defecto local: constante o función (p. ej. `nowIso` para fechas). */
type DefaultValue = number | string | boolean | null | (() => string)

/**
 * Defaults locales = defaults REALES del servidor (001_initial_schema.sql):
 * al construir la fila optimista se rellenan los campos que el input no
 * trae, para que el espejo coincida con lo que el servidor guardaría. Los
 * campos NOT NULL sin default (p. ej. productos.codigo/nombre) deben venir
 * en el input: si faltan, el push fallará en el servidor y quedará como
 * dead-letter con aviso (trampa 12: la cola nunca se descarta).
 */
const ROW_DEFAULTS: { [K in SyncedTableName]: Record<string, DefaultValue> } = {
  productos: {
    descripcion: null,
    precio_compra: 0,
    precio_venta: 0,
    porcentaje_ganancia: 0,
    stock: 0,
    stock_minimo: 0,
    unidad: 'unidad',
    fecha_registro: nowIso,
    activo: true,
  },
  vendedores: { activo: true, fecha_registro: nowIso },
  compradores: { activo: true, fecha_registro: nowIso },
  ventas_diarias: { monto_efectivo: 0, monto_transferencia: 0, salario_calculado: 0, notas: null },
  compras: { subtotal: 0, total: 0, estado: 'completada', notas: null },
  detalles_compra: { cantidad: 1, precio_unitario: 0 },
  gastos: { monto: 0, descripcion: null },
  impuestos: { monto: 0, monto_pagado: 0, estado: 'pendiente', notas: null },
  // PK = business_id: la fila no tiene `id` (trampa 10, §7).
  configuracion_negocio: {
    nit: null,
    direccion: null,
    telefono: null,
    email: null,
    regimen: 'simplificado',
    tarifa_iva: 19.0,
    moneda: 'COP',
  },
  movimientos_caja: { monto: 0 },
  registros_ipve: { inicio: 0, entrada: 0, final: 0, precio_venta: 0 },
  pedidos: { fecha: nowIso, cantidad: 1, cantidad_entregada: 0, estado: 'pendiente', notas: null },
  solicitudes_producto_nuevo: {
    fecha: nowIso,
    precio_compra: 0,
    cantidad: 1,
    estado: 'pendiente',
    notas: null,
    precio_venta: null,
    stock_minimo: null,
    producto_id: null,
    comentario_admin: null,
  },
  salarios_fijos: { monto_semanal: 0 },
  fiados: { monto: 0, descripcion: null, notas: null, estado: 'pendiente', fecha_cobro: null },
}

/** Resuelve los defaults de una tabla evaluando las funciones (fechas). */
function resolveDefaults(entity: SyncedTableName): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(ROW_DEFAULTS[entity])) {
    resolved[key] = typeof value === 'function' ? value() : value
  }
  return resolved
}

/**
 * Orden de lectura por defecto: `updated_at` desc (las escrituras
 * optimistas tocan updated_at, así que lo más reciente queda primero).
 * `movimientos_caja` aún no declara updated_at en los tipos generados
 * (TODO: regenerar database.ts tras la migración 004); en runtime la
 * columna existe y las filas sin ella ordenan al final.
 */
export function sortByUpdatedDesc<T extends SyncedTableName>(rows: LocalRow<T>[]): LocalRow<T>[] {
  const at = (row: LocalRow<T>): string =>
    (row as LocalRow<T> & { updated_at?: string }).updated_at ?? ''
  return rows.sort((a, b) => at(b).localeCompare(at(a)))
}

export interface RepositoryOptions<T extends SyncedTableName> {
  /** Tabla espejada (es la `entity` del outbox). */
  entity: T
  /**
   * PK del servidor/store. `'business_id'` SOLO para configuracion_negocio
   * (la fila no tiene `id`, trampa 10): el `rowId` del outbox es el
   * business_id y el insert no genera uuid.
   */
  primaryKey?: 'id' | 'business_id'
  /**
   * Columnas derivadas locales: se recalculan sobre la fila optimista tras
   * mezclar defaults+input (create) o fila+patch (update). Ej.:
   * `total_vendido = monto_efectivo + monto_transferencia` en ventas_diarias
   * (GENERATED en el servidor; trampa 9: jamás va en el payload).
   */
  derive?: (row: Record<string, unknown>) => void
}

export interface Repository<T extends SyncedTableName> {
  readonly entity: T
  /**
   * Lectura reactiva del store espejo (`useLiveQuery`): filas del negocio
   * ordenadas por `updated_at` desc. `[]` cuando no hay datos;
   * `undefined` mientras la primera lectura de IndexedDB está en curso
   * (los hooks lo traducen como `loading`).
   */
  useData(businessId?: string | null): LocalRow<T>[] | undefined
  /** Insert optimista: uuid de cliente, sync_rev 0, store + outbox atómicos. */
  create(businessId: string, input: InsertInput<T>): Promise<LocalRow<T>>
  /**
   * Update optimista: `baseRev` = sync_rev de la fila LOCAL; aplica el
   * patch y encola `op:'update'` con el payload snake_case del patch.
   */
  update(businessId: string, id: string, patch: UpdateInput<T>): Promise<LocalRow<T>>
  /** Borrado físico local + op `delete` con `baseRev` de la fila. */
  remove(businessId: string, id: string): Promise<boolean>
}

/**
 * Crea un repositorio sobre el store espejo de una tabla sincronizada.
 * Todas las escrituras son primero local + outbox, en una misma
 * transacción de Dexie: o se ve el cambio completo o no ocurre nada.
 */
export function createRepository<T extends SyncedTableName>(
  options: RepositoryOptions<T>,
): Repository<T> {
  const { entity, primaryKey = 'id', derive } = options
  const store = getStore(entity)

  const useData = (businessId?: string | null): LocalRow<T>[] | undefined =>
    useLiveQuery(
      async () => {
        if (!businessId) return [] as LocalRow<T>[]
        const rows = await store.where('business_id').equals(businessId).toArray()
        return sortByUpdatedDesc(rows)
      },
      [businessId],
    )

  const create = async (businessId: string, input: InsertInput<T>): Promise<LocalRow<T>> => {
    // rowId: uuid de cliente (idempotencia por id en el servidor) o el
    // propio business_id cuando la PK es business_id.
    const rowId = primaryKey === 'business_id' ? businessId : uuid()
    const row: Record<string, unknown> = resolveDefaults(entity)
    mergeDefined(row, input)
    row.business_id = businessId
    row.sync_rev = 0
    row.created_at = nowIso()
    row.updated_at = nowIso()
    if (primaryKey === 'id') row.id = rowId
    derive?.(row)
    const typed = row as unknown as LocalRow<T>

    await db.transaction('rw', [store, db.outbox], async () => {
      await store.put(typed)
      await enqueue({
        businessId,
        entity,
        op: 'insert',
        rowId,
        // Payload = fila snake_case sin generadas/protegidas (trampa 9).
        payload: buildPayload(row),
        baseRev: null,
      })
    })
    return typed
  }

  const update = async (
    businessId: string,
    id: string,
    patch: UpdateInput<T>,
  ): Promise<LocalRow<T>> => {
    const rowId = primaryKey === 'business_id' ? businessId : id
    const payload = buildPayload(patch)

    return db.transaction('rw', [store, db.outbox], async (): Promise<LocalRow<T>> => {
      const row = await store.get(rowId)
      if (!row) {
        throw new Error(`Fila local no encontrada en ${entity}: ${rowId}`)
      }

      const merged: Record<string, unknown> = { ...row }
      mergeDefined(merged, patch)
      // sync_rev NO cambia: sigue siendo el token base de la fila local
      // hasta que el servidor confirme (Fase 5); solo se toca updated_at.
      merged.updated_at = nowIso()
      derive?.(merged)
      const typed = merged as unknown as LocalRow<T>

      await store.put(typed)
      if (Object.keys(payload).length > 0) {
        await enqueue({
          businessId,
          entity,
          op: 'update',
          rowId,
          payload,
          baseRev: row.sync_rev,
        })
      }
      return typed
    })
  }

  const remove = async (businessId: string, id: string): Promise<boolean> => {
    const rowId = primaryKey === 'business_id' ? businessId : id

    return db.transaction('rw', [store, db.outbox], async (): Promise<boolean> => {
      const row = await store.get(rowId)
      if (!row) {
        // Ya no existe localmente: delete idempotente, nada que propagar.
        return false
      }
      await store.delete(rowId)
      await enqueue({ businessId, entity, op: 'delete', rowId, baseRev: row.sync_rev })
      return true
    })
  }

  return { entity, useData, create, update, remove }
}
