import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import type {
  Producto,
  Vendedor,
  Comprador,
  VentaDiaria,
  Compra,
  DetalleCompra,
  Gasto,
  Impuesto,
  MovimientoCaja,
  RegistroIPVE,
  Pedido,
  SolicitudProductoNuevo,
  SalarioFijo,
  Fiado
} from '@/types'

type OmitMeta<T> = Omit<T, 'business_id' | 'created_at' | 'updated_at'>

const stripUndefined = <T extends object>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T

// ---------------------------------------------
// PRODUCTOS
// ---------------------------------------------
export function toProducto(r: Tables<'productos'>): Producto {
  return {
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    descripcion: r.descripcion ?? '',
    categoria: r.categoria,
    precioCompra: r.precio_compra,
    precioVenta: r.precio_venta,
    porcentajeGanancia: r.porcentaje_ganancia,
    stock: r.stock,
    stockMinimo: r.stock_minimo,
    unidad: r.unidad,
    fechaRegistro: r.fecha_registro,
    activo: r.activo
  }
}

export function fromProducto(p: Partial<Producto>): OmitMeta<TablesInsert<'productos'>> {
  return stripUndefined({
    codigo: p.codigo,
    nombre: p.nombre,
    descripcion: p.descripcion,
    categoria: p.categoria,
    precio_compra: p.precioCompra,
    precio_venta: p.precioVenta,
    porcentaje_ganancia: p.porcentajeGanancia,
    stock: p.stock,
    stock_minimo: p.stockMinimo,
    unidad: p.unidad,
    fecha_registro: p.fechaRegistro,
    activo: p.activo
  }) as OmitMeta<TablesInsert<'productos'>>
}

// ---------------------------------------------
// VENDEDORES / COMPRADORES
// ---------------------------------------------
export function toVendedor(r: Tables<'vendedores'>): Vendedor {
  return { id: r.id, nombre: r.nombre, activo: r.activo, fechaRegistro: r.fecha_registro }
}

export function fromVendedor(v: Partial<Vendedor>): OmitMeta<TablesInsert<'vendedores'>> {
  return stripUndefined({
    nombre: v.nombre,
    activo: v.activo,
    fecha_registro: v.fechaRegistro
  }) as OmitMeta<TablesInsert<'vendedores'>>
}

export function toComprador(r: Tables<'compradores'>): Comprador {
  return { id: r.id, nombre: r.nombre, activo: r.activo, fechaRegistro: r.fecha_registro }
}

export function fromComprador(c: Partial<Comprador>): OmitMeta<TablesInsert<'compradores'>> {
  return stripUndefined({
    nombre: c.nombre,
    activo: c.activo,
    fecha_registro: c.fechaRegistro
  }) as OmitMeta<TablesInsert<'compradores'>>
}

// ---------------------------------------------
// VENTAS DIARIAS
// ---------------------------------------------
export function toVentaDiaria(r: Tables<'ventas_diarias'>): VentaDiaria {
  return {
    id: r.id,
    fecha: r.fecha,
    vendedorId: r.vendedor_id,
    vendedorNombre: r.vendedor_nombre,
    montoEfectivo: r.monto_efectivo,
    montoTransferencia: r.monto_transferencia,
    totalVendido: r.total_vendido,
    salarioCalculado: r.salario_calculado,
    diferenciaCaja: r.diferencia_caja ?? null,
    notas: r.notas ?? undefined
  }
}

export function fromVentaDiaria(v: Partial<VentaDiaria>): OmitMeta<TablesInsert<'ventas_diarias'>> {
  return stripUndefined({
    fecha: v.fecha,
    vendedor_id: v.vendedorId,
    vendedor_nombre: v.vendedorNombre,
    monto_efectivo: v.montoEfectivo,
    monto_transferencia: v.montoTransferencia,
    // total_vendido es GENERATED en el servidor (001:131): nunca se envía
    salario_calculado: v.salarioCalculado,
    diferencia_caja: v.diferenciaCaja,
    notas: v.notas
  }) as OmitMeta<TablesInsert<'ventas_diarias'>>
}

// ---------------------------------------------
// COMPRAS + DETALLES
// ---------------------------------------------
export function toDetalleCompra(r: Tables<'detalles_compra'>): DetalleCompra {
  return {
    productoId: r.producto_id,
    productoNombre: r.producto_nombre,
    cantidad: r.cantidad,
    precioUnitario: r.precio_unitario,
    subtotal: r.subtotal
  }
}

export function fromDetalleCompra(
  d: DetalleCompra,
  compraId: string
): Omit<TablesInsert<'detalles_compra'>, 'subtotal'> {
  // subtotal es columna GENERADA (cantidad * precio_unitario): no se envía
  return {
    compra_id: compraId,
    producto_id: d.productoId,
    producto_nombre: d.productoNombre,
    cantidad: d.cantidad,
    precio_unitario: d.precioUnitario
  }
}

export function toCompra(
  r: Tables<'compras'>,
  detalles: Tables<'detalles_compra'>[] = []
): Compra {
  return {
    id: r.id,
    fecha: r.fecha,
    compradorId: r.comprador_id,
    compradorNombre: r.comprador_nombre,
    detalles: detalles.map(toDetalleCompra),
    subtotal: r.subtotal,
    total: r.total,
    metodoPago: r.metodo_pago,
    estado: r.estado,
    notas: r.notas ?? undefined
  }
}

export function fromCompra(c: Omit<Partial<Compra>, 'id' | 'detalles'>): OmitMeta<TablesInsert<'compras'>> {
  return stripUndefined({
    fecha: c.fecha,
    comprador_id: c.compradorId,
    comprador_nombre: c.compradorNombre,
    subtotal: c.subtotal,
    total: c.total,
    metodo_pago: c.metodoPago,
    estado: c.estado,
    notas: c.notas
  }) as OmitMeta<TablesInsert<'compras'>>
}

// ---------------------------------------------
// GASTOS
// ---------------------------------------------
export function toGasto(r: Tables<'gastos'>): Gasto {
  return {
    id: r.id,
    fecha: r.fecha,
    concepto: r.concepto,
    categoria: r.categoria,
    monto: r.monto,
    metodoPago: r.metodo_pago,
    descripcion: r.descripcion ?? undefined
  }
}

export function fromGasto(g: Partial<Gasto>): OmitMeta<TablesInsert<'gastos'>> {
  return stripUndefined({
    fecha: g.fecha,
    concepto: g.concepto,
    categoria: g.categoria,
    monto: g.monto,
    metodo_pago: g.metodoPago,
    descripcion: g.descripcion
  }) as OmitMeta<TablesInsert<'gastos'>>
}

// ---------------------------------------------
// IMPUESTOS
// ---------------------------------------------
export function toImpuesto(r: Tables<'impuestos'>): Impuesto {
  return {
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    periodo: r.periodo,
    fechaVencimiento: r.fecha_vencimiento,
    monto: r.monto,
    montoPagado: r.monto_pagado,
    estado: r.estado,
    notas: r.notas ?? undefined
  }
}

export function fromImpuesto(i: Partial<Impuesto>): OmitMeta<TablesInsert<'impuestos'>> {
  return stripUndefined({
    nombre: i.nombre,
    tipo: i.tipo,
    periodo: i.periodo,
    fecha_vencimiento: i.fechaVencimiento,
    monto: i.monto,
    monto_pagado: i.montoPagado,
    estado: i.estado,
    notas: i.notas
  }) as OmitMeta<TablesInsert<'impuestos'>>
}

// ---------------------------------------------
// MOVIMIENTOS DE CAJA
// ---------------------------------------------
export function toMovimientoCaja(r: Tables<'movimientos_caja'>): MovimientoCaja {
  return {
    id: r.id,
    fecha: r.fecha,
    tipo: r.tipo,
    concepto: r.concepto,
    monto: r.monto,
    categoria: r.categoria,
    metodoPago: r.metodo_pago
  }
}

// ---------------------------------------------
// REGISTROS IPVE
// ---------------------------------------------
export function toRegistroIPVE(r: Tables<'registros_ipve'>): RegistroIPVE {
  return {
    id: r.id,
    fecha: r.fecha,
    vendedorId: r.vendedor_id,
    vendedorNombre: r.vendedor_nombre,
    productoId: r.producto_id,
    productoNombre: r.producto_nombre,
    inicio: r.inicio,
    entrada: r.entrada,
    final: r.final,
    precioVenta: r.precio_venta,
    tipo: r.tipo
  }
}

export function fromRegistroIPVE(input: Partial<RegistroIPVE>): OmitMeta<TablesInsert<'registros_ipve'>> {
  return stripUndefined({
    fecha: input.fecha,
    vendedor_id: input.vendedorId,
    vendedor_nombre: input.vendedorNombre,
    producto_id: input.productoId,
    producto_nombre: input.productoNombre,
    inicio: input.inicio,
    entrada: input.entrada,
    final: input.final,
    precio_venta: input.precioVenta,
    tipo: input.tipo
  }) as OmitMeta<TablesInsert<'registros_ipve'>>
}

export function fromSolicitud(input: Partial<SolicitudProductoNuevo>): OmitMeta<TablesInsert<'solicitudes_producto_nuevo'>> {
  return stripUndefined({
    fecha: input.fecha,
    comprador_id: input.compradorId,
    comprador_nombre: input.compradorNombre,
    nombre_producto: input.nombreProducto,
    precio_compra: input.precioCompra,
    cantidad: input.cantidad,
    estado: input.estado,
    notas: input.notas,
    precio_venta: input.precioVenta,
    stock_minimo: input.stockMinimo,
    producto_id: input.productoId,
    comentario_admin: input.comentarioAdmin
  }) as OmitMeta<TablesInsert<'solicitudes_producto_nuevo'>>
}

// ---------------------------------------------
// PEDIDOS
// ---------------------------------------------
export function toPedido(r: Tables<'pedidos'>): Pedido {
  return {
    id: r.id,
    fecha: r.fecha,
    vendedorId: r.vendedor_id,
    vendedorNombre: r.vendedor_nombre,
    productoId: r.producto_id,
    productoNombre: r.producto_nombre,
    cantidad: r.cantidad,
    cantidadEntregada: r.cantidad_entregada ?? undefined,
    estado: r.estado,
    notas: r.notas ?? undefined
  }
}

export function fromPedido(p: Partial<Pedido>): OmitMeta<TablesInsert<'pedidos'>> {
  return stripUndefined({
    fecha: p.fecha,
    vendedor_id: p.vendedorId,
    vendedor_nombre: p.vendedorNombre,
    producto_id: p.productoId,
    producto_nombre: p.productoNombre,
    cantidad: p.cantidad,
    cantidad_entregada: p.cantidadEntregada,
    estado: p.estado,
    notas: p.notas
  }) as OmitMeta<TablesInsert<'pedidos'>>
}

// ---------------------------------------------
// SOLICITUDES DE PRODUCTO NUEVO
// ---------------------------------------------
export function toSolicitud(r: Tables<'solicitudes_producto_nuevo'>): SolicitudProductoNuevo {
  return {
    id: r.id,
    fecha: r.fecha,
    compradorId: r.comprador_id,
    compradorNombre: r.comprador_nombre,
    nombreProducto: r.nombre_producto,
    precioCompra: r.precio_compra,
    cantidad: r.cantidad,
    estado: r.estado,
    notas: r.notas ?? undefined,
    precioVenta: r.precio_venta ?? undefined,
    stockMinimo: r.stock_minimo ?? undefined,
    productoId: r.producto_id ?? undefined,
    comentarioAdmin: r.comentario_admin ?? undefined
  }
}

// ---------------------------------------------
// SALARIOS FIJOS
// ---------------------------------------------
export function toSalarioFijo(r: Tables<'salarios_fijos'>): SalarioFijo {
  return { id: r.id, rol: r.rol, nombre: r.nombre, montoSemanal: r.monto_semanal }
}

export function fromSalarioFijo(
  s: Partial<SalarioFijo> & { business_id?: string }
): Omit<TablesInsert<'salarios_fijos'>, 'business_id' | 'created_at' | 'updated_at'> {
  return stripUndefined({
    rol: s.rol,
    nombre: s.nombre,
    monto_semanal: s.montoSemanal
  }) as Omit<TablesInsert<'salarios_fijos'>, 'business_id' | 'created_at' | 'updated_at'>
}

// ---------------------------------------------
// FIADOS
// ---------------------------------------------
export function toFiado(r: Tables<'fiados'>): Fiado {
  return {
    id: r.id,
    fecha: r.fecha,
    clienteNombre: r.cliente_nombre,
    vendedorId: r.vendedor_id,
    vendedorNombre: r.vendedor_nombre,
    monto: r.monto,
    descripcion: r.descripcion ?? undefined,
    notas: r.notas ?? undefined,
    estado: r.estado,
    fechaCobro: r.fecha_cobro ?? undefined
  }
}

export function fromFiado(f: Partial<Fiado>): OmitMeta<TablesInsert<'fiados'>> {
  return stripUndefined({
    fecha: f.fecha,
    cliente_nombre: f.clienteNombre,
    vendedor_id: f.vendedorId,
    vendedor_nombre: f.vendedorNombre,
    monto: f.monto,
    descripcion: f.descripcion,
    notas: f.notas,
    estado: f.estado,
    fecha_cobro: f.fechaCobro
  }) as OmitMeta<TablesInsert<'fiados'>>
}

export type { TablesUpdate }
