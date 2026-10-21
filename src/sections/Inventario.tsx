import { useState, useRef } from 'react';
import {
  Plus, Edit2, Trash2, Package, AlertTriangle, BarChart3, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonTable,
  StatusBadge,
  TablePagination,
  usePagination,
} from '@/components/shared';
import { useProductos, useProductRotation, formatCurrency } from '@/hooks/supabase/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import {
  margen, formatMargen, precioDesdeMargen, margenDesdePrecio, clampMargen, MARGEN_MAX
} from '@/lib/ganancia';
import type { Producto, CategoriaProducto } from '@/types';
import {
  InventarioProductoDialog,
  InventarioDeleteDialog,
  type InventarioFormState,
} from './inventario/InventarioDialogs';
import { InventarioTopRotacion } from './inventario/InventarioTopRotacion';

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
    loading,
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

  const [formData, setFormData] = useState<InventarioFormState>({
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

  const { pageItems, page, pageCount, setPage, reset } = usePagination(productsForTable);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    reset();
  };

  const handleCategoriaChange = (value: string) => {
    setCategoriaFilter(value);
    reset();
  };

  const toggleBajoStock = () => {
    setShowBajoStock(!showBajoStock);
    reset();
  };

  const handleViewModeChange = (value: string) => {
    setViewMode(value as 'lista' | 'rotacion');
    reset();
  };

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

  function updateField<K extends keyof InventarioFormState>(key: K, value: string) {
    setFormData(prev => ({ ...prev, [key]: value }) as InventarioFormState);
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
      const text: Array<keyof InventarioFormState> = ['nombre', 'categoria', 'unidad', 'precioCompra', 'precioVenta', 'stock', 'stockMinimo'];
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
        toast.success('Producto actualizado');
      } else {
        await agregarProducto(productoData);
        toast.success('Producto creado');
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Error guardando producto:', error);
      toast.error('Error al guardar el producto');
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
        toast.success('Producto eliminado');
        setDeleteDialogOpen(false);
        setProductToDelete(null);
      } catch (error) {
        console.error('Error eliminando producto:', error);
        toast.error('Error al eliminar el producto');
      }
    }
  };

  const getStockBadge = (stock: number, stockMinimo: number) => {
    if (stock <= 0) {
      return <StatusBadge tone="danger">Agotado</StatusBadge>;
    } else if (stock <= stockMinimo) {
      return <StatusBadge tone="warning">Bajo Stock</StatusBadge>;
    } else if (stock <= stockMinimo * 1.5) {
      return <StatusBadge tone="neutral">Stock Medio</StatusBadge>;
    }
    return <StatusBadge tone="success">OK</StatusBadge>;
  };

  const getCategoriaLabel = (cat: string) => {
    return categorias.find(c => c.value === cat)?.label || cat;
  };

  // Badge del margen real (PV − PC)/PV × 100: verde ≥30 %, amarillo 15–30 %, rojo <15 %.
  const getGananciaBadge = (precioVenta: number, precioCompra: number) => {
    const pct = margen(precioVenta, precioCompra);
    if (pct === null) {
      return <StatusBadge tone="neutral">—</StatusBadge>;
    }
    if (pct >= 30) {
      return <StatusBadge tone="success">{formatMargen(pct)}</StatusBadge>;
    }
    if (pct >= 15) {
      return <StatusBadge tone="warning">{formatMargen(pct)}</StatusBadge>;
    }
    return <StatusBadge tone="danger">{formatMargen(pct)}</StatusBadge>;
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
        <TableCell className="py-3 text-right">{rot.vendidoSemana} / {rot.vendidoMes} / {rot.totalVendido}</TableCell>
        <TableCell className="py-3 text-right">{formatCurrency(rot.precioVenta)}</TableCell>
        <TableCell className="py-3 text-right">{formatCurrency(rot.gananciaPorUnidad)}</TableCell>
        <TableCell className="py-3 text-right">{formatCurrency(rot.gananciaSemanal)}</TableCell>
        <TableCell className="py-3 text-right">{formatCurrency(rot.gananciaMensual)}</TableCell>
        <TableCell className="py-3 text-right font-medium text-primary">{rot.rotacion.toFixed(2)}</TableCell>
      </>
    );
  };

  const tableLoading = loading || (viewMode === 'rotacion' && rotationLoading);
  const skeletonCols = viewMode === 'rotacion' ? 9 : (esJefe ? 9 : 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Gestiona tu catálogo, precios y stock"
        icon={Package}
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
        }
      />

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Productos</p>
                <p className="text-2xl font-bold">{productos.length}</p>
              </div>
              <Package className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor Inventario</p>
                <p className="text-2xl font-bold">{formatCurrency(totalInventario)}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Productos Agotados</p>
                <p className="text-2xl font-bold text-destructive">{productosAgotados}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive/70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bajo Stock</p>
                <p className="text-2xl font-bold text-warning-foreground">{productosBajoStock}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Productos Líderes - Top 10 por Rotación */}
      {!rotationLoading && topProducts.length > 0 && (
        <InventarioTopRotacion products={topProducts} />
      )}

      {/* Filtros, Vista y Acciones */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 flex-1 w-full">
              <SearchInput
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Buscar productos…"
              />
              <Select value={categoriaFilter} onValueChange={handleCategoriaChange}>
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
                onClick={toggleBajoStock}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Bajo Stock
              </Button>
              <Select value={viewMode} onValueChange={handleViewModeChange}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Vista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lista">Lista</SelectItem>
                  <SelectItem value="rotacion">Rotación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Productos */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">Lista de Productos</h2>
            {viewMode === 'rotacion' && (
              <Badge variant="secondary" className="ml-2">
                Ordenado por Rotación
              </Badge>
            )}
          </div>

          {tableLoading ? (
            <SkeletonTable cols={skeletonCols} />
          ) : productos.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Sin productos"
              description="Agrega tu primer producto para empezar a controlar tu inventario."
              action={
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Producto
                </Button>
              }
            />
          ) : productsForTable.length === 0 ? (
            viewMode === 'rotacion' ? (
              <EmptyState
                icon={BarChart3}
                title="Sin datos de rotación"
                description="Aún no hay ventas registradas para calcular la rotación de productos."
              />
            ) : (
              <EmptyState
                icon={Search}
                title="Sin resultados para tu búsqueda"
                description="Prueba con otro nombre, código o cambia los filtros."
              />
            )
          ) : (
            <>
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
                  {pageItems.map((producto) => (
                    <TableRow key={producto.id}>
                      <TableCell className="py-3 font-medium">{producto.codigo}</TableCell>
                      <TableCell className="py-3">
                        <span className="inline-flex items-center gap-2">
                          {producto.nombre}
                          {producto.esNuevo && <StatusBadge tone="info">Nuevo</StatusBadge>}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline">{getCategoriaLabel(producto.categoria)}</Badge>
                      </TableCell>
                      {viewMode === 'rotacion' ? (
                        getRotationColumns(producto)
                      ) : (
                        <>
                          <TableCell className="py-3 text-right">{formatCurrency(producto.precioCompra)}</TableCell>
                          <TableCell className="py-3 text-right">{formatCurrency(producto.precioVenta)}</TableCell>
                          {esJefe && (
                            <TableCell className="py-3 text-right">
                              {getGananciaBadge(producto.precioVenta, producto.precioCompra)}
                            </TableCell>
                          )}
                          <TableCell className="py-3 text-right">
                            {producto.stock} {producto.unidad}
                          </TableCell>
                          <TableCell className="py-3">{getStockBadge(producto.stock, producto.stockMinimo)}</TableCell>
                        </>
                      )}
                      <TableCell className="py-3 text-right">
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
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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

      {/* Dialog para agregar/editar producto */}
      <InventarioProductoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingProduct}
        formData={formData}
        onFieldChange={updateField}
        onPrecioCompraChange={handlePrecioCompraChange}
        onGananciaChange={handleGananciaChange}
        onPrecioVentaChange={handlePrecioVentaChange}
        margenTopado={margenTopado}
        errors={formErrors}
        categorias={categorias}
        saving={saving}
        onSave={handleSave}
      />

      {/* Dialog de confirmación para eliminar */}
      <InventarioDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        producto={productToDelete}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
