import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, Receipt, Eye, Loader2, SearchX, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  PageHeader, EmptyState, SkeletonTable, usePagination, TablePagination
} from '@/components/shared';
import { useCompras, useCompradores, useProductos, useProductosPendientesAprobacion, formatCurrency, formatDate, toFechaLocal } from '@/hooks/supabase/useSupabaseData';
import type { Compra, DetalleCompra, Comprador, Producto, SolicitudProductoTipo } from '@/types';
import { ActionButton } from '@/components/ui/action-button';
import { supabase } from '@/lib/supabase';

export default function HacerCompras() {
  const { data: compras, loading, create: crearCompra, refetch: refetchCompras } = useCompras();
  const { data: compradores } = useCompradores();
  const { data: productos, update: actualizarProducto, refetch: refetchProductos } = useProductos();

  const [selectedCompra, setSelectedCompra] = useState<Compra | null>(null);

  const productosNecesarios = useMemo(() =>
    productos.filter(p => p.stock <= p.stockMinimo || p.stock <= 0),
    [productos]
  );

  const comprasOrdenadas = useMemo(() => compras.slice().reverse(), [compras]);
  const { pageItems, page, pageCount, setPage } = usePagination(comprasOrdenadas, 10);

  const { getMisSolicitudes, crearSolicitud } = useProductosPendientesAprobacion();

  const [nuevaCompraOpen, setNuevaCompraOpen] = useState(false);
  const [compradorSearch, setCompradorSearch] = useState('');
  const [selectedComprador, setSelectedComprador] = useState<Comprador | null>(null);
  const [productoSearch, setProductoSearch] = useState('');
  const [compradorSugOpen, setCompradorSugOpen] = useState(false);
  const [productoSugOpen, setProductoSugOpen] = useState(false);
  
  // Flujo de aprobación para productos nuevos y cambios de precio
  const [solicitudOpen, setSolicitudOpen] = useState(false);
  const [solicitudTipo, setSolicitudTipo] = useState<SolicitudProductoTipo>('nuevo');
  const [productoParaSolicitud, setProductoParaSolicitud] = useState<Producto | null>(null);
  const [solicitudForm, setSolicitudForm] = useState({
    nombre: '',
    categoria: 'otros' as Producto['categoria'],
    precioCompra: '',
    cantidadInicial: '1',
    unidad: 'unidad',
    notas: '',
  });
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  
  const misSolicitudes = useMemo(() => getMisSolicitudes(selectedComprador?.id || ''), [getMisSolicitudes, selectedComprador?.id]);
  const solicitudesPendientesComprador = misSolicitudes.filter(s => s.estado === 'pendiente');
  
  // Productos creados en esta compra: aún no aparecen en `productos` (lista del hook)
  const productosCreadosRef = useRef<Producto[]>([]);
  const [detalles, setDetalles] = useState<DetalleCompra[]>([]);
  const [metodoPago, setMetodoPago] = useState<Compra['metodoPago']>('efectivo');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Al cerrar el diálogo, ocultar ambas barras de sugerencias
  // (el blur programático no siempre dispara al desmontar el contenido del Dialog)
  useEffect(() => {
    if (!nuevaCompraOpen) {
      setCompradorSugOpen(false);
      setProductoSugOpen(false);
    }
  }, [nuevaCompraOpen]);

  const filteredCompradores = useMemo(() =>
    compradorSearch
      ? compradores.filter(c => c.nombre.toLowerCase().includes(compradorSearch.toLowerCase()))
      : [],
    [compradores, compradorSearch]
  );

  const filteredProductos = useMemo(() =>
    productoSearch
      ? productos.filter(p => p.activo && p.nombre.toLowerCase().includes(productoSearch.toLowerCase()))
      : productos.filter(p => p.activo),
    [productos, productoSearch]
  );

  // true cuando la búsqueda no coincide exactamente con ningún producto activo:
  // en ese caso se ofrece crearlo como producto nuevo.
  const busquedaSinCoincidenciaExacta = useMemo(() => {
    const q = productoSearch.trim().toLowerCase();
    if (!q) return false;
    return !productos.some(p => p.activo && p.nombre.trim().toLowerCase() === q);
  }, [productos, productoSearch]);

  const subtotal = useMemo(() =>
    detalles.reduce((sum, d) => sum + d.subtotal, 0),
    [detalles]
  );

  const handleAddProductoConCantidad = (producto: Producto, cantidad: number) => {
    const existingIndex = detalles.findIndex(d => d.productoId === producto.id);

    // Si ya está en la compra, solo actualizar cantidad
    if (existingIndex >= 0) {
      const newDetalles = [...detalles];
      const detalle = newDetalles[existingIndex];
      const newCantidad = detalle.cantidad + cantidad;
      newDetalles[existingIndex] = {
        ...detalle,
        cantidad: newCantidad,
        subtotal: newCantidad * detalle.precioUnitario,
      };
      setDetalles(newDetalles);
      setProductoSearch('');
      setProductoSugOpen(false);
      return;
    }

    // Verificar si el precio de compra ingresado difiere del precio actual del producto
    // El precio real se captura en el input de la tabla de detalles
    // Aquí solo agregamos con el precio actual del producto
    
    const nuevoDetalle: DetalleCompra = {
      productoId: producto.id,
      productoNombre: producto.nombre,
      cantidad: cantidad,
      precioUnitario: producto.precioCompra,
      subtotal: cantidad * producto.precioCompra,
    };
    setDetalles([...detalles, nuevoDetalle]);
    setProductoSearch('');
    setProductoSugOpen(false);
  };

  const handleAbrirSolicitudNuevo = () => {
    const nombre = productoSearch.trim();
    if (!nombre) return;
    setSolicitudTipo('nuevo');
    setProductoParaSolicitud(null);
    setSolicitudForm({
      nombre,
      categoria: 'otros',
      precioCompra: '',
      cantidadInicial: '1',
      unidad: 'unidad',
      notas: '',
    });
    setProductoSugOpen(false);
    setSolicitudOpen(true);
  };

  const handleAbrirSolicitudCambioPrecio = (producto: Producto, precioNuevo: number) => {
    setSolicitudTipo('cambio_precio');
    setProductoParaSolicitud(producto);
    setSolicitudForm({
      nombre: producto.nombre,
      categoria: producto.categoria,
      precioCompra: precioNuevo.toString(),
      cantidadInicial: '1',
      unidad: producto.unidad,
      notas: `Cambio de precio: anterior ${formatCurrency(producto.precioCompra)} → nuevo ${formatCurrency(precioNuevo)}`,
    });
    setProductoSugOpen(false);
    setSolicitudOpen(true);
  };

  const handleEnviarSolicitud = async () => {
    if (enviandoSolicitud || !selectedComprador) return;
    
    const nombre = solicitudForm.nombre.trim();
    const precioCompra = parseFloat(solicitudForm.precioCompra);
    const cantidadInicial = parseInt(solicitudForm.cantidadInicial);
    
    if (!nombre || isNaN(precioCompra) || precioCompra <= 0 || isNaN(cantidadInicial) || cantidadInicial <= 0) {
      toast.error('Complete todos los campos obligatorios');
      return;
    }
    
    setEnviandoSolicitud(true);
    try {
      await crearSolicitud({
        compradorId: selectedComprador.id,
        nombre,
        categoria: solicitudForm.categoria,
        precioCompra,
        cantidadInicial,
        unidad: solicitudForm.unidad,
        tipo: solicitudTipo,
        productoExistenteId: productoParaSolicitud?.id,
        precioCompraAnterior: productoParaSolicitud?.precioCompra,
        notas: solicitudForm.notas,
      });
      
      toast.success(solicitudTipo === 'nuevo' 
        ? 'Solicitud de producto nuevo enviada para aprobación' 
        : 'Solicitud de cambio de precio enviada para aprobación');
      
      setSolicitudOpen(false);
      setSolicitudForm({ nombre: '', categoria: 'otros', precioCompra: '', cantidadInicial: '1', unidad: 'unidad', notas: '' });
      setProductoParaSolicitud(null);
    } catch (error) {
      console.error('Error enviando solicitud:', error);
      toast.error('Error al enviar la solicitud');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const handleUpdateCantidad = (index: number, cantidad: number) => {
    if (cantidad <= 0) {
      setDetalles(detalles.filter((_, i) => i !== index));
      return;
    }
    const newDetalles = [...detalles];
    newDetalles[index] = {
      ...newDetalles[index],
      cantidad,
      subtotal: cantidad * newDetalles[index].precioUnitario,
    };
    setDetalles(newDetalles);
  };

  const handleUpdatePrecio = (index: number, precio: number) => {
    if (precio < 0) return;
    const newDetalles = [...detalles];
    const detalle = newDetalles[index];
    const producto = productos.find(p => p.id === detalle.productoId);
    
    // Si el precio difiere del precio de compra actual del producto, ofrecer solicitud de cambio
    if (producto && Math.abs(precio - producto.precioCompra) > 0.01) {
      // Actualizar el precio en el detalle
      newDetalles[index] = {
        ...detalle,
        precioUnitario: precio,
        subtotal: detalle.cantidad * precio,
      };
      setDetalles(newDetalles);
      
      // Mostrar dialog para solicitar cambio de precio
      handleAbrirSolicitudCambioPrecio(producto, precio);
      return;
    }
    
    newDetalles[index] = {
      ...detalle,
      precioUnitario: precio,
      subtotal: detalle.cantidad * precio,
    };
    setDetalles(newDetalles);
  };

  const handleRemoveDetalle = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const handleGuardarCompra = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (detalles.length === 0 || !selectedComprador) return;

      const nuevaCompra: Omit<Compra, 'id'> = {
        fecha: toFechaLocal(new Date()),
        compradorId: selectedComprador.id,
        compradorNombre: selectedComprador.nombre,
        detalles,
        subtotal,
        total: subtotal,
        metodoPago,
        estado: 'completada',
        notas,
      };

      await crearCompra(nuevaCompra);
      toast.success('Compra registrada');
      await refetchCompras();

      for (const detalle of detalles) {
        // Los productos recién creados no están aún en `productos`: buscarlos en el ref
        const producto = productos.find(p => p.id === detalle.productoId)
          ?? productosCreadosRef.current.find(p => p.id === detalle.productoId);
        if (producto) {
          const nuevoStock = producto.stock + detalle.cantidad;
          await actualizarProducto(producto.id, {
            stock: nuevoStock,
            precioCompra: detalle.precioUnitario,
          });
          // Limpiar tag si corresponde (re-stock o stock=0)
          await supabase.rpc('limpiar_tag_si_corresponde', {
            p_producto_id: producto.id,
            p_nueva_entrada: detalle.cantidad,
            p_nuevo_stock: nuevoStock
          });
        }
      }

      await refetchProductos();
      productosCreadosRef.current = [];

      setDetalles([]);
      setSelectedComprador(null);
      setCompradorSearch('');
      setMetodoPago('efectivo');
      setNotas('');
      setNuevaCompraOpen(false);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const getMetodoPagoLabel = (metodo: Compra['metodoPago']) => {
    const labels = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', credito: 'Crédito' };
    return labels[metodo];
  };

  const comprasHoy = useMemo(() =>
    compras.filter(c =>
      new Date(c.fecha).toDateString() === new Date().toDateString() &&
      c.estado === 'completada'
    ),
    [compras]
  );
  const totalComprasHoy = useMemo(() =>
    comprasHoy.reduce((sum, c) => sum + c.total, 0),
    [comprasHoy]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compras"
        description="Registra las compras de productos para reponer inventario"
        icon={Receipt}
        actions={
          <Button onClick={() => setNuevaCompraOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Compra
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compras Hoy</p>
                <p className="text-2xl font-bold">{formatCurrency(totalComprasHoy)}</p>
              </div>
              <Receipt className="w-8 h-8 text-primary shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Productos por Reponer</p>
                <p className="text-2xl font-bold text-destructive">{productosNecesarios.length}</p>
              </div>
              <Badge variant="destructive">{productosNecesarios.length}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-semibold">Historial de Compras</h2>

          {loading ? (
            <SkeletonTable rows={5} cols={5} />
          ) : compras.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No hay compras registradas"
              description="Registra tu primera compra para reponer el inventario."
              action={
                <Button onClick={() => setNuevaCompraOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Compra
                </Button>
              }
            />
          ) : (
            <>
              <Table className="[&_td]:py-3 [&_th]:py-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((compra) => (
                    <TableRow key={compra.id}>
                      <TableCell>{formatDate(compra.fecha)}</TableCell>
                      <TableCell>{compra.compradorNombre}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(compra.total)}</TableCell>
                      <TableCell><span className="capitalize">{getMetodoPagoLabel(compra.metodoPago)}</span></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedCompra(compra)} title="Ver detalles">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination page={page} pageCount={pageCount} setPage={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={nuevaCompraOpen} onOpenChange={setNuevaCompraOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Compra</DialogTitle>
            <DialogDescription>Registre una nueva compra de productos</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comprador">Comprador *</Label>
              <div className="relative">
                <Input
                  id="comprador"
                  placeholder="Buscar comprador..."
                  value={compradorSearch}
                  onChange={(e) => {
                    setCompradorSearch(e.target.value);
                    setCompradorSugOpen(true);
                  }}
                  onFocus={() => {
                    setSelectedComprador(null);
                    setCompradorSugOpen(true);
                  }}
                  onClick={() => setCompradorSugOpen(true)}
                  onBlur={() => setCompradorSugOpen(false)}
                />
                {compradorSugOpen && filteredCompradores.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
                    {filteredCompradores.map(c => (
                      <button
                        key={c.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedComprador(c);
                          setCompradorSearch(c.nombre);
                          setCompradorSugOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-accent"
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedComprador && (
                <p className="text-sm text-success">Seleccionado: {selectedComprador.nombre}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="producto">Producto *</Label>
              <div className="relative">
                <Input
                  id="producto"
                  placeholder="Buscar producto..."
                  value={productoSearch}
                  onChange={(e) => {
                    setProductoSearch(e.target.value);
                    setProductoSugOpen(true);
                  }}
                  onFocus={() => setProductoSugOpen(true)}
                  onClick={() => setProductoSugOpen(true)}
                  onBlur={() => setProductoSugOpen(false)}
                />
                {productoSugOpen && (filteredProductos.length > 0 || (productoSearch.trim() !== '' && busquedaSinCoincidenciaExacta)) && (
                  <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
                    {filteredProductos.map(p => (
                      <div key={p.id} className="px-3 py-2">
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleAddProductoConCantidad(p, 1)}
                          className="w-full px-3 py-2 text-left hover:bg-accent flex justify-between"
                        >
                          <span>{p.nombre} ({formatCurrency(p.precioCompra)})</span>
                          <Badge variant="secondary">{p.stock} {p.unidad}</Badge>
                        </button>
                        {/* Opción para solicitar cambio de precio si el comprador quiere otro precio */}
                        <div className="ml-8 mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Si el precio difiere:</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAbrirSolicitudCambioPrecio(p, p.precioCompra); // Se editará en el formulario
                            }}
                          >
                            Solicitar cambio de precio
                          </Button>
                        </div>
                      </div>
                    ))}
                    {productoSearch.trim() !== '' && busquedaSinCoincidenciaExacta && (
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleAbrirSolicitudNuevo}
                        className="w-full px-3 py-2 text-left hover:bg-primary/10 border-t border-border flex items-center gap-2 text-primary font-medium"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span>Agregar "{productoSearch.trim()}" como producto nuevo (requiere aprobación)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Detalles de la Compra</Label>
              {detalles.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No hay productos agregados"
                  description="Busca un producto para agregarlo a la compra."
                  className="py-6"
                />
              ) : (
                <Table className="[&_td]:py-3 [&_th]:py-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">P. Unitario</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalles.map((detalle, index) => (
                      <TableRow key={index}>
                        <TableCell>{detalle.productoNombre}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="1"
                            value={detalle.cantidad}
                            onChange={(e) => handleUpdateCantidad(index, parseInt(e.target.value) || 0)}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={detalle.precioUnitario}
                            onChange={(e) => handleUpdatePrecio(index, parseFloat(e.target.value) || 0)}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(detalle.subtotal)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveDetalle(index)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="metodoPago">Método de Pago</Label>
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
                <Label htmlFor="notas">Notas</Label>
                <Input id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones..." />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <p className="text-lg font-bold self-center">Total: {formatCurrency(subtotal)}</p>
              <Button variant="outline" onClick={() => setNuevaCompraOpen(false)}>Cancelar</Button>
              <Button onClick={handleGuardarCompra} disabled={detalles.length === 0 || !selectedComprador || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar Compra
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para solicitar aprobación de producto nuevo o cambio de precio */}
      <Dialog open={solicitudOpen} onOpenChange={setSolicitudOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{solicitudTipo === 'nuevo' ? 'Solicitar Producto Nuevo' : 'Solicitar Cambio de Precio'}</DialogTitle>
            <DialogDescription>
              {solicitudTipo === 'nuevo' 
                ? 'El admin revisará y definirá precio de venta y stock mínimo. Se agregará al inventario con etiqueta "Nuevo".'
                : `Cambio de precio para "${productoParaSolicitud?.nombre}". El admin reestructurará el precio de venta. Se agregará etiqueta "Cambio de precio" por 1 semana.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {productoParaSolicitud && (
              <div className="p-4 bg-muted rounded-lg border border-warning/30">
                <p className="text-sm font-medium text-warning-foreground">Producto existente: {productoParaSolicitud.nombre}</p>
                <p className="text-xs text-muted-foreground">Precio actual: {formatCurrency(productoParaSolicitud.precioCompra)} → Nuevo: {formatCurrency(parseFloat(solicitudForm.precioCompra) || 0)}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sol-nombre">Nombre *</Label>
                <Input
                  id="sol-nombre"
                  value={solicitudForm.nombre}
                  onChange={(e) => setSolicitudForm({ ...solicitudForm, nombre: e.target.value })}
                  placeholder="Nombre del producto"
                  disabled={solicitudTipo === 'cambio_precio'}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sol-categoria">Categoría *</Label>
                <Select
                  value={solicitudForm.categoria}
                  onValueChange={(v) => setSolicitudForm({ ...solicitudForm, categoria: v as Producto['categoria'] })}
                  disabled={solicitudTipo === 'cambio_precio'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aseo">Aseo</SelectItem>
                    <SelectItem value="comida">Comida</SelectItem>
                    <SelectItem value="bebidas">Bebidas</SelectItem>
                    <SelectItem value="cerveza">Cerveza</SelectItem>
                    <SelectItem value="otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sol-precio">Precio de Compra *</Label>
                <Input
                  id="sol-precio"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={solicitudForm.precioCompra}
                  onChange={(e) => setSolicitudForm({ ...solicitudForm, precioCompra: e.target.value })}
                  placeholder="0"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sol-cantidad">Cantidad Inicial *</Label>
                <Input
                  id="sol-cantidad"
                  type="number"
                  min="1"
                  value={solicitudForm.cantidadInicial}
                  onChange={(e) => setSolicitudForm({ ...solicitudForm, cantidadInicial: e.target.value })}
                  placeholder="1"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sol-unidad">Unidad</Label>
                <Input
                  id="sol-unidad"
                  value={solicitudForm.unidad}
                  onChange={(e) => setSolicitudForm({ ...solicitudForm, unidad: e.target.value })}
                  placeholder="unidad"
                  disabled={solicitudTipo === 'cambio_precio'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sol-notas">Notas</Label>
              <Textarea
                id="sol-notas"
                value={solicitudForm.notas}
                onChange={(e) => setSolicitudForm({ ...solicitudForm, notas: e.target.value })}
                placeholder="Información adicional para el admin..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSolicitudOpen(false); setSolicitudForm({ nombre: '', categoria: 'otros', precioCompra: '', cantidadInicial: '1', unidad: 'unidad', notas: '' }); setProductoParaSolicitud(null); }}>
              Cancelar
            </Button>
            <ActionButton onAction={handleEnviarSolicitud} disabled={enviandoSolicitud || !solicitudForm.nombre.trim() || !solicitudForm.precioCompra}>
              {enviandoSolicitud && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar para Aprobación
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Panel de mis solicitudes pendientes */}
      {solicitudesPendientesComprador.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" />
                Mis Solicitudes Pendientes ({solicitudesPendientesComprador.length})
              </h3>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {solicitudesPendientesComprador.map(s => (
                <div key={s.id} className="p-3 bg-card rounded-lg border border-border flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{s.nombre}</span>
                      <Badge variant="outline" className={s.tipo === 'nuevo' ? 'bg-blue/10 text-blue' : 'bg-orange/10 text-orange'}>
                        {s.tipo === 'nuevo' ? 'Nuevo' : 'Cambio Precio'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.tipo === 'nuevo' 
                        ? `Categoría: ${s.categoria} | Precio compra: ${formatCurrency(s.precioCompra)} | Cantidad: ${s.cantidadInicial}`
                        : `Cambio: ${formatCurrency(s.precioCompraAnterior || 0)} → ${formatCurrency(s.precioCompra)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">Enviada: {formatDate(s.fechaCreacion)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">Pendiente</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCompra && (
        <Dialog open={!!selectedCompra} onOpenChange={() => setSelectedCompra(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalle de Compra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">Fecha</p><p>{formatDate(selectedCompra.fecha)}</p></div>
                <div><p className="text-muted-foreground">Comprador</p><p>{selectedCompra.compradorNombre}</p></div>
                <div><p className="text-muted-foreground">Método</p><p className="capitalize">{getMetodoPagoLabel(selectedCompra.metodoPago)}</p></div>
                <div><p className="text-muted-foreground">Estado</p><p>{selectedCompra.estado}</p></div>
              </div>
              <Table className="[&_td]:py-3 [&_th]:py-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">P. Unitario</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedCompra.detalles.map((detalle, index) => (
                    <TableRow key={index}>
                      <TableCell>{detalle.productoNombre}</TableCell>
                      <TableCell className="text-right">{detalle.cantidad}</TableCell>
                      <TableCell className="text-right">{formatCurrency(detalle.precioUnitario)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(detalle.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end">
                <p className="text-xl font-bold">Total: {formatCurrency(selectedCompra.total)}</p>
              </div>
              {selectedCompra.notas && <p className="text-sm text-muted-foreground">Notas: {selectedCompra.notas}</p>}
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedCompra(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
