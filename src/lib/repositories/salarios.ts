// Repositorio de salarios fijos (CRUD local-first sobre el store espejo).

import { createRepository } from './factory'

export const salariosRepository = createRepository<'salarios_fijos'>({ entity: 'salarios_fijos' })
