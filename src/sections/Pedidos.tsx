import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { usePedidos, useProductos, useRegistrosIPVE, useVendedores } from '@/hooks/supabase/useSupabaseData';
import type { Pedido } from '@/types';
import type { AuthUser } from '@/contexts/AuthContext';
import { PedidosVendedorView } from './pedidos/PedidosVendedorView';
import { PedidosAdminView } from './pedidos/PedidosAdminView';

interface PedidosProps {
  user?: AuthUser;
}

export default function Pedidos({ user }: PedidosProps) {
  const isAdmin = user?.role === 'admin';
  const { pedidos, agregarPedido, actualizarPedido, loading: pedidosLoading } = usePedidos();
  const { productos, reducirStock, loading: productosLoading } = useProductos();
  const { agregarEntrada } = useRegistrosIPVE();
  const { vendedores, getVendedorByNombre } = useVendedores();

  const hoyLocal = new Date();
  const today = `${hoyLocal.getFullYear()}-${String(hoyLocal.getMonth() + 1).padStart(2, '0')}-${String(hoyLocal.getDate()).padStart(2, '0')}`;
  const [searchQuery, setSearchQuery] = useState('');

  const [newPedidoOpen, setNewPedidoOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<string>('');
  const [cantidad, setCantidad] = useState<number>(1);
  const [notas, setNotas] = useState<string>('');
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [cantidadEntregada, setCantidadEntregada] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recepcionOpen, setRecepcionOpen] = useState(false);
  const [vendedorIdRecepcion, setVendedorIdRecepcion] = useState<string>('');
  const [cantidadRecepcion, setCantidadRecepcion] = useState<number>(0);
  const [seleccionarVendedorOpen, setSeleccionarVendedorOpen] = useState(false);
  const [vendedorIdTemporal, setVendedorIdTemporal] = useState<string>('');

  const misPedidos = useMemo(() => {
    if (!user) return [];
    return [...pedidos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .filter(p => p.vendedorNombre === user.nombre);
  }, [pedidos, user]);

  const misPedidosPendientes = useMemo(() => {
    return misPedidos.filter(p => p.estado === 'pendiente');
  }, [misPedidos]);

  const misPedidosAprobados = useMemo(() => {
    return misPedidos.filter(p => p.estado === 'aprobado');
  }, [misPedidos]);

  const misPedidosHistorial = useMemo(() => {
    return misPedidos.filter(p => p.estado !== 'pendiente');
  }, [misPedidos]);

  const productosFiltrados = useMemo(() => {
    return productos
      .filter(p => p.activo)
      .filter(p => searchQuery
        ? p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.codigo.toLowerCase().includes(searchQuery.toLowerCase())
        : true
      );
  }, [productos, searchQuery]);

  const pedidosPendientesAdmin = useMemo(() => {
    return [...pedidos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .filter(p => p.estado === 'pendiente');
  }, [pedidos]);

  const pedidosProcesadosAdmin = useMemo(() => {
    return [...pedidos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .filter(p => p.estado !== 'pendiente');
  }, [pedidos]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handlePedir = (productoId: string) => {
    setSelectedProducto(productoId);
    setCantidad(1);
    setNotas('');
    setNewPedidoOpen(true);
  };

  const handleCloseNewPedido = () => {
    setNewPedidoOpen(false);
    setSelectedProducto('');
  };

  const handleCrearPedido = async () => {
    if (!selectedProducto || cantidad < 1 || !user) return;

    const producto = productos.find(p => p.id === selectedProducto);
    if (!producto) return;

    const vendedor = getVendedorByNombre(user.nombre);
    let vendedorIdReal: string;

    if (vendedor) {
      vendedorIdReal = vendedor.id;
    } else {
      if (!vendedorIdTemporal) {
        setSeleccionarVendedorOpen(true);
        return;
      }
      vendedorIdReal = vendedorIdTemporal;
    }

    await agregarPedido({
      vendedorId: vendedorIdReal,
      vendedorNombre: user.nombre,
      productoId: producto.id,
      productoNombre: producto.nombre,
      cantidad,
      notas,
    });

    toast.success('Pedido enviado');
    setNewPedidoOpen(false);
    setSelectedProducto('');
    setCantidad(1);
    setNotas('');
    setVendedorIdTemporal('');
  };

  const handleConfirmarVendedorTemporal = async () => {
    if (!vendedorIdTemporal || !selectedProducto || !user) {
      setSeleccionarVendedorOpen(false);
      return;
    }

    const producto = productos.find(p => p.id === selectedProducto);
    if (!producto) return;

    await agregarPedido({
      vendedorId: vendedorIdTemporal,
      vendedorNombre: user.nombre,
      productoId: producto.id,
      productoNombre: producto.nombre,
      cantidad,
      notas,
    });

    toast.success('Pedido enviado');
    setSeleccionarVendedorOpen(false);
    setNewPedidoOpen(false);
    setSelectedProducto('');
    setCantidad(1);
    setNotas('');
    setVendedorIdTemporal('');
  };

  const handleAceptarPedido = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setCantidadEntregada(pedido.cantidad);
    setConfirmOpen(true);
  };

  const handleConfirmarEntrega = () => {
    if (!selectedPedido) return;

    actualizarPedido(selectedPedido.id, {
      estado: 'aprobado',
      cantidadEntregada: cantidadEntregada,
    });

    reducirStock(selectedPedido.productoId, cantidadEntregada);

    toast.success('Entrega confirmada');
    setConfirmOpen(false);
    setSelectedPedido(null);
  };

  const handleRechazar = (pedidoId: string) => {
    actualizarPedido(pedidoId, { estado: 'cancelado' });
    toast.success('Pedido rechazado');
  };

  const handleConfirmarRecibido = (pedido: Pedido) => {
    if (!user) return;

    setSelectedPedido(pedido);
    setVendedorIdRecepcion(pedido.vendedorId);
    setCantidadRecepcion(pedido.cantidadEntregada || pedido.cantidad);
    setRecepcionOpen(true);
  };

  const handleConfirmarRecepcion = async () => {
    if (!selectedPedido || !user) return;

    let targetVendedorId: string;
    let targetVendedorNombre: string;

    if (isAdmin && vendedorIdRecepcion) {
      const vendor = vendedores.find(v => v.id === vendedorIdRecepcion);
      targetVendedorId = vendedorIdRecepcion;
      targetVendedorNombre = vendor?.nombre || '';
    } else {
      const vendor = getVendedorByNombre(user.nombre);
      targetVendedorId = vendor?.id || selectedPedido.vendedorId;
      targetVendedorNombre = vendor?.nombre || selectedPedido.vendedorNombre;
    }

    console.log('CONFIRMando recepcion:', { targetVendedorId, targetVendedorNombre, today });
    console.log('selectedPedido:', selectedPedido);
    console.log('cantidadRecepcion:', cantidadRecepcion);

    if (!targetVendedorId) return;

    const producto = productos.find(p => p.id === selectedPedido.productoId);
    const precioVenta = producto?.precioVenta || 0;
    console.log('producto:', producto);

    await agregarEntrada(today, targetVendedorId, selectedPedido.productoId, selectedPedido.productoNombre, cantidadRecepcion, precioVenta, targetVendedorNombre);
    console.log('LLAMADO agregarEntrada');

    await actualizarPedido(selectedPedido.id, { estado: 'entregado' });

    toast.success('Recepción registrada');
    setRecepcionOpen(false);
    setSelectedPedido(null);
    if (isAdmin) {
      setVendedorIdRecepcion('');
    }
    setCantidadRecepcion(0);
  };

  if (!isAdmin) {
    return (
      <PedidosVendedorView
        user={user}
        productosLoading={productosLoading}
        pedidosLoading={pedidosLoading}
        productos={productos}
        productosFiltrados={productosFiltrados}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        misPedidosAprobados={misPedidosAprobados}
        misPedidosPendientes={misPedidosPendientes}
        misPedidosHistorial={misPedidosHistorial}
        vendedores={vendedores}
        newPedidoOpen={newPedidoOpen}
        onNewPedidoOpenChange={setNewPedidoOpen}
        onCloseNewPedido={handleCloseNewPedido}
        selectedProducto={selectedProducto}
        cantidad={cantidad}
        onCantidadChange={setCantidad}
        notas={notas}
        onNotasChange={setNotas}
        onPedir={handlePedir}
        onCrearPedido={handleCrearPedido}
        seleccionarVendedorOpen={seleccionarVendedorOpen}
        onSeleccionarVendedorOpenChange={setSeleccionarVendedorOpen}
        vendedorIdTemporal={vendedorIdTemporal}
        onVendedorIdTemporalChange={setVendedorIdTemporal}
        onConfirmarVendedorTemporal={handleConfirmarVendedorTemporal}
        recepcionOpen={recepcionOpen}
        onRecepcionOpenChange={setRecepcionOpen}
        selectedPedido={selectedPedido}
        cantidadRecepcion={cantidadRecepcion}
        onCantidadRecepcionChange={setCantidadRecepcion}
        onConfirmarRecibido={handleConfirmarRecibido}
        onConfirmarRecepcion={handleConfirmarRecepcion}
      />
    );
  }

  return (
    <PedidosAdminView
      pedidosLoading={pedidosLoading}
      pedidosPendientesAdmin={pedidosPendientesAdmin}
      pedidosProcesadosAdmin={pedidosProcesadosAdmin}
      vendedores={vendedores}
      productos={productos}
      confirmOpen={confirmOpen}
      onConfirmOpenChange={setConfirmOpen}
      selectedPedido={selectedPedido}
      cantidadEntregada={cantidadEntregada}
      onCantidadEntregadaChange={setCantidadEntregada}
      onConfirmarEntrega={handleConfirmarEntrega}
      recepcionOpen={recepcionOpen}
      onRecepcionOpenChange={setRecepcionOpen}
      cantidadRecepcion={cantidadRecepcion}
      onCantidadRecepcionChange={setCantidadRecepcion}
      vendedorIdRecepcion={vendedorIdRecepcion}
      onVendedorIdRecepcionChange={setVendedorIdRecepcion}
      onConfirmarRecepcion={handleConfirmarRecepcion}
      onAceptarPedido={handleAceptarPedido}
      onRechazar={handleRechazar}
    />
  );
}
