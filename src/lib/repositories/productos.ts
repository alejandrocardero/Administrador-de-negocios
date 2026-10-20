// Repositorio de productos. Además del CRUD genérico expone el ajuste de
// stock con delta (regla de oro 4, §3): NUNCA read-modify-write.

import { db } from '@/lib/db/localDb'
import { enqueue } from '@/lib/db/outbox'
import { createRepository, getStore, nowIso } from './factory'

/** CRUD local-first sobre el store espejo de productos. */
export const productosRepository = createRepository<'productos'>({ entity: 'productos' })

/**
 * Ajuste de stock por delta: aplica el valor optimista local
 * (`max(0, stock + delta)`) y encola la op `stock_delta`, que el motor de
 * push (Fase 5) traduce al RPC atómico `ajustar_stock`. `baseRev` es null:
 * el servidor hace el incremento atómico e idempotente por `mutation_id`
 * (§4.3), sin comparar revisiones.
 */
export async function ajustarStock(
  businessId: string,
  productoId: string,
  delta: number,
): Promise<void> {
  const store = getStore('productos')
  await db.transaction('rw', [store, db.outbox], async () => {
    const row = await store.get(productoId)
    if (!row) throw new Error(`Producto no encontrado localmente: ${productoId}`)
    // Valor provisional optimista; el definitivo lo fija el servidor.
    const stock = Math.max(0, row.stock + delta)
    await store.put({ ...row, stock, updated_at: nowIso() })
    await enqueue({
      businessId,
      entity: 'productos',
      op: 'stock_delta',
      rowId: productoId,
      payload: { delta },
      baseRev: null,
    })
  })
}
