// Tipos para la aplicación de administración de negocios

export interface ReportFilters {
  fechaInicio?: string;
  fechaFin?: string;
  reporteTipo?: 'general' | 'ventas' | 'compras' | 'gastos' | 'utilidad';
  // ... otros filtros que puedan surgir
}

export type Section = 
  | { id: 'dashboard', params?: undefined } 
  | { id: 'inventario', params?: undefined } 
  | { id: 'ventas', params?: undefined } 
  | { id: 'vendedores', params?: undefined } 
  | { id: 'compradores', params?: undefined } 
  | { id: 'compras', params?: undefined } 
  | { id: 'gastos', params?: undefined } 
  | { id: 'impuestos', params?: undefined } 
  | { id: 'reportes', params?: ReportFilters }
  | { id: 'configuracion', params?: undefined }
  | { id: 'pedidos', params?: undefined }
  | { id: 'alertaStock', params?: undefined }
;

export type CategoriaProducto = 'aseo' | 'comida' | 'bebidas' | 'cerveza' | 'otros';

export interface Vendedor {
  id: string;
  nombre: string;
  activo: boolean;
  fechaRegistro: string;
}

export interface Comprador {
  id: string;
  nombre: string;
  activo: boolean;
  fechaRegistro: string;
}

export interface VentaDiaria {
  id: string;
  fecha: string; // ISO date string YYYY-MM-DD
  vendedorId: string;
  vendedorNombre: string;
  montoEfectivo: number;
  montoTransferencia: number;
  totalVendido: number;
  salarioCalculado: number;
  notas?: string;
}

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaProducto;
  precioCompra: number;
  precioVenta: number;
  stock: number;
  stockMinimo: number;
  unidad: string;
  fechaRegistro: string;
  activo: boolean;
}

export interface DetalleCompra {
  productoId: string;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Compra {
  id: string;
  fecha: string;
  compradorId: string;
  compradorNombre: string;
  detalles: DetalleCompra[];
  subtotal: number;
  total: number;
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia' | 'credito';
  estado: 'completada' | 'pendiente' | 'cancelada';
  notas?: string;
}

export interface Gasto {
  id: string;
  fecha: string;
  concepto: string;
  categoria: 'servicios' | 'nomina' | 'arriendo' | 'impuestos' | 'mantenimiento' | 'otros';
  monto: number;
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia';
  descripcion?: string;
}

export interface Impuesto {
  id: string;
  nombre: string;
  tipo: 'iva' | 'renta' | 'ica' | 'otro';
  periodo: string;
  fechaVencimiento: string;
  monto: number;
  montoPagado: number;
  estado: 'pendiente' | 'pagado' | 'vencido';
  notas?: string;
}

export interface ConfiguracionNegocio {
  nombre: string;
  nit: string;
  direccion: string;
  telefono: string;
  email: string;
  regimen: 'simplificado' | 'comun';
  tarifaIva: number;
  moneda: string;
}

export interface MovimientoCaja {
  id: string;
  fecha: string;
  tipo: 'entrada' | 'salida';
  concepto: string;
  monto: number;
  categoria: string;
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia';
}

export interface RegistroIPVE {
  id: string;
  fecha: string;
  vendedorId: string;
  vendedorNombre: string;
  productoId: string;
  productoNombre: string;
  inicio: number;
  entrada: number;
  final: number;
  precioVenta: number;
  tipo: 'diario' | 'historico';
}

export interface DashboardStats {
  ventasHoy: number;
  ventasMes: number;
  comprasMes: number;
  gastosMes: number;
  utilidadMes: number;
  productosBajoStock: number;
  balanceCaja: number;
}

export interface FiltrosReporte {
  fechaInicio: string;
  fechaFin: string;
  categoria?: string;
  vendedor?: string;
  comprador?: string;
}

export interface Pedido {
  id: string;
  fecha: string;
  vendedorId: string;
  vendedorNombre: string;
  productoId: string;
  productoNombre: string;
  cantidad: number;
  cantidadEntregada?: number;
  estado: 'pendiente' | 'aprobado' | 'entregado' | 'cancelado';
  notas?: string;
}
