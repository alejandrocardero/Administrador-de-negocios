import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/types/database'
import type {
  Producto,
  Vendedor,
  Comprador,
  VentaDiaria,
  Compra,
  Gasto,
  Impuesto,
  MovimientoCaja,
  RegistroIPVE,
  Pedido,
  SolicitudProductoNuevo,
  SalarioFijo,
  Fiado,
  ProductRotationStats
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
  fromDetalleCompra,
  toGasto,
  fromGasto,
  toImpuesto,
  fromImpuesto,
  toMovimientoCaja,
  toRegistroIPVE,
  toPedido,
  fromPedido,
  toSolicitud,
  toSalarioFijo,
  fromSalarioFijo,
  toFiado,
  fromFiado
} from '@/lib/mappers'

export { formatCurrency, formatDate, formatDateTime, generateId } from '@/lib/formatters'

type TableName = keyof Database['public']['Tables']

const inFlight = new Map<string, Promise<unknown>>()

const dedup = <T,>(key: string, work: () => Promise<T>): Promise<T> => {
  const hit = inFlight.get(key)
  if (hit) return hit as Promise<T>
  const p = work().finally(() => { inFlight.delete(key) })
  inFlight.set(key, p)
  return p as Promise<T>
}

interface UseSupabaseDataOptions {
  table: TableName
  select?: string
  orderBy?: { column: string; ascending?: boolean }
  filter?: (query: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
  enabled?: boolean
}

interface UseSupabaseDataReturn<T> {
  data: T[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  create: (data: Omit<TablesInsert<TableName>, 'business_id' | 'created_at' | 'updated_at'>) => Promise<T | null>
  update: (id: string, data: Partial<TablesUpdate<TableName>>) => Promise<T | null>
  delete: (id: string) => Promise<boolean>
  getById: (id: string) => T | undefined
}

export function useSupabaseData<T extends { business_id: string; id: string }>(
  options: UseSupabaseDataOptions
): UseSupabaseDataReturn<T> {
  const { table, select = '*', orderBy, filter, enabled = true } = options
  const { user } = useAuth()
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const businessId = user?.business_id

  const filterRef = useRef(filter)
  const orderByRef = useRef(orderBy)

  useEffect(() => {
    filterRef.current = filter
    orderByRef.current = orderBy
  })

  const buildQuery = useCallback(() => {
    let query = supabase.from(table).select(select)
    if (businessId && table !== 'detalles_compra' && table !== 'businesses') {
      query = query.eq('business_id' as never, businessId)
    }
    if (filterRef.current) {
      query = filterRef.current(query)
    }
    const orderByOption = orderByRef.current
    if (orderByOption) {
      query = query.order(orderByOption.column, { ascending: orderByOption.ascending ?? true })
    }
    return query
  }, [table, select, businessId])

  const fetchData = useCallback(async () => {
    if (!enabled || !businessId) {
      setData([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const query = buildQuery()
      const { data: result, error: queryError } = await query

      if (queryError) throw queryError
      setData((result as unknown as T[]) || [])
    } catch (err) {
      setError(err as Error)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [buildQuery, enabled, businessId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const create = useCallback(async (newData: Omit<TablesInsert<TableName>, 'business_id' | 'created_at' | 'updated_at'>) => {
    return dedup('create', async () => {
      if (!businessId) throw new Error('No business selected')

      const insertData = {
        ...newData,
        business_id: businessId
      } as TablesInsert<TableName>

      const { data: result, error } = await supabase
        .from(table)
        .insert(insertData as never)
        .select()
        .single()

      if (error) throw error

      setData(prev => [...prev, result as unknown as T])
      return result as unknown as T
    })
  }, [table, businessId])

  const update = useCallback(async (id: string, updateData: Partial<TablesUpdate<TableName>>) => {
    if (!businessId) throw new Error('No business selected')

    const { data: result, error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id' as never, id)
      .eq('business_id' as never, businessId)
      .select()
      .single()

    if (error) throw error

    setData(prev => prev.map(item => item.id === id ? { ...item, ...result } as T : item))
    return result as unknown as T
  }, [table, businessId])

  const deleteItem = useCallback(async (id: string) => {
    if (!businessId) throw new Error('No business selected')

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id' as never, id)
      .eq('business_id' as never, businessId)

    if (error) throw error

    setData(prev => prev.filter(item => item.id !== id))
    return true
  }, [table, businessId])

  const getById = useCallback((id: string) => {
    return data.find(item => item.id === id)
  }, [data])

  const refetch = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  return useMemo(() => ({
    data,
    loading,
    error,
    refetch,
    create,
    update,
    delete: deleteItem,
    getById
  }), [data, loading, error, create, update, deleteItem, getById, refetch])
}

// ---------------------------------------------
// Capa de dominio: filas (snake_case) -> objetos de la UI (camelCase)
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

function useMappedData<T extends { business_id: string; id: string }, D extends { id: string }>(
  options: UseSupabaseDataOptions,
  toDomain: (row: T) => D,
  fromDomain: (input: Partial<D>) => Omit<TablesInsert<TableName>, 'business_id' | 'created_at' | 'updated_at'>
): DomainReturn<D> {
  const raw = useSupabaseData<T>(options)
  const { create: rawCreate, update: rawUpdate, delete: rawDelete } = raw

  const data = useMemo(() => raw.data.map(toDomain), [raw.data, toDomain])

  const create = useCallback(async (input: Partial<D>) => {
    const row = await rawCreate(fromDomain(input))
    return row ? toDomain(row) : null
  }, [rawCreate, fromDomain, toDomain])

  const update = useCallback(async (id: string, patch: Partial<D>) => {
    const row = await rawUpdate(id, fromDomain(patch))
    return row ? toDomain(row) : null
  }, [rawUpdate, fromDomain, toDomain])

  const getById = useCallback((id: string) => data.find(item => item.id === id), [data])

  return {
    data,
    loading: raw.loading,
    error: raw.error,
    refetch: raw.refetch,
    create,
    update,
    delete: rawDelete,
    getById
  }
}

interface ProductosReturn extends DomainReturn<Producto> {
  productos: Producto[]
  buscarProductos: (query: string) => Producto[]
  getProductosBajoStock: () => Producto[]
  getProductosByCategoria: (categoria: string) => Producto[]
  reducirStock: (id: string, cantidad: number) => void
  todosLosProductos: Producto[]
}

export function useProductos(): ProductosReturn {
  const base = useMappedData<Tables<'productos'>, Producto>(
    { table: 'productos', orderBy: { column: 'nombre', ascending: true } },
    toProducto,
    fromProducto
  )

  const buscarProductos = useCallback((query: string) => {
    const q = query.toLowerCase()
    return base.data.filter(p =>
      p.activo && (
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q)
      )
    )
  }, [base.data])

  const getProductosBajoStock = useCallback(() =>
    base.data.filter(p => p.stock <= p.stockMinimo && p.activo),
    [base.data]
  )

  const getProductosByCategoria = useCallback((categoria: string) =>
    base.data.filter(p => p.categoria === categoria && p.activo),
    [base.data]
  )

  const reducirStock = useCallback((id: string, cantidad: number) => {
    base.update(id, { stock: Math.max(0, (base.getById(id)?.stock ?? 0) - cantidad) })
  }, [base])

  return {
    ...base,
    productos: base.data,
    buscarProductos,
    getProductosBajoStock,
    getProductosByCategoria,
    reducirStock,
    todosLosProductos: base.data
  }
}

interface VendedoresReturn extends DomainReturn<Vendedor> {
  vendedores: Vendedor[]
  buscarVendedores: (query: string) => Vendedor[]
  getVendedorByNombre: (nombre: string) => Vendedor | undefined
  todosLosVendedores: Vendedor[]
}

export function useVendedores(): VendedoresReturn {
  const base = useMappedData<Tables<'vendedores'>, Vendedor>(
    { table: 'vendedores', orderBy: { column: 'nombre', ascending: true } },
    toVendedor,
    fromVendedor
  )

  const buscarVendedores = useCallback((query: string) => {
    const q = query.toLowerCase()
    return base.data.filter(v => v.activo && v.nombre.toLowerCase().includes(q))
  }, [base.data])

  const getVendedorByNombre = useCallback((nombre: string) =>
    base.data.find(v => v.nombre === nombre),
    [base.data]
  )

  return {
    ...base,
    vendedores: base.data,
    buscarVendedores,
    getVendedorByNombre,
    todosLosVendedores: base.data
  }
}

interface CompradoresReturn extends DomainReturn<Comprador> {
  buscarCompradores: (query: string) => Comprador[]
  todosLosCompradores: Comprador[]
}

export function useCompradores(): CompradoresReturn {
  const base = useMappedData<Tables<'compradores'>, Comprador>(
    { table: 'compradores', orderBy: { column: 'nombre', ascending: true } },
    toComprador,
    fromComprador
  )

  const buscarCompradores = useCallback((query: string) => {
    const q = query.toLowerCase()
    return base.data.filter(c => c.activo && c.nombre.toLowerCase().includes(q))
  }, [base.data])

  return {
    ...base,
    buscarCompradores,
    todosLosCompradores: base.data
  }
}

interface VentasDiariasReturn extends DomainReturn<VentaDiaria> {
  ventas: VentaDiaria[]
  getVentasByFecha: (inicio: string, fin: string) => VentaDiaria[]
}

export function useVentasDiarias(): VentasDiariasReturn {
  const base = useMappedData<Tables<'ventas_diarias'>, VentaDiaria>(
    { table: 'ventas_diarias', orderBy: { column: 'fecha', ascending: false } },
    toVentaDiaria,
    fromVentaDiaria
  )

  const getVentasByFecha = useCallback((inicio: string, fin: string) => {
    const ini = new Date(inicio)
    ini.setHours(0, 0, 0, 0)
    const f = new Date(fin)
    f.setHours(23, 59, 59, 999)

    return base.data.filter(v => {
      const fecha = new Date(v.fecha)
      return fecha >= ini && fecha <= f
    })
  }, [base.data])

  return { ...base, ventas: base.data, getVentasByFecha }
}

interface GastosReturn extends DomainReturn<Gasto> {
  getGastosByFecha: (inicio: string, fin: string) => Gasto[]
  getGastosMes: () => Gasto[]
}

export function useGastos(): GastosReturn {
  const base = useMappedData<Tables<'gastos'>, Gasto>(
    { table: 'gastos', orderBy: { column: 'fecha', ascending: false } },
    toGasto,
    fromGasto
  )

  const getGastosByFecha = useCallback((inicio: string, fin: string) => {
    const ini = new Date(inicio).getTime()
    const f = new Date(fin).getTime()
    return base.data.filter(g => {
      const fecha = new Date(g.fecha).getTime()
      return fecha >= ini && fecha <= f
    })
  }, [base.data])

  const getGastosMes = useCallback(() => {
    const ahora = new Date()
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    return base.data.filter(g => new Date(g.fecha) >= inicioMes)
  }, [base.data])

  return { ...base, getGastosByFecha, getGastosMes }
}

interface ImpuestosReturn extends DomainReturn<Impuesto> {
  impuestos: Impuesto[]
  agregarImpuesto: ImpuestosReturn['create']
  actualizarImpuesto: ImpuestosReturn['update']
  getImpuestosPendientes: () => Impuesto[]
  getImpuestosByPeriodo: (periodo: string) => Impuesto[]
}

export function useImpuestos(): ImpuestosReturn {
  const base = useMappedData<Tables<'impuestos'>, Impuesto>(
    { table: 'impuestos', orderBy: { column: 'fecha_vencimiento', ascending: true } },
    toImpuesto,
    fromImpuesto
  )

  const getImpuestosPendientes = useCallback(() =>
    base.data.filter(i => i.estado === 'pendiente' || i.estado === 'vencido'),
    [base.data]
  )

  const getImpuestosByPeriodo = useCallback((periodo: string) =>
    base.data.filter(i => i.periodo === periodo),
    [base.data]
  )

  return {
    ...base,
    impuestos: base.data,
    agregarImpuesto: base.create,
    actualizarImpuesto: base.update,
    getImpuestosPendientes,
    getImpuestosByPeriodo
  }
}

interface MovimientosCajaReturn {
  data: MovimientoCaja[]
  getBalanceCaja: () => number
  getMovimientosByFecha: (inicio: string, fin: string) => MovimientoCaja[]
}

export function useMovimientosCaja(): MovimientosCajaReturn {
  const raw = useSupabaseData<Tables<'movimientos_caja'>>({
    table: 'movimientos_caja',
    orderBy: { column: 'fecha', ascending: false }
  })
  const data = useMemo(() => raw.data.map(toMovimientoCaja), [raw.data])

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
  const base = useMappedData<Tables<'registros_ipve'>, RegistroIPVE>(
    { table: 'registros_ipve', orderBy: { column: 'fecha', ascending: false } },
    toRegistroIPVE,
    input => input as Omit<TablesInsert<TableName>, 'business_id' | 'created_at' | 'updated_at'>
  )

  const agregarRegistro = base.create

  const agregarOActualizarRegistro = useCallback(async (registro: Omit<RegistroIPVE, 'id'>) => {
    return dedup('registros.upsert', async () => {
      const existente = base.data.find(r =>
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
  }, [base])

  const actualizarRegistro = base.update

  const getRegistrosByFecha = useCallback((fecha: string) =>
    base.data.filter(r => r.fecha === fecha && r.tipo === 'historico'),
    [base.data]
  )

  const getRegistrosDiariosByFecha = useCallback((fecha: string) =>
    base.data.filter(r => r.fecha === fecha && r.tipo === 'diario'),
    [base.data]
  )

  const getRegistrosByVendedor = useCallback((vendedorId: string) =>
    base.data.filter(r => r.vendedorId === vendedorId),
    [base.data]
  )

  const agregarEntrada = useCallback(async (
    fecha: string, vendedorId: string, productoId: string,
    productoNombre: string, cantidad: number, precioVenta: number, vendedorNombre?: string
  ) => {
    return dedup('entradas.create', async () => {
      const existente = base.data.find(r =>
        r.fecha === fecha && r.vendedorId === vendedorId && r.productoId === productoId && r.tipo === 'diario'
      )
      if (existente) {
        await base.update(existente.id, { entrada: existente.entrada + cantidad })
      } else {
        await base.create({ fecha, vendedorId, vendedorNombre: vendedorNombre || '', productoId, productoNombre, inicio: 0, entrada: cantidad, final: 0, precioVenta, tipo: 'diario' })
      }
    })
  }, [base])

  const limpiarDiario = useCallback(async () => {
    const diarios = base.data.filter(r => r.tipo === 'diario')
    for (const r of diarios) {
      await base.delete(r.id)
    }
  }, [base])

  return {
    data: base.data,
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
  const businessId = user?.business_id;
  const [data, setData] = useState<ProductRotationStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!businessId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: ipveData, error: ipveError } = await supabase
        .from('registros_ipve')
        .select('producto_id, producto_nombre, entrada, precio_venta, fecha')
        .eq('business_id', businessId)
        .eq('tipo', 'historico');

      if (ipveError) throw ipveError;

      const { data: productosData, error: productosError } = await supabase
        .from('productos')
        .select('id, codigo, nombre, precio_compra, precio_venta, fecha_registro')
        .eq('business_id', businessId)
        .eq('activo', true);

      if (productosError) throw productosError;

      const ahora = new Date();
      const haceSemana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
      const haceMes = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

      const ventasPorProducto = new Map<string, {
        total: number;
        semana: number;
        mes: number;
        precios: number[];
      }>();

      (ipveData || []).forEach(row => {
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

      const enriched: ProductRotationStats[] = (productosData || []).map(prod => {
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
      setData(enriched);
    } catch (err) {
      setError(err as Error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTopByRotation = useCallback((limit = 10) => {
    return data.slice(0, limit);
  }, [data]);

  const getProductRotation = useCallback((productoId: string) => {
    return data.find(p => p.productoId === productoId);
  }, [data]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return useMemo(() => ({
    data,
    loading,
    error,
    refetch,
    getTopByRotation,
    getProductRotation,
  }), [data, loading, error, refetch, getTopByRotation, getProductRotation]);
}

interface PedidosReturn extends DomainReturn<Pedido> {
  pedidos: Pedido[]
  agregarPedido: PedidosReturn['create']
  actualizarPedido: PedidosReturn['update']
  getPedidosPendientes: () => Pedido[]
}

export function usePedidos(): PedidosReturn {
  const base = useMappedData<Tables<'pedidos'>, Pedido>(
    { table: 'pedidos', orderBy: { column: 'fecha', ascending: false } },
    toPedido,
    fromPedido
  )

  const getPedidosPendientes = useCallback(() =>
    base.data.filter(p => p.estado === 'pendiente'),
    [base.data]
  )

  const create = useCallback((input: Partial<Pedido>) => dedup('pedidos.create', () => base.create(input)), [base])

  return {
    ...base,
    create,
    pedidos: base.data,
    agregarPedido: base.create,
    actualizarPedido: base.update,
    getPedidosPendientes
  }
}

interface SolicitudesProductoNuevoReturn extends DomainReturn<SolicitudProductoNuevo> {
  aprobarSolicitud: (id: string, precioVenta: number, stockMinimo: number, productoId: string, comentario?: string) => Promise<void>
  rechazarSolicitud: (id: string, comentario?: string) => Promise<void>
  getSolicitudesPendientes: () => SolicitudProductoNuevo[]
}

export function useSolicitudesProductoNuevo(): SolicitudesProductoNuevoReturn {
  const base = useMappedData<Tables<'solicitudes_producto_nuevo'>, SolicitudProductoNuevo>(
    { table: 'solicitudes_producto_nuevo', orderBy: { column: 'fecha', ascending: false } },
    toSolicitud,
    input => input as Omit<TablesInsert<TableName>, 'business_id' | 'created_at' | 'updated_at'>
  )

  const aprobarSolicitud = useCallback(async (id: string, precioVenta: number, stockMinimo: number, productoId: string, comentario?: string) => {
    await base.update(id, { estado: 'aprobada', precioVenta, stockMinimo, productoId, comentarioAdmin: comentario })
  }, [base])

  const rechazarSolicitud = useCallback(async (id: string, comentario?: string) => {
    await base.update(id, { estado: 'rechazada', comentarioAdmin: comentario })
  }, [base])

  const getSolicitudesPendientes = useCallback(() =>
    base.data.filter(s => s.estado === 'pendiente'),
    [base.data]
  )

  return { ...base, aprobarSolicitud, rechazarSolicitud, getSolicitudesPendientes }
}

interface SalariosFijosReturn extends DomainReturn<SalarioFijo> {
  salariosFijos: SalarioFijo[]
  upsertSalario: (rol: import('@/types').UserRole, montoSemanal: number) => Promise<void>
}

export function useSalariosFijos(): SalariosFijosReturn {
  const base = useMappedData<Tables<'salarios_fijos'>, SalarioFijo>(
    { table: 'salarios_fijos' },
    toSalarioFijo,
    fromSalarioFijo
  )

  const upsertSalario = useCallback(async (rol: import('@/types').UserRole, montoSemanal: number) => {
    return dedup('salarios.upsert', async () => {
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

interface FiadosReturn extends DomainReturn<Fiado> {
  fiados: Fiado[]
  getPendientes: () => Fiado[]
  getCobrados: () => Fiado[]
  getPorVendedor: (vendedorId: string) => Fiado[]
  cobrarFiado: (id: string) => Promise<void>
}

export function useFiados(): FiadosReturn {
  const base = useMappedData<Tables<'fiados'>, Fiado>(
    { table: 'fiados', orderBy: { column: 'fecha', ascending: false } },
    toFiado,
    fromFiado
  )
  const { create: crearVentaDiaria } = useVentasDiarias()

  const getPendientes = useCallback(() =>
    base.data.filter(f => f.estado === 'pendiente'),
    [base.data]
  )

  const getCobrados = useCallback(() =>
    base.data.filter(f => f.estado === 'cobrado'),
    [base.data]
  )

  const getPorVendedor = useCallback((vendedorId: string) =>
    base.data.filter(f => f.vendedorId === vendedorId),
    [base.data]
  )

  const cobrarFiado = useCallback(async (id: string) => {
    return dedup('fiados.cobrar', async () => {
      const fiado = base.data.find(f => f.id === id)
      if (!fiado || fiado.estado === 'cobrado') return

      await base.update(id, { estado: 'cobrado', fechaCobro: new Date().toISOString() })

      const ventaCobro = {
        fecha: new Date().toISOString(),
        vendedorId: fiado.vendedorId,
        vendedorNombre: fiado.vendedorNombre,
        montoEfectivo: fiado.monto,
        montoTransferencia: 0,
        notas: `Cobro fiado - ${fiado.clienteNombre}${fiado.descripcion ? ` (${fiado.descripcion})` : ''}`,
      }
      await crearVentaDiaria(ventaCobro)
    })
  }, [base, crearVentaDiaria])

  return { ...base, fiados: base.data, getPendientes, getCobrados, getPorVendedor, cobrarFiado }
}

export function useConfiguracion() {
  const { user } = useAuth()
  const [config, setConfig] = useState<Tables<'configuracion_negocio'> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.business_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }

    let mounted = true

    const fetchConfig = async () => {
      const { data, error } = await supabase
        .from('configuracion_negocio')
        .select('*')
        .eq('business_id', user.business_id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching config:', error)
      }
      if (mounted) {
        setConfig(data)
        setLoading(false)
      }
    }

    fetchConfig()

    return () => { mounted = false }
  }, [user?.business_id])

  const updateConfig = async (data: Partial<TablesUpdate<'configuracion_negocio'>>) => {
    return dedup('config.upsert', async () => {
      if (!user?.business_id) throw new Error('No business selected')

      const { data: result, error } = await supabase
        .from('configuracion_negocio')
        .upsert({ ...data, business_id: user.business_id } as TablesInsert<'configuracion_negocio'>)
        .select()
        .single()

      if (error) throw error
      setConfig(result)
      return result
    })
  }

  return { config, loading, updateConfig }
}

// ---------------------------------------------
// COMPRAS: requiere unir sus detalles (tabla hija sin business_id)
// ---------------------------------------------
type CompraRow = Tables<'compras'> & { detalles_compra?: Tables<'detalles_compra'>[] }

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
  const businessId = user?.business_id
  const [rows, setRows] = useState<CompraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!businessId) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: queryError } = await supabase
        .from('compras')
        .select('*, detalles_compra(*)')
        .eq('business_id', businessId)
        .order('fecha', { ascending: false })

      if (queryError) throw queryError
      setRows((data as unknown as CompraRow[]) || [])
    } catch (err) {
      setError(err as Error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const data = useMemo(
    () => rows.map(row => toCompra(row, row.detalles_compra || [])),
    [rows]
  )

  const create = useCallback(async (input: Omit<Compra, 'id'>) => {
    return dedup('compras.create', async () => {
      if (!businessId) throw new Error('No business selected')

      const { data: row, error: insertError } = await supabase
        .from('compras')
        .insert({ ...fromCompra(input), business_id: businessId })
        .select('*')
        .single()

      if (insertError) throw insertError

      if (input.detalles?.length) {
        const { error: detallesError } = await supabase
          .from('detalles_compra')
          .insert(input.detalles.map(detalle => fromDetalleCompra(detalle, row.id)))

        if (detallesError) throw detallesError
      }

      await fetchData()
      return row ? toCompra(row as Tables<'compras'>) : null
    })
  }, [businessId, fetchData])

  const update = useCallback(async (id: string, patch: Partial<Compra>) => {
    if (!businessId) throw new Error('No business selected')

    const { data: row, error: updateError } = await supabase
      .from('compras')
      .update(fromCompra(patch))
      .eq('id', id)
      .eq('business_id', businessId)
      .select('*')
      .single()

    if (updateError) throw updateError

    await fetchData()
    return row ? toCompra(row as Tables<'compras'>) : null
  }, [businessId, fetchData])

  const deleteItem = useCallback(async (id: string) => {
    if (!businessId) throw new Error('No business selected')

    const { error: deleteError } = await supabase
      .from('compras')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId)

    if (deleteError) throw deleteError

    await fetchData()
    return true
  }, [businessId, fetchData])

  const getById = useCallback((id: string) => data.find(item => item.id === id), [data])

  const refetch = useCallback(async () => {
    await fetchData()
  }, [fetchData])

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

  return { data, loading, error, refetch, create, update, delete: deleteItem, getById, getComprasByFecha, getComprasMes }
}

// Helper para queries complejas con joins
export async function fetchWithRelations<T>(
  table: TableName,
  select: string,
  businessId: string,
  extraFilters?: Record<string, unknown>
) {
  let query = supabase.from(table).select(select).eq('business_id' as never, businessId)

  if (extraFilters) {
    Object.entries(extraFilters).forEach(([key, value]) => {
      query = query.eq(key as never, value as never)
    })
  }

  const { data, error } = await query
  if (error) throw error
  return data as T[]
}
