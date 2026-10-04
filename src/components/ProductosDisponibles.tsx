import { useState, useMemo, useRef } from 'react';
import { Package, ShoppingCart, CheckCircle, XCircle, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { useProductos, usePedidos, useRegistrosIPVE, useVendedores, formatCurrency } from '@/hooks/supabase/useSupabaseData';
import type { Pedido, AuthUser } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProductosDisponiblesProps {
  user: AuthUser;
}

export default function ProductosDisponibles({ user }: ProductosDisponiblesProps) {
  const { productos } = useProductos();
  const { pedidos, agregarPedido, actualizarPedido } = usePedidos();
  const { agregarEntrada } = useRegistrosIPVE();
  const { getVendedorByNombre } = useVendedores();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSinStock, setShowSinStock] = useState(false);
  const [pedidoOpen, setPedidoOpen] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<string | null>(null);
  const [cantidadPedido, setCantidadPedido] = useState(1);
  const [notasPedido, setNotasPedido] = useState('');
  const [confirmEntregaOpen, setConfirmEntregaOpen] = useState(false);
  const [pedidoAConfirmar, setPedidoAConfirmar] = useState<Pedido | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const vendedorId = user.username;

  const productosFiltrados = productos
    .filter(p => p.activo)
    .filter(p => !showSinStock ? p.stock > 0 : true)
    .filter(p => searchQuery
      ? p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.codigo.toLowerCase().includes(searchQuery.toLowerCase())
      : true
    );

  const misPedidosPendientes = useMemo(() => {
    return [...pedidos]
      .filter(p => p.vendedorId === vendedorId && p.estado === 'pendiente')
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [pedidos, vendedorId]);

const misPedidosAprobados = useMemo(() => {
    return [...pedidos]
      .filter(p => p.vendedorId === vendedorId && p.estado === 'aprobado')
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [pedidos, vendedorId]);

  const misPedidosHistorial = useMemo(() => {
    return [...pedidos]
      .filter(p => p.vendedorId === vendedorId && (p.estado === 'entregado' || p.estado === 'cancelado'))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [pedidos, vendedorId]);

  const handleAbrirPedido = (productoId: string) => {
    setProductoSeleccionado(productoId);
    setCantidadPedido(1);
    setNotasPedido('');
    setPedidoOpen(true);
  };

  const handleConfirmarEntrega = (pedido: Pedido) => {
    setPedidoAConfirmar(pedido);
    setConfirmEntregaOpen(true);
  };

  const handleAceptarEntrega = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (!pedidoAConfirmar) return;

      const producto = productos.find(p => p.id === pedidoAConfirmar.productoId);
      if (!producto) return;

      const vendedor = getVendedorByNombre(user.nombre);

      await actualizarPedido(pedidoAConfirmar.id, { estado: 'entregado' });

      if (vendedor) {
        const hoyLocal = new Date();
        const fecha = `${hoyLocal.getFullYear()}-${String(hoyLocal.getMonth() + 1).padStart(2, '0')}-${String(hoyLocal.getDate()).padStart(2, '0')}`;
        await agregarEntrada(fecha, vendedor.id, producto.id, producto.nombre, pedidoAConfirmar.cantidadEntregada || 0, producto.precioVenta);
      }

      setConfirmEntregaOpen(false);
      setPedidoAConfirmar(null);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleRechazarEntrega = () => {
    if (!pedidoAConfirmar) return;
    actualizarPedido(pedidoAConfirmar.id, { 
      estado: 'pendiente',
      cantidadEntregada: undefined,
    });
    setConfirmEntregaOpen(false);
    setPedidoAConfirmar(null);
  };

  const handleConfirmarPedido = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (!productoSeleccionado) return;
      const producto = productos.find(p => p.id === productoSeleccionado);
      if (!producto) return;

      await agregarPedido({
        vendedorId,
        vendedorNombre: user.nombre,
        productoId: producto.id,
        productoNombre: producto.nombre,
        cantidad: cantidadPedido,
        notas: notasPedido || undefined,
      });
      setPedidoOpen(false);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Productos Disponibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar producto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant={showSinStock ? "default" : "outline"}
              onClick={() => setShowSinStock(!showSinStock)}
            >
              {showSinStock ? "Con Stock" : "Todos"}
            </Button>
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
                          Agotado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {tienePedidoPendiente ? (
                        <Badge variant="outline">Pendiente</Badge>
                      ) : tieneStock ? (
                        <Button
                          size="sm"
                          onClick={() => handleAbrirPedido(producto.id)}
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Pedir
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin stock</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pedidos pendientes de aprobación */}
      {misPedidosPendientes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Mis Pedidos Pendientes
            </CardTitle>
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
                {misPedidosPendientes.map(pedido => (
                  <TableRow key={pedido.id}>
                    <TableCell>{format(new Date(pedido.fecha), 'PPP', { locale: es })}</TableCell>
                    <TableCell>{pedido.productoNombre}</TableCell>
                    <TableCell className="font-bold">{pedido.cantidad}</TableCell>
                    <TableCell>
                      <Badge variant="outline">Pendiente</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pedidos aprobados - esperando confirmación */}
      {misPedidosAprobados.length > 0 && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Pendiente de Confirmación
            </CardTitle>
            <CardDescription>
              El administrador ha aprobado tu pedido. Confirma la recepción
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Solicitado</TableHead>
                  <TableHead>Entregado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {misPedidosAprobados.map(pedido => (
                  <TableRow key={pedido.id}>
                    <TableCell>{format(new Date(pedido.fecha), 'PPP', { locale: es })}</TableCell>
                    <TableCell>{pedido.productoNombre}</TableCell>
                    <TableCell>{pedido.cantidad}</TableCell>
                    <TableCell className="font-bold text-green-600">{pedido.cantidadEntregada}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleConfirmarEntrega(pedido)}>
                        Confirmar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Historial de pedidos entregados */}
      {misPedidosHistorial.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Historial de Pedidos
            </CardTitle>
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
                    <TableCell>{format(new Date(pedido.fecha), 'PPP', { locale: es })}</TableCell>
                    <TableCell>{pedido.productoNombre}</TableCell>
                    <TableCell className="font-bold">{pedido.cantidadEntregada || pedido.cantidad}</TableCell>
                    <TableCell>
                      <Badge variant={pedido.estado === 'entregado' ? 'default' : 'destructive'}>
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

      {/* Dialog para realizar pedido */}
      <Dialog open={pedidoOpen} onOpenChange={setPedidoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Realizar Pedido</DialogTitle>
          </DialogHeader>
          {productoSeleccionado && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">
                  {productos.find(p => p.id === productoSeleccionado)?.nombre}
                </p>
                <p className="text-sm text-muted-foreground">
                  {productos.find(p => p.id === productoSeleccionado)?.codigo}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input
                  id="cantidad"
                  type="number"
                  min="1"
                  value={cantidadPedido}
                  onChange={(e) => setCantidadPedido(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notas">Notas (opcional)</Label>
                <Input
                  id="notas"
                  placeholder="Comentarios adicionales..."
                  value={notasPedido}
                  onChange={(e) => setNotasPedido(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPedidoOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarPedido} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar/rechazar entrega */}
      <Dialog open={confirmEntregaOpen} onOpenChange={setConfirmEntregaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Recepción</DialogTitle>
          </DialogHeader>
          {pedidoAConfirmar && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><strong>Producto:</strong> {pedidoAConfirmar.productoNombre}</p>
                <p><strong>Solicitado:</strong> {pedidoAConfirmar.cantidad}</p>
                <p><strong>Entregado:</strong> {pedidoAConfirmar.cantidadEntregada}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                ¿Estás de acuerdo con la cantidad entregada?
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleRechazarEntrega}>No estoy de acuerdo</Button>
            <Button onClick={handleAceptarEntrega} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sí, confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}