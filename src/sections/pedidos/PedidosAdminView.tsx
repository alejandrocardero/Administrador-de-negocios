import { useMemo } from 'react';
import { CheckCircle, XCircle, Truck, FileCheck, AlertTriangle, Info } from 'lucide-react';
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
import {
  EmptyState, LabeledInput, PageHeader, SkeletonTable, TablePagination, usePagination,
} from '@/components/shared';
import type { Pedido, Vendedor } from '@/types';
import { PedidosEstadoBadge } from './PedidosEstadoBadge';

const formatFecha = (fecha: string) => format(new Date(fecha), 'PPP', { locale: es });

import type { Producto } from '@/types';

interface PedidosAdminViewProps {
  pedidosLoading: boolean;
  pedidosPendientesAdmin: Pedido[];
  pedidosProcesadosAdmin: Pedido[];
  vendedores: Vendedor[];
  productos: Producto[];
  confirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  selectedPedido: Pedido | null;
  cantidadEntregada: number;
  onCantidadEntregadaChange: (value: number) => void;
  onConfirmarEntrega: () => void;
  recepcionOpen: boolean;
  onRecepcionOpenChange: (open: boolean) => void;
  cantidadRecepcion: number;
  onCantidadRecepcionChange: (value: number) => void;
  vendedorIdRecepcion: string;
  onVendedorIdRecepcionChange: (value: string) => void;
  onConfirmarRecepcion: () => void;
  onAceptarPedido: (pedido: Pedido) => void;
  onRechazar: (pedidoId: string) => void;
}

// Función para detectar si un pedido es de reposición
const isPedidoReposicion = (pedido: Pedido): boolean => {
  return pedido.notas?.includes('[REPOSICION]') ?? false;
};

// Función para extraer info de stock de las notas de reposición
const getReposicionStockInfo = (notas?: string): { final: number; minimo: number } | null => {
  if (!notas) return null;
  const match = notas.match(/Stock final: (\d+) \(mín: (\d+)\)/);
  if (match) {
    return { final: parseInt(match[1]), minimo: parseInt(match[2]) };
  }
  return null;
};

export function PedidosAdminView({
  pedidosLoading,
  pedidosPendientesAdmin,
  pedidosProcesadosAdmin,
  vendedores,
  productos,
  confirmOpen,
  onConfirmOpenChange,
  selectedPedido,
  cantidadEntregada,
  onCantidadEntregadaChange,
  onConfirmarEntrega,
  recepcionOpen,
  onRecepcionOpenChange,
  cantidadRecepcion,
  onCantidadRecepcionChange,
  vendedorIdRecepcion,
  onVendedorIdRecepcionChange,
  onConfirmarRecepcion,
  onAceptarPedido,
  onRechazar,
}: PedidosAdminViewProps) {
  const procesadosPagination = usePagination(pedidosProcesadosAdmin);

  // Separar pedidos de reposición de pedidos normales
  const pedidosReposicion = useMemo(() => 
    pedidosPendientesAdmin.filter(isPedidoReposicion),
  [pedidosPendientesAdmin]);

  const pedidosNormales = useMemo(() => 
    pedidosPendientesAdmin.filter(p => !isPedidoReposicion(p)),
  [pedidosPendientesAdmin]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Aprueba las solicitudes de los vendedores y revisa el historial"
        icon={Truck}
      />

      {/* Solicitudes de Reposición (Stock Bajo) */}
      {pedidosReposicion.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Solicitudes de Reposición ({pedidosReposicion.length})
            </CardTitle>
            <CardDescription>
              Productos con stock bajo detectados automáticamente al guardar el día. Verifique stock real antes de aprobar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pedidosLoading ? (
              <SkeletonTable cols={7} />
            ) : (
              <>
                {/* Vista de tabla (escritorio) */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Stock Final</TableHead>
                        <TableHead className="text-right">Stock Mín</TableHead>
                        <TableHead className="text-right">Solicitado</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidosReposicion.map((pedido: Pedido) => {
                        const stockInfo = getReposicionStockInfo(pedido.notas);
                        const producto = productos.find(p => p.id === pedido.productoId);
                        const stockActual = producto?.stock ?? 0;
                        
                        return (
                          <TableRow key={pedido.id} className="bg-destructive/5">
                            <TableCell className="py-3">{formatFecha(pedido.fecha)}</TableCell>
                            <TableCell className="py-3">{pedido.vendedorNombre}</TableCell>
                            <TableCell className="py-3 font-medium">{pedido.productoNombre}</TableCell>
                            <TableCell className="py-3 text-right font-bold text-destructive">
                              {stockInfo?.final ?? 'N/A'}
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              {stockInfo?.minimo ?? 'N/A'}
                            </TableCell>
                            <TableCell className="py-3 text-right font-bold">{pedido.cantidad}</TableCell>
                            <TableCell className="py-3 text-right">
                              <div className="flex gap-2 justify-end items-center">
                                {stockActual < stockInfo?.minimo! && stockInfo && (
                                  <span className="text-xs text-destructive flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Stock real: {stockActual} (bajo mínimo)
                                  </span>
                                )}
                                {stockActual >= (stockInfo?.minimo ?? 0) && stockInfo && (
                                  <span className="text-xs text-success flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Stock real: {stockActual}
                                  </span>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => onAceptarPedido(pedido)}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Aprobar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => onRechazar(pedido.id)}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Rechazar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Vista de tarjetas (móvil) */}
                <div className="md:hidden space-y-3">
                  {pedidosReposicion.map((pedido: Pedido) => {
                    const stockInfo = getReposicionStockInfo(pedido.notas);
                    const producto = productos.find(p => p.id === pedido.productoId);
                    const stockActual = producto?.stock ?? 0;
                    
                    return (
                      <Card key={pedido.id} className="p-0 border-destructive/30">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{pedido.productoNombre}</p>
                              <p className="text-xs text-muted-foreground">
                                {pedido.vendedorNombre} · {formatFecha(pedido.fecha)}
                              </p>
                            </div>
                            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                          </div>
                          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                            <div className="min-w-0">
                              <dt className="text-xs text-muted-foreground">Stock Final (IPVE)</dt>
                              <dd className="font-bold text-destructive">{stockInfo?.final ?? 'N/A'}</dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-xs text-muted-foreground">Stock Mínimo</dt>
                              <dd className="font-bold">{stockInfo?.minimo ?? 'N/A'}</dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-xs text-muted-foreground">Solicitado</dt>
                              <dd className="font-bold">{pedido.cantidad}</dd>
                            </div>
                          </dl>
                          <div className="flex items-center gap-2 text-xs">
                            <Info className="h-3 w-3" />
                            <span>Stock real en bodega: <strong>{stockActual}</strong></span>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => onAceptarPedido(pedido)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onRechazar(pedido.id)}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Rechazar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pedidos Normales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Pedidos Pendientes {pedidosNormales.length > 0 && `(${pedidosNormales.length})`}
          </CardTitle>
          <CardDescription>
            Pedidos solicitados por vendedores que necesitan aprobación
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pedidosLoading ? (
            <SkeletonTable cols={5} />
          ) : pedidosNormales.length === 0 && pedidosReposicion.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No hay pedidos pendientes"
              description="Las solicitudes de los vendedores aparecerán aquí para su aprobación."
            />
          ) : pedidosNormales.length > 0 ? (
            <>
              {/* Vista de tabla (escritorio) */}
              <div className="hidden md:block">
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
                    {pedidosNormales.map((pedido: Pedido) => (
                      <TableRow key={pedido.id}>
                        <TableCell className="py-3">
                          {formatFecha(pedido.fecha)}
                        </TableCell>
                        <TableCell className="py-3">{pedido.vendedorNombre}</TableCell>
                        <TableCell className="py-3">{pedido.productoNombre}</TableCell>
                        <TableCell className="py-3 font-bold">{pedido.cantidad}</TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => onAceptarPedido(pedido)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Procesar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onRechazar(pedido.id)}
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
              </div>

              {/* Vista de tarjetas (móvil) */}
              <div className="md:hidden space-y-3">
                {pedidosNormales.map((pedido: Pedido) => (
                  <Card key={pedido.id} className="p-0">
                    <CardContent className="p-4 space-y-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{pedido.productoNombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {pedido.vendedorNombre} · {formatFecha(pedido.fecha)}
                        </p>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">Cantidad Solicitada</dt>
                          <dd className="font-bold">{pedido.cantidad}</dd>
                        </div>
                      </dl>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => onAceptarPedido(pedido)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Procesar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onRechazar(pedido.id)}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Rechazar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {pedidosLoading ? (
            <SkeletonTable cols={4} />
          ) : pedidosProcesadosAdmin.length === 0 ? (
            <EmptyState
              icon={FileCheck}
              title="No hay pedidos procesados"
              description="Cuando proceses solicitudes, quedarán registradas aquí."
            />
          ) : (
            <>
              {/* Vista de tabla (escritorio) */}
              <div className="hidden md:block">
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
                    {procesadosPagination.pageItems.map(pedido => (
                      <TableRow key={pedido.id}>
                        <TableCell className="py-3">
                          {formatFecha(pedido.fecha)}
                        </TableCell>
                        <TableCell className="py-3">{pedido.vendedorNombre}</TableCell>
                        <TableCell className="py-3">{pedido.productoNombre}</TableCell>
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
                {procesadosPagination.pageItems.map(pedido => (
                  <Card key={pedido.id} className="p-0">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{pedido.productoNombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {pedido.vendedorNombre} · {formatFecha(pedido.fecha)}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <PedidosEstadoBadge estado={pedido.estado} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <TablePagination
                page={procesadosPagination.page}
                pageCount={procesadosPagination.pageCount}
                setPage={procesadosPagination.setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={onConfirmOpenChange}>
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

              <LabeledInput
                label="Cantidad a Entregar"
                type="number"
                min="1"
                value={cantidadEntregada}
                onChange={(e) => onCantidadEntregadaChange(parseInt(e.target.value) || 1)}
              />

              <p className="text-sm text-muted-foreground">
                El vendedor deberá confirmar la recepción de esta cantidad
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onConfirmOpenChange(false)}>Cancelar</Button>
            <ActionButton onAction={onConfirmarEntrega} successMessage="Entrega confirmada">
              Confirmar Entrega
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

              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select value={vendedorIdRecepcion} onValueChange={onVendedorIdRecepcionChange}>
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

              <LabeledInput
                label="Cantidad a Recibir"
                type="number"
                min="1"
                value={cantidadRecepcion}
                onChange={(e) => onCantidadRecepcionChange(parseInt(e.target.value) || 1)}
              />

              <p className="text-sm text-muted-foreground">
                Esta cantidad se agregará como entrada en el IPVE del vendedor seleccionado
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
