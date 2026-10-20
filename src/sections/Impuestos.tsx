import { useState, useRef, useEffect } from 'react';
import { 
  Plus, Search, Edit2, Calculator, AlertTriangle,
  CheckCircle, Clock, DollarSign, Loader2
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useImpuestos, formatCurrency, formatDate, toFechaLocal } from '@/hooks/supabase/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import type { Impuesto } from '@/types';

const tiposImpuesto = [
  { value: 'iva', label: 'IVA' },
  { value: 'renta', label: 'Renta' },
  { value: 'ica', label: 'ICA' },
  { value: 'otro', label: 'Otro' },
  { value: 'onat', label: 'Pago ONAT' },
  { value: 'deposito_bancario', label: 'Depósito Bancario' },
];

// Meses en español para el periodo de los impuestos mensuales fijos
const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const obtenerPeriodoMes = (fecha: Date) => `${MESES_ES[fecha.getMonth()]} ${fecha.getFullYear()}`;

// Impuestos mensuales fijos que se auto-generan para todos los negocios
const impuestosMensuales = [
  { tipo: 'onat' as const, nombre: 'Pago ONAT' },
  { tipo: 'deposito_bancario' as const, nombre: 'Depósito Bancario' },
];

export default function Impuestos() {
  const { impuestos, agregarImpuesto, actualizarImpuesto, getImpuestosPendientes, loading } = useImpuestos();
  const { user } = useAuth();
  const esJefe = user?.role === 'jefe';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingImpuesto, setEditingImpuesto] = useState<Impuesto | null>(null);
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [impuestoToPay, setImpuestoToPay] = useState<Impuesto | null>(null);
  const [montoPago, setMontoPago] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // Guardia: evita doble generación en StrictMode y al cambiar de renderizado
  const autoGenRef = useRef<string | null>(null);

  const periodoMes = obtenerPeriodoMes(new Date());

  // AUTO-GENERACIÓN MENSUAL: crea 'Pago ONAT' y 'Depósito Bancario' del mes actual
  // si aún no existen. Se espera a que carguen los impuestos para no duplicar registros.
  useEffect(() => {
    if (loading) return;
    const businessId = user?.business_id || '';
    if (autoGenRef.current === businessId) return;
    autoGenRef.current = businessId;

    const generar = async () => {
      // Último día del mes actual como fecha de vencimiento
      const ahora = new Date();
      const fechaVencimiento = toFechaLocal(new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0));

      for (const mensual of impuestosMensuales) {
        try {
          const existe = impuestos.some(i => i.tipo === mensual.tipo && i.periodo === periodoMes);
          if (!existe) {
            await agregarImpuesto({
              nombre: `${mensual.nombre} — ${periodoMes}`,
              tipo: mensual.tipo,
              periodo: periodoMes,
              fechaVencimiento,
              monto: 0,
              montoPagado: 0,
              estado: 'pendiente',
            });
          }
        } catch (err) {
          // Nunca romper la página por un fallo de auto-generación
          console.warn(`No se pudo generar el impuesto mensual "${mensual.nombre}":`, err);
        }
      }
    };

    generar();
  }, [loading, impuestos, agregarImpuesto, user?.business_id, periodoMes]);

  // Impuestos mensuales fijos del periodo actual que aún no están pagados (alerta del jefe)
  const impuestosMensualesPendientes = impuestos.filter(
    (i: Impuesto) =>
      (i.tipo === 'onat' || i.tipo === 'deposito_bancario') &&
      i.periodo === periodoMes &&
      i.estado !== 'pagado'
  );

  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'iva' as Impuesto['tipo'],
    periodo: '',
    fechaVencimiento: '',
    monto: '',
    notas: '',
  });

  const filteredImpuestos = impuestos.filter((i: Impuesto) => {
    const matchesSearch = 
      i.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.periodo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'todos' || i.estado === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleOpenDialog = (impuesto?: Impuesto) => {
    if (impuesto) {
      setEditingImpuesto(impuesto);
      setFormData({
        nombre: impuesto.nombre,
        tipo: impuesto.tipo,
        periodo: impuesto.periodo,
        fechaVencimiento: impuesto.fechaVencimiento.split('T')[0],
        monto: impuesto.monto.toString(),
        notas: impuesto.notas || '',
      });
    } else {
      setEditingImpuesto(null);
      setFormData({
        nombre: '',
        tipo: 'iva',
        periodo: '',
        fechaVencimiento: '',
        monto: '',
        notas: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const impuestoData = {
        nombre: formData.nombre,
        tipo: formData.tipo,
        periodo: formData.periodo,
        fechaVencimiento: toFechaLocal(formData.fechaVencimiento),
        monto: parseFloat(formData.monto) || 0,
        montoPagado: editingImpuesto?.montoPagado || 0,
        estado: editingImpuesto?.estado || 'pendiente',
        notas: formData.notas || undefined,
      };

      if (editingImpuesto) {
        await actualizarImpuesto(editingImpuesto.id, impuestoData);
      } else {
        await agregarImpuesto(impuestoData);
      }
      setDialogOpen(false);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleOpenPago = (impuesto: Impuesto) => {
    setImpuestoToPay(impuesto);
    setMontoPago((impuesto.monto - impuesto.montoPagado).toString());
    setPagoDialogOpen(true);
  };

  const handleRegistrarPago = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (impuestoToPay) {
        const nuevoMonto = parseFloat(montoPago) || 0;
        const totalPagado = impuestoToPay.montoPagado + nuevoMonto;
        const nuevoEstado: Impuesto['estado'] = totalPagado >= impuestoToPay.monto ? 'pagado' : 'pendiente';
        
        const patch: Partial<Impuesto> = {
          montoPagado: totalPagado,
          estado: nuevoEstado,
        };
        // Los impuestos mensuales nacen con monto 0 (el jefe introduce lo que pagó):
        // el monto final del impuesto se ajusta al total pagado.
        if (impuestoToPay.monto < totalPagado) {
          patch.monto = totalPagado;
        }

        await actualizarImpuesto(impuestoToPay.id, patch);
        setPagoDialogOpen(false);
        setImpuestoToPay(null);
        setMontoPago('');
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const getEstadoBadge = (estado: Impuesto['estado']) => {
    switch (estado) {
      case 'pagado':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Pagado</Badge>;
      case 'pendiente':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
      case 'vencido':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Vencido</Badge>;
    }
  };

  const getTipoLabel = (tipo: string) => {
    return tiposImpuesto.find(t => t.value === tipo)?.label || tipo;
  };

  const impuestosPendientes = getImpuestosPendientes();
  const totalPendiente = impuestosPendientes.reduce((sum: number, i: Impuesto) => sum + (i.monto - i.montoPagado), 0);
  const totalPagado = impuestos.reduce((sum: number, i: Impuesto) => sum + i.montoPagado, 0);
  const totalImpuestos = impuestos.reduce((sum: number, i: Impuesto) => sum + i.monto, 0);

  return (
    <div className="space-y-6">
      {/* Alerta mensual para el jefe: impuestos fijos del mes sin pagar */}
      {esJefe && impuestosMensualesPendientes.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="font-semibold text-amber-800">
                Impuestos mensuales pendientes de pago — {periodoMes}
              </p>
              {impuestosMensualesPendientes.map((impuesto: Impuesto) => (
                <div
                  key={impuesto.id}
                  className="flex items-center justify-between gap-2 bg-white/70 rounded-md px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-amber-900">{impuesto.nombre}</p>
                    <p className="text-xs text-amber-700">
                      Vence: {formatDate(impuesto.fechaVencimiento)} · Monto: {formatCurrency(impuesto.monto)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => handleOpenPago(impuesto)}
                  >
                    Registrar pago
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Impuestos</p>
                <p className="text-2xl font-bold">{formatCurrency(totalImpuestos)}</p>
              </div>
              <Calculator className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendiente</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalPendiente)}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pagado</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPagado)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Vencidos</p>
                <p className="text-2xl font-bold text-red-600">
                  {impuestos.filter((i: Impuesto) => i.estado === 'vencido').length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Impuestos */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg">Gestión de Impuestos</CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar impuestos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-48"
              />
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Impuesto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
              <TabsTrigger value="pagado">Pagados</TabsTrigger>
              <TabsTrigger value="vencido">Vencidos</TabsTrigger>
            </TabsList>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredImpuestos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                        No se encontraron impuestos
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredImpuestos.slice().reverse().map((impuesto: Impuesto) => (
                      <TableRow key={impuesto.id}>
                        <TableCell className="font-medium">{impuesto.nombre}</TableCell>
                        <TableCell>{getTipoLabel(impuesto.tipo)}</TableCell>
                        <TableCell>{impuesto.periodo}</TableCell>
                        <TableCell>{formatDate(impuesto.fechaVencimiento)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(impuesto.monto)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(impuesto.montoPagado)}</TableCell>
                        <TableCell>{getEstadoBadge(impuesto.estado)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {impuesto.estado !== 'pagado' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenPago(impuesto)}
                              >
                                <DollarSign className="w-4 h-4 mr-1" />
                                Pagar
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(impuesto)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog para agregar/editar impuesto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingImpuesto ? 'Editar Impuesto' : 'Nuevo Impuesto'}
            </DialogTitle>
            <DialogDescription>
              Complete los datos del impuesto
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: IVA Noviembre 2024"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select 
                value={formData.tipo} 
                onValueChange={(value) => setFormData({ ...formData, tipo: value as Impuesto['tipo'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposImpuesto.map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodo">Periodo *</Label>
              <Input
                id="periodo"
                value={formData.periodo}
                onChange={(e) => setFormData({ ...formData, periodo: e.target.value })}
                placeholder="Ej: Noviembre 2024"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vencimiento">Fecha de Vencimiento *</Label>
              <Input
                id="vencimiento"
                type="date"
                value={formData.fechaVencimiento}
                onChange={(e) => setFormData({ ...formData, fechaVencimiento: e.target.value })}
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
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notas">Notas</Label>
              <Input
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingImpuesto ? 'Guardar Cambios' : 'Registrar Impuesto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para registrar pago */}
      <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago de Impuesto</DialogTitle>
            <DialogDescription>
              {impuestoToPay?.nombre} - Periodo: {impuestoToPay?.periodo}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-slate-600">Monto Total:</span>
                <span className="font-medium">{formatCurrency(impuestoToPay?.monto || 0)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-600">Pagado:</span>
                <span className="font-medium">{formatCurrency(impuestoToPay?.montoPagado || 0)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Saldo Pendiente:</span>
                <span>{formatCurrency((impuestoToPay?.monto || 0) - (impuestoToPay?.montoPagado || 0))}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="montoPago">Monto a Pagar *</Label>
              <Input
                id="montoPago"
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrarPago} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <DollarSign className="w-4 h-4 mr-2" />
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
