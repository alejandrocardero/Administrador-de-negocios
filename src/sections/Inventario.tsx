import { useState, useRef } from 'react';
import { 
  Plus, Search, Edit2, Trash2, Package, AlertTriangle, BarChart3, Loader2
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
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { useProductos, useProductRotation, formatCurrency } from '@/hooks/supabase/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import {
  margen, formatMargen, precioDesdeMargen, margenDesdePrecio, clampMargen, MARGEN_MAX
} from '@/lib/ganancia';
import type { Producto, CategoriaProducto, ProductRotationStats } from '@/types';

const categorias: { value: CategoriaProducto; label: string }[] = [
  { value: 'aseo', label: 'Aseo' },
  { value: 'comida', label: 'Comida' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'cerveza', label: 'Cerveza' },
  { value: 'otros', label: 'Otros' },
];

export default function Inventario() {
  const { 
    data: productos, 
    create: agregarProducto, 
    update: actualizarProducto, 
    delete: eliminarProducto,
  } = useProductos();

  const { 
    data: rotationData, 
    loading: rotationLoading, 
    getTopByRotation 
  } = useProductRotation();

  const { user } = useAuth();
  const esJefe = user?.role === 'jefe';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const [showBajoStock, setShowBajoStock] = useState(false);
  const [viewMode, setViewMode] = useState<'lista' | 'rotacion'>('lista');
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Producto | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [margenTopado, setMargenTopado] = useState(false);

  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    categoria: 'otros' as CategoriaProducto,
    precioCompra: '',
    precioVenta: '',
    porcentajeGanancia: '30',
    stock: '',
    stockMinimo: '',
    unidad: 'unidad',
  });

  // Helper functions to replace the old useProductos methods
  const getProductosBajoStock = () => productos.filter(p => p.stock <= p.stockMinimo && p.activo);
  const buscarProductos = (query: string) => {
    const q = query.toLowerCase();
    return productos.filter(p => 
      p.activo && (
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q)
      )
    );
  };
  const getProductosByCategoria = (categoria: string) => 
    productos.filter(p => p.categoria === categoria && p.activo);

  const filteredProducts = showBajoStock 
    ? getProductosBajoStock()
    : categoriaFilter !== 'todas'
      ? getProductosByCategoria(categoriaFilter)
      : searchQuery
        ? buscarProductos(searchQuery)
        : productos;

  const topProducts = getTopByRotation(10);

  const productsForTable = viewMode === 'rotacion' 
    ? (() => {
        const rotationMap = new Map(rotationData.map(r => [r.productoId, r]));
        return filteredProducts
          .map(p => ({ producto: p, rotation: rotationMap.get(p.id) }))
          .filter(({ rotation }) => rotation !== undefined)
          .sort((a, b) => (b.rotation!.rotacion - a.rotation!.rotacion))
          .map(({ producto }) => producto);
      })()
    : filteredProducts;

  const handleOpenDialog = (producto?: Producto) => {
    if (producto) {
      setEditingProduct(producto);
      setFormData({
        codigo: producto.codigo,
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        categoria: producto.categoria,
        precioCompra: producto.precioCompra.toString(),
        precioVenta: producto.precioVenta.toString(),
        porcentajeGanancia: (producto.porcentajeGanancia ?? 30).toString(),
        stock: producto.stock.toString(),
        stockMinimo: producto.stockMinimo.toString(),
        unidad: producto.unidad,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        categoria: 'otros',
        precioCompra: '',
        precioVenta: '',
        porcentajeGanancia: '30',
        stock: '',
        stockMinimo: '',
        unidad: 'unidad',
      });
    }
    setDialogOpen(true);
    setFormErrors({});
    setMargenTopado(false);
  };

  function updateField<K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) {
    setFormData(prev => ({ ...prev, [key]: value }) as typeof formData);
    setFormErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // ----- Ganancia deseada (%) ↔ Precio de Venta (bidireccional) -----
  // Fórmula del usuario: PV = PC / (1 − %/100) (margen sobre el precio de venta).
  // Con % vacío o 0 el precio de venta queda editable libre.
  function handleGananciaChange(raw: string) {
    const pctRaw = parseFloat(raw);
    setMargenTopado(!Number.isNaN(pctRaw) && pctRaw > MARGEN_MAX);
    if (raw.trim() === '' || Number.isNaN(pctRaw) || pctRaw <= 0) {
      updateField('porcentajeGanancia', raw);
      return;
    }
    const pct = clampMargen(pctRaw);
    const pc = parseFloat(formData.precioCompra);
    updateField('porcentajeGanancia', String(pct));
    if (!Number.isNaN(pc) && pc > 0) {
      updateField('precioVenta', String(precioDesdeMargen(pc, pct)));
    }
  }

  function handlePrecioVentaChange(raw: string) {
    updateField('precioVenta', raw);
    const pc = parseFloat(formData.precioCompra);
    const pv = parseFloat(raw);
    const pct = (!Number.isNaN(pc) && !Number.isNaN(pv) && pv > 0)
      ? margenDesdePrecio(pc, pv)
      : null;
    updateField('porcentajeGanancia', pct !== null ? String(pct) : '');
  }

  function handlePrecioCompraChange(raw: string) {
    updateField('precioCompra', raw);
    const pct = parseFloat(formData.porcentajeGanancia);
    const pc = parseFloat(raw);
    // Al cambiar el costo se recalcula el PV para mantener la ganancia deseada.
    if (!Number.isNaN(pct) && pct > 0 && !Number.isNaN(pc) && pc > 0) {
      updateField('precioVenta', String(precioDesdeMargen(pc, pct)));
    }
  }

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const errors: Record<string, string> = {};
      const text: Array<keyof typeof formData> = ['nombre', 'categoria', 'unidad', 'precioCompra', 'precioVenta', 'stock', 'stockMinimo'];
      text.forEach(field => {
        if (!String(formData[field]).trim()) errors[field] = 'Campo obligatorio';
      });

      const precioCompra = formData.precioCompra.trim();
      if (precioCompra && (isNaN(parseFloat(precioCompra)) || parseFloat(precioCompra) < 0)) {
        errors.precioCompra = 'Ingrese un precio válido';
      }
      const precioVenta = formData.precioVenta.trim();
      if (precioVenta && (isNaN(parseFloat(precioVenta)) || parseFloat(precioVenta) < 0)) {
        errors.precioVenta = 'Ingrese un precio válido';
      }
      const stock = formData.stock.trim();
      if (stock && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) {
        errors.stock = 'Ingrese un número entero válido';
      }
      const stockMinimo = formData.stockMinimo.trim();
      if (stockMinimo && (!Number.isInteger(Number(stockMinimo)) || Number(stockMinimo) < 0)) {
        errors.stockMinimo = 'Ingrese un número entero válido';
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
      setFormErrors({});

      const productoData = {
        codigo: formData.codigo,
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        categoria: formData.categoria,
        precioCompra: parseFloat(formData.precioCompra) || 0,
        precioVenta: parseFloat(formData.precioVenta) || 0,
        porcentajeGanancia: parseFloat(formData.porcentajeGanancia) || 30,
        stock: parseInt(formData.stock) || 0,
        stockMinimo: parseInt(formData.stockMinimo) || 0,
        unidad: formData.unidad,
        activo: true,
      };

      if (editingProduct) {
        await actualizarProducto(editingProduct.id, productoData);
      } else {
        await agregarProducto(productoData);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Error guardando producto:', error);
      alert('Error al guardar el producto');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = (producto: Producto) => {
    setProductToDelete(producto);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        await eliminarProducto(productToDelete.id);
        setDeleteDialogOpen(false);
        setProductToDelete(null);
      } catch (error) {
        console.error('Error eliminando producto:', error);
        alert('Error al eliminar el producto');
      }
    }
  };

  const getStockBadge = (stock: number, stockMinimo: number) => {
    if (stock <= 0) {
      return <Badge variant="destructive">Agotado</Badge>;
    } else if (stock <= stockMinimo) {
      return <Badge variant="destructive" className="bg-yellow-500">Bajo Stock</Badge>;
    } else if (stock <= stockMinimo * 1.5) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Stock Medio</Badge>;
    }
    return <Badge variant="default" className="bg-green-500">OK</Badge>;
  };

  const getCategoriaLabel = (cat: string) => {
    return categorias.find(c => c.value === cat)?.label || cat;
  };

  // Badge del margen real (PV − PC)/PV × 100: verde ≥30 %, amarillo 15–30 %, rojo <15 %.
  const getGananciaBadge = (precioVenta: number, precioCompra: number) => {
    const pct = margen(precioVenta, precioCompra);
    if (pct === null) {
      return <Badge variant="secondary" className="bg-slate-100 text-slate-500">—</Badge>;
    }
    if (pct >= 30) {
      return <Badge variant="default" className="bg-green-500">{formatMargen(pct)}</Badge>;
    }
    if (pct >= 15) {
      return <Badge variant="default" className="bg-yellow-500">{formatMargen(pct)}</Badge>;
    }
    return <Badge variant="destructive">{formatMargen(pct)}</Badge>;
  };

  const totalInventario = productos.reduce((sum, p) => sum + (p.precioCompra * p.stock), 0);
  const productosAgotados = productos.filter(p => p.stock <= 0).length;
  const productosBajoStock = getProductosBajoStock().length;

  const rotationMap = new Map(rotationData.map(r => [r.productoId, r]));

  const getRotationForProduct = (productoId: string) => rotationMap.get(productoId);

  const getRotationColumns = (producto: Producto) => {
    const rot = getRotationForProduct(producto.id);
    if (!rot) return null;
    return (
      <>
        <TableCell className="text-right">{rot.vendidoSemana} / {rot.vendidoMes} / {rot.totalVendido}</TableCell>
        <TableCell className="text-right">{formatCurrency(rot.precioVenta)}</TableCell>
        <TableCell className="text-right">{formatCurrency(rot.gananciaPorUnidad)}</TableCell>
        <TableCell className="text-right">{formatCurrency(rot.gananciaSemanal)}</TableCell>
        <TableCell className="text-right">{formatCurrency(rot.gananciaMensual)}</TableCell>
        <TableCell className="text-right font-medium text-blue-600">{rot.rotacion.toFixed(2)}</TableCell>
      </>
    );
  };

  const getLeaderCardStats = (rot: ProductRotationStats) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">Vendidos (Sem/Mes/Total)</p>
        <p className="text-sm font-medium">{rot.vendidoSemana} / {rot.vendidoMes} / {rot.totalVendido}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">Precio / Ganancia Ud.</p>
        <p className="text-sm font-medium truncate">{formatCurrency(rot.precioVenta)} / {formatCurrency(rot.gananciaPorUnidad)}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">Ganancia Semanal</p>
        <p className="text-sm font-medium text-green-600">{formatCurrency(rot.gananciaSemanal)}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">Ganancia Mensual</p>
        <p className="text-sm font-medium text-green-600">{formatCurrency(rot.gananciaMensual)}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Productos</p>
                <p className="text-2xl font-bold">{productos.length}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Valor Inventario</p>
                <p className="text-2xl font-bold">{formatCurrency(totalInventario)}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Productos Agotados</p>
                <p className="text-2xl font-bold text-red-600">{productosAgotados}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Bajo Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{productosBajoStock}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Productos Líderes - Top 10 por Rotación */}
      {!rotationLoading && topProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Productos Líderes (Top 10 por Rotación)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {topProducts.map((rot, index) => (
                <div key={rot.productoId} className="border rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-6 h-6 shrink-0 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{rot.productoNombre}</p>
                        <p className="text-xs text-slate-500 truncate">{rot.productoCodigo || '—'}</p>
                      </div>
                    </div>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded shrink-0 whitespace-nowrap">
                      Rot: {rot.rotacion.toFixed(2)}
                    </span>
                  </div>
                  {getLeaderCardStats(rot)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros, Vista y Acciones */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {categorias.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showBajoStock ? "default" : "outline"}
                onClick={() => setShowBajoStock(!showBajoStock)}
                className={showBajoStock ? "bg-yellow-500 hover:bg-yellow-600" : ""}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Bajo Stock
              </Button>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'lista' | 'rotacion')}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Vista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lista">Lista</SelectItem>
                  <SelectItem value="rotacion">Rotación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Productos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Lista de Productos
            {viewMode === 'rotacion' && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 ml-2">
                Ordenado por Rotación
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    {viewMode === 'rotacion' ? (
                      <>
                        <TableHead className="text-right">Vendidos (Sem/Mes/Total)</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Ganancia/Ud</TableHead>
                        <TableHead className="text-right">Ganancia Semanal</TableHead>
                        <TableHead className="text-right">Ganancia Mensual</TableHead>
                        <TableHead className="text-right">Rotación</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="text-right">P. Compra</TableHead>
                        <TableHead className="text-right">P. Venta</TableHead>
                        {esJefe && <TableHead className="text-right">% Ganancia</TableHead>}
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead>Estado</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsForTable.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={viewMode === 'rotacion' ? 9 : (esJefe ? 9 : 8)} className="text-center py-8 text-slate-500">
                        {rotationLoading 
                          ? 'Cargando datos de rotación...' 
                          : viewMode === 'rotacion' 
                            ? 'No hay productos con datos de rotación' 
                            : 'No se encontraron productos'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    productsForTable.map((producto) => (
                      <TableRow key={producto.id}>
                        <TableCell className="font-medium">{producto.codigo}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2">
                            {producto.nombre}
                            {producto.esNuevo && <Badge className="bg-blue-600 text-white">Nuevo</Badge>}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCategoriaLabel(producto.categoria)}</Badge>
                        </TableCell>
                        {viewMode === 'rotacion' ? (
                          getRotationColumns(producto)
                        ) : (
                          <>
                            <TableCell className="text-right">{formatCurrency(producto.precioCompra)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(producto.precioVenta)}</TableCell>
                            {esJefe && (
                              <TableCell className="text-right">
                                {getGananciaBadge(producto.precioVenta, producto.precioCompra)}
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              {producto.stock} {producto.unidad}
                            </TableCell>
                            <TableCell>{getStockBadge(producto.stock, producto.stockMinimo)}</TableCell>
                          </>
                        )}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(producto)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(producto)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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

      {/* Dialog para agregar/editar producto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
            <DialogDescription>
              Complete los datos del producto. Todos los campos son obligatorios excepto Código y Descripción.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => updateField('codigo', e.target.value)}
                placeholder="Ej: PROD001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => updateField('nombre', e.target.value)}
                placeholder="Nombre del producto"
              />
              {formErrors.nombre && <p className="text-sm text-red-600">{formErrors.nombre}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => updateField('descripcion', e.target.value)}
                placeholder="Descripción del producto"
              />
              {formErrors.descripcion && <p className="text-sm text-red-600">{formErrors.descripcion}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría *</Label>
              <Select 
                value={formData.categoria} 
                onValueChange={(value) => updateField('categoria', value as CategoriaProducto)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.categoria && <p className="text-sm text-red-600">{formErrors.categoria}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidad">Unidad *</Label>
              <Input
                id="unidad"
                value={formData.unidad}
                onChange={(e) => updateField('unidad', e.target.value)}
                placeholder="unidad, kg, litro, etc."
              />
              {formErrors.unidad && <p className="text-sm text-red-600">{formErrors.unidad}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="precioCompra">Precio de Compra *</Label>
              <Input
                id="precioCompra"
                type="number"
                value={formData.precioCompra}
                onChange={(e) => handlePrecioCompraChange(e.target.value)}
                placeholder="0"
              />
              {formErrors.precioCompra && <p className="text-sm text-red-600">{formErrors.precioCompra}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="porcentajeGanancia">Ganancia deseada (%)</Label>
              <Input
                id="porcentajeGanancia"
                type="number"
                inputMode="decimal"
                min="0"
                max={MARGEN_MAX}
                value={formData.porcentajeGanancia}
                onChange={(e) => handleGananciaChange(e.target.value)}
                placeholder="Ej: 25"
              />
              {margenTopado && <p className="text-sm text-amber-600">Máximo {MARGEN_MAX} %</p>}
              <p className="text-xs text-slate-500">
                Con un % definido, el precio de venta se calcula como PC / (1 − %/100).
                Déjelo vacío o en 0 para editarlo libremente.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="precioVenta">Precio de Venta *</Label>
              <Input
                id="precioVenta"
                type="number"
                value={formData.precioVenta}
                onChange={(e) => handlePrecioVentaChange(e.target.value)}
                placeholder="0"
              />
              {formErrors.precioVenta && <p className="text-sm text-red-600">{formErrors.precioVenta}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Stock Actual *</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => updateField('stock', e.target.value)}
                placeholder="0"
              />
              {formErrors.stock && <p className="text-sm text-red-600">{formErrors.stock}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="stockMinimo">Stock Mínimo *</Label>
              <Input
                id="stockMinimo"
                type="number"
                value={formData.stockMinimo}
                onChange={(e) => updateField('stockMinimo', e.target.value)}
                placeholder="0"
              />
              {formErrors.stockMinimo && <p className="text-sm text-red-600">{formErrors.stockMinimo}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para eliminar */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea eliminar el producto "{productToDelete?.nombre}"? 
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
