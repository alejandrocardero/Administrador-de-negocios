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
  | { id: 'aprobarProductos', params?: undefined }
  | { id: 'salarios', params?: undefined }
  | { id: 'fiados', params?: undefined }
;

// Multi-tenant types
export interface Business {
  id: string;
  nombre: string;
  slug: string;
  nit?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  regimen: 'simplificado' | 'comun';
  tarifa_iva: number;
  moneda: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  user_id: string | null;
  business_id: string;
  role: UserRole;
  nombre: string;
  username: string;
  password_hash: string | null;
  is_virtual: boolean;
  created_at: string;
}

export type UserRole = 'jefe' | 'vendedor' | 'admin' | 'comprador';

export interface User {
  role: UserRole;
  nombre: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  role: UserRole;
  nombre: string;
  username?: string;
  business_id: string;
  business_nombre: string;
  business_slug: string;
  is_virtual: boolean;
  is_owner: boolean;
  membership_id: string;
}

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
  diferenciaCaja?: number | null;
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
  porcentajeGanancia: number;
  stock: number;
  stockMinimo: number;
  unidad: string;
  fechaRegistro: string;
  activo: boolean;
  /** true si el producto fue creado desde Compras sin existir en el inventario */
  esNuevo?: boolean;
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
  tipo: 'iva' | 'renta' | 'ica' | 'otro' | 'onat' | 'deposito_bancario';
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

export interface SolicitudProductoNuevo {
  id: string;
  fecha: string;
  compradorId: string;
  compradorNombre: string;
  nombreProducto: string;
  precioCompra: number;
  cantidad: number;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  notas?: string;
  precioVenta?: number;
  stockMinimo?: number;
  productoId?: string;
  comentarioAdmin?: string;
}

export interface SalarioFijo {
  id: string;
  rol: UserRole;
  nombre: string;
  montoSemanal: number;
}

export interface Fiado {
  id: string;
  fecha: string; // ISO - cuándo se fió
  clienteNombre: string;
  vendedorId: string;
  vendedorNombre: string;
  monto: number;
  descripcion?: string; // productos que se llevó
  notas?: string;
  estado: 'pendiente' | 'cobrado';
  fechaCobro?: string; // ISO - al cobrar
}

export interface ProductoConRotacion extends Producto {
  totalVendido: number;
  vendidoSemana: number;
  vendidoMes: number;
  gananciaPorUnidad: number;
  gananciaSemanal: number;
  gananciaMensual: number;
  rotacion: number;
  diasDesdeRegistro: number;
}

export interface ProductRotationStats {
  productoId: string;
  productoNombre: string;
  productoCodigo: string;
  totalVendido: number;
  vendidoSemana: number;
  vendidoMes: number;
  precioVenta: number;
  precioCompra: number;
  gananciaPorUnidad: number;
  gananciaSemanal: number;
  gananciaMensual: number;
  rotacion: number;
  diasDesdeRegistro: number;
  fechaRegistro: string;
}
