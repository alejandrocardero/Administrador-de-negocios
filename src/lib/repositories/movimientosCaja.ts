// Repositorio de movimientos de caja (CRUD local-first sobre el store
// espejo). El hook público actual (useMovimientosCaja) solo expone
// lectura, pero el repositorio queda completo para las fases siguientes.

import { createRepository } from './factory'

export const movimientosCajaRepository = createRepository<'movimientos_caja'>({
  entity: 'movimientos_caja',
})
