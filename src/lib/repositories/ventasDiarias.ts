// Repositorio de ventas diarias.
//
// `total_vendido` es GENERATED en el servidor (monto_efectivo +
// monto_transferencia, 001_initial_schema.sql): se recalcula localmente
// para que la fila optimista sirva para mostrar, pero JAMÁS va en el
// payload (trampa 9, §7; el RPC también la excluye).

import { createRepository } from './factory'

export const ventasDiariasRepository = createRepository<'ventas_diarias'>({
  entity: 'ventas_diarias',
  derive: (row) => {
    row.total_vendido = Number(row.monto_efectivo ?? 0) + Number(row.monto_transferencia ?? 0)
  },
})
