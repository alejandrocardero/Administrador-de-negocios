// Repositorio de impuestos (CRUD local-first sobre el store espejo).

import { createRepository } from './factory'

export const impuestosRepository = createRepository<'impuestos'>({ entity: 'impuestos' })
