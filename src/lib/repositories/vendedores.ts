// Repositorio de vendedores (CRUD local-first sobre el store espejo).

import { createRepository } from './factory'

export const vendedoresRepository = createRepository<'vendedores'>({ entity: 'vendedores' })
