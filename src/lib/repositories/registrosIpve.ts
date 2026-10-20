// Repositorio de registros IPVE (CRUD local-first sobre el store espejo).

import { createRepository } from './factory'

export const registrosIpveRepository = createRepository<'registros_ipve'>({ entity: 'registros_ipve' })
