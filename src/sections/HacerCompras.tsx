import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, Receipt, Eye, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { useCompras, useCompradores, useProductos, formatCurrency, formatDate, toFechaLocal } from '@/hooks/supabase/useSupabaseData';
import type { Compra, DetalleCompra, Comprador, Producto } from '@/types';

export default function HacerCompras() {
  const { data: compras, create: crearCompra, refetch: refetchCompras } = useCompras();
  const { data: compradores } = useCompradores();
  const { data: productos, update: actualizarProducto } = useProductos();

  const [selectedCompra, setSelectedCompra] = useState<Compra | null>(null);

  const productosNecesarios = useMemo(() =>
    productos.filter(p => p.stock <= p.stockMinimo || p.stock <= 0),
    [productos]
  );

  const [nuevaCompraOpen, setNuevaCompraOpen] = useState(false);
  const [compradorSearch, setCompradorSearch] = useState('');
  const [selectedComprador, setSelectedComprador] = useState<Comprador | null>(null);
  const [productoSearch, setProductoSearch] = useState('');
  const [compradorSugOpen, setCompradorSugOpen] = useState(false);
  const [productoSugOpen, setProductoSugOpen] = useState(false);
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

  const subtotal = useMemo(() =>
    detalles.reduce((sum, d) => sum + d.subtotal, 0),
    [detalles]
  );

  const handleAddProductoConCantidad = (producto: Producto, cantidad: number) => {
    const existingIndex = detalles.findIndex(d => d.productoId === producto.id);

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
    } else {
      const nuevoDetalle: DetalleCompra = {
        productoId: producto.id,
        productoNombre: producto.nombre,
        cantidad: cantidad,
        precioUnitario: producto.precioCompra,
        subtotal: cantidad * producto.precioCompra,
      };
      setDetalles([...detalles, nuevoDetalle]);
    }
    setProductoSearch('');
    setProductoSugOpen(false);
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
    newDetalles[index] = {
      ...newDetalles[index],
      precioUnitario: precio,
      subtotal: newDetalles[index].cantidad * precio,
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
      await refetchCompras();

      for (const detalle of detalles) {
        const producto = productos.find(p => p.id === detalle.productoId);
        if (producto) {
          await actualizarProducto(producto.id, {
            stock: producto.stock + detalle.cantidad,
            precioCompra: detalle.precioUnitario,
          });
        }
      }

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Compras Hoy</p>
                <p className="text-2xl font-bold">{formatCurrency(totalComprasHoy)}</p>
              </div>
              <Receipt className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Productos por Reponer</p>
                <p className="text-2xl font-bold text-red-600">{productosNecesarios.length}</p>
              </div>
              <Badge variant="destructive">{productosNecesarios.length}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registrar Compra</CardTitle>
          <Button onClick={() => setNuevaCompraOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Compra
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Método</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compras.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                      No hay compras registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  compras.slice().reverse().map((compra) => (
                    <TableRow key={compra.id}>
                      <TableCell>{formatDate(compra.fecha)}</TableCell>
                      <TableCell>{compra.compradorNombre}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(compra.total)}</TableCell>
                      <TableCell><span className="capitalize">{getMetodoPagoLabel(compra.metodoPago)}</span></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedCompra(compra)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
                  <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto bg-white border rounded-md shadow-lg">
                    {filteredCompradores.map(c => (
                      <button
                        key={c.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedComprador(c);
                          setCompradorSearch(c.nombre);
                          setCompradorSugOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-100"
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedComprador && (
                <p className="text-sm text-green-600">Seleccionado: {selectedComprador.nombre}</p>
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
                {productoSugOpen && filteredProductos.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto bg-white border rounded-md shadow-lg">
                    {filteredProductos.map(p => (
                      <button
                        key={p.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleAddProductoConCantidad(p, 1)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-100 flex justify-between"
                      >
                        <span>{p.nombre} ({formatCurrency(p.precioCompra)})</span>
                        <Badge variant="secondary">{p.stock} {p.unidad}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Detalles de la Compra</Label>
              {detalles.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No hay productos agregados</p>
              ) : (
                <Table>
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
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveDetalle(index)} className="text-red-500">
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

            <div className="flex justify-end gap-2 pt-4 border-t">
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

      {selectedCompra && (
        <Dialog open={!!selectedCompra} onOpenChange={() => setSelectedCompra(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalle de Compra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><p className="text-slate-500">Fecha</p><p>{formatDate(selectedCompra.fecha)}</p></div>
                <div><p className="text-slate-500">Comprador</p><p>{selectedCompra.compradorNombre}</p></div>
                <div><p className="text-slate-500">Método</p><p className="capitalize">{getMetodoPagoLabel(selectedCompra.metodoPago)}</p></div>
                <div><p className="text-slate-500">Estado</p><p>{selectedCompra.estado}</p></div>
              </div>
              <Table>
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
              {selectedCompra.notas && <p className="text-sm text-slate-500">Notas: {selectedCompra.notas}</p>}
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