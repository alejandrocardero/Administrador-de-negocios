import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LabeledInput } from '@/components/shared';
import { MARGEN_MAX } from '@/lib/ganancia';
import type { CategoriaProducto, Producto } from '@/types';

export interface InventarioFormState {
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaProducto;
  precioCompra: string;
  precioVenta: string;
  porcentajeGanancia: string;
  stock: string;
  stockMinimo: string;
  unidad: string;
}

export interface CategoriaOption {
  value: CategoriaProducto;
  label: string;
}

interface InventarioProductoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Producto | null;
  formData: InventarioFormState;
  onFieldChange: (field: keyof InventarioFormState, value: string) => void;
  onPrecioCompraChange: (raw: string) => void;
  onGananciaChange: (raw: string) => void;
  onPrecioVentaChange: (raw: string) => void;
  margenTopado: boolean;
  errors: Record<string, string>;
  categorias: CategoriaOption[];
  saving: boolean;
  onSave: () => void;
}

/** Diálogo para crear o editar un producto del inventario. */
export function InventarioProductoDialog({
  open, onOpenChange, editing, formData, onFieldChange,
  onPrecioCompraChange, onGananciaChange, onPrecioVentaChange,
  margenTopado, errors, categorias, saving, onSave,
}: InventarioProductoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Editar Producto' : 'Nuevo Producto'}
          </DialogTitle>
          <DialogDescription>
            Complete los datos del producto. Todos los campos son obligatorios excepto Código y Descripción.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <LabeledInput
            label="Código"
            value={formData.codigo}
            onChange={(e) => onFieldChange('codigo', e.target.value)}
            placeholder="Ej: PROD001"
          />
          <LabeledInput
            label="Nombre *"
            value={formData.nombre}
            onChange={(e) => onFieldChange('nombre', e.target.value)}
            placeholder="Nombre del producto"
            error={errors.nombre}
          />
          <div className="sm:col-span-2">
            <LabeledInput
              label="Descripción"
              value={formData.descripcion}
              onChange={(e) => onFieldChange('descripcion', e.target.value)}
              placeholder="Descripción del producto"
              error={errors.descripcion}
            />
          </div>
          <div className="space-y-2">
            <Label>Categoría *</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => onFieldChange('categoria', value as CategoriaProducto)}
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
            {errors.categoria && <p className="text-sm text-destructive">{errors.categoria}</p>}
          </div>
          <LabeledInput
            label="Unidad *"
            value={formData.unidad}
            onChange={(e) => onFieldChange('unidad', e.target.value)}
            placeholder="unidad, kg, litro, etc."
            error={errors.unidad}
          />
          <LabeledInput
            label="Precio de Compra *"
            type="number"
            value={formData.precioCompra}
            onChange={(e) => onPrecioCompraChange(e.target.value)}
            placeholder="0"
            error={errors.precioCompra}
          />
          <div className="space-y-2">
            <Label htmlFor="porcentajeGanancia">Ganancia deseada (%)</Label>
            <Input
              id="porcentajeGanancia"
              type="number"
              inputMode="decimal"
              min="0"
              max={MARGEN_MAX}
              value={formData.porcentajeGanancia}
              onChange={(e) => onGananciaChange(e.target.value)}
              placeholder="Ej: 25"
              className="border-input focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
            />
            {margenTopado && <p className="text-sm text-warning-foreground">Máximo {MARGEN_MAX} %</p>}
            <p className="text-xs text-muted-foreground">
              Con un % definido, el precio de venta se calcula como PC / (1 − %/100).
              Déjelo vacío o en 0 para editarlo libremente.
            </p>
          </div>
          <LabeledInput
            label="Precio de Venta *"
            type="number"
            value={formData.precioVenta}
            onChange={(e) => onPrecioVentaChange(e.target.value)}
            placeholder="0"
            error={errors.precioVenta}
          />
          <LabeledInput
            label="Stock Actual *"
            type="number"
            value={formData.stock}
            onChange={(e) => onFieldChange('stock', e.target.value)}
            placeholder="0"
            error={errors.stock}
          />
          <LabeledInput
            label="Stock Mínimo *"
            type="number"
            value={formData.stockMinimo}
            onChange={(e) => onFieldChange('stockMinimo', e.target.value)}
            placeholder="0"
            error={errors.stockMinimo}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editing ? 'Guardar Cambios' : 'Crear Producto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface InventarioDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: Producto | null;
  onConfirm: () => void;
}

/** Diálogo de confirmación para eliminar un producto. */
export function InventarioDeleteDialog({
  open, onOpenChange, producto, onConfirm,
}: InventarioDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Eliminación</DialogTitle>
          <DialogDescription>
            ¿Está seguro de que desea eliminar el producto "{producto?.nombre}"?
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
