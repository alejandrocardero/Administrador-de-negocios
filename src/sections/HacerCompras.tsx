import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Receipt, Eye } from 'lucide-react';
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
import { formatCurrency, formatDate, generateId } from '@/hooks/useStorage';
import type { Compra, DetalleCompra, Comprador, Producto } from '@/types';

function getCompradoresFromStorage(): Comprador[] {
  try {
    const item = localStorage.getItem('compradores');
    if (item) {
      const parsed = JSON.parse(item);
      return Array.isArray(parsed) ? parsed.filter((c: Comprador) => c.activo) : [];
    }
  } catch {
  }
  return [];
}

function getProductosFromStorage(): Producto[] {
  try {
    const item = localStorage.getItem('productos');
    if (item) {
      const parsed = JSON.parse(item);
      return Array.isArray(parsed) ? parsed.filter((p: Producto) => p.activo) : [];
    }
  } catch {
  }
  return [];
}

function getComprasFromStorage(): Compra[] {
  try {
    const item = localStorage.getItem('compras');
    if (item) {
      const parsed = JSON.parse(item);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
  }
  return [];
}

function saveComprasToStorage(compras: Compra[]): void {
  localStorage.setItem('compras', JSON.stringify(compras));
}

function saveProductosToStorage(productos: Producto[]): void {
  localStorage.setItem('productos', JSON.stringify(productos));
}

export default function HacerCompras() {
  const [compradores, setCompradores] = useState<Comprador[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [selectedCompra, setSelectedCompra] = useState<Compra | null>(null);

  useEffect(() => {
    setCompradores(getCompradoresFromStorage());
    setCompras(getComprasFromStorage());
    setProductos(getProductosFromStorage());

    const interval = setInterval(() => {
      setCompradores(getCompradoresFromStorage());
      setCompras(getComprasFromStorage());
      setProductos(getProductosFromStorage());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const productosNecesarios = productos.filter(p => p.stock <= p.stockMinimo || p.stock <= 0);
  
  const [nuevaCompraOpen, setNuevaCompraOpen] = useState(false);
  const [compradorSearch, setCompradorSearch] = useState('');
  const [selectedComprador, setSelectedComprador] = useState<Comprador | null>(null);
  const [productoSearch, setProductoSearch] = useState('');
  const [detalles, setDetalles] = useState<DetalleCompra[]>([]);
  const [metodoPago, setMetodoPago] = useState<Compra['metodoPago']>('efectivo');
  const [notas, setNotas] = useState('');

  const filteredCompradores = compradorSearch
    ? compradores.filter(c => c.nombre.toLowerCase().includes(compradorSearch.toLowerCase()))
    : [];

  const filteredProductos = productoSearch
    ? productos.filter(p => 
        p.nombre.toLowerCase().includes(productoSearch.toLowerCase()) ||
        p.codigo.toLowerCase().includes(productoSearch.toLowerCase())
      )
    : [];

  const subtotal = detalles.reduce((sum, d) => sum + d.subtotal, 0);

  const handleAddProducto = (producto: Producto) => {
    handleAddProductoConCantidad(producto, 1);
  };

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

  const handleGuardarCompra = () => {
    if (detalles.length === 0 || !selectedComprador) return;

    const nuevaCompra: Compra = {
      id: generateId(),
      fecha: new Date().toISOString(),
      compradorId: selectedComprador.id,
      compradorNombre: selectedComprador.nombre,
      detalles,
      subtotal,
      total: subtotal,
      metodoPago,
      estado: 'completada',
      notas,
    };

    const nuevasCompras = [...compras, nuevaCompra];
    setCompras(nuevasCompras);
    saveComprasToStorage(nuevasCompras);

    const productosActualizados = productos.map(p => {
      const detalle = detalles.find(d => d.productoId === p.id);
      if (detalle) {
        return {
          ...p,
          stock: p.stock + detalle.cantidad,
          precioCompra: detalle.precioUnitario,
        };
      }
      return p;
    });
    setProductos(productosActualizados);
    saveProductosToStorage(productosActualizados);

    setDetalles([]);
    setSelectedComprador(null);
    setCompradorSearch('');
    setMetodoPago('efectivo');
    setNotas('');
    setSelectionMode(false);
    setSelectedProductos(new Set());
    setNuevaCompraOpen(false);
  };

  const getMetodoPagoLabel = (metodo: Compra['metodoPago']) => {
    const labels = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', credito: 'Crédito' };
    return labels[metodo];
  };

  const comprasHoy = compras.filter(c => 
    new Date(c.fecha).toDateString() === new Date().toDateString() && 
    c.estado === 'completada'
  );
  const totalComprasHoy = comprasHoy.reduce((sum, c) => sum + c.total, 0);

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
            <DialogDescription>Registre una nueva compra</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Comprador *</Label>
              {selectedComprador ? (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <p className="font-medium">{selectedComprador.nombre}</p>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedComprador(null)}>Cambiar</Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Buscar comprador..." value={compradorSearch} onChange={(e) => setCompradorSearch(e.target.value)} className="pl-10" />
                  {filteredCompradores.length > 0 && compradorSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCompradores.map((comprador) => (
                        <button key={comprador.id} className="w-full px-4 py-2 text-left hover:bg-slate-50" onClick={() => { setSelectedComprador(comprador); setCompradorSearch(''); }}>
                          <p className="font-medium">{comprador.nombre}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Productos a Comprar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Buscar producto..." value={productoSearch} onChange={(e) => setProductoSearch(e.target.value)} className="pl-10 w-48" />
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-center w-24">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productos.filter(p => productoSearch === '' || p.nombre.toLowerCase().includes(productoSearch.toLowerCase()) || p.codigo.toLowerCase().includes(productoSearch.toLowerCase())).map((producto) => {
                      const detalleExistente = detalles.find(d => d.productoId === producto.id);
                      const cantidadIngresada = detalleExistente?.cantidad || 1;
                      const isSelected = detalleExistente !== undefined;

                      return (
                        <TableRow key={producto.id} className={isSelected ? 'bg-blue-50' : ''}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  if (cantidadIngresada > 0) {
                                    handleAddProductoConCantidad(producto, cantidadIngresada);
                                  }
                                } else {
                                  setDetalles(prev => prev.filter(d => d.productoId !== producto.id));
                                }
                              }}
                              className="w-4 h-4"
                            />
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{producto.nombre}</p>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(producto.precioCompra)}</TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="1"
                              value={cantidadIngresada}
                              onChange={(e) => {
                                const cantidad = parseInt(e.target.value) || 1;
                                if (isSelected) {
                                  setDetalles(prev => prev.map(d =>
                                    d.productoId === producto.id
                                      ? { ...d, cantidad, subtotal: cantidad * d.precioUnitario }
                                      : d
                                  ));
                                }
                              }}
                              className="w-20 mx-auto text-center"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {detalles.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">P. Unitario</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalles.map((detalle, index) => (
                      <TableRow key={index}>
                        <TableCell>{detalle.productoNombre}</TableCell>
                        <TableCell className="text-right">
                          <Input type="number" value={detalle.precioUnitario} onChange={(e) => handleUpdatePrecio(index, parseFloat(e.target.value) || 0)} className="w-24 ml-auto text-right" />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="number" min="1" value={detalle.cantidad} onChange={(e) => handleUpdateCantidad(index, parseInt(e.target.value) || 1)} className="w-20 mx-auto text-center" />
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(detalle.subtotal)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveDetalle(index)} className="text-red-500 hover:text-red-700 h-6 w-6">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {detalles.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Método de Pago</Label>
                <Select value={metodoPago} onValueChange={(v) => setMetodoPago(v as Compra['metodoPago'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas..." />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevaCompraOpen(false)}>Cancelar</Button>
            <Button onClick={handleGuardarCompra} disabled={detalles.length === 0 || !selectedComprador}>
              <Receipt className="w-4 h-4 mr-2" />
              Guardar Compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCompra} onOpenChange={() => setSelectedCompra(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Compra</DialogTitle>
            <DialogDescription>
              Compra del {selectedCompra && formatDate(selectedCompra.fecha)}
            </DialogDescription>
          </DialogHeader>
          {selectedCompra && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Comprador</p>
                  <p className="font-medium">{selectedCompra.compradorNombre}</p>
                </div>
                <div>
                  <p className="text-slate-500">Método de Pago</p>
                  <p className="font-medium capitalize">{getMetodoPagoLabel(selectedCompra.metodoPago)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total</p>
                  <p className="font-medium text-lg">{formatCurrency(selectedCompra.total)}</p>
                </div>
              </div>

              {selectedCompra.notas && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-sm font-medium text-yellow-800">Nota:</p>
                  <p className="text-sm text-yellow-700">{selectedCompra.notas}</p>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">P. Unitario</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCompra.detalles.map((detalle, index) => (
                      <TableRow key={index}>
                        <TableCell>{detalle.productoNombre}</TableCell>
                        <TableCell className="text-right">{formatCurrency(detalle.precioUnitario)}</TableCell>
                        <TableCell className="text-center">{detalle.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCurrency(detalle.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-medium">Total:</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(selectedCompra.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCompra(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}