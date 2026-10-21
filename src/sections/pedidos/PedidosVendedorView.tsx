import { useEffect } from 'react';
import {
  CheckCircle, XCircle, Truck, Send, FileCheck, Package, Search, ShoppingCart
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  EmptyState, LabeledInput, PageHeader, SearchInput, SkeletonCards, SkeletonTable,
  StatusBadge, TablePagination, usePagination,
} from '@/components/shared';
import { formatCurrency } from '@/hooks/supabase/useSupabaseData';
import type { Pedido, Producto, Vendedor } from '@/types';
import type { AuthUser } from '@/contexts/AuthContext';
import { PedidosEstadoBadge } from './PedidosEstadoBadge';

const formatFecha = (fecha: string) => format(new Date(fecha), 'PPP', { locale: es });

interface PedidosVendedorViewProps {
  user?: AuthUser;
  productosLoading: boolean;
  pedidosLoading: boolean;
  productos: Producto[];
  productosFiltrados: Producto[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  misPedidosAprobados: Pedido[];
  misPedidosPendientes: Pedido[];
  misPedidosHistorial: Pedido[];
  vendedores: Vendedor[];
  newPedidoOpen: boolean;
  onNewPedidoOpenChange: (open: boolean) => void;
  onCloseNewPedido: () => void;
  selectedProducto: string;
  cantidad: number;
  onCantidadChange: (value: number) => void;
  notas: string;
  onNotasChange: (value: string) => void;
  onPedir: (productoId: string) => void;
  onCrearPedido: () => void;
  seleccionarVendedorOpen: boolean;
  onSeleccionarVendedorOpenChange: (open: boolean) => void;
  vendedorIdTemporal: string;
  onVendedorIdTemporalChange: (value: string) => void;
  onConfirmarVendedorTemporal: () => void;
  recepcionOpen: boolean;
  onRecepcionOpenChange: (open: boolean) => void;
  selectedPedido: Pedido | null;
  cantidadRecepcion: number;
  onCantidadRecepcionChange: (value: number) => void;
  onConfirmarRecibido: (pedido: Pedido) => void;
  onConfirmarRecepcion: () => void;
}

export function PedidosVendedorView({
  productosLoading,
  pedidosLoading,
  productos,
  productosFiltrados,
  searchQuery,
  onSearchChange,
  misPedidosAprobados,
  misPedidosPendientes,
  misPedidosHistorial,
  vendedores,
  newPedidoOpen,
  onNewPedidoOpenChange,
  onCloseNewPedido,
  selectedProducto,
  cantidad,
  onCantidadChange,
  notas,
  onNotasChange,
  onPedir,
  onCrearPedido,
  seleccionarVendedorOpen,
  onSeleccionarVendedorOpenChange,
  vendedorIdTemporal,
  onVendedorIdTemporalChange,
  onConfirmarVendedorTemporal,
  recepcionOpen,
  onRecepcionOpenChange,
  selectedPedido,
  cantidadRecepcion,
  onCantidadRecepcionChange,
  onConfirmarRecibido,
  onConfirmarRecepcion,
}: PedidosVendedorViewProps) {
  const productosPagination = usePagination(productosFiltrados);
  const aprobadosPagination = usePagination(misPedidosAprobados);
  const pendientesPagination = usePagination(misPedidosPendientes);
  const historialPagination = usePagination(misPedidosHistorial);

  // Reset de página al cambiar la búsqueda
  const { reset: resetProductosPage } = productosPagination;
  useEffect(() => { resetProductosPage(); }, [searchQuery, resetProductosPage]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Solicita productos y confirma la recepción de tus pedidos"
        icon={ShoppingCart}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Productos Disponibles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Buscar producto…"
            />
          </div>

          {productosLoading ? (
            <>
              {/* Skeleton de tabla (escritorio) */}
              <div className="hidden md:block">
                <SkeletonTable cols={4} />
              </div>
              {/* Skeleton de tarjetas (móvil) */}
              <div className="md:hidden">
                <SkeletonCards count={4} />
              </div>
            </>
          ) : productos.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Sin productos disponibles"
              description="Cuando el administrador publique productos, aparecerán aquí para solicitarlos."
            />
          ) : productosFiltrados.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Sin resultados para tu búsqueda"
              description="Prueba con otro nombre o código de producto."
            />
          ) : (
            <>
              {/* Vista de tabla (escritorio) */}
              <div className="hidden md:block">
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
                    {productosPagination.pageItems.map(producto => {
                      const tieneStock = producto.stock > 0;
                      const tienePedidoPendiente = misPedidosPendientes.some(
                        p => p.productoId === producto.id
                      );

                      return (
                        <TableRow key={producto.id}>
                          <TableCell className="py-3">
                            <div>
                              <p className="font-medium">{producto.nombre}</p>
                              <p className="text-xs text-muted-foreground">{producto.codigo}</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">{formatCurrency(producto.precioVenta)}</TableCell>
                          <TableCell className="py-3">
                            {tieneStock ? (
                              <StatusBadge tone="success" className="gap-1">
                                <CheckCircle className="size-3" aria-hidden />
                                Disponible
                              </StatusBadge>
                            ) : (
                              <StatusBadge tone="danger" className="gap-1">
                                <XCircle className="size-3" aria-hidden />
                                No disponible
                              </StatusBadge>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            {tienePedidoPendiente ? (
                              <StatusBadge tone="warning">Pendiente</StatusBadge>
                            ) : tieneStock ? (
                              <Button
                                size="sm"
                                onClick={() => onPedir(producto.id)}
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
              </div>

              {/* Vista de tarjetas (móvil) */}
              <div className="md:hidden space-y-3">
                {productosPagination.pageItems.map(producto => {
                  const tieneStock = producto.stock > 0;
                  const tienePedidoPendiente = misPedidosPendientes.some(
                    p => p.productoId === producto.id
                  );
                  return (
                    <Card key={producto.id} className="p-0">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{producto.nombre}</p>
                            <p className="text-xs text-muted-foreground">{producto.codigo}</p>
                          </div>
                          <div className="shrink-0">
                            {tieneStock ? (
                              <StatusBadge tone="success" className="gap-1">
                                <CheckCircle className="size-3" aria-hidden />
                                Disponible
                              </StatusBadge>
                            ) : (
                              <StatusBadge tone="danger" className="gap-1">
                                <XCircle className="size-3" aria-hidden />
                                No disponible
                              </StatusBadge>
                            )}
                          </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">Precio</dt>
                            <dd>{formatCurrency(producto.precioVenta)}</dd>
                          </div>
                        </dl>
                        <div className="flex justify-end">
                          {tienePedidoPendiente ? (
                            <StatusBadge tone="warning">Pendiente</StatusBadge>
                          ) : tieneStock ? (
                            <Button
                              size="sm"
                              onClick={() => onPedir(producto.id)}
                            >
                              <ShoppingCart className="h-3 w-3 mr-1" />
                              Pedir
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">No disponible</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <TablePagination
                page={productosPagination.page}
                pageCount={productosPagination.pageCount}
                setPage={productosPagination.setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {pedidosLoading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          {misPedidosAprobados.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <Send className="h-5 w-5" />
                  Pedidos Aprobados - Por Confirmar Recepción
                </CardTitle>
                <CardDescription>
                  Confirma cuando hayas recibido los productos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Vista de tabla (escritorio) */}
                <div className="hidden md:block">
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
                      {aprobadosPagination.pageItems.map(pedido => (
                        <TableRow key={pedido.id}>
                          <TableCell className="py-3">
                            {formatFecha(pedido.fecha)}
                          </TableCell>
                          <TableCell className="py-3">{pedido.productoNombre}</TableCell>
                          <TableCell className="py-3 font-bold text-warning-foreground">{pedido.cantidadEntregada || pedido.cantidad}</TableCell>
                          <TableCell className="py-3 text-right">
                            <Button
                              size="sm"
                              onClick={() => onConfirmarRecibido(pedido)}
                            >
                              <FileCheck className="h-3 w-3 mr-1" />
                              Confirmar Recepción
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Vista de tarjetas (móvil) */}
                <div className="md:hidden space-y-3">
                  {aprobadosPagination.pageItems.map(pedido => (
                    <Card key={pedido.id} className="p-0">
                      <CardContent className="p-4 space-y-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{pedido.productoNombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFecha(pedido.fecha)}
                          </p>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">Cantidad Aprobada</dt>
                            <dd className="font-bold text-warning-foreground">{pedido.cantidadEntregada || pedido.cantidad}</dd>
                          </div>
                        </dl>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => onConfirmarRecibido(pedido)}
                          >
                            <FileCheck className="h-3 w-3 mr-1" />
                            Confirmar Recepción
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <TablePagination
                  page={aprobadosPagination.page}
                  pageCount={aprobadosPagination.pageCount}
                  setPage={aprobadosPagination.setPage}
                />
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
                {/* Vista de tabla (escritorio) */}
                <div className="hidden md:block">
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
                      {pendientesPagination.pageItems.map(pedido => (
                        <TableRow key={pedido.id}>
                          <TableCell className="py-3">
                            {formatFecha(pedido.fecha)}
                          </TableCell>
                          <TableCell className="py-3">{pedido.productoNombre}</TableCell>
                          <TableCell className="py-3 font-bold">{pedido.cantidad}</TableCell>
                          <TableCell className="py-3">
                            <StatusBadge tone="warning">Pendiente</StatusBadge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Vista de tarjetas (móvil) */}
                <div className="md:hidden space-y-3">
                  {pendientesPagination.pageItems.map(pedido => (
                    <Card key={pedido.id} className="p-0">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{pedido.productoNombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFecha(pedido.fecha)}
                            </p>
                          </div>
                          <div className="shrink-0">
                            <StatusBadge tone="warning">Pendiente</StatusBadge>
                          </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">Cantidad Solicitada</dt>
                            <dd className="font-bold">{pedido.cantidad}</dd>
                          </div>
                        </dl>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <TablePagination
                  page={pendientesPagination.page}
                  pageCount={pendientesPagination.pageCount}
                  setPage={pendientesPagination.setPage}
                />
              </CardContent>
            </Card>
          )}

          {misPedidosHistorial.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historial de Pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Vista de tabla (escritorio) */}
                <div className="hidden md:block">
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
                      {historialPagination.pageItems.map(pedido => (
                        <TableRow key={pedido.id}>
                          <TableCell className="py-3">
                            {formatFecha(pedido.fecha)}
                          </TableCell>
                          <TableCell className="py-3">{pedido.productoNombre}</TableCell>
                          <TableCell className="py-3">{pedido.cantidadEntregada || pedido.cantidad}</TableCell>
                          <TableCell className="py-3">
                            <PedidosEstadoBadge estado={pedido.estado} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Vista de tarjetas (móvil) */}
                <div className="md:hidden space-y-3">
                  {historialPagination.pageItems.map(pedido => (
                    <Card key={pedido.id} className="p-0">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{pedido.productoNombre}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFecha(pedido.fecha)}
                            </p>
                          </div>
                          <div className="shrink-0">
                            <PedidosEstadoBadge estado={pedido.estado} />
                          </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="min-w-0">
                            <dt className="text-xs text-muted-foreground">Cantidad</dt>
                            <dd>{pedido.cantidadEntregada || pedido.cantidad}</dd>
                          </div>
                        </dl>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <TablePagination
                  page={historialPagination.page}
                  pageCount={historialPagination.pageCount}
                  setPage={historialPagination.setPage}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={newPedidoOpen} onOpenChange={onNewPedidoOpenChange}>
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

            <LabeledInput
              label="Cantidad"
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => onCantidadChange(parseInt(e.target.value) || 1)}
            />

            <div className="flex w-full flex-col gap-1.5">
              <Label>Notas (Opcional)</Label>
              <Textarea
                value={notas}
                onChange={(e) => onNotasChange(e.target.value)}
                placeholder="Comentarios adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseNewPedido}>Cancelar</Button>
            <ActionButton onAction={onCrearPedido} successMessage="Pedido enviado">
              Enviar Pedido
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={seleccionarVendedorOpen} onOpenChange={onSeleccionarVendedorOpenChange}>
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
              <Select value={vendedorIdTemporal} onValueChange={onVendedorIdTemporalChange}>
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
            <Button variant="outline" onClick={() => onSeleccionarVendedorOpenChange(false)}>Cancelar</Button>
            <ActionButton onAction={onConfirmarVendedorTemporal} disabled={!vendedorIdTemporal} successMessage="Pedido enviado">
              Confirmar
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recepcionOpen} onOpenChange={onRecepcionOpenChange}>
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

              <LabeledInput
                label="Cantidad a Recibir"
                type="number"
                min="1"
                value={cantidadRecepcion}
                onChange={(e) => onCantidadRecepcionChange(parseInt(e.target.value) || 1)}
              />

              <p className="text-sm text-muted-foreground">
                Esta cantidad se agregará como entrada en tu IPVE
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onRecepcionOpenChange(false)}>Cancelar</Button>
            <ActionButton onAction={onConfirmarRecepcion} successMessage="Recepción confirmada">
              Confirmar Recepción
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
