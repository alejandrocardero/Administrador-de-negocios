// Repositorio de solicitudes de producto nuevo (CRUD local-first sobre el
// store espejo de solicitudes_producto_nuevo).

import { createRepository } from './factory'

export const solicitudesRepository = createRepository<'solicitudes_producto_nuevo'>({
  entity: 'solicitudes_producto_nuevo',
})
