// Repositorio de compradores (CRUD local-first sobre el store espejo).

import { createRepository } from './factory'

export const compradoresRepository = createRepository<'compradores'>({ entity: 'compradores' })
