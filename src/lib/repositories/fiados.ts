// Repositorio de fiados (CRUD local-first sobre el store espejo).

import { createRepository } from './factory'

export const fiadosRepository = createRepository<'fiados'>({ entity: 'fiados' })
