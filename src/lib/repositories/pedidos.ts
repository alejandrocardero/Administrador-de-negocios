// Repositorio de pedidos (CRUD local-first sobre el store espejo).

import { createRepository } from './factory'

export const pedidosRepository = createRepository<'pedidos'>({ entity: 'pedidos' })
