import { useState } from 'react';
import { 
  Plus, Search, Trash2, Receipt, Calendar, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { useCompras, useCompradores, useProductos, formatCurrency, formatDate } from '@/hooks/useStorage';
import type { Compra, DetalleCompra, Comprador, Producto } from '@/types';

export default function Compras() {
  const { compras, agregarCompra, cancelarCompra } = useCompras();
  const { buscarCompradores } = useCompradores();
  const { buscarProductos, getProductoById, actualizarProducto } = useProductos();

  const [searchQuery, setSearchQuery] = useState('');
  
  // Estado para nueva compra
  const [nuevaCompraOpen, setNuevaCompraOpen] = useState(false);
  const [compradorSearch, setCompradorSearch] = useState('');
  const [selectedComprador, setSelectedComprador] = useState<Comprador | null>(null);
  const [productoSearch, setProductoSearch] = useState('');
  const [detalles, setDetalles] = useState<DetalleCompra[]>([]);
  const [metodoPago, setMetodoPago] = useState<Compra['metodoPago']>('efectivo');
  const [notas, setNotas] = useState('');
  const [updateInventory, setUpdateInventory] = useState(true);
  const [selectedCompra, setSelectedCompra] = useState<Compra | null>(null);

  const filteredCompras = searchQuery
    ? compras.filter((c: Compra) => 
        c.compradorNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : compras;

  const filteredCompradores = compradorSearch ? buscarCompradores(compradorSearch) : [];
  const filteredProductos = productoSearch ? buscarProductos(productoSearch) : [];

  const subtotal = detalles.reduce((sum: number, d: DetalleCompra) => sum + d.subtotal, 0);
  const total = subtotal;

  const handleAddProducto = (producto: Producto) => {
    const existingIndex = detalles.findIndex((d: DetalleCompra) => d.productoId === producto.id);
    
    if (existingIndex >= 0) {
      // Actualizar cantidad si ya existe
      const newDetalles = [...detalles];
      const detalle = newDetalles[existingIndex];
      const newCantidad = detalle.cantidad + 1;
      const newSubtotal = newCantidad * detalle.precioUnitario;
      
      newDetalles[existingIndex] = {
        ...detalle,
        cantidad: newCantidad,
        subtotal: newSubtotal,
      };
      setDetalles(newDetalles);
    } else {
      // Agregar nuevo detalle
      const precioUnitario = producto.precioCompra;
      const subtotalDetalle = precioUnitario;
      
      const nuevoDetalle: DetalleCompra = {
        productoId: producto.id,
        productoNombre: producto.nombre,
        cantidad: 1,
        precioUnitario,
        subtotal: subtotalDetalle,
      };
      setDetalles([...detalles, nuevoDetalle]);
    }
    setProductoSearch('');
  };

  const handleUpdateCantidad = (index: number, cantidad: number) => {
    if (cantidad <= 0) {
      handleRemoveDetalle(index);
      return;
    }
    
    const newDetalles = [...detalles];
    const detalle = newDetalles[index];
    const newSubtotal = cantidad * detalle.precioUnitario;
    
    newDetalles[index] = {
      ...detalle,
      cantidad,
      subtotal: newSubtotal,
    };
    setDetalles(newDetalles);
  };

  const handleUpdatePrecio = (index: number, precio: number) => {
    if (precio < 0) return;
    
    const newDetalles = [...detalles];
    const detalle = newDetalles[index];
    const newSubtotal = detalle.cantidad * precio;
    
    newDetalles[index] = {
      ...detalle,
      precioUnitario: precio,
      subtotal: newSubtotal,
    };
    setDetalles(newDetalles);
  };

  const handleRemoveDetalle = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const handleGuardarCompra = () => {
    if (detalles.length === 0 || !selectedComprador) return;

    const compra: Omit<Compra, 'id'> = {
      fecha: new Date().toISOString(),
      compradorId: selectedComprador.id,
      compradorNombre: selectedComprador.nombre,
      detalles,
      subtotal,
      total,
      metodoPago,
      estado: 'completada',
      notas,
    };

    agregarCompra(compra);
    
    if (updateInventory) {
      detalles.forEach((detalle: DetalleCompra) => {
        const producto = getProductoById(detalle.productoId);
        if (producto) {
          actualizarProducto(producto.id, {
            stock: producto.stock + detalle.cantidad,
            precioCompra: detalle.precioUnitario,
          });
        }
      });
    }
    
    // Resetear formulario
    setDetalles([]);
    setSelectedComprador(null);
    setCompradorSearch('');
    setMetodoPago('efectivo');
    setNotas('');
    setUpdateInventory(true);
    setNuevaCompraOpen(false);
  };

  const getEstadoBadge = (estado: Compra['estado']) => {
    switch (estado) {
      case 'completada':
        return <Badge className="bg-green-500">Completada</Badge>;
      case 'pendiente':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
      case 'cancelada':
        return <Badge variant="destructive">Cancelada</Badge>;
    }
  };

  const getMetodoPagoLabel = (metodo: Compra['metodoPago']) => {
    const labels = {
      efectivo: 'Efectivo',
      tarjeta: 'Tarjeta',
      transferencia: 'Transferencia',
      credito: 'Crédito',
    };
    return labels[metodo];
  };

  const comprasHoy = compras.filter((c: Compra) => 
    new Date(c.fecha).toDateString() === new Date().toDateString() && 
    c.estado === 'completada'
  );
  const totalComprasHoy = comprasHoy.reduce((sum: number, c: Compra) => sum + c.total, 0);
  const comprasMes = compras.filter((c: Compra) => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    return new Date(c.fecha) >= inicioMes && c.estado === 'completada';
  });
  const totalComprasMes = comprasMes.reduce((sum: number, c: Compra) => sum + c.total, 0);

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Compras Hoy</p>
                <p className="text-2xl font-bold">{formatCurrency(totalComprasHoy)}</p>
                <p className="text-xs text-slate-400">{comprasHoy.length} compras</p>
              </div>
              <Receipt className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Compras del Mes</p>
                <p className="text-2xl font-bold">{formatCurrency(totalComprasMes)}</p>
                <p className="text-xs text-slate-400">{comprasMes.length} compras</p>
              </div>
              <Calendar className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Compras</p>
                <p className="text-2xl font-bold">{compras.length}</p>
                <p className="text-xs text-slate-400">Registradas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Compras */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg">Historial de Compras</CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar compras..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            <Button onClick={() => setNuevaCompraOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Compra
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Método de Pago</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompras.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      No se encontraron compras
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompras.slice().reverse().map((compra: Compra) => (
                    <TableRow key={compra.id}>
                      <TableCell className="font-medium">#{compra.id.slice(-6)}</TableCell>
                      <TableCell>{formatDate(compra.fecha)}</TableCell>
                      <TableCell>{compra.compradorNombre}</TableCell>
                      <TableCell>
                        <span className="capitalize">{getMetodoPagoLabel(compra.metodoPago)}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(compra.total)}</TableCell>
                      <TableCell>{getEstadoBadge(compra.estado)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedCompra(compra)} title="Ver detalles">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {compra.estado !== 'cancelada' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => cancelarCompra(compra.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para nueva compra */}
      <Dialog open={nuevaCompraOpen} onOpenChange={setNuevaCompraOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Compra</DialogTitle>
            <DialogDescription>
              Registre una nueva compra por comprador
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Selección de Comprador */}
            <div className="space-y-2">
              <Label>Comprador *</Label>
              {selectedComprador ? (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{selectedComprador.nombre}</p>
                    <p className="text-sm text-slate-500">ID: {selectedComprador.id}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedComprador(null)}>
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar comprador..."
                    value={compradorSearch}
                    onChange={(e) => setCompradorSearch(e.target.value)}
                    className="pl-10"
                  />
                  {filteredCompradores.length > 0 && compradorSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCompradores.map((comprador: Comprador) => (
                        <button
                          key={comprador.id}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50"
                          onClick={() => {
                            setSelectedComprador(comprador);
                            setCompradorSearch('');
                          }}
                        >
                          <p className="font-medium">{comprador.nombre}</p>
                          <p className="text-sm text-slate-500">ID: {comprador.id}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {compradorSearch && filteredCompradores.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-4 text-center text-slate-500">
                      No se encontraron compradores
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Agregar Productos */}
            <div className="space-y-2">
              <Label>Agregar Productos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar producto..."
                  value={productoSearch}
                  onChange={(e) => setProductoSearch(e.target.value)}
                  className="pl-10"
                />
                {filteredProductos.length > 0 && productoSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProductos.map((producto: Producto) => (
                      <button
                        key={producto.id}
                        className="w-full px-4 py-2 text-left hover:bg-slate-50 flex justify-between items-center"
                        onClick={() => handleAddProducto(producto)}
                      >
                        <div>
                          <p className="font-medium">{producto.nombre}</p>
                          <p className="text-sm text-slate-500">Stock: {producto.stock}</p>
                        </div>
                        <p className="font-medium">{formatCurrency(producto.precioCompra)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tabla de Detalles */}
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
                    {detalles.map((detalle: DetalleCompra, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{detalle.productoNombre}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={detalle.precioUnitario}
                            onChange={(e) => handleUpdatePrecio(index, parseFloat(e.target.value) || 0)}
                            className="w-24 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="1"
                            value={detalle.cantidad}
                            onChange={(e) => handleUpdateCantidad(index, parseInt(e.target.value) || 1)}
                            className="w-20 mx-auto text-center"
                          />
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(detalle.subtotal)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveDetalle(index)}
                            className="text-red-500 hover:text-red-700 h-6 w-6"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Totales */}
            {detalles.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            )}

            {/* Método de Pago y Notas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label>Notas</Label>
                <Input
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>

            {/* Actualizar Inventario Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="updateInventory"
                checked={updateInventory}
                onCheckedChange={(checked) => setUpdateInventory(checked as boolean)}
              />
              <Label htmlFor="updateInventory">Actualizar inventario con esta compra</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevaCompraOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleGuardarCompra}
              disabled={detalles.length === 0 || !selectedComprador}
            >
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
                <div>
                  <p className="text-slate-500">Estado</p>
                  <p className="font-medium">{getEstadoBadge(selectedCompra.estado)}</p>
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
