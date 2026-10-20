// Repositorio de gastos (CRUD local-first sobre el store espejo).

import { createRepository } from './factory'

export const gastosRepository = createRepository<'gastos'>({ entity: 'gastos' })
