import { useState, useRef, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, Wallet, Loader2, SearchX
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  PageHeader, SearchInput, EmptyState, SkeletonTable, SkeletonCards,
  usePagination, TablePagination
} from '@/components/shared';
import { useGastos, formatCurrency, formatDate, toFechaLocal } from '@/hooks/supabase/useSupabaseData';
import type { Gasto } from '@/types';

const categoriasGasto = [
  { value: 'servicios', label: 'Servicios Públicos' },
  { value: 'nomina', label: 'Nómina' },
  { value: 'arriendo', label: 'Arriendo' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'otros', label: 'Otros' },
];

export default function Gastos() {
  const {
    data: gastos,
    loading,
    create: agregarGasto,
    update: actualizarGasto,
    delete: eliminarGasto,
  } = useGastos();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<Gasto | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gastoToDelete, setGastoToDelete] = useState<Gasto | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const [formData, setFormData] = useState({
    fecha: toFechaLocal(new Date()),
    concepto: '',
    categoria: 'otros' as Gasto['categoria'],
    monto: '',
    metodoPago: 'efectivo' as Gasto['metodoPago'],
    descripcion: '',
  });

  const getGastosMes = () => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    return gastos.filter(g => new Date(g.fecha) >= inicioMes);
  };

  const filteredGastos = gastos.filter((g: Gasto) => {
    const matchesSearch =
      g.concepto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.descripcion?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategoria = categoriaFilter === 'todas' || g.categoria === categoriaFilter;
    return matchesSearch && matchesCategoria;
  });

  const gastosOrdenados = useMemo(
    () => filteredGastos.slice().reverse(),
    [filteredGastos]
  );
  const { pageItems, page, pageCount, setPage, reset } = usePagination(gastosOrdenados, 10);

  const handleOpenDialog = (gasto?: Gasto) => {
    if (gasto) {
      setEditingGasto(gasto);
      setFormData({
        fecha: gasto.fecha.split('T')[0],
        concepto: gasto.concepto,
        categoria: gasto.categoria,
        monto: gasto.monto.toString(),
        metodoPago: gasto.metodoPago,
        descripcion: gasto.descripcion || '',
      });
    } else {
      setEditingGasto(null);
      setFormData({
        fecha: toFechaLocal(new Date()),
        concepto: '',
        categoria: 'otros',
        monto: '',
        metodoPago: 'efectivo',
        descripcion: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const gastoData = {
        fecha: toFechaLocal(formData.fecha),
        concepto: formData.concepto,
        categoria: formData.categoria,
        monto: parseFloat(formData.monto) || 0,
        metodoPago: formData.metodoPago,
        descripcion: formData.descripcion || undefined,
      };

      if (editingGasto) {
        await actualizarGasto(editingGasto.id, gastoData);
        toast.success('Gasto actualizado');
      } else {
        await agregarGasto(gastoData);
        toast.success('Gasto registrado');
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Error guardando gasto:', error);
      toast.error('Error al guardar el gasto');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = (gasto: Gasto) => {
    setGastoToDelete(gasto);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (gastoToDelete) {
      try {
        await eliminarGasto(gastoToDelete.id);
        toast.success('Gasto eliminado');
        setDeleteDialogOpen(false);
        setGastoToDelete(null);
      } catch (error) {
        console.error('Error eliminando gasto:', error);
        toast.error('Error al eliminar el gasto');
      }
    }
  };

  const getCategoriaLabel = (cat: string) => {
    return categoriasGasto.find(c => c.value === cat)?.label || cat;
  };

  const gastosMes = getGastosMes();
  const totalGastosMes = gastosMes.reduce((sum: number, g: Gasto) => sum + g.monto, 0);

  const gastosPorCategoria = categoriasGasto.map(cat => ({
    ...cat,
    total: gastosMes.filter((g: Gasto) => g.categoria === cat.value).reduce((sum: number, g: Gasto) => sum + g.monto, 0),
  })).filter(cat => cat.total > 0);

  const hayFiltros = searchQuery !== '' || categoriaFilter !== 'todas';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gastos"
        description="Registra y controla los gastos del negocio"
        icon={Wallet}
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Gasto
          </Button>
        }
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
                  <p className="text-sm text-muted-foreground">Gastos del Mes</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalGastosMes)}</p>
                  <p className="text-xs text-muted-foreground">{gastosMes.length} gastos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Gastos</p>
                  <p className="text-2xl font-bold">{gastos.length}</p>
                  <p className="text-xs text-muted-foreground">Registrados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Promedio Diario</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(gastosMes.length > 0 ? totalGastosMes / 30 : 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Este mes</p>
                </div>
                <Wallet className="w-8 h-8 text-success shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gastos por Categoría */}
      {gastosPorCategoria.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">Gastos por Categoría - Este Mes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {gastosPorCategoria.map((cat) => (
                <div key={cat.value} className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">{cat.label}</span>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(cat.total)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Gastos */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Historial de Gastos</h2>
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput
                value={searchQuery}
                onChange={(v) => { setSearchQuery(v); reset(); }}
                placeholder="Buscar gastos..."
              />
              <Select
                value={categoriaFilter}
                onValueChange={(v) => { setCategoriaFilter(v); reset(); }}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {categoriasGasto.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <SkeletonTable rows={6} cols={6} />
          ) : filteredGastos.length === 0 ? (
            <EmptyState
              icon={hayFiltros ? SearchX : Wallet}
              title={hayFiltros ? 'Sin resultados' : 'No hay gastos'}
              description={
                hayFiltros
                  ? 'Ningún gasto coincide con tu búsqueda o filtro.'
                  : 'Registra tu primer gasto para llevar el control.'
              }
              action={
                !hayFiltros ? (
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Gasto
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <Table className="[&_td]:py-3 [&_th]:py-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Método de Pago</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((gasto: Gasto) => (
                    <TableRow key={gasto.id}>
                      <TableCell>{formatDate(gasto.fecha)}</TableCell>
                      <TableCell className="font-medium">{gasto.concepto}</TableCell>
                      <TableCell>{getCategoriaLabel(gasto.categoria)}</TableCell>
                      <TableCell className="capitalize">{gasto.metodoPago}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        -{formatCurrency(gasto.monto)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(gasto)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(gasto)}
                            className="text-destructive hover:text-destructive/80"
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

      {/* Dialog para agregar/editar gasto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingGasto ? 'Editar Gasto' : 'Nuevo Gasto'}
            </DialogTitle>
            <DialogDescription>
              Complete los datos del gasto
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha *</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría *</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value as Gasto['categoria'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoriasGasto.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="concepto">Concepto *</Label>
              <Input
                id="concepto"
                value={formData.concepto}
                onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                placeholder="Ej: Pago de servicios de energía"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monto">Monto *</Label>
              <Input
                id="monto"
                type="number"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metodoPago">Método de Pago *</Label>
              <Select
                value={formData.metodoPago}
                onValueChange={(value) => setFormData({ ...formData, metodoPago: value as Gasto['metodoPago'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción adicional..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingGasto ? 'Guardar Cambios' : 'Registrar Gasto'}
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
              ¿Está seguro de que desea eliminar el gasto "{gastoToDelete?.concepto}"?
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
