import { useState, useMemo } from 'react';
import { CheckCircle, XCircle, Clock, Package, PackagePlus, SearchX, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  PageHeader, SearchInput, EmptyState, SkeletonTable, SkeletonCards,
  StatusBadge, usePagination, TablePagination
} from '@/components/shared';
import { useSolicitudesProductoNuevo, useProductos, useCompras, formatCurrency, formatDate } from '@/hooks/supabase/useSupabaseData';
import type { SolicitudProductoNuevo, Producto, CategoriaProducto, Compra, DetalleCompra } from '@/types';

const categorias: { value: CategoriaProducto; label: string }[] = [
  { value: 'aseo', label: 'Aseo' },
  { value: 'comida', label: 'Comida' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'cerveza', label: 'Cerveza' },
  { value: 'otros', label: 'Otros' },
];

export default function AprobarProductos() {
  const { data: solicitudes, loading, refetch: refetchSolicitudes, aprobarSolicitud, rechazarSolicitud } = useSolicitudesProductoNuevo();
  const { create: crearProducto, refetch: refetchProductos } = useProductos();
  const { create: crearCompra, refetch: refetchCompras } = useCompras();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudProductoNuevo | null>(null);
  const [precioVenta, setPrecioVenta] = useState(0);
  const [stockMinimo, setStockMinimo] = useState(1);
  const [categoria, setCategoria] = useState<CategoriaProducto>('otros');
  const [comentario, setComentario] = useState('');
  const [metodoPago, setMetodoPago] = useState<Compra['metodoPago']>('efectivo');
  const [rechazarOpen, setRechazarOpen] = useState(false);
  const [rechazoComentario, setRechazoComentario] = useState('');

  const pendientes = useMemo(() => solicitudes.filter(s => s.estado === 'pendiente'), [solicitudes]);
  const historial = useMemo(() => solicitudes.filter(s => s.estado !== 'pendiente'), [solicitudes]);

  const filteredPendientes = useMemo(() =>
    searchQuery
      ? pendientes.filter(s =>
          s.nombreProducto.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.compradorNombre.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : pendientes,
    [pendientes, searchQuery]
  );

  const pendientesPaginados = usePagination(filteredPendientes, 10);
  const historialOrdenado = useMemo(() => historial.slice().reverse(), [historial]);
  const historialPaginado = usePagination(historialOrdenado, 10);

  const handleOpenAprobar = (s: SolicitudProductoNuevo) => {
    setSelectedSolicitud(s);
    setPrecioVenta(Math.round(s.precioCompra * 1.3));
    setStockMinimo(5);
    setCategoria('otros');
    setComentario('');
    setMetodoPago('efectivo');
  };

  const handleAprobar = async () => {
    if (!selectedSolicitud || precioVenta <= 0 || stockMinimo < 0) return;

    const pctGanancia = Math.round((1 - selectedSolicitud.precioCompra / precioVenta) * 100);
    const nuevoProducto: Omit<Producto, 'id' | 'fechaRegistro'> = {
      codigo: `PRD-${Date.now().toString(36).toUpperCase()}`,
      nombre: selectedSolicitud.nombreProducto,
      descripcion: selectedSolicitud.notas || '',
      categoria,
      precioCompra: selectedSolicitud.precioCompra,
      precioVenta,
      porcentajeGanancia: pctGanancia,
      stock: selectedSolicitud.cantidad,
      stockMinimo,
      unidad: 'unidad',
      activo: true,
    };

    const productoCreado = await crearProducto(nuevoProducto);
    if (!productoCreado) return;

    const detalle: DetalleCompra = {
      productoId: productoCreado.id,
      productoNombre: productoCreado.nombre,
      cantidad: selectedSolicitud.cantidad,
      precioUnitario: selectedSolicitud.precioCompra,
      subtotal: selectedSolicitud.precioCompra * selectedSolicitud.cantidad,
    };

    const nuevaCompra: Omit<Compra, 'id'> = {
      fecha: new Date().toISOString(),
      compradorId: selectedSolicitud.compradorId,
      compradorNombre: selectedSolicitud.compradorNombre,
      detalles: [detalle],
      subtotal: detalle.subtotal,
      total: detalle.subtotal,
      metodoPago,
      estado: 'completada',
      notas: `Producto nuevo aprobado: ${selectedSolicitud.nombreProducto}. ${comentario || ''}`.trim(),
    };

    await crearCompra(nuevaCompra);
    await aprobarSolicitud(selectedSolicitud.id, precioVenta, stockMinimo, productoCreado.id, comentario || undefined);
    await refetchSolicitudes();
    await refetchProductos();
    await refetchCompras();
    toast.success('Producto aprobado y creado');
    setSelectedSolicitud(null);
  };

  const handleOpenRechazar = (s: SolicitudProductoNuevo) => {
    setSelectedSolicitud(s);
    setRechazoComentario('');
    setRechazarOpen(true);
  };

  const handleRechazar = async () => {
    if (!selectedSolicitud) return;
    await rechazarSolicitud(selectedSolicitud.id, rechazoComentario || undefined);
    await refetchSolicitudes();
    toast.success('Solicitud rechazada');
    setRechazarOpen(false);
    setSelectedSolicitud(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprobar Productos"
        description="Solicitudes de productos nuevos enviadas por compradores"
        icon={PackagePlus}
      />

      {/* Estadísticas */}
      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Solicitudes Pendientes</p>
                  <p className="text-2xl font-bold text-warning-foreground">{pendientes.length}</p>
                </div>
                <Clock className="w-8 h-8 text-warning shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aprobadas</p>
                  <p className="text-2xl font-bold text-success">
                    {solicitudes.filter(s => s.estado === 'aprobada').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-success shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rechazadas</p>
                  <p className="text-2xl font-bold text-destructive">
                    {solicitudes.filter(s => s.estado === 'rechazada').length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-destructive shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-primary" />
              Solicitudes Pendientes
            </h2>
            <SearchInput
              value={searchQuery}
              onChange={(v) => { setSearchQuery(v); pendientesPaginados.reset(); }}
              placeholder="Buscar por producto o comprador..."
            />
          </div>

          {loading ? (
            <>
              <div className="hidden md:block">
                <SkeletonTable rows={4} cols={7} />
              </div>
              <div className="md:hidden">
                <SkeletonCards count={3} />
              </div>
            </>
          ) : filteredPendientes.length === 0 ? (
            <EmptyState
              icon={searchQuery ? SearchX : Inbox}
              title={searchQuery ? 'Sin resultados' : 'No hay solicitudes pendientes'}
              description={
                searchQuery
                  ? 'Ninguna solicitud coincide con tu búsqueda.'
                  : 'Cuando un comprador sugiera un producto nuevo, aparecerá aquí para su aprobación.'
              }
            />
          ) : (
            <>
              {/* Vista de tabla (escritorio) */}
              <div className="hidden md:block">
                <Table className="[&_td]:py-3 [&_th]:py-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Comprador</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">P. Compra</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendientesPaginados.pageItems.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">{formatDate(s.fecha)}</TableCell>
                        <TableCell>{s.compradorNombre}</TableCell>
                        <TableCell className="font-medium">{s.nombreProducto}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.precioCompra)}</TableCell>
                        <TableCell className="text-center">{s.cantidad}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(s.precioCompra * s.cantidad)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" onClick={() => handleOpenAprobar(s)}>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Aprobar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleOpenRechazar(s)}>
                              <XCircle className="w-3 h-3 mr-1" />
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
                {pendientesPaginados.pageItems.map(s => (
                  <Card key={s.id} className="p-0">
                    <CardContent className="p-4 space-y-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.nombreProducto}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(s.fecha)} · {s.compradorNombre}</p>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">P. Compra</dt>
                          <dd>{formatCurrency(s.precioCompra)}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">Cantidad</dt>
                          <dd>{s.cantidad}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">Total</dt>
                          <dd className="font-medium">{formatCurrency(s.precioCompra * s.cantidad)}</dd>
                        </div>
                      </dl>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => handleOpenAprobar(s)}>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Aprobar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleOpenRechazar(s)}>
                          <XCircle className="w-3 h-3 mr-1" />
                          Rechazar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <TablePagination
                page={pendientesPaginados.page}
                pageCount={pendientesPaginados.pageCount}
                setPage={pendientesPaginados.setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {historial.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-lg font-semibold">Historial</h2>

            {/* Vista de tabla (escritorio) */}
            <div className="hidden md:block">
              <Table className="[&_td]:py-3 [&_th]:py-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>P. Venta</TableHead>
                    <TableHead>Stock Mín</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historialPaginado.pageItems.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{formatDate(s.fecha)}</TableCell>
                      <TableCell>{s.compradorNombre}</TableCell>
                      <TableCell className="font-medium">{s.nombreProducto}</TableCell>
                      <TableCell>
                        <StatusBadge tone={s.estado === 'aprobada' ? 'success' : 'danger'}>
                          {s.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{s.precioVenta ? formatCurrency(s.precioVenta) : '-'}</TableCell>
                      <TableCell>{s.stockMinimo ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Vista de tarjetas (móvil) */}
            <div className="md:hidden space-y-3">
              {historialPaginado.pageItems.map(s => (
                <Card key={s.id} className="p-0">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.nombreProducto}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(s.fecha)} · {s.compradorNombre}</p>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge tone={s.estado === 'aprobada' ? 'success' : 'danger'}>
                          {s.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                        </StatusBadge>
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">P. Venta</dt>
                        <dd>{s.precioVenta ? formatCurrency(s.precioVenta) : '-'}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Stock Mín</dt>
                        <dd>{s.stockMinimo ?? '-'}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              ))}
            </div>

            <TablePagination
              page={historialPaginado.page}
              pageCount={historialPaginado.pageCount}
              setPage={historialPaginado.setPage}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedSolicitud && !rechazarOpen} onOpenChange={(open) => { if (!open) setSelectedSolicitud(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aprobar Producto Nuevo</DialogTitle>
          </DialogHeader>
          {selectedSolicitud && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Comprador</p>
                    <p className="font-medium">{selectedSolicitud.compradorNombre}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fecha</p>
                    <p className="font-medium">{formatDate(selectedSolicitud.fecha)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Producto solicitado</p>
                  <p className="font-bold text-lg">{selectedSolicitud.nombreProducto}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Precio Compra</p>
                    <p className="font-medium">{formatCurrency(selectedSolicitud.precioCompra)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cantidad</p>
                    <p className="font-medium">{selectedSolicitud.cantidad}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium">{formatCurrency(selectedSolicitud.precioCompra * selectedSolicitud.cantidad)}</p>
                  </div>
                </div>
                {selectedSolicitud.notas && (
                  <div className="bg-warning/15 p-2 rounded border border-warning/30 text-sm">
                    <p className="text-warning-foreground font-medium">Notas del comprador:</p>
                    <p className="text-warning-foreground">{selectedSolicitud.notas}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <p className="font-medium text-sm text-foreground">Configurar nuevo producto</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Precio de Venta *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={precioVenta}
                      onChange={(e) => setPrecioVenta(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stock Mínimo *</Label>
                    <Input
                      type="number"
                      min="0"
                      value={stockMinimo}
                      onChange={(e) => setStockMinimo(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaProducto)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Método de Pago</Label>
                  <Select value={metodoPago} onValueChange={(v) => setMetodoPago(v as Compra['metodoPago'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="credito">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Comentario (opcional)</Label>
                  <Textarea
                    placeholder="Mensaje para el comprador..."
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSolicitud(null)}>Cancelar</Button>
            <ActionButton onAction={handleAprobar} disabled={precioVenta <= 0} successMessage="Producto aprobado">
              <Package className="w-4 h-4 mr-2" />
              Aprobar y Crear Producto
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rechazarOpen} onOpenChange={setRechazarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Solicitud</DialogTitle>
          </DialogHeader>
          {selectedSolicitud && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Rechazar solicitud de <strong className="text-foreground">{selectedSolicitud.nombreProducto}</strong> de {selectedSolicitud.compradorNombre}
              </p>
              <div className="space-y-2">
                <Label>Motivo del rechazo (opcional)</Label>
                <Textarea
                  placeholder="Indique por qué se rechaza..."
                  value={rechazoComentario}
                  onChange={(e) => setRechazoComentario(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazarOpen(false)}>Cancelar</Button>
            <ActionButton onAction={handleRechazar} variant="destructive" successMessage="Solicitud rechazada">
              <XCircle className="w-4 h-4 mr-2" />
              Rechazar Solicitud
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
