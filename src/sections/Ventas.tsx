import { useState, useMemo, useEffect } from 'react';
import {
  CalendarIcon, Edit, Trash, MoreHorizontal, User, DollarSign, FileSpreadsheet, Banknote
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
import { useVentasDiarias, useVendedores, formatCurrency, formatDate } from '@/hooks/useStorage';
import { useAuth } from '@/hooks/useAuth';
import type { VentaDiaria, Vendedor } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import IPVE from '@/components/IPVE';
import HistorialIPVE from '@/components/HistorialIPVE';
import ContadorBilletes from '@/components/ContadorBilletes';

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
}: {
  vendedores: Vendedor[];
  onSubmit: (data: NuevoRegistro) => void;
  defaultValues?: Partial<NuevoRegistro>;
  isEdit?: boolean;
  contadorConfirmado?: number | null;
  onOpenContador?: () => void;
  onConfirmarSubmit?: (data: NuevoRegistro) => void;
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
      setFormData(prev => ({ ...prev, montoEfectivo: contadorConfirmado }));
    }
  }, [contadorConfirmado]);

  const handleChange = (field: keyof NuevoRegistro, value: any) => {
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

      <div className="md:col-span-2 flex justify-end">
        <Button type="submit">
          {isEdit ? 'Guardar Cambios' : 'Registrar Venta'}
        </Button>
      </div>
    </form>
  );
}

export default function Ventas() {
  const { user } = useAuth();
  const { ventas, agregarVentaDiaria, actualizarVentaDiaria, eliminarVentaDiaria } = useVentasDiarias();
  const { vendedores } = useVendedores();
  const [editingVenta, setEditingVenta] = useState<VentaDiaria | null>(null);
  const [deleteVenta, setDeleteVenta] = useState<VentaDiaria | null>(null);
  const [historialIpveOpen, setHistorialIpveOpen] = useState(false);
  const [ipveDiarioOpen, setIpveDiarioOpen] = useState(false);
  const [contadorOpen, setContadorOpen] = useState(false);
  const [contadorConfirmado, setContadorConfirmado] = useState<number | null>(null);
  const [confirmVenta, setConfirmVenta] = useState<NuevoRegistro | null>(null);

  const sortedVentas = useMemo(() => {
    return [...ventas].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [ventas]);

  const handleAddSubmit = (data: NuevoRegistro) => {
    setConfirmVenta(data);
  };

  const handleConfirmVenta = () => {
    if (!confirmVenta) return;
    const vendedor = vendedores.find(v => v.id === confirmVenta.vendedorId);
    if (!vendedor) return;

    agregarVentaDiaria({
      ...confirmVenta,
      fecha: confirmVenta.fecha.toISOString(),
      vendedorNombre: vendedor.nombre,
    });
    setContadorConfirmado(null);
    setConfirmVenta(null);
  };

  const handleEditSubmit = (data: NuevoRegistro) => {
    if (!editingVenta) return;
    const vendedor = vendedores.find(v => v.id === data.vendedorId);
    if (!vendedor) return;
    
    actualizarVentaDiaria(editingVenta.id, {
        ...data,
        fecha: data.fecha.toISOString(),
        vendedorNombre: vendedor.nombre,
    });
    setEditingVenta(null);
  };
  
  const handleDelete = () => {
    if(deleteVenta) {
      eliminarVentaDiaria(deleteVenta.id);
      setDeleteVenta(null);
    }
  }

  const totalVentasHoy = useMemo(() => {
      const hoy = new Date().toDateString();
      return ventas
        .filter(v => new Date(v.fecha).toDateString() === hoy)
        .reduce((sum, v) => sum + v.totalVendido, 0);
  }, [ventas]);
  
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>IPVE - Inventario de Productos en Venta</CardTitle>
          <div className="flex gap-2">
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
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Ventas Diarias</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Monto Efectivo</TableHead>
                <TableHead>Monto Transferencia</TableHead>
                <TableHead>Total Vendido</TableHead>
                <TableHead>Salario del Día</TableHead>
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

      <IPVE open={ipveDiarioOpen} onOpenChange={setIpveDiarioOpen} modoDiario={true} user={user || undefined} />
      <HistorialIPVE open={historialIpveOpen} onOpenChange={setHistorialIpveOpen} />
      <ContadorBilletes
        open={contadorOpen}
        onOpenChange={setContadorOpen}
        onConfirmar={(total) => setContadorConfirmado(total)}
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
                </div>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmVenta(null)}>Cancelar</Button>
                <Button onClick={handleConfirmVenta}>Confirmar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}