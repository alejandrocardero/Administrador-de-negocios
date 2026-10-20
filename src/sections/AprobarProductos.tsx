import { useState, useMemo, useRef } from 'react';
import { CheckCircle, XCircle, Clock, Package, PackagePlus, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  const { data: solicitudes, refetch: refetchSolicitudes, aprobarSolicitud, rechazarSolicitud } = useSolicitudesProductoNuevo();
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
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

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

  const handleOpenAprobar = (s: SolicitudProductoNuevo) => {
    setSelectedSolicitud(s);
    setPrecioVenta(Math.round(s.precioCompra * 1.3));
    setStockMinimo(5);
    setCategoria('otros');
    setComentario('');
    setMetodoPago('efectivo');
  };

  const handleAprobar = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
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
    setSelectedSolicitud(null);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleOpenRechazar = (s: SolicitudProductoNuevo) => {
    setSelectedSolicitud(s);
    setRechazoComentario('');
    setRechazarOpen(true);
  };

  const handleRechazar = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
    if (!selectedSolicitud) return;
    await rechazarSolicitud(selectedSolicitud.id, rechazoComentario || undefined);
    await refetchSolicitudes();
    setRechazarOpen(false);
    setSelectedSolicitud(null);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Solicitudes Pendientes</p>
                <p className="text-2xl font-bold text-amber-600">{pendientes.length}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Aprobadas</p>
                <p className="text-2xl font-bold text-green-600">
                  {solicitudes.filter(s => s.estado === 'aprobada').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Rechazadas</p>
                <p className="text-2xl font-bold text-red-600">
                  {solicitudes.filter(s => s.estado === 'rechazada').length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-blue-500" />
            Solicitudes Pendientes
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por producto o comprador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredPendientes.length === 0 ? (
            <p className="text-center py-8 text-slate-500">No hay solicitudes pendientes</p>
          ) : (
            <>
              {/* Vista de tabla (escritorio) */}
              <div className="hidden md:block">
                <Table>
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
                    {filteredPendientes.map(s => (
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
                {filteredPendientes.map(s => (
                  <Card key={s.id} className="p-0">
                    <CardContent className="p-4 space-y-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.nombreProducto}</p>
                        <p className="text-xs text-slate-500">{formatDate(s.fecha)} · {s.compradorNombre}</p>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="min-w-0">
                          <dt className="text-xs text-slate-500">P. Compra</dt>
                          <dd>{formatCurrency(s.precioCompra)}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-slate-500">Cantidad</dt>
                          <dd>{s.cantidad}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-slate-500">Total</dt>
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
            </>
          )}
        </CardContent>
      </Card>

      {historial.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Vista de tabla (escritorio) */}
            <div className="hidden md:block">
              <Table>
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
                  {historial.slice().reverse().map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{formatDate(s.fecha)}</TableCell>
                      <TableCell>{s.compradorNombre}</TableCell>
                      <TableCell className="font-medium">{s.nombreProducto}</TableCell>
                      <TableCell>
                        {s.estado === 'aprobada' ? (
                          <Badge className="bg-green-500">Aprobada</Badge>
                        ) : (
                          <Badge variant="destructive">Rechazada</Badge>
                        )}
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
              {historial.slice().reverse().map(s => (
                <Card key={s.id} className="p-0">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.nombreProducto}</p>
                        <p className="text-xs text-slate-500">{formatDate(s.fecha)} · {s.compradorNombre}</p>
                      </div>
                      <div className="shrink-0">
                        {s.estado === 'aprobada' ? (
                          <Badge className="bg-green-500">Aprobada</Badge>
                        ) : (
                          <Badge variant="destructive">Rechazada</Badge>
                        )}
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">P. Venta</dt>
                        <dd>{s.precioVenta ? formatCurrency(s.precioVenta) : '-'}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">Stock Mín</dt>
                        <dd>{s.stockMinimo ?? '-'}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              ))}
            </div>
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
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-slate-500">Comprador</p>
                    <p className="font-medium">{selectedSolicitud.compradorNombre}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Fecha</p>
                    <p className="font-medium">{formatDate(selectedSolicitud.fecha)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 text-sm">Producto solicitado</p>
                  <p className="font-bold text-lg">{selectedSolicitud.nombreProducto}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-slate-500">Precio Compra</p>
                    <p className="font-medium">{formatCurrency(selectedSolicitud.precioCompra)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Cantidad</p>
                    <p className="font-medium">{selectedSolicitud.cantidad}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Total</p>
                    <p className="font-medium">{formatCurrency(selectedSolicitud.precioCompra * selectedSolicitud.cantidad)}</p>
                  </div>
                </div>
                {selectedSolicitud.notas && (
                  <div className="bg-yellow-50 p-2 rounded text-sm">
                    <p className="text-yellow-800 font-medium">Notas del comprador:</p>
                    <p className="text-yellow-700">{selectedSolicitud.notas}</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-4">
                <p className="font-medium text-sm text-slate-700">Configurar nuevo producto</p>
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
            <Button onClick={handleAprobar} disabled={precioVenta <= 0 || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Package className="w-4 h-4 mr-2" />
              Aprobar y Crear Producto
            </Button>
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
              <p className="text-sm text-slate-600">
                Rechazar solicitud de <strong>{selectedSolicitud.nombreProducto}</strong> de {selectedSolicitud.compradorNombre}
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
            <Button variant="destructive" onClick={handleRechazar} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <XCircle className="w-4 h-4 mr-2" />
              Rechazar Solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}