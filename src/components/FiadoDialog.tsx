import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger as PopoverTriggerRoot } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useVendedores, toFechaLocal } from '@/hooks/supabase/useSupabaseData';
import type { Fiado } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface FiadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (fiado: Omit<Fiado, 'id' | 'estado'>) => void;
  defaultVendedorId?: string;
}

export default function FiadoDialog({ open, onOpenChange, onSave, defaultVendedorId }: FiadoDialogProps) {
  const { vendedores } = useVendedores();
  const [formData, setFormData] = useState<Omit<Fiado, 'id' | 'estado' | 'vendedorNombre'>>({
    fecha: toFechaLocal(new Date()),
    clienteNombre: '',
    vendedorId: defaultVendedorId || '',
    monto: 0,
    descripcion: '',
    notas: '',
  });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const vendedorNombre = useMemo(() => 
    formData.vendedorId ? vendedores.find(v => v.id === formData.vendedorId)?.nombre || '' : '',
    [formData.vendedorId, vendedores]
  );

  useEffect(() => {
    if (open && defaultVendedorId) {
      setFormData(prev => ({
        ...prev,
        vendedorId: defaultVendedorId || prev.vendedorId,
        vendedorNombre: vendedores.find(v => v.id === defaultVendedorId)?.nombre || '',
        fecha: toFechaLocal(new Date()),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultVendedorId]);

  const handleChange = useCallback((field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await Promise.resolve(onSave({ ...formData, vendedorNombre } as Omit<Fiado, 'id' | 'estado'>));
      onOpenChange(false);
      setFormData({
        fecha: toFechaLocal(new Date()),
        clienteNombre: '',
        vendedorId: defaultVendedorId || '',
        monto: 0,
        descripcion: '',
        notas: '',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Fiado (A Plazo)</DialogTitle>
          <DialogDescription>Datos del cliente y producto fiado</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="clienteNombre">Cliente *</Label>
            <Input
              id="clienteNombre"
              value={formData.clienteNombre}
              onChange={(e) => handleChange('clienteNombre', e.target.value)}
              placeholder="Nombre del cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendedorId">Vendedor *</Label>
            <Select value={formData.vendedorId} onValueChange={(val) => handleChange('vendedorId', val)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione vendedor" />
              </SelectTrigger>
              <SelectContent>
                {vendedores.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha del Fiado *</Label>
            <Popover>
              <PopoverTriggerRoot asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !formData.fecha && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.fecha ? format(new Date(formData.fecha), "PPP", { locale: es }) : <span>Seleccione una fecha</span>}
                </Button>
              </PopoverTriggerRoot>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.fecha ? new Date(formData.fecha) : undefined}
                  onSelect={(date) => date && handleChange('fecha', toFechaLocal(date))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monto">Monto *</Label>
            <Input
              id="monto"
              type="number"
              min="1"
              step="any"
              value={formData.monto}
              onChange={(e) => handleChange('monto', parseFloat(e.target.value) || 0)}
              placeholder="0"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Productos / Descripción *</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => handleChange('descripcion', e.target.value)}
              placeholder="Qué productos se llevó el cliente"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas (Opcional)</Label>
            <Textarea
              id="notas"
              value={formData.notas}
              onChange={(e) => handleChange('notas', e.target.value)}
              placeholder="Observaciones adicionales"
              rows={2}
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Fiado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}