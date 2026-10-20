// Hooks local-first (Fase 4 del plan offline-responsive).
//
// ESPEJO EXACTO de la API pública de src/hooks/supabase/useSupabaseData.ts
// (mismas firmas y helpers derivados), pero respaldados por los
// repositorios de IndexedDB (src/lib/repositories): la UI lee y escribe
// SOLO aquí (regla de oro 1, §3). El switchover futuro (fase de
// integración) es cambiar el import en los componentes, nada más.
//
// Diferencias de SEMÁNTICA interna (la API pública es idéntica):
// - `error` es siempre null: aquí no hay red. Las escrituras son locales
//   + encoladas; la cola de sincronización NUNCA se descarta (trampa 12).
// - `loading` solo cubre la primera lectura de IndexedDB (milisegundos);
//   no hay refetch de red.
// - `refetch` es un no-op reactivo: `useLiveQuery` mantiene el dato al día
//   tras cada escritura optimista.
// - `reducirStock` usa el ajuste por delta atómico (`stock_delta` → RPC
//   `ajustar_stock`, regla de oro 4) en lugar de read-modify-write.

import { useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Tables, TablesUpdate } from '@/types/database'
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
  Fiado,
  ProductRotationStats,
  UserRole
} from '@/types'
import {
  toProducto,
  fromProducto,
  toVendedor,
  fromVendedor,
  toComprador,
  fromComprador,
  toVentaDiaria,
  fromVentaDiaria,
  toCompra,
  fromCompra,
  toGasto,
  fromGasto,
  toImpuesto,
  fromImpuesto,
  toMovimientoCaja,
  toRegistroIPVE,
  fromRegistroIPVE,
  toPedido,
  fromPedido,
  toSolicitud,
  fromSolicitud,
  toSalarioFijo,
  fromSalarioFijo,
  toFiado,
  fromFiado
} from '@/lib/mappers'
import type { LocalRow } from '@/lib/db/localDb'
import type { SyncedTableName } from '@/lib/sync/types'
import type { InsertInput, Repository, UpdateInput } from '@/lib/repositories/factory'
import { productosRepository, ajustarStock } from '@/lib/repositories/productos'
import { vendedoresRepository } from '@/lib/repositories/vendedores'
import { compradoresRepository } from '@/lib/repositories/compradores'
import { ventasDiariasRepository } from '@/lib/repositories/ventasDiarias'
import { gastosRepository } from '@/lib/repositories/gastos'
import { impuestosRepository } from '@/lib/repositories/impuestos'
import { movimientosCajaRepository } from '@/lib/repositories/movimientosCaja'
import { registrosIpveRepository } from '@/lib/repositories/registrosIpve'
import { pedidosRepository } from '@/lib/repositories/pedidos'
import { solicitudesRepository } from '@/lib/repositories/solicitudes'
import { salariosRepository } from '@/lib/repositories/salarios'
import { fiadosRepository } from '@/lib/repositories/fiados'
import { configuracionRepository } from '@/lib/repositories/configuracion'
import {
  createCompra,
  updateCompra,
  removeCompra,
  useComprasData
} from '@/lib/repositories/compras'
import type { CompraUpdatePatch, DetalleCompraInput, DetalleCompraRow } from '@/lib/repositories/compras'

export { formatCurrency, formatDate, formatDateTime, generateId, toFechaLocal } from '@/lib/formatters'
import { toFechaLocal } from '@/lib/formatters'

// Misma deduplicación de escrituras en vuelo que useSupabaseData: evita
// duplicados cuando la UI dispara dos veces la misma acción (doble clic).
const inFlight = new Map<string, Promise<unknown>>()

const dedup = <T>(key: string, work: () => Promise<T>): Promise<T> => {
  const hit = inFlight.get(key)
  if (hit) return hit as Promise<T>
  const p = work().finally(() => { inFlight.delete(key) })
  inFlight.set(key, p)
  return p as Promise<T>
}

// ---------------------------------------------
// Capa de dominio: filas del store (snake_case + sync_rev) -> objetos de
// la UI (camelCase), con las escrituras viajando al repositorio.
// ---------------------------------------------

interface DomainReturn<D extends { id: string }> {
  data: D[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  create: (input: Partial<D>) => Promise<D | null>
  update: (id: string, patch: Partial<D>) => Promise<D | null>
  delete: (id: string) => Promise<boolean>
  getById: (id: string) => D | undefined
}

function useMappedRepoData<T extends SyncedTableName, D extends { id: string }>(
  repo: Repository<T>,
  toDomain: (row: LocalRow<T>) => D,
  fromDomain: (input: Partial<D>) => InsertInput<T> & UpdateInput<T>
): DomainReturn<D> {
  const { user } = useAuth()
  const businessId = user?.business_id ?? null
  const rows = repo.useData(businessId)

  // undefined = primera lectura de IndexedDB en curso (no hay red).
  const loading = rows === undefined
  const data = useMemo(() => (rows ?? []).map(toDomain), [rows, toDomain])

  const create = useCallback(async (input: Partial<D>): Promise<D | null> => {
    if (!businessId) throw new Error('No business selected')
    return toDomain(await repo.create(businessId, fromDomain(input)))
  }, [repo, businessId, fromDomain, toDomain])

  const update = useCallback(async (id: string, patch: Partial<D>): Promise<D | null> => {
    if (!businessId) throw new Error('No business selected')
    return toDomain(await repo.update(businessId, id, fromDomain(patch)))
  }, [repo, businessId, fromDomain, toDomain])

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    if (!businessId) throw new Error('No business selected')
    return repo.remove(businessId, id)
  }, [repo, businessId])

  const getById = useCallback((id: string) => data.find(item => item.id === id), [data])

  // Lectura reactiva: no hay nada que volver a pedir a la red.
  const refetch = useCallback(async (): Promise<void> => {}, [])

  return {
    data,
    loading,
    error: null,
    refetch,
    create,
    update,
    delete: deleteItem,
    getById
  }
}

/** Orden por nombre asc (espejo del orderBy de los hooks originales). */
const byNombreAsc = <D extends { nombre: string }>(a: D, b: D): number =>
  a.nombre.localeCompare(b.nombre)

/** Orden por fecha desc (espejo del orderBy de los hooks originales). */
const byFechaDesc = <D extends { fecha: string }>(a: D, b: D): number =>
  new Date(b.fecha).getTime() - new Date(a.fecha).getTime()

// ---------------------------------------------
// PRODUCTOS
// ---------------------------------------------

interface ProductosReturn extends DomainReturn<Producto> {
  productos: Producto[]
  buscarProductos: (query: string) => Producto[]
  getProductosBajoStock: () => Producto[]
  getProductosByCategoria: (categoria: string) => Producto[]
  reducirStock: (id: string, cantidad: number) => void
  todosLosProductos: Producto[]
}

export function useProductos(): ProductosReturn {
  const base = useMappedRepoData(productosRepository, toProducto, fromProducto)
  const { user } = useAuth()
  const businessId = user?.business_id ?? null

  const data = useMemo(() => [...base.data].sort(byNombreAsc), [base.data])

  const buscarProductos = useCallback((query: string) => {
    const q = query.toLowerCase()
    return data.filter(p =>
      p.activo && (
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q)
      )
    )
  }, [data])

  const getProductosBajoStock = useCallback(() =>
    data.filter(p => p.stock <= p.stockMinimo && p.activo),
    [data]
  )

  const getProductosByCategoria = useCallback((categoria: string) =>
    data.filter(p => p.categoria === categoria && p.activo),
    [data]
  )

  // Regla de oro 4 (§3): ajuste por delta atómico (op stock_delta → RPC
  // ajustar_stock), nunca read-modify-write. Fire-and-forget como el
  // original (misma firma void).
  const reducirStock = useCallback((id: string, cantidad: number) => {
    if (!businessId) return
    void ajustarStock(businessId, id, -cantidad).catch((err) =>
      console.error('Error ajustando stock:', err)
    )
  }, [businessId])

  return {
    ...base,
    data,
    productos: data,
    buscarProductos,
    getProductosBajoStock,
    getProductosByCategoria,
    reducirStock,
    todosLosProductos: data
  }
}

// ---------------------------------------------
// VENDEDORES
// ---------------------------------------------

interface VendedoresReturn extends DomainReturn<Vendedor> {
  vendedores: Vendedor[]
  buscarVendedores: (query: string) => Vendedor[]
  getVendedorByNombre: (nombre: string) => Vendedor | undefined
  todosLosVendedores: Vendedor[]
}

export function useVendedores(): VendedoresReturn {
  const base = useMappedRepoData(vendedoresRepository, toVendedor, fromVendedor)

  const data = useMemo(() => [...base.data].sort(byNombreAsc), [base.data])

  const buscarVendedores = useCallback((query: string) => {
    const q = query.toLowerCase()
    return data.filter(v => v.activo && v.nombre.toLowerCase().includes(q))
  }, [data])

  const getVendedorByNombre = useCallback((nombre: string) =>
    data.find(v => v.nombre === nombre),
    [data]
  )

  return {
    ...base,
    data,
    vendedores: data,
    buscarVendedores,
    getVendedorByNombre,
    todosLosVendedores: data
  }
}

// ---------------------------------------------
// COMPRADORES
// ---------------------------------------------

interface CompradoresReturn extends DomainReturn<Comprador> {
  buscarCompradores: (query: string) => Comprador[]
  todosLosCompradores: Comprador[]
}

export function useCompradores(): CompradoresReturn {
  const base = useMappedRepoData(compradoresRepository, toComprador, fromComprador)

  const data = useMemo(() => [...base.data].sort(byNombreAsc), [base.data])

  const buscarCompradores = useCallback((query: string) => {
    const q = query.toLowerCase()
    return data.filter(c => c.activo && c.nombre.toLowerCase().includes(q))
  }, [data])

  return {
    ...base,
    data,
    buscarCompradores,
    todosLosCompradores: data
  }
}

// ---------------------------------------------
// VENTAS DIARIAS
// ---------------------------------------------

interface VentasDiariasReturn extends DomainReturn<VentaDiaria> {
  ventas: VentaDiaria[]
  getVentasByFecha: (inicio: string, fin: string) => VentaDiaria[]
}

export function useVentasDiarias(): VentasDiariasReturn {
  const base = useMappedRepoData(ventasDiariasRepository, toVentaDiaria, fromVentaDiaria)

  const data = useMemo(() => [...base.data].sort(byFechaDesc), [base.data])

  const getVentasByFecha = useCallback((inicio: string, fin: string) => {
    const ini = new Date(inicio)
    ini.setHours(0, 0, 0, 0)
    const f = new Date(fin)
    f.setHours(23, 59, 59, 999)

    return data.filter(v => {
      const fecha = new Date(v.fecha)
      return fecha >= ini && fecha <= f
    })
  }, [data])

  return { ...base, data, ventas: data, getVentasByFecha }
}

// ---------------------------------------------
// GASTOS
// ---------------------------------------------

interface GastosReturn extends DomainReturn<Gasto> {
  getGastosByFecha: (inicio: string, fin: string) => Gasto[]
  getGastosMes: () => Gasto[]
}

export function useGastos(): GastosReturn {
  const base = useMappedRepoData(gastosRepository, toGasto, fromGasto)

  const data = useMemo(() => [...base.data].sort(byFechaDesc), [base.data])

  const getGastosByFecha = useCallback((inicio: string, fin: string) => {
    const ini = new Date(inicio).getTime()
    const f = new Date(fin).getTime()
    return data.filter(g => {
      const fecha = new Date(g.fecha).getTime()
      return fecha >= ini && fecha <= f
    })
  }, [data])

  const getGastosMes = useCallback(() => {
    const ahora = new Date()
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    return data.filter(g => new Date(g.fecha) >= inicioMes)
  }, [data])

  return { ...base, data, getGastosByFecha, getGastosMes }
}

// ---------------------------------------------
// IMPUESTOS
// ---------------------------------------------

interface ImpuestosReturn extends DomainReturn<Impuesto> {
  impuestos: Impuesto[]
  agregarImpuesto: ImpuestosReturn['create']
  actualizarImpuesto: ImpuestosReturn['update']
  getImpuestosPendientes: () => Impuesto[]
  getImpuestosByPeriodo: (periodo: string) => Impuesto[]
}

export function useImpuestos(): ImpuestosReturn {
  const base = useMappedRepoData(impuestosRepository, toImpuesto, fromImpuesto)

  // Orden espejo del original: fecha_vencimiento asc.
  const data = useMemo(
    () => [...base.data].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)),
    [base.data]
  )

  const getImpuestosPendientes = useCallback(() =>
    data.filter(i => i.estado === 'pendiente' || i.estado === 'vencido'),
    [data]
  )

  const getImpuestosByPeriodo = useCallback((periodo: string) =>
    data.filter(i => i.periodo === periodo),
    [data]
  )

  return {
    ...base,
    data,
    impuestos: data,
    agregarImpuesto: base.create,
    actualizarImpuesto: base.update,
    getImpuestosPendientes,
    getImpuestosByPeriodo
  }
}

// ---------------------------------------------
// MOVIMIENTOS DE CAJA (solo lectura, como el hook original)
// ---------------------------------------------

interface MovimientosCajaReturn {
  data: MovimientoCaja[]
  getBalanceCaja: () => number
  getMovimientosByFecha: (inicio: string, fin: string) => MovimientoCaja[]
}

export function useMovimientosCaja(): MovimientosCajaReturn {
  const { user } = useAuth()
  const businessId = user?.business_id ?? null
  const rows = movimientosCajaRepository.useData(businessId)

  const data = useMemo(() => (rows ?? []).map(toMovimientoCaja).sort(byFechaDesc), [rows])

  const getBalanceCaja = useCallback(() =>
    data.reduce((total, m) => m.tipo === 'entrada' ? total + m.monto : total - m.monto, 0),
    [data]
  )

  const getMovimientosByFecha = useCallback((inicio: string, fin: string) => {
    const ini = new Date(inicio).getTime()
    const f = new Date(fin).getTime()
    return data.filter(m => {
      const fecha = new Date(m.fecha).getTime()
      return fecha >= ini && fecha <= f
    })
  }, [data])

  return { data, getBalanceCaja, getMovimientosByFecha }
}

// ---------------------------------------------
// REGISTROS IPVE
// ---------------------------------------------

interface IPVEReturn {
  data: RegistroIPVE[]
  agregarRegistro: (registro: Omit<RegistroIPVE, 'id'>) => Promise<RegistroIPVE | null>
  agregarOActualizarRegistro: (registro: Omit<RegistroIPVE, 'id'>) => Promise<void>
  actualizarRegistro: (id: string, datos: Partial<RegistroIPVE>) => Promise<RegistroIPVE | null>
  getRegistrosByFecha: (fecha: string) => RegistroIPVE[]
  getRegistrosDiariosByFecha: (fecha: string) => RegistroIPVE[]
  getRegistrosByVendedor: (vendedorId: string) => RegistroIPVE[]
  agregarEntrada: (fecha: string, vendedorId: string, productoId: string, productoNombre: string, cantidad: number, precioVenta: number, vendedorNombre?: string) => Promise<void>
  limpiarDiario: () => Promise<void>
}

export function useRegistrosIPVE(): IPVEReturn {
  const base = useMappedRepoData(registrosIpveRepository, toRegistroIPVE, fromRegistroIPVE)

  const data = useMemo(() => [...base.data].sort(byFechaDesc), [base.data])

  const agregarRegistro = base.create

  const agregarOActualizarRegistro = useCallback(async (registro: Omit<RegistroIPVE, 'id'>) => {
    return dedup('registros.upsert:' + registro.fecha + ':' + registro.vendedorId + ':' + registro.productoId + ':' + registro.tipo, async () => {
      const existente = data.find(r =>
        r.fecha === registro.fecha &&
        r.vendedorId === registro.vendedorId &&
        r.productoId === registro.productoId &&
        r.tipo === registro.tipo
      )

      if (existente) {
        await base.update(existente.id, {
          inicio: registro.inicio,
          entrada: registro.entrada,
          final: registro.final,
          precioVenta: registro.precioVenta,
          vendedorNombre: registro.vendedorNombre,
          productoNombre: registro.productoNombre
        })
      } else {
        await base.create(registro)
      }
    })
  }, [base, data])

  const actualizarRegistro = base.update

  const getRegistrosByFecha = useCallback((fecha: string) =>
    data.filter(r => r.fecha === fecha && r.tipo === 'historico'),
    [data]
  )

  const getRegistrosDiariosByFecha = useCallback((fecha: string) =>
    data.filter(r => r.fecha === fecha && r.tipo === 'diario'),
    [data]
  )

  const getRegistrosByVendedor = useCallback((vendedorId: string) =>
    data.filter(r => r.vendedorId === vendedorId),
    [data]
  )

  const agregarEntrada = useCallback(async (
    fecha: string, vendedorId: string, productoId: string,
    productoNombre: string, cantidad: number, precioVenta: number, vendedorNombre?: string
  ) => {
    return dedup('entradas.create:' + fecha + ':' + vendedorId + ':' + productoId, async () => {
      const existente = data.find(r =>
        r.fecha === fecha && r.vendedorId === vendedorId && r.productoId === productoId && r.tipo === 'diario'
      )
      if (existente) {
        await base.update(existente.id, { entrada: existente.entrada + cantidad })
      } else {
        await base.create({ fecha, vendedorId, vendedorNombre: vendedorNombre || '', productoId, productoNombre, inicio: 0, entrada: cantidad, final: 0, precioVenta, tipo: 'diario' })
      }
    })
  }, [base, data])

  const limpiarDiario = useCallback(async () => {
    const diarios = data.filter(r => r.tipo === 'diario')
    for (const r of diarios) {
      await base.delete(r.id)
    }
  }, [base, data])

  return {
    data,
    agregarRegistro,
    agregarOActualizarRegistro,
    actualizarRegistro,
    getRegistrosByFecha,
    getRegistrosDiariosByFecha,
    getRegistrosByVendedor,
    agregarEntrada,
    limpiarDiario
  }
}

// ---------------------------------------------
// ROTACIÓN DE PRODUCTOS
// ---------------------------------------------

interface ProductRotationReturn {
  data: ProductRotationStats[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getTopByRotation: (limit?: number) => ProductRotationStats[];
  getProductRotation: (productoId: string) => ProductRotationStats | undefined;
}

export function useProductRotation(): ProductRotationReturn {
  const { user } = useAuth();
  const businessId = user?.business_id ?? null;

  // Misma lógica que useSupabaseData.ts:604-726, leyendo del store local:
  // registros IPVE históricos + productos activos.
  const ipveRows = registrosIpveRepository.useData(businessId);
  const productoRows = productosRepository.useData(businessId);

  const loading = ipveRows === undefined || productoRows === undefined;

  const data = useMemo<ProductRotationStats[]>(() => {
    const ahora = new Date();
    const haceSemana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const haceMes = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

    const ventasPorProducto = new Map<string, {
      total: number;
      semana: number;
      mes: number;
      precios: number[];
    }>();

    (ipveRows ?? []).forEach(row => {
      if (row.tipo !== 'historico') return
      const pid = row.producto_id;
      const entrada = row.entrada || 0;
      const fecha = new Date(row.fecha);
      const precio = row.precio_venta || 0;

      if (!ventasPorProducto.has(pid)) {
        ventasPorProducto.set(pid, { total: 0, semana: 0, mes: 0, precios: [] });
      }
      const stats = ventasPorProducto.get(pid)!;
      stats.total += entrada;
      stats.precios.push(precio);
      if (fecha >= haceSemana) stats.semana += entrada;
      if (fecha >= haceMes) stats.mes += entrada;
    });

    const enriched: ProductRotationStats[] = (productoRows ?? [])
      .filter(prod => prod.activo)
      .map(prod => {
        const ventas = ventasPorProducto.get(prod.id) || { total: 0, semana: 0, mes: 0, precios: [] };
        const precioVenta = prod.precio_venta;
        const precioCompra = prod.precio_compra;
        const gananciaPorUnidad = precioVenta - precioCompra;
        const fechaRegistro = new Date(prod.fecha_registro);
        const diasDesdeRegistro = Math.max(1, Math.floor((ahora.getTime() - fechaRegistro.getTime()) / (24 * 60 * 60 * 1000)));
        const rotacion = diasDesdeRegistro > 0 ? ventas.total / diasDesdeRegistro : 0;

        return {
          productoId: prod.id,
          productoNombre: prod.nombre,
          productoCodigo: prod.codigo,
          totalVendido: ventas.total,
          vendidoSemana: ventas.semana,
          vendidoMes: ventas.mes,
          precioVenta,
          precioCompra,
          gananciaPorUnidad,
          gananciaSemanal: gananciaPorUnidad * ventas.semana,
          gananciaMensual: gananciaPorUnidad * ventas.mes,
          rotacion,
          diasDesdeRegistro,
          fechaRegistro: prod.fecha_registro,
        };
      });

    enriched.sort((a, b) => b.rotacion - a.rotacion);
    return enriched;
  }, [ipveRows, productoRows]);

  const getTopByRotation = useCallback((limit = 10) => {
    return data.slice(0, limit);
  }, [data]);

  const getProductRotation = useCallback((productoId: string) => {
    return data.find(p => p.productoId === productoId);
  }, [data]);

  const refetch = useCallback(async (): Promise<void> => {}, []);

  return {
    data,
    loading,
    error: null,
    refetch,
    getTopByRotation,
    getProductRotation,
  };
}

// ---------------------------------------------
// PEDIDOS
// ---------------------------------------------

interface PedidosReturn extends DomainReturn<Pedido> {
  pedidos: Pedido[]
  agregarPedido: PedidosReturn['create']
  actualizarPedido: PedidosReturn['update']
  getPedidosPendientes: () => Pedido[]
}

export function usePedidos(): PedidosReturn {
  const base = useMappedRepoData(pedidosRepository, toPedido, fromPedido)

  const data = useMemo(() => [...base.data].sort(byFechaDesc), [base.data])

  const getPedidosPendientes = useCallback(() =>
    data.filter(p => p.estado === 'pendiente'),
    [data]
  )

  const create = useCallback((input: Partial<Pedido>) => dedup('pedidos.create:' + JSON.stringify(input), () => base.create(input)), [base])

  return {
    ...base,
    data,
    create,
    pedidos: data,
    agregarPedido: base.create,
    actualizarPedido: base.update,
    getPedidosPendientes
  }
}

// ---------------------------------------------
// SOLICITUDES DE PRODUCTO NUEVO
// ---------------------------------------------

interface SolicitudesProductoNuevoReturn extends DomainReturn<SolicitudProductoNuevo> {
  aprobarSolicitud: (id: string, precioVenta: number, stockMinimo: number, productoId: string, comentario?: string) => Promise<void>
  rechazarSolicitud: (id: string, comentario?: string) => Promise<void>
  getSolicitudesPendientes: () => SolicitudProductoNuevo[]
}

export function useSolicitudesProductoNuevo(): SolicitudesProductoNuevoReturn {
  const base = useMappedRepoData(solicitudesRepository, toSolicitud, fromSolicitud)

  const data = useMemo(() => [...base.data].sort(byFechaDesc), [base.data])

  const aprobarSolicitud = useCallback(async (id: string, precioVenta: number, stockMinimo: number, productoId: string, comentario?: string) => {
    await base.update(id, { estado: 'aprobada', precioVenta, stockMinimo, productoId, comentarioAdmin: comentario })
  }, [base])

  const rechazarSolicitud = useCallback(async (id: string, comentario?: string) => {
    await base.update(id, { estado: 'rechazada', comentarioAdmin: comentario })
  }, [base])

  const getSolicitudesPendientes = useCallback(() =>
    data.filter(s => s.estado === 'pendiente'),
    [data]
  )

  return { ...base, data, aprobarSolicitud, rechazarSolicitud, getSolicitudesPendientes }
}

// ---------------------------------------------
// SALARIOS FIJOS
// ---------------------------------------------

interface SalariosFijosReturn extends DomainReturn<SalarioFijo> {
  salariosFijos: SalarioFijo[]
  upsertSalario: (rol: UserRole, montoSemanal: number) => Promise<void>
}

export function useSalariosFijos(): SalariosFijosReturn {
  const base = useMappedRepoData(salariosRepository, toSalarioFijo, fromSalarioFijo)

  // El hook original no fija orderBy: se mantiene el orden del repositorio
  // (updated_at desc).

  const upsertSalario = useCallback(async (rol: UserRole, montoSemanal: number) => {
    return dedup('salarios.upsert:' + rol, async () => {
      const existente = base.data.find(s => s.rol === rol)
      if (existente) {
        await base.update(existente.id, { montoSemanal })
      } else {
        const rolesBase = [
          { rol: 'admin' as const, nombre: 'Administrador' },
          { rol: 'comprador' as const, nombre: 'Comprador' },
          { rol: 'vendedor' as const, nombre: 'Vendedor' },
          { rol: 'jefe' as const, nombre: 'Jefe Principal' },
        ]
        await base.create({ rol, nombre: rolesBase.find(r => r.rol === rol)?.nombre || rol, montoSemanal })
      }
    })
  }, [base])

  return { ...base, salariosFijos: base.data, upsertSalario }
}

// ---------------------------------------------
// FIADOS
// ---------------------------------------------

interface FiadosReturn extends DomainReturn<Fiado> {
  fiados: Fiado[]
  getPendientes: () => Fiado[]
  getCobrados: () => Fiado[]
  getPorVendedor: (vendedorId: string) => Fiado[]
  cobrarFiado: (id: string) => Promise<void>
}

export function useFiados(): FiadosReturn {
  const base = useMappedRepoData(fiadosRepository, toFiado, fromFiado)
  const { create: crearVentaDiaria } = useVentasDiarias()

  const data = useMemo(() => [...base.data].sort(byFechaDesc), [base.data])

  const getPendientes = useCallback(() =>
    data.filter(f => f.estado === 'pendiente'),
    [data]
  )

  const getCobrados = useCallback(() =>
    data.filter(f => f.estado === 'cobrado'),
    [data]
  )

  const getPorVendedor = useCallback((vendedorId: string) =>
    data.filter(f => f.vendedorId === vendedorId),
    [data]
  )

  const cobrarFiado = useCallback(async (id: string) => {
    return dedup('fiados.cobrar:' + id, async () => {
      const fiado = data.find(f => f.id === id)
      if (!fiado || fiado.estado === 'cobrado') return

      await base.update(id, { estado: 'cobrado', fechaCobro: new Date().toISOString() })

      const ventaCobro = {
        fecha: toFechaLocal(new Date()),
        vendedorId: fiado.vendedorId,
        vendedorNombre: fiado.vendedorNombre,
        montoEfectivo: fiado.monto,
        montoTransferencia: 0,
        notas: `Cobro fiado - ${fiado.clienteNombre}${fiado.descripcion ? ` (${fiado.descripcion})` : ''}`,
      }
      await crearVentaDiaria(ventaCobro)
    })
  }, [base, crearVentaDiaria, data])

  return { ...base, data, fiados: data, getPendientes, getCobrados, getPorVendedor, cobrarFiado }
}

// ---------------------------------------------
// CONFIGURACIÓN (una fila por negocio, PK business_id)
// ---------------------------------------------

export function useConfiguracion() {
  const { user } = useAuth()
  const businessId = user?.business_id ?? null
  const rows = configuracionRepository.useData(businessId)

  const loading = rows === undefined
  // Mismo tipo que el hook original: la fila cruda snake_case.
  const config: Tables<'configuracion_negocio'> | null = rows && rows.length > 0 ? rows[0] : null

  const updateConfig = useCallback(
    async (data: Partial<TablesUpdate<'configuracion_negocio'>>): Promise<Tables<'configuracion_negocio'>> =>
      dedup('config.upsert:' + JSON.stringify(data), async () => {
        if (!businessId) throw new Error('No business selected')
        // Upsert local-first: update con baseRev si la fila está en el
        // espejo; insert si todavía no existe localmente.
        return await configuracionRepository.upsert(businessId, data)
      }),
    [businessId]
  )

  return { config, loading, updateConfig }
}

// ---------------------------------------------
// COMPRAS: agregado con sus detalles (unidad transaccional, §4.7)
// ---------------------------------------------

/** Detalle de dominio (camelCase) -> input snake_case del agregado. */
const toDetalleInput = (d: DetalleCompra): DetalleCompraInput => ({
  producto_id: d.productoId,
  producto_nombre: d.productoNombre,
  cantidad: d.cantidad,
  precio_unitario: d.precioUnitario,
})

export interface ComprasReturn {
  data: Compra[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  create: (input: Omit<Compra, 'id'>) => Promise<Compra | null>
  update: (id: string, patch: Partial<Compra>) => Promise<Compra | null>
  delete: (id: string) => Promise<boolean>
  getById: (id: string) => Compra | undefined
  getComprasByFecha: (inicio: string, fin: string) => Compra[]
  getComprasMes: () => Compra[]
}

export function useCompras(): ComprasReturn {
  const { user } = useAuth()
  const businessId = user?.business_id ?? null
  const { compras, detalles } = useComprasData(businessId)

  const loading = compras === undefined || detalles === undefined

  const data = useMemo<Compra[]>(() => {
    // Une los detalles a su compra (el agregado vive en dos stores).
    const porCompra = new Map<string, DetalleCompraRow[]>()
    for (const d of detalles ?? []) {
      const lista = porCompra.get(d.compra_id)
      if (lista) lista.push(d)
      else porCompra.set(d.compra_id, [d])
    }
    return (compras ?? []).map(c => toCompra(c, porCompra.get(c.id) ?? []))
  }, [compras, detalles])

  const create = useCallback(async (input: Omit<Compra, 'id'>): Promise<Compra | null> => {
    return dedup('compras.create:' + JSON.stringify(input), async () => {
      if (!businessId) throw new Error('No business selected')
      // UNA sola op del agregado: la compra lleva `detalles` en el payload.
      const row = await createCompra(businessId, {
        ...fromCompra(input),
        detalles: input.detalles.map(toDetalleInput),
      })
      return toCompra(row)
    })
  }, [businessId])

  const update = useCallback(async (id: string, patch: Partial<Compra>): Promise<Compra | null> => {
    if (!businessId) throw new Error('No business selected')
    const compraPatch: CompraUpdatePatch = { ...fromCompra(patch) }
    // Los detalles solo se reemplazan si el patch los trae (mismo criterio
    // del servidor).
    if (patch.detalles) compraPatch.detalles = patch.detalles.map(toDetalleInput)
    const row = await updateCompra(businessId, id, compraPatch)
    return toCompra(row)
  }, [businessId])

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    if (!businessId) throw new Error('No business selected')
    return removeCompra(businessId, id)
  }, [businessId])

  const getById = useCallback((id: string) => data.find(item => item.id === id), [data])

  const refetch = useCallback(async (): Promise<void> => {}, [])

  const getComprasByFecha = useCallback((inicio: string, fin: string) => {
    const ini = new Date(inicio).getTime()
    const f = new Date(fin).getTime()
    return data.filter(c => {
      const fecha = new Date(c.fecha).getTime()
      return fecha >= ini && fecha <= f && c.estado === 'completada'
    })
  }, [data])

  const getComprasMes = useCallback(() => {
    const ahora = new Date()
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    return data.filter(c => new Date(c.fecha) >= inicioMes && c.estado === 'completada')
  }, [data])

  return { data, loading, error: null, refetch, create, update, delete: deleteItem, getById, getComprasByFecha, getComprasMes }
}
