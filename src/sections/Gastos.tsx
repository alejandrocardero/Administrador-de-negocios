import { useState, useRef } from 'react';
import { 
  Plus, Search, Edit2, Trash2, Wallet, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useGastos, formatCurrency, formatDate } from '@/hooks/supabase/useSupabaseData';
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
    fecha: new Date().toISOString().split('T')[0],
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
        fecha: new Date().toISOString().split('T')[0],
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
        fecha: new Date(formData.fecha).toISOString(),
        concepto: formData.concepto,
        categoria: formData.categoria,
        monto: parseFloat(formData.monto) || 0,
        metodoPago: formData.metodoPago,
        descripcion: formData.descripcion || undefined,
      };

      if (editingGasto) {
        await actualizarGasto(editingGasto.id, gastoData);
      } else {
        await agregarGasto(gastoData);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Error guardando gasto:', error);
      alert('Error al guardar el gasto');
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
        setDeleteDialogOpen(false);
        setGastoToDelete(null);
      } catch (error) {
        console.error('Error eliminando gasto:', error);
        alert('Error al eliminar el gasto');
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

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Gastos del Mes</p>
                <p className="text-2xl font-bold">{formatCurrency(totalGastosMes)}</p>
                <p className="text-xs text-slate-400">{gastosMes.length} gastos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Gastos</p>
                <p className="text-2xl font-bold">{gastos.length}</p>
                <p className="text-xs text-slate-400">Registrados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Promedio Diario</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(gastosMes.length > 0 ? totalGastosMes / 30 : 0)}
                </p>
                <p className="text-xs text-slate-400">Este mes</p>
              </div>
              <Wallet className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gastos por Categoría */}
      {gastosPorCategoria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gastos por Categoría - Este Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {gastosPorCategoria.map((cat) => (
                <div key={cat.value} className="bg-slate-50 p-3 rounded-lg">
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
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg">Historial de Gastos</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar gastos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-48"
              />
            </div>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
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
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Gasto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
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
                {filteredGastos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      No se encontraron gastos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGastos.slice().reverse().map((gasto: Gasto) => (
                    <TableRow key={gasto.id}>
                      <TableCell>{formatDate(gasto.fecha)}</TableCell>
                      <TableCell className="font-medium">{gasto.concepto}</TableCell>
                      <TableCell>{getCategoriaLabel(gasto.categoria)}</TableCell>
                      <TableCell className="capitalize">{gasto.metodoPago}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">
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
              ¿Está seguro de que desea eliminar el gasto &quot;{gastoToDelete?.concepto}&quot;? 
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
