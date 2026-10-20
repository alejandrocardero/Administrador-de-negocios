import { useState, useMemo, useEffect, useRef } from 'react';
import {
  CalendarIcon, Edit, Trash, MoreHorizontal, User, DollarSign, FileSpreadsheet, Banknote, HandCoins, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover, PopoverContent, PopoverTrigger as PopoverTriggerRoot
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useVentasDiarias, useVendedores, useFiados, useRegistrosIPVE, formatCurrency, formatDate, toFechaLocal } from '@/hooks/supabase/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import type { VentaDiaria, Vendedor } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import IPVE from '@/components/IPVE';
import HistorialIPVE from '@/components/HistorialIPVE';
import ContadorBilletes from '@/components/ContadorBilletes';
import FiadoDialog from '@/components/FiadoDialog';

interface NuevoRegistro {
  fecha: Date;
  vendedorId: string;
  montoEfectivo: number;
  montoTransferencia: number;
  notas: string;
}

function VentaForm({
  vendedores,
  onSubmit,
  defaultValues,
  isEdit = false,
  contadorConfirmado,
  onOpenContador,
  onConfirmarSubmit,
  onOpenFiado,
}: {
  vendedores: Vendedor[];
  onSubmit: (data: NuevoRegistro) => void;
  defaultValues?: Partial<NuevoRegistro>;
  isEdit?: boolean;
  contadorConfirmado?: number | null;
  onOpenContador?: () => void;
  onConfirmarSubmit?: (data: NuevoRegistro) => void;
  onOpenFiado?: () => void;
}) {
  const [formData, setFormData] = useState<NuevoRegistro>({
    fecha: defaultValues?.fecha || new Date(),
    vendedorId: defaultValues?.vendedorId || '',
    montoEfectivo: defaultValues?.montoEfectivo || 0,
    montoTransferencia: defaultValues?.montoTransferencia || 0,
    notas: defaultValues?.notas || '',
  });

  useEffect(() => {
    if (contadorConfirmado && contadorConfirmado > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({ ...prev, montoEfectivo: contadorConfirmado }));
    }
  }, [contadorConfirmado]);

  const handleChange = (field: keyof NuevoRegistro, value: string | number | Date) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onConfirmarSubmit) {
      onConfirmarSubmit(formData);
    } else {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="vendedorId">Vendedor</Label>
        <Select 
          value={formData.vendedorId} 
          onValueChange={(val) => handleChange('vendedorId', val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccione un vendedor" />
          </SelectTrigger>
          <SelectContent>
            {vendedores.map(v => (
              <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fecha">Fecha de la Venta</Label>
        <Popover>
          <PopoverTriggerRoot asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !formData.fecha && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.fecha ? format(formData.fecha, "PPP", { locale: es }) : <span>Seleccione una fecha</span>}
            </Button>
          </PopoverTriggerRoot>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={formData.fecha}
              onSelect={(date) => date && handleChange('fecha', date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor="montoEfectivo">Monto en Efectivo</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            value={formData.montoEfectivo}
            readOnly
            placeholder="0.00"
            className="bg-muted cursor-not-allowed"
          />
          <Button type="button" variant="default" onClick={onOpenContador} title="Contar billetes">
            <Banknote className="h-4 w-4 mr-2" />
            Contar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="montoTransferencia">Monto por Transferencia</Label>
        <Input
          type="number"
          value={formData.montoTransferencia}
          onChange={(e) => handleChange('montoTransferencia', parseFloat(e.target.value) || 0)}
          placeholder="0.00"
        />
      </div>

      <div className="md:col-span-2 space-y-2">
        <Label htmlFor="notas">Notas (Opcional)</Label>
        <Textarea 
          value={formData.notas}
          onChange={(e) => handleChange('notas', e.target.value)}
          placeholder="Anotaciones sobre la venta..." 
        />
      </div>

      <div className="md:col-span-2 flex justify-end gap-2">
        {!isEdit && onOpenFiado && (
          <Button type="button" variant="outline" onClick={onOpenFiado}>
            <HandCoins className="w-4 h-4 mr-2" />
            Fiado (A Plazo)
          </Button>
        )}
        <Button type="submit">
          {isEdit ? 'Guardar Cambios' : 'Registrar Venta'}
        </Button>
      </div>
    </form>
  );
}

export default function Ventas() {
  const { user } = useAuth();
  const { 
    data: ventas, 
    create: agregarVentaDiaria, 
    update: actualizarVentaDiaria, 
    delete: eliminarVentaDiaria,
  } = useVentasDiarias();
  
  const { 
    data: vendedores 
  } = useVendedores();
  
  const { 
    create: agregarFiado 
  } = useFiados();
  
  const { data: registrosIpve } = useRegistrosIPVE();

  // Importe IPVE (tipo historico) del vendedor para una fecha local dada.
  // null = sin IPVE registrado ese día (no hay con qué comparar el cierre).
  const ipveImporteDelDia = (vendedorId: string, fechaLocal: string): number | null => {
    const regs = registrosIpve.filter(r =>
      r.fecha === fechaLocal && r.vendedorId === vendedorId && r.tipo === 'historico'
    );
    if (regs.length === 0) return null;
    return regs.reduce((sum, r) => sum + (r.inicio + r.entrada - r.final) * r.precioVenta, 0);
  };
  
  const [editingVenta, setEditingVenta] = useState<VentaDiaria | null>(null);
  const [deleteVenta, setDeleteVenta] = useState<VentaDiaria | null>(null);
  const [historialIpveOpen, setHistorialIpveOpen] = useState(false);
  const [ipveDiarioOpen, setIpveDiarioOpen] = useState(false);
  const [contadorOpen, setContadorOpen] = useState(false);
  const [contadorConfirmado, setContadorConfirmado] = useState<number | null>(null);
  const [contadorBilletes, setContadorBilletes] = useState<Record<number, number>>({});
  const [confirmVenta, setConfirmVenta] = useState<NuevoRegistro | null>(null);
  const [fiadoDialogOpen, setFiadoDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const sortedVentas = useMemo(() => {
    return [...ventas].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [ventas]);

  const handleAddSubmit = (data: NuevoRegistro) => {
    setConfirmVenta(data);
  };

  const handleOpenFiadoDialog = () => {
    setFiadoDialogOpen(true);
  };

const handleConfirmVenta = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (!confirmVenta) return;
      const vendedor = vendedores.find(v => v.id === confirmVenta.vendedorId);
      if (!vendedor) return;

      // Fecha local (Bug 5) + sobrante/faltante vs IPVE del vendedor (Bugs 2 y 4)
      const fechaLocal = toFechaLocal(confirmVenta.fecha);
      const ipve = ipveImporteDelDia(confirmVenta.vendedorId, fechaLocal);
      const diferenciaCaja = ipve === null
        ? null
        : (confirmVenta.montoEfectivo + confirmVenta.montoTransferencia) - ipve;

      await agregarVentaDiaria({
        ...confirmVenta,
        fecha: fechaLocal,
        vendedorNombre: vendedor.nombre,
        diferenciaCaja,
      });
      setContadorConfirmado(null);
      setContadorBilletes({});
      setConfirmVenta(null);
    } catch (error) {
      console.error('Error guardando venta:', error);
      alert('Error al guardar la venta');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleEditSubmit = async (data: NuevoRegistro) => {
    if (!editingVenta) return;
    const vendedor = vendedores.find(v => v.id === data.vendedorId);
    if (!vendedor) return;
    
    try {
      const fechaLocal = toFechaLocal(data.fecha);
      const ipve = ipveImporteDelDia(data.vendedorId, fechaLocal);
      const diferenciaCaja = ipve === null
        ? null
        : (data.montoEfectivo + data.montoTransferencia) - ipve;

      await actualizarVentaDiaria(editingVenta.id, {
          ...data,
          fecha: fechaLocal,
          vendedorNombre: vendedor.nombre,
          diferenciaCaja,
      });
      setEditingVenta(null);
    } catch (error) {
      console.error('Error actualizando venta:', error);
      alert('Error al actualizar la venta');
    }
  };
   
  const handleDelete = async () => {
    if (deleteVenta) {
      try {
        await eliminarVentaDiaria(deleteVenta.id);
        setDeleteVenta(null);
      } catch (error) {
        console.error('Error eliminando venta:', error);
        alert('Error al eliminar la venta');
      }
    }
  }

  const ventasHoy = useMemo(() => {
      const hoyLocal = toFechaLocal(new Date());
      return ventas.filter(v => v.fecha === hoyLocal);
  }, [ventas]);

  const totalVentasHoy = useMemo(() => {
      return ventasHoy.reduce((sum, v) => sum + v.totalVendido, 0);
  }, [ventasHoy]);

  // Vista previa del cierre para el diálogo de confirmación (antes de guardar)
  const confirmacionCierre = useMemo(() => {
    if (!confirmVenta) return null;
    const fechaLocal = toFechaLocal(confirmVenta.fecha);
    const ipve = ipveImporteDelDia(confirmVenta.vendedorId, fechaLocal);
    if (ipve === null) return { ipve: null, diferencia: null };
    const diferencia = (confirmVenta.montoEfectivo + confirmVenta.montoTransferencia) - ipve;
    return { ipve, diferencia };
  }, [confirmVenta, registrosIpve]);

  const totalSalariosHoy = useMemo(() => {
    const hoy = new Date().toDateString();
    return ventas
      .filter(v => new Date(v.fecha).toDateString() === hoy)
      .reduce((sum, v) => sum + v.salarioCalculado, 0);
  }, [ventas]);


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ventas Totales Hoy</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalVentasHoy)}</div>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Salarios Calculados Hoy</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalSalariosHoy)}</div>
              </CardContent>
          </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>IPVE - Inventario de Productos en Venta</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIpveDiarioOpen(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              IPVE Diario
            </Button>
            <Button variant="outline" onClick={() => setHistorialIpveOpen(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Historial IPVE
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrar Cierre de Ventas Diario</CardTitle>
        </CardHeader>
        <CardContent>
          <VentaForm 
            vendedores={vendedores} 
            onSubmit={handleAddSubmit}
            contadorConfirmado={contadorConfirmado}
            onOpenContador={() => setContadorOpen(true)}
            onConfirmarSubmit={handleAddSubmit}
            onOpenFiado={handleOpenFiadoDialog}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Ventas Diarias</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Vista de tabla (escritorio) */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Monto Efectivo</TableHead>
                  <TableHead>Monto Transferencia</TableHead>
                  <TableHead>Total Vendido</TableHead>
                  <TableHead>Salario del Día</TableHead>
                  <TableHead>Diferencia</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVentas.map(venta => (
                  <TableRow key={venta.id}>
                    <TableCell>{formatDate(venta.fecha)}</TableCell>
                    <TableCell>{venta.vendedorNombre}</TableCell>
                    <TableCell>{formatCurrency(venta.montoEfectivo)}</TableCell>
                    <TableCell>{formatCurrency(venta.montoTransferencia)}</TableCell>
                    <TableCell className="font-bold">{formatCurrency(venta.totalVendido)}</TableCell>
                    <TableCell className="text-green-600 font-bold">{formatCurrency(venta.salarioCalculado)}</TableCell>
                    <TableCell>
                      {venta.diferenciaCaja === null || venta.diferenciaCaja === undefined ? (
                        <span className="text-muted-foreground">—</span>
                      ) : venta.diferenciaCaja > 0 ? (
                        <Badge className="bg-green-500">+{formatCurrency(venta.diferenciaCaja)}</Badge>
                      ) : venta.diferenciaCaja < 0 ? (
                        <Badge className="bg-red-500">−{formatCurrency(Math.abs(venta.diferenciaCaja))}</Badge>
                      ) : (
                        <Badge variant="outline">✓</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingVenta(venta)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-500" onClick={() => setDeleteVenta(venta)}>
                            <Trash className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Vista de tarjetas (móvil) */}
          <div className="md:hidden space-y-3">
            {sortedVentas.length === 0 ? (
              <p className="text-center py-8 text-slate-500">No hay ventas registradas</p>
            ) : (
              sortedVentas.map(venta => (
                <Card key={venta.id} className="p-0">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{venta.vendedorNombre}</p>
                        <p className="text-xs text-slate-500">{formatDate(venta.fecha)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 shrink-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingVenta(venta)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-500" onClick={() => setDeleteVenta(venta)}>
                            <Trash className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">Monto Efectivo</dt>
                        <dd>{formatCurrency(venta.montoEfectivo)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">Monto Transferencia</dt>
                        <dd>{formatCurrency(venta.montoTransferencia)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">Total Vendido</dt>
                        <dd className="font-bold">{formatCurrency(venta.totalVendido)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">Salario del Día</dt>
                        <dd className="text-green-600 font-bold">{formatCurrency(venta.salarioCalculado)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">Diferencia</dt>
                        <dd>
                          {venta.diferenciaCaja === null || venta.diferenciaCaja === undefined
                            ? <span className="text-slate-400">—</span>
                            : venta.diferenciaCaja > 0
                              ? <span className="text-green-600 font-semibold">Sobrante {formatCurrency(venta.diferenciaCaja)}</span>
                              : venta.diferenciaCaja < 0
                                ? <span className="text-red-600 font-semibold">Faltante {formatCurrency(Math.abs(venta.diferenciaCaja))}</span>
                                : <span className="text-slate-500">✓ Cuadra</span>}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingVenta} onOpenChange={() => setEditingVenta(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Editar Venta Diaria</DialogTitle>
            </DialogHeader>
            {editingVenta && (
              <VentaForm 
                  vendedores={vendedores} 
                  onSubmit={handleEditSubmit}
                  isEdit={true}
                  defaultValues={{
                      ...editingVenta,
                      fecha: editingVenta ? new Date(editingVenta.fecha) : new Date(),
                  }}
              />
            )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteVenta} onOpenChange={() => setDeleteVenta(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirmar Eliminación</DialogTitle>
                <DialogDescription>
                    ¿Está seguro de que desea eliminar este registro de venta? Esta acción no se puede deshacer.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteVenta(null)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <IPVE open={ipveDiarioOpen} onOpenChange={setIpveDiarioOpen} modoDiario={true} user={user || undefined} totalCierre={totalVentasHoy} ventasHoy={ventasHoy} />
      <HistorialIPVE open={historialIpveOpen} onOpenChange={setHistorialIpveOpen} />
      <ContadorBilletes
        open={contadorOpen}
        onOpenChange={setContadorOpen}
        onConfirmar={(total) => setContadorConfirmado(total)}
        initialCantidades={contadorBilletes}
        onCantidadesChange={setContadorBilletes}
      />

      {/* Confirm Dialog */}
      <Dialog open={!!confirmVenta} onOpenChange={(open) => !open && setConfirmVenta(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirmar Registro de Venta</DialogTitle>
                <DialogDescription>
                    ¿Desea registrar la venta con los siguientes datos?
                </DialogDescription>
            </DialogHeader>
            {confirmVenta && (
                <div className="space-y-2 text-sm">
                    <p><strong>Vendedor:</strong> {vendedores.find(v => v.id === confirmVenta.vendedorId)?.nombre}</p>
                    <p><strong>Fecha:</strong> {format(confirmVenta.fecha, 'PPP', { locale: es })}</p>
                    <p><strong>Efectivo:</strong> ${confirmVenta.montoEfectivo.toLocaleString('es-CO')}</p>
                    <p><strong>Transferencia:</strong> ${confirmVenta.montoTransferencia.toLocaleString('es-CO')}</p>
                    <p className="font-bold text-lg"><strong>Total:</strong> ${(confirmVenta.montoEfectivo + confirmVenta.montoTransferencia).toLocaleString('es-CO')}</p>
                    {confirmacionCierre?.ipve !== null && confirmacionCierre?.ipve !== undefined && (
                        <p><strong>IPVE del día:</strong> {formatCurrency(confirmacionCierre.ipve)}</p>
                    )}
                    {confirmacionCierre?.diferencia !== null && confirmacionCierre?.diferencia !== undefined && (
                        <p className={confirmacionCierre.diferencia > 0 ? 'text-green-600' : confirmacionCierre.diferencia < 0 ? 'text-red-600' : ''}>
                            <strong>{confirmacionCierre.diferencia > 0 ? 'Sobrante' : confirmacionCierre.diferencia < 0 ? 'Faltante' : 'Cuadra con el IPVE'}:</strong>{' '}
                            {formatCurrency(Math.abs(confirmacionCierre.diferencia))}
                        </p>
                    )}
                </div>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmVenta(null)}>Cancelar</Button>
                <Button onClick={handleConfirmVenta} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <FiadoDialog
        open={fiadoDialogOpen}
        onOpenChange={setFiadoDialogOpen}
        onSave={agregarFiado}
      />
    </div>
  );
}