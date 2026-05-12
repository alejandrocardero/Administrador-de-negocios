import { useState, useCallback } from 'react';
import type { 
  Producto, Vendedor, Comprador, VentaDiaria, Compra, Gasto, 
  Impuesto, ConfiguracionNegocio,
  MovimientoCaja, RegistroIPVE, Pedido
} from '@/types';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Adjust for timezone issues by creating date in UTC
  const adjustedDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return adjustedDate.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Hook para productos
export function useProductos() {
  const [productos, setProductos] = useLocalStorage<Producto[]>('productos', []);

  const agregarProducto = (producto: Omit<Producto, 'id' | 'fechaRegistro'>) => {
    const nuevo: Producto = {
      ...producto,
      id: generateId(),
      fechaRegistro: new Date().toISOString(),
    };
    setProductos(prev => [...prev, nuevo]);
    return nuevo;
  };

  const actualizarProducto = (id: string, datos: Partial<Producto>) => {
    setProductos(prev => prev.map(p => p.id === id ? { ...p, ...datos } : p));
  };

  const eliminarProducto = (id: string) => {
    setProductos(prev => prev.filter(p => p.id !== id));
  };

  const getProductoById = (id: string) => productos.find(p => p.id === id);

  const getProductosBajoStock = () => productos.filter(p => p.stock <= p.stockMinimo && p.activo);

  const getProductosByCategoria = (categoria: string) => 
    productos.filter(p => p.categoria === categoria && p.activo);

  const buscarProductos = (query: string) => {
    const q = query.toLowerCase();
    return productos.filter(p => 
      p.activo && (
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q)
      )
    );
  };

  return {
    productos: productos.filter(p => p.activo),
    todosLosProductos: productos,
    agregarProducto,
    actualizarProducto,
    eliminarProducto,
    getProductoById,
    getProductosBajoStock,
    getProductosByCategoria,
    buscarProductos,
    reducirStock: (id: string, cantidad: number) => {
      setProductos(prev => prev.map(p => {
        if (p.id === id) {
          return { ...p, stock: Math.max(0, p.stock - cantidad) };
        }
        return p;
      }));
    },
  };
}

// Hook para vendedores
export function useVendedores() {
  const [vendedores, setVendedores] = useLocalStorage<Vendedor[]>('vendedores', []);

  const agregarVendedor = (vendedor: Omit<Vendedor, 'id' | 'fechaRegistro' | 'activo'>) => {
    const nuevo: Vendedor = {
      ...vendedor,
      id: generateId(),
      fechaRegistro: new Date().toISOString(),
      activo: true,
    };
    setVendedores(prev => [...prev, nuevo]);
    return nuevo;
  };

  const getVendedorByNombre = (nombre: string) => {
    return vendedores.find(v => v.nombre === nombre);
  };

  const actualizarVendedor = (id: string, datos: Partial<Vendedor>) => {
    setVendedores(prev => prev.map(v => v.id === id ? { ...v, ...datos } : v));
  };

  const eliminarVendedor = (id: string) => {
    // Soft delete by setting activo to false
    setVendedores(prev => prev.map(v => v.id === id ? { ...v, activo: false } : v));
  };

  const getVendedorById = (id: string) => vendedores.find(v => v.id === id);

  const buscarVendedores = (query: string) => {
    const q = query.toLowerCase();
    return vendedores.filter(v => v.activo && v.nombre.toLowerCase().includes(q));
  };

  return {
    vendedores: vendedores.filter(v => v.activo),
    todosLosVendedores: vendedores,
    agregarVendedor,
    actualizarVendedor,
    eliminarVendedor,
    getVendedorById,
    getVendedorByNombre,
    buscarVendedores,
  };
}

// Hook para compradores
export function useCompradores() {
  const [compradores, setCompradores] = useLocalStorage<Comprador[]>('compradores', []);

  const agregarComprador = (comprador: Omit<Comprador, 'id' | 'fechaRegistro' | 'activo'>) => {
    const nuevo: Comprador = {
      ...comprador,
      id: generateId(),
      fechaRegistro: new Date().toISOString(),
      activo: true,
    };
    setCompradores(prev => [...prev, nuevo]);
    return nuevo;
  };

  const actualizarComprador = (id: string, datos: Partial<Comprador>) => {
    setCompradores(prev => prev.map(c => c.id === id ? { ...c, ...datos } : c));
  };

  const eliminarComprador = (id: string) => {
    // Soft delete by setting activo to false
    setCompradores(prev => prev.map(c => c.id === id ? { ...c, activo: false } : c));
  };

  const getCompradorById = (id: string) => compradores.find(c => c.id === id);

  const buscarCompradores = (query: string) => {
    const q = query.toLowerCase();
    return compradores.filter(c => c.activo && c.nombre.toLowerCase().includes(q));
  };

  return {
    compradores: compradores.filter(c => c.activo),
    todosLosCompradores: compradores,
    agregarComprador,
    actualizarComprador,
    eliminarComprador,
    getCompradorById,
    buscarCompradores,
  };
}

// Hook para ventas diarias
export function useVentasDiarias() {
  const [ventas, setVentas] = useLocalStorage<VentaDiaria[]>('ventasDiarias', []);

  const agregarVentaDiaria = (venta: Omit<VentaDiaria, 'id' | 'totalVendido' | 'salarioCalculado'>) => {
    const nuevo: VentaDiaria = {
      ...venta,
      id: generateId(),
      totalVendido: venta.montoEfectivo + venta.montoTransferencia,
      salarioCalculado: (venta.montoEfectivo + venta.montoTransferencia) * 0.10,
    };
    setVentas(prev => [...prev, nuevo]);
    return nuevo;
  };

  const actualizarVentaDiaria = (id: string, datos: Partial<VentaDiaria>) => {
    setVentas(prev => prev.map(v => v.id === id ? { ...v, ...datos } : v));
  };

  const eliminarVentaDiaria = (id: string) => {
    setVentas(prev => prev.filter(v => v.id !== id));
  };

  const getVentasByFecha = (inicio: string, fin: string) => {
    const ini = new Date(inicio);
    ini.setHours(0, 0, 0, 0);
    const f = new Date(fin);
    f.setHours(23, 59, 59, 999);
    
    return ventas.filter(v => {
      const fecha = new Date(v.fecha);
      return fecha >= ini && fecha <= f;
    });
  };

  return {
    ventas,
    agregarVentaDiaria,
    actualizarVentaDiaria,
    eliminarVentaDiaria,
    getVentasByFecha,
  };
}

// Hook para compras
export function useCompras() {
  const [compras, setCompras] = useLocalStorage<Compra[]>('compras', []);

  const agregarCompra = (compra: Omit<Compra, 'id'>) => {
    const nueva: Compra = {
      ...compra,
      id: generateId(),
    };
    setCompras(prev => [...prev, nueva]);
    return nueva;
  };

  const actualizarCompra = (id: string, datos: Partial<Compra>) => {
    setCompras(prev => prev.map(c => c.id === id ? { ...c, ...datos } : c));
  };

  const cancelarCompra = (id: string) => {
    setCompras(prev => prev.map(c => c.id === id ? { ...c, estado: 'cancelada' } : c));
  };

  const getCompraById = (id: string) => compras.find(c => c.id === id);

  const getComprasByFecha = (inicio: string, fin: string) => {
    const ini = new Date(inicio).getTime();
    const f = new Date(fin).getTime();
    return compras.filter(c => {
      const fecha = new Date(c.fecha).getTime();
      return fecha >= ini && fecha <= f && c.estado === 'completada';
    });
  };

  const getComprasMes = () => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    return compras.filter(c => 
      new Date(c.fecha) >= inicioMes && c.estado === 'completada'
    );
  };

  return {
    compras,
    agregarCompra,
    actualizarCompra,
    cancelarCompra,
    getCompraById,
    getComprasByFecha,
    getComprasMes,
  };
}

// Hook para gastos
export function useGastos() {
  const [gastos, setGastos] = useLocalStorage<Gasto[]>('gastos', []);

  const agregarGasto = (gasto: Omit<Gasto, 'id'>) => {
    const nuevo: Gasto = {
      ...gasto,
      id: generateId(),
    };
    setGastos(prev => [...prev, nuevo]);
    return nuevo;
  };

  const actualizarGasto = (id: string, datos: Partial<Gasto>) => {
    setGastos(prev => prev.map(g => g.id === id ? { ...g, ...datos } : g));
  };

  const eliminarGasto = (id: string) => {
    setGastos(prev => prev.filter(g => g.id !== id));
  };

  const getGastosByFecha = (inicio: string, fin: string) => {
    const ini = new Date(inicio).getTime();
    const f = new Date(fin).getTime();
    return gastos.filter(g => {
      const fecha = new Date(g.fecha).getTime();
      return fecha >= ini && fecha <= f;
    });
  };

  const getGastosMes = () => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    return gastos.filter(g => new Date(g.fecha) >= inicioMes);
  };

  return {
    gastos,
    agregarGasto,
    actualizarGasto,
    eliminarGasto,
    getGastosByFecha,
    getGastosMes,
  };
}

// Hook para impuestos
export function useImpuestos() {
  const [impuestos, setImpuestos] = useLocalStorage<Impuesto[]>('impuestos', []);

  const agregarImpuesto = (impuesto: Omit<Impuesto, 'id'>) => {
    const nuevo: Impuesto = {
      ...impuesto,
      id: generateId(),
    };
    setImpuestos(prev => [...prev, nuevo]);
    return nuevo;
  };

  const actualizarImpuesto = (id: string, datos: Partial<Impuesto>) => {
    setImpuestos(prev => prev.map(i => i.id === id ? { ...i, ...datos } : i));
  };

  const eliminarImpuesto = (id: string) => {
    setImpuestos(prev => prev.filter(i => i.id !== id));
  };

  const getImpuestosPendientes = () => impuestos.filter(i => i.estado === 'pendiente' || i.estado === 'vencido');

  const getImpuestosByPeriodo = (periodo: string) => impuestos.filter(i => i.periodo === periodo);

  return {
    impuestos,
    agregarImpuesto,
    actualizarImpuesto,
    eliminarImpuesto,
    getImpuestosPendientes,
    getImpuestosByPeriodo,
  };
}

// Hook para configuración
export function useConfiguracion() {
  const [configuracion, setConfiguracion] = useLocalStorage<ConfiguracionNegocio>('configuracion', {
    nombre: 'Mi Negocio',
    nit: '',
    direccion: '',
    telefono: '',
    email: '',
    regimen: 'simplificado',
    tarifaIva: 19,
    moneda: 'COP',
  });

  const actualizarConfiguracion = (datos: Partial<ConfiguracionNegocio>) => {
    setConfiguracion(prev => ({ ...prev, ...datos }));
  };

  return {
    configuracion,
    actualizarConfiguracion,
  };
}

// Hook para movimientos de caja
export function useMovimientosCaja() {
  const [movimientos, setMovimientos] = useLocalStorage<MovimientoCaja[]>('movimientosCaja', []);

  const agregarMovimiento = (movimiento: Omit<MovimientoCaja, 'id'>) => {
    const nuevo: MovimientoCaja = {
      ...movimiento,
      id: generateId(),
    };
    setMovimientos(prev => [...prev, nuevo]);
    return nuevo;
  };

  const getBalanceCaja = () => {
    return movimientos.reduce((total, m) => {
      return m.tipo === 'entrada' ? total + m.monto : total - m.monto;
    }, 0);
  };

  const getMovimientosByFecha = (inicio: string, fin: string) => {
    const ini = new Date(inicio).getTime();
    const f = new Date(fin).getTime();
    return movimientos.filter(m => {
      const fecha = new Date(m.fecha).getTime();
      return fecha >= ini && fecha <= f;
    });
  };

  return {
    movimientos,
    agregarMovimiento,
    getBalanceCaja,
    getMovimientosByFecha,
  };
}

export function useIPVE() {
  const [registros, setRegistros] = useLocalStorage<RegistroIPVE[]>('registrosIPVE', []);

  const agregarRegistro = (registro: Omit<RegistroIPVE, 'id'>) => {
    const nuevo: RegistroIPVE = {
      ...registro,
      id: generateId(),
    };
    setRegistros(prev => [...prev, nuevo]);
    return nuevo;
  };

  const agregarOActualizarRegistro = (registro: Omit<RegistroIPVE, 'id'>) => {
    setRegistros(prev => {
      const existente = prev.find(r => 
        r.fecha === registro.fecha && 
        r.vendedorId === registro.vendedorId && 
        r.productoId === registro.productoId && 
        r.tipo === registro.tipo
      );
      
      if (existente) {
        return prev.map(r => 
          r.id === existente.id 
            ? { 
                ...r, 
                inicio: registro.inicio, 
                entrada: registro.entrada, 
                final: registro.final,
                precioVenta: registro.precioVenta,
                vendedorNombre: registro.vendedorNombre,
                productoNombre: registro.productoNombre
              } 
            : r
        );
      } else {
        const nuevo: RegistroIPVE = {
          ...registro,
          id: generateId(),
        };
        return [...prev, nuevo];
      }
    });
  };

  const guardarRegistrosIPVE = (registrosNuevos: Omit<RegistroIPVE, 'id'>[]) => {
    setRegistros(prev => {
      const actualizados: RegistroIPVE[] = [];
      
      for (const registro of registrosNuevos) {
        const existente = prev.find(r => 
          r.fecha === registro.fecha && 
          r.vendedorId === registro.vendedorId && 
          r.productoId === registro.productoId && 
          r.tipo === registro.tipo
        );
        
        if (existente) {
          actualizados.push({
            ...existente,
            inicio: registro.inicio,
            entrada: registro.entrada,
            final: registro.final,
            precioVenta: registro.precioVenta,
            vendedorNombre: registro.vendedorNombre,
            productoNombre: registro.productoNombre
          });
        } else {
          actualizados.push({
            ...registro,
            id: generateId(),
          });
        }
      }
      
      const idsActualizados = new Set(actualizados.map(r => r.id));
      const sinCambios = prev.filter(r => !idsActualizados.has(r.id));
      return [...sinCambios, ...actualizados];
    });
  };

  const guardarIPVEDiarioYHistorico = <T extends Omit<RegistroIPVE, 'id' | 'tipo'>>(registrosDiarios: T[]) => {
    setRegistros(prev => {
      const actualizados: RegistroIPVE[] = [];
      
      for (const registro of registrosDiarios) {
        const existenteDiario = prev.find(r => 
          r.fecha === registro.fecha && 
          r.vendedorId === registro.vendedorId && 
          r.productoId === registro.productoId && 
          r.tipo === 'diario'
        );
        
        if (existenteDiario) {
          actualizados.push({
            ...existenteDiario,
            inicio: registro.inicio,
            entrada: registro.entrada,
            final: registro.final,
            precioVenta: registro.precioVenta,
            vendedorNombre: registro.vendedorNombre,
            productoNombre: registro.productoNombre
          });
        } else {
          actualizados.push({
            ...registro,
            id: generateId(),
            tipo: 'diario' as const,
          });
        }
      }
      
      for (const registro of registrosDiarios) {
        const existenteHistorico = prev.find(r => 
          r.fecha === registro.fecha && 
          r.vendedorId === registro.vendedorId && 
          r.productoId === registro.productoId && 
          r.tipo === 'historico'
        );
        
        if (existenteHistorico) {
          actualizados.push({
            ...existenteHistorico,
            inicio: registro.inicio,
            entrada: registro.entrada,
            final: registro.final,
            precioVenta: registro.precioVenta,
            vendedorNombre: registro.vendedorNombre,
            productoNombre: registro.productoNombre
          });
        } else {
          actualizados.push({
            ...registro,
            id: generateId(),
            tipo: 'historico' as const,
          });
        }
      }
      
      const idsActualizados = new Set(actualizados.map(r => r.id));
      const sinCambios = prev.filter(r => !idsActualizados.has(r.id));
      return [...sinCambios, ...actualizados];
    });
  };

  const actualizarRegistro = (id: string, datos: Partial<RegistroIPVE>) => {
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, ...datos } : r));
  };

  const getRegistrosByFecha = (fecha: string) => {
    return registros.filter(r => r.fecha === fecha && r.tipo === 'historico');
  };

  const getRegistrosDiariosByFecha = (fecha: string) => {
    return registros.filter(r => r.fecha === fecha && r.tipo === 'diario');
  };

  const getRegistrosByVendedor = (vendedorId: string) => {
    return registros.filter(r => r.vendedorId === vendedorId);
  };

  const agregarEntradaDiario = (fecha: string, vendedorId: string, productoId: string, productoNombre: string, cantidad: number, precioVenta: number, vendedorNombre?: string) => {
    const existente = registros.find(r => r.fecha === fecha && r.vendedorId === vendedorId && r.productoId === productoId && r.tipo === 'diario');
    if (existente) {
      setRegistros(prev => prev.map(r => r.id === existente.id ? { ...r, entrada: r.entrada + cantidad } : r));
    } else {
      agregarRegistro({ fecha, vendedorId, vendedorNombre: vendedorNombre || '', productoId, productoNombre, inicio: 0, entrada: cantidad, final: 0, precioVenta, tipo: 'diario' });
    }
  };

  const guardarDiaHistorico = (fecha: string) => {
    const diarios = registros.filter(r => r.fecha === fecha && r.tipo === 'diario');
    const Historicos = diarios.map(r => ({
      ...r,
      id: generateId(),
      tipo: 'historico' as const,
    }));
    setRegistros(prev => [...prev, ...Historicos]);
  };

  const limpiarDiario = () => {
    setRegistros(prev => prev.filter(r => r.tipo !== 'diario'));
  };

return {
    registros,
    agregarRegistro,
    agregarOActualizarRegistro,
    guardarRegistrosIPVE,
    guardarIPVEDiarioYHistorico,
    actualizarRegistro,
    getRegistrosByFecha,
    getRegistrosDiariosByFecha,
    getRegistrosByVendedor,
    agregarEntrada: agregarEntradaDiario,
    guardarDiaHistorico,
    limpiarDiario,
  };
}

// Hook para pedidos
export function usePedidos() {
  const [pedidos, setPedidos] = useLocalStorage<Pedido[]>('pedidos', []);

  const agregarPedido = (pedido: Omit<Pedido, 'id' | 'fecha' | 'estado'>) => {
    const nuevo: Pedido = {
      ...pedido,
      id: generateId(),
      fecha: new Date().toISOString(),
      estado: 'pendiente',
    };
    setPedidos(prev => [...prev, nuevo]);
    return nuevo;
  };

  const actualizarPedido = (id: string, datos: Partial<Pedido>) => {
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, ...datos } : p));
  };

  const eliminarPedido = (id: string) => {
    setPedidos(prev => prev.filter(p => p.id !== id));
  };

  const getPedidosPendientes = () => pedidos.filter(p => p.estado === 'pendiente');

  return {
    pedidos,
    agregarPedido,
    actualizarPedido,
    eliminarPedido,
    getPedidosPendientes,
  };
}
