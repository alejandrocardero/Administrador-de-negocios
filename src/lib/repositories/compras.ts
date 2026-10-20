// Repositorio del AGREGADO compras + detalles_compra (§4.7 del plan).
//
// La compra y sus detalles son una UNIDAD transaccional: create/update
// escriben la compra y reemplazan los detalles locales en UNA transacción
// de Dexie y encolan UNA sola op `entity:'compras'` cuyo payload incluye
// `detalles: [...]` (snake_case, con `id` de cliente por detalle). El RPC
// `apply_mutation` reemplaza los detalles en bloque dentro de su misma
// transacción (sync_replace_compra_detalles).
//
// `remove` borra en cascada local (compra + detalles) y encola UNA op
// delete de la compra: los detalles NO se tombstonean (trampa 4, §7; el
// cascade del padre basta).

import { useLiveQuery } from 'dexie-react-hooks'
import { db, type LocalRow } from '@/lib/db/localDb'
import { enqueue } from '@/lib/db/outbox'
import { uuid } from '@/lib/id'
import { buildPayload, mergeDefined, nowIso } from './factory'
import type { TablesInsert, TablesUpdate } from '@/types/database'

/**
 * Fila espejo de detalle. `business_id` existe en runtime (la migración
 * 004 lo añade y lo rellena el trigger desde el padre) pero los tipos
 * generados aún no lo incluyen (TODO: regenerar database.ts).
 */
export type DetalleCompraRow = LocalRow<'detalles_compra'> & { business_id?: string }

/** Detalle del agregado en snake_case, sin id (lo genera el repositorio). */
export interface DetalleCompraInput {
  producto_id: string
  producto_nombre: string
  cantidad: number
  precio_unitario: number
}

/** Input de alta del agregado: campos de la compra + detalles (obligatorios). */
export type CompraCreateInput = Partial<
  Omit<TablesInsert<'compras'>, 'id' | 'business_id' | 'created_at' | 'updated_at'>
> & {
  detalles: DetalleCompraInput[]
}

/** Patch del agregado: los detalles solo se reemplazan si el patch los trae. */
export type CompraUpdatePatch = Partial<
  Omit<TablesUpdate<'compras'>, 'id' | 'business_id' | 'created_at' | 'updated_at'>
> & {
  detalles?: DetalleCompraInput[]
}

/** Construye las filas locales de detalle (subtotal generado calculado aquí). */
function buildDetalleRows(
  businessId: string,
  compraId: string,
  detalles: DetalleCompraInput[],
): DetalleCompraRow[] {
  return detalles.map((d) => ({
    id: uuid(),
    compra_id: compraId,
    business_id: businessId,
    producto_id: d.producto_id,
    producto_nombre: d.producto_nombre,
    cantidad: d.cantidad,
    precio_unitario: d.precio_unitario,
    // subtotal es GENERATED (cantidad * precio_unitario): se calcula
    // localmente para mostrar; el payload JAMÁS lo lleva (trampa 9).
    subtotal: d.cantidad * d.precio_unitario,
    sync_rev: 0,
  }))
}

/** Detalles para el payload del agregado (snake_case, con id por detalle). */
function detallesPayload(rows: DetalleCompraRow[]): Record<string, unknown>[] {
  // apply_mutation/sync_replace_compra_detalles excluyen compra_id,
  // subtotal y business_id: los fija el servidor desde el padre.
  return rows.map((r) => ({
    id: r.id,
    producto_id: r.producto_id,
    producto_nombre: r.producto_nombre,
    cantidad: r.cantidad,
    precio_unitario: r.precio_unitario,
  }))
}

/**
 * Alta del agregado: compra + reemplazo de detalles + UNA op insert, todo
 * en una misma transacción de Dexie.
 */
export async function createCompra(
  businessId: string,
  input: CompraCreateInput,
): Promise<LocalRow<'compras'>> {
  const compraId = uuid()
  const now = nowIso()
  const detalles = buildDetalleRows(businessId, compraId, input.detalles)
  const sumaDetalles = detalles.reduce((acc, d) => acc + d.subtotal, 0)

  const row: LocalRow<'compras'> = {
    id: compraId,
    business_id: businessId,
    fecha: input.fecha ?? now,
    comprador_id: input.comprador_id ?? '',
    comprador_nombre: input.comprador_nombre ?? '',
    subtotal: input.subtotal ?? sumaDetalles,
    total: input.total ?? input.subtotal ?? sumaDetalles,
    metodo_pago: input.metodo_pago ?? 'efectivo',
    estado: input.estado ?? 'completada',
    notas: input.notas ?? null,
    created_at: now,
    updated_at: now,
    sync_rev: 0,
  }

  await db.transaction('rw', [db.compras, db.detalles_compra, db.outbox], async () => {
    await db.compras.put(row)
    await db.detalles_compra.bulkPut(detalles)
    await enqueue({
      businessId,
      entity: 'compras',
      op: 'insert',
      rowId: compraId,
      // Sin columnas generadas/protegidas; `subtotal` jamás va (trampa 9)
      // y `detalles` viaja como clave del agregado.
      payload: { ...buildPayload(input), detalles: detallesPayload(detalles) },
      baseRev: null,
    })
  })
  return row
}

/**
 * Edición del agregado: aplica el patch a la compra local (baseRev de la
 * fila) y, SOLO si el patch trae `detalles`, los reemplaza en bloque.
 * Mismo criterio que el servidor: sin `detalles` en el payload, los
 * detalles actuales se conservan.
 */
export async function updateCompra(
  businessId: string,
  id: string,
  patch: CompraUpdatePatch,
): Promise<LocalRow<'compras'>> {
  // `detalles` no es columna de compras: se separa antes de mezclar.
  const { detalles: patchDetalles, ...compraFields } = patch

  return db.transaction('rw', [db.compras, db.detalles_compra, db.outbox], async (): Promise<
    LocalRow<'compras'>
  > => {
    const row = await db.compras.get(id)
    if (!row) throw new Error(`Compra no encontrada localmente: ${id}`)
    const baseRev = row.sync_rev

    const merged: Record<string, unknown> = { ...row }
    mergeDefined(merged, compraFields)
    merged.updated_at = nowIso()
    const typed = merged as unknown as LocalRow<'compras'>
    await db.compras.put(typed)

    let detalles: Record<string, unknown>[] | undefined
    if (patchDetalles) {
      // Reemplazo en bloque de los detalles locales.
      await db.detalles_compra.filter((d) => d.compra_id === id).delete()
      const rows = buildDetalleRows(businessId, id, patchDetalles)
      await db.detalles_compra.bulkPut(rows)
      detalles = detallesPayload(rows)
    }

    const payload = buildPayload(compraFields)
    if (detalles) payload.detalles = detalles
    if (Object.keys(payload).length > 0) {
      await enqueue({ businessId, entity: 'compras', op: 'update', rowId: id, payload, baseRev })
    }
    return typed
  })
}

/**
 * Borrado en cascada local: compra + sus detalles (los detalles no se
 * tombstonean, §4.2) y UNA op delete de la compra.
 */
export async function removeCompra(businessId: string, id: string): Promise<boolean> {
  return db.transaction('rw', [db.compras, db.detalles_compra, db.outbox], async (): Promise<boolean> => {
    const row = await db.compras.get(id)
    // Cascada local (también limpia detalles huérfanos si los hubiera).
    await db.detalles_compra.filter((d) => d.compra_id === id).delete()
    if (!row) return false
    await db.compras.delete(id)
    await enqueue({ businessId, entity: 'compras', op: 'delete', rowId: id, baseRev: row.sync_rev })
    return true
  })
}

/** Snapshot reactivo del agregado (compras + detalles del negocio). */
export interface ComprasSnapshot {
  /** Compras ordenadas por `fecha` desc (orden espejo del hook original). */
  compras: LocalRow<'compras'>[]
  detalles: DetalleCompraRow[]
}

/**
 * Lectura reactiva del agregado: `undefined` mientras la primera lectura
 * de IndexedDB está en curso (los hooks lo traducen como `loading`).
 */
export function useComprasData(businessId?: string | null): {
  compras: LocalRow<'compras'>[] | undefined
  detalles: DetalleCompraRow[] | undefined
} {
  const data = useLiveQuery(
    async (): Promise<ComprasSnapshot> => {
      if (!businessId) return { compras: [], detalles: [] }
      const compras = await db.compras.where('business_id').equals(businessId).toArray()
      const detalles = await db.detalles_compra.where('business_id').equals(businessId).toArray()
      compras.sort((a, b) => b.fecha.localeCompare(a.fecha))
      return { compras, detalles }
    },
    [businessId],
  )
  return { compras: data?.compras, detalles: data?.detalles }
}
