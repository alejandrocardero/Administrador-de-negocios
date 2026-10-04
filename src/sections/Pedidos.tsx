import { useState, useMemo, useRef } from 'react';
import { CheckCircle, XCircle, Truck, Package, Send, FileCheck, ShoppingCart, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePedidos, useProductos, useRegistrosIPVE, useVendedores, formatCurrency } from '@/hooks/supabase/useSupabaseData';
import type { Pedido } from '@/types';
import type { AuthUser } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PedidosProps {
  user?: AuthUser;
}

export default function Pedidos({ user }: PedidosProps) {
  const isAdmin = user?.role === 'admin';
  const { pedidos, agregarPedido, actualizarPedido } = usePedidos();
  const { productos, reducirStock } = useProductos();
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
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

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

  const handleCrearPedido = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
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

      setNewPedidoOpen(false);
      setSelectedProducto('');
      setCantidad(1);
      setNotas('');
      setVendedorIdTemporal('');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleConfirmarVendedorTemporal = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
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

      setSeleccionarVendedorOpen(false);
      setNewPedidoOpen(false);
      setSelectedProducto('');
      setCantidad(1);
      setNotas('');
      setVendedorIdTemporal('');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
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
    
    setConfirmOpen(false);
    setSelectedPedido(null);
  };

  const handleRechazar = (pedidoId: string) => {
    actualizarPedido(pedidoId, { estado: 'cancelado' });
  };

  const handleConfirmarRecibido = (pedido: Pedido) => {
    if (!user) return;

    setSelectedPedido(pedido);
    setVendedorIdRecepcion(pedido.vendedorId);
    setCantidadRecepcion(pedido.cantidadEntregada || pedido.cantidad);
    setRecepcionOpen(true);
  };

  const handleConfirmarRecepcion = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
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

      setRecepcionOpen(false);
      setSelectedPedido(null);
      if (isAdmin) {
        setVendedorIdRecepcion('');
      }
      setCantidadRecepcion(0);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Productos Disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productosFiltrados.map(producto => {
                  const tieneStock = producto.stock > 0;
                  const tienePedidoPendiente = misPedidosPendientes.some(
                    p => p.productoId === producto.id
                  );

                  return (
                    <TableRow key={producto.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{producto.nombre}</p>
                          <p className="text-xs text-muted-foreground">{producto.codigo}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(producto.precioVenta)}</TableCell>
                      <TableCell>
                        {tieneStock ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Disponible
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            No disponible
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {tienePedidoPendiente ? (
                          <Badge variant="outline">Pendiente</Badge>
                        ) : tieneStock ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedProducto(producto.id);
                              setCantidad(1);
                              setNotas('');
                              setNewPedidoOpen(true);
                            }}
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Pedir
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No disponible</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {misPedidosAprobados.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <Send className="h-5 w-5" />
                Pedidos Aprobados - Por Confirmar Recepción
              </CardTitle>
              <CardDescription>
                Confirma cuando hayas recibido los productos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cantidad Aprobada</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {misPedidosAprobados.map(pedido => (
                    <TableRow key={pedido.id}>
                      <TableCell>
                        {format(new Date(pedido.fecha), 'PPP', { locale: es })}
                      </TableCell>
                      <TableCell>{pedido.productoNombre}</TableCell>
                      <TableCell className="font-bold text-amber-600">{pedido.cantidadEntregada || pedido.cantidad}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          onClick={() => handleConfirmarRecibido(pedido)}
                        >
                          <FileCheck className="h-3 w-3 mr-1" />
                          Confirmar Recepción
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {misPedidosPendientes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Pedidos Pendientes
              </CardTitle>
              <CardDescription>
                Esperando aprobación del administrador
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cantidad Solicitada</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {misPedidosPendientes.map(pedido => (
                    <TableRow key={pedido.id}>
                      <TableCell>
                        {format(new Date(pedido.fecha), 'PPP', { locale: es })}
                      </TableCell>
                      <TableCell>{pedido.productoNombre}</TableCell>
                      <TableCell className="font-bold">{pedido.cantidad}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Pendiente</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {misPedidosHistorial.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Historial de Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {misPedidosHistorial.map(pedido => (
                    <TableRow key={pedido.id}>
                      <TableCell>
                        {format(new Date(pedido.fecha), 'PPP', { locale: es })}
                      </TableCell>
                      <TableCell>{pedido.productoNombre}</TableCell>
                      <TableCell>{pedido.cantidadEntregada || pedido.cantidad}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={pedido.estado === 'entregado' ? 'default' : pedido.estado === 'cancelado' ? 'destructive' : 'secondary'}
                        >
                          {pedido.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={newPedidoOpen} onOpenChange={setNewPedidoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Pedido de Productos</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedProducto && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">
                    {productos.find(p => p.id === selectedProducto)?.nombre}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {productos.find(p => p.id === selectedProducto)?.codigo}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-2">
                <Label>Notas (Opcional)</Label>
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Comentarios adicionales..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setNewPedidoOpen(false);
                setSelectedProducto('');
              }}>Cancelar</Button>
              <Button onClick={handleCrearPedido} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar Pedido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={seleccionarVendedorOpen} onOpenChange={setSeleccionarVendedorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Seleccionar Vendedor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                No se encontró el vendedor. Por favor seleccione a qué vendedor pertenece este pedido.
              </p>
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select value={vendedorIdTemporal} onValueChange={setVendedorIdTemporal}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setSeleccionarVendedorOpen(false);
              }}>Cancelar</Button>
              <Button onClick={handleConfirmarVendedorTemporal} disabled={!vendedorIdTemporal || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={recepcionOpen} onOpenChange={setRecepcionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Recepción de Pedido</DialogTitle>
            </DialogHeader>
            {selectedPedido && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p><strong>Producto:</strong> {selectedPedido.productoNombre}</p>
                  <p><strong>Cantidad Aprobada:</strong> {selectedPedido.cantidadEntregada || selectedPedido.cantidad}</p>
                </div>

                <div className="space-y-2">
                  <Label>Cantidad a Recibir</Label>
                  <Input
                    type="number"
                    min="1"
                    value={cantidadRecepcion}
                    onChange={(e) => setCantidadRecepcion(parseInt(e.target.value) || 1)}
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  Esta cantidad se agregará como entrada en tu IPVE
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRecepcionOpen(false)}>Cancelar</Button>
              <Button onClick={handleConfirmarRecepcion} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar Recepción
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Pedidos Pendientes
          </CardTitle>
          <CardDescription>
            Pedidos solicitados por vendedores que necesitan aprobación
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pedidosPendientesAdmin.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay pedidos pendientes
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cantidad Solicitada</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosPendientesAdmin.map(pedido => (
                  <TableRow key={pedido.id}>
                    <TableCell>
                      {format(new Date(pedido.fecha), 'PPP', { locale: es })}
                    </TableCell>
                    <TableCell>{pedido.vendedorNombre}</TableCell>
                    <TableCell>{pedido.productoNombre}</TableCell>
                    <TableCell className="font-bold">{pedido.cantidad}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button 
                          size="sm" 
                          onClick={() => handleAceptarPedido(pedido)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Procesar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleRechazar(pedido.id)}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Rechazar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {pedidosProcesadosAdmin.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay pedidos procesados
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosProcesadosAdmin.map(pedido => (
                  <TableRow key={pedido.id}>
                    <TableCell>
                      {format(new Date(pedido.fecha), 'PPP', { locale: es })}
                    </TableCell>
                    <TableCell>{pedido.vendedorNombre}</TableCell>
                    <TableCell>{pedido.productoNombre}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={pedido.estado === 'entregado' ? 'default' : pedido.estado === 'cancelado' ? 'destructive' : 'secondary'}
                      >
                        {pedido.estado}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Procesar Pedido</DialogTitle>
          </DialogHeader>
          {selectedPedido && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><strong>Vendedor:</strong> {selectedPedido.vendedorNombre}</p>
                <p><strong>Producto:</strong> {selectedPedido.productoNombre}</p>
                <p><strong>Solicitado:</strong> {selectedPedido.cantidad}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cantidadEntregada">Cantidad a Entregar</Label>
                <Input
                  id="cantidadEntregada"
                  type="number"
                  min="1"
                  value={cantidadEntregada}
                  onChange={(e) => setCantidadEntregada(parseInt(e.target.value) || 1)}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                El vendedor deberá confirmar la recepción de esta cantidad
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarEntrega}>Confirmar Entrega</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recepcionOpen} onOpenChange={setRecepcionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Recepción de Pedido</DialogTitle>
          </DialogHeader>
          {selectedPedido && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><strong>Producto:</strong> {selectedPedido.productoNombre}</p>
                <p><strong>Cantidad Aprobada:</strong> {selectedPedido.cantidadEntregada || selectedPedido.cantidad}</p>
              </div>

              {isAdmin ? (
                <>
                  <div className="space-y-2">
                    <Label>Vendedor</Label>
                    <Select value={vendedorIdRecepcion} onValueChange={setVendedorIdRecepcion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedores.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cantidad a Recibir</Label>
                    <Input
                      type="number"
                      min="1"
                      value={cantidadRecepcion}
                      onChange={(e) => setCantidadRecepcion(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Cantidad a Recibir</Label>
                  <Input
                    type="number"
                    min="1"
                    value={cantidadRecepcion}
                    onChange={(e) => setCantidadRecepcion(parseInt(e.target.value) || 1)}
                  />
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Esta cantidad se agregará como entrada en el IPVE del {isAdmin ? 'vendedor seleccionado' : 'vendedor'}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecepcionOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarRecepcion} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Recepción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}