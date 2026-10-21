import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus, Edit2, Calculator, AlertTriangle,
  CheckCircle, Clock, DollarSign, Receipt, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonTable,
  StatusBadge,
  TablePagination,
  usePagination,
} from '@/components/shared';
import { useImpuestos, formatCurrency, formatDate, toFechaLocal } from '@/hooks/supabase/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import type { Impuesto } from '@/types';
import {
  ImpuestoFormDialog,
  ImpuestoPagoDialog,
  tiposImpuesto,
  type ImpuestoFormState,
} from './impuestos/ImpuestosDialogs';

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

  const [formData, setFormData] = useState<ImpuestoFormState>({
    nombre: '',
    tipo: 'iva',
    periodo: '',
    fechaVencimiento: '',
    monto: '',
    notas: '',
  });

  const handleFieldChange = (field: keyof ImpuestoFormState, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const filteredImpuestos = impuestos.filter((i: Impuesto) => {
    const matchesSearch =
      i.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.periodo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'todos' || i.estado === activeTab;
    return matchesSearch && matchesTab;
  });

  // Mismo orden de presentación que antes: el más reciente primero
  const impuestosOrdenados = useMemo(
    () => [...filteredImpuestos].reverse(),
    [filteredImpuestos]
  );

  const { pageItems, page, pageCount, setPage, reset } = usePagination(impuestosOrdenados);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    reset();
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    reset();
  };

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
        toast.success('Impuesto actualizado');
      } else {
        await agregarImpuesto(impuestoData);
        toast.success('Impuesto registrado');
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error('No se pudo guardar el impuesto');
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
        toast.success('Pago registrado');
      }
    } catch (error) {
      toast.error('No se pudo registrar el pago');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const estadoBadge = (estado: Impuesto['estado']) => {
    switch (estado) {
      case 'pagado':
        return <StatusBadge tone="success" className="gap-1"><CheckCircle className="size-3" aria-hidden /> Pagado</StatusBadge>;
      case 'pendiente':
        return <StatusBadge tone="warning" className="gap-1"><Clock className="size-3" aria-hidden /> Pendiente</StatusBadge>;
      case 'vencido':
        return <StatusBadge tone="danger" className="gap-1"><AlertTriangle className="size-3" aria-hidden /> Vencido</StatusBadge>;
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
      <PageHeader
        title="Impuestos"
        description="Gestiona impuestos, pagos y vencimientos"
        icon={Receipt}
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Impuesto
          </Button>
        }
      />

      {/* Alerta mensual para el jefe: impuestos fijos del mes sin pagar */}
      {esJefe && impuestosMensualesPendientes.length > 0 && (
        <div className="border border-warning/40 bg-warning/10 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-foreground mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="font-semibold text-warning-foreground">
                Impuestos mensuales pendientes de pago — {periodoMes}
              </p>
              {impuestosMensualesPendientes.map((impuesto: Impuesto) => (
                <div
                  key={impuesto.id}
                  className="flex items-center justify-between gap-2 bg-card/70 rounded-md px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-warning-foreground">{impuesto.nombre}</p>
                    <p className="text-xs text-warning-foreground/75">
                      Vence: {formatDate(impuesto.fechaVencimiento)} · Monto: {formatCurrency(impuesto.monto)}
                    </p>
                  </div>
                  <Button
                    size="sm"
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
                <p className="text-sm text-muted-foreground">Total Impuestos</p>
                <p className="text-2xl font-bold">{formatCurrency(totalImpuestos)}</p>
              </div>
              <Calculator className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendiente</p>
                <p className="text-2xl font-bold text-warning-foreground">{formatCurrency(totalPendiente)}</p>
              </div>
              <Clock className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pagado</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalPagado)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-success/70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-destructive">
                  {impuestos.filter((i: Impuesto) => i.estado === 'vencido').length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive/70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Impuestos */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Buscar impuestos…"
            />
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
                <TabsTrigger value="pagado">Pagados</TabsTrigger>
                <TabsTrigger value="vencido">Vencidos</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {loading ? (
            <SkeletonTable cols={8} />
          ) : impuestos.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Sin impuestos registrados"
              description="Agrega tu primer impuesto para llevar el control de pagos y vencimientos."
              action={
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Impuesto
                </Button>
              }
            />
          ) : impuestosOrdenados.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Sin resultados para tu búsqueda"
              description="Ajusta la búsqueda o cambia de pestaña para ver otros impuestos."
            />
          ) : (
            <>
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
                  {pageItems.map((impuesto: Impuesto) => (
                    <TableRow key={impuesto.id}>
                      <TableCell className="py-3 font-medium">{impuesto.nombre}</TableCell>
                      <TableCell className="py-3">{getTipoLabel(impuesto.tipo)}</TableCell>
                      <TableCell className="py-3">{impuesto.periodo}</TableCell>
                      <TableCell className="py-3">{formatDate(impuesto.fechaVencimiento)}</TableCell>
                      <TableCell className="py-3 text-right">{formatCurrency(impuesto.monto)}</TableCell>
                      <TableCell className="py-3 text-right">{formatCurrency(impuesto.montoPagado)}</TableCell>
                      <TableCell className="py-3">{estadoBadge(impuesto.estado)}</TableCell>
                      <TableCell className="py-3 text-right">
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
                  ))}
                </TableBody>
              </Table>
              <TablePagination page={page} pageCount={pageCount} setPage={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog para agregar/editar impuesto */}
      <ImpuestoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingImpuesto}
        formData={formData}
        onFieldChange={handleFieldChange}
        saving={saving}
        onSave={handleSave}
      />

      {/* Dialog para registrar pago */}
      <ImpuestoPagoDialog
        open={pagoDialogOpen}
        onOpenChange={setPagoDialogOpen}
        impuesto={impuestoToPay}
        montoPago={montoPago}
        onMontoPagoChange={setMontoPago}
        saving={saving}
        onConfirm={handleRegistrarPago}
      />
    </div>
  );
}
