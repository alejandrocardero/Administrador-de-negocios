// Repositorio de configuración del negocio.
//
// Caso especial (trampa 10, §7): la PK del servidor es `business_id` (la
// fila NO tiene `id`), así que el `rowId` del outbox es el business_id y
// el insert no genera uuid. El hook original (useConfiguracion) hace
// upsert: aquí se decide LOCALMENTE update vs insert (el servidor nunca
// hace upsert ciego — reglas 3/4 de apply_mutation).

import type { LocalRow } from '@/lib/db/localDb'
import { createRepository, getStore } from './factory'
import type { InsertInput, Repository, UpdateInput } from './factory'

const base = createRepository<'configuracion_negocio'>({
  entity: 'configuracion_negocio',
  // PK del servidor = business_id: la fila no tiene `id`.
  primaryKey: 'business_id',
})

/** Repositorio de configuración: CRUD genérico + upsert local. */
export interface ConfiguracionRepository extends Repository<'configuracion_negocio'> {
  /**
   * Upsert local-first: si la fila ya está en el espejo → update con
   * `baseRev` de la fila; si no existe → insert (baseRev null). Si el
   * servidor ya tenía una fila nunca pull-eada, el insert resultará en un
   * conflicto insert_insert conservando AMBAS versiones (regla 3, §3).
   */
  upsert(
    businessId: string,
    patch: UpdateInput<'configuracion_negocio'>,
  ): Promise<LocalRow<'configuracion_negocio'>>
}

export const configuracionRepository: ConfiguracionRepository = {
  ...base,
  upsert: async (
    businessId: string,
    patch: UpdateInput<'configuracion_negocio'>,
  ): Promise<LocalRow<'configuracion_negocio'>> => {
    const existing = await getStore('configuracion_negocio').get(businessId)
    if (existing) {
      // rowId del outbox = businessId (PK sin `id`, trampa 10, §7).
      return base.update(businessId, businessId, patch)
    }
    return base.create(businessId, patch as InsertInput<'configuracion_negocio'>)
  },
}
