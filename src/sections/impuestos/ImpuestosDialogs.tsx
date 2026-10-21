import { DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LabeledInput } from '@/components/shared';
import { formatCurrency } from '@/hooks/supabase/useSupabaseData';
import type { Impuesto } from '@/types';

export const tiposImpuesto = [
  { value: 'iva', label: 'IVA' },
  { value: 'renta', label: 'Renta' },
  { value: 'ica', label: 'ICA' },
  { value: 'otro', label: 'Otro' },
  { value: 'onat', label: 'Pago ONAT' },
  { value: 'deposito_bancario', label: 'Depósito Bancario' },
] as const;

export interface ImpuestoFormState {
  nombre: string;
  tipo: Impuesto['tipo'];
  periodo: string;
  fechaVencimiento: string;
  monto: string;
  notas: string;
}

interface ImpuestoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Impuesto | null;
  formData: ImpuestoFormState;
  onFieldChange: (field: keyof ImpuestoFormState, value: string) => void;
  saving: boolean;
  onSave: () => void;
}

/** Diálogo para crear o editar un impuesto. */
export function ImpuestoFormDialog({
  open, onOpenChange, editing, formData, onFieldChange, saving, onSave,
}: ImpuestoFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Editar Impuesto' : 'Nuevo Impuesto'}
          </DialogTitle>
          <DialogDescription>
            Complete los datos del impuesto
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <LabeledInput
            label="Nombre *"
            value={formData.nombre}
            onChange={(e) => onFieldChange('nombre', e.target.value)}
            placeholder="Ej: IVA Noviembre 2024"
          />
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select
              value={formData.tipo}
              onValueChange={(value) => onFieldChange('tipo', value as Impuesto['tipo'])}
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
          <LabeledInput
            label="Periodo *"
            value={formData.periodo}
            onChange={(e) => onFieldChange('periodo', e.target.value)}
            placeholder="Ej: Noviembre 2024"
          />
          <LabeledInput
            label="Fecha de Vencimiento *"
            type="date"
            value={formData.fechaVencimiento}
            onChange={(e) => onFieldChange('fechaVencimiento', e.target.value)}
          />
          <LabeledInput
            label="Monto *"
            type="number"
            value={formData.monto}
            onChange={(e) => onFieldChange('monto', e.target.value)}
            placeholder="0"
          />
          <div className="sm:col-span-2">
            <LabeledInput
              label="Notas"
              value={formData.notas}
              onChange={(e) => onFieldChange('notas', e.target.value)}
              placeholder="Notas adicionales..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editing ? 'Guardar Cambios' : 'Registrar Impuesto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ImpuestoPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  impuesto: Impuesto | null;
  montoPago: string;
  onMontoPagoChange: (value: string) => void;
  saving: boolean;
  onConfirm: () => void;
}

/** Diálogo para registrar un pago (parcial o total) de un impuesto. */
export function ImpuestoPagoDialog({
  open, onOpenChange, impuesto, montoPago, onMontoPagoChange, saving, onConfirm,
}: ImpuestoPagoDialogProps) {
  const saldoPendiente = (impuesto?.monto || 0) - (impuesto?.montoPagado || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pago de Impuesto</DialogTitle>
          <DialogDescription>
            {impuesto?.nombre} - Periodo: {impuesto?.periodo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monto Total:</span>
              <span className="font-medium">{formatCurrency(impuesto?.monto || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pagado:</span>
              <span className="font-medium">{formatCurrency(impuesto?.montoPagado || 0)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Saldo Pendiente:</span>
              <span>{formatCurrency(saldoPendiente)}</span>
            </div>
          </div>

          <LabeledInput
            label="Monto a Pagar *"
            type="number"
            value={montoPago}
            onChange={(e) => onMontoPagoChange(e.target.value)}
            placeholder="0"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <DollarSign className="w-4 h-4 mr-2" />
            Registrar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
