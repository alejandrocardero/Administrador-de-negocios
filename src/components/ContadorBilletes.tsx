import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DENOMINACIONES = [
  { valor: 5000, label: '$5.000' },
  { valor: 2000, label: '$2.000' },
  { valor: 1000, label: '$1.000' },
  { valor: 500, label: '$500' },
  { valor: 200, label: '$200' },
  { valor: 100, label: '$100' },
  { valor: 50, label: '$50' },
  { valor: 20, label: '$20' },
  { valor: 10, label: '$10' },
  { valor: 5, label: '$5' },
];

interface ContadorBilletesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (total: number) => void;
  /** Desglose previo por denominación: se restaura al reabrir (Bug 3). */
  initialCantidades?: Record<number, number>;
  /** Notifica cada cambio al padre para que el conteo sobreviva al cierre. */
  onCantidadesChange?: (cantidades: Record<number, number>) => void;
}

export default function ContadorBilletes({ open, onOpenChange, onConfirmar, initialCantidades, onCantidadesChange }: ContadorBilletesProps) {
  const [cantidades, setCantidades] = useState<Record<number, number>>(initialCantidades || {});

  const handleCantidadChange = (valor: number, cantidad: string) => {
    const cant = parseInt(cantidad) || 0;
    const nuevas = { ...cantidades, [valor]: cant };
    setCantidades(nuevas);
    onCantidadesChange?.(nuevas);
  };

  const totalCalculado = DENOMINACIONES.reduce((sum, d) => {
    return sum + (d.valor * (cantidades[d.valor] || 0));
  }, 0);

  const handleConfirmar = () => {
    onConfirmar(totalCalculado);
    // El desglose se CONSERVA en el padre: reabrir permite corregir billetes
    // tras un error. Solo se limpia con "Limpiar" o al guardar la venta.
    onOpenChange(false);
  };

  const handleLimpiar = () => {
    setCantidades({});
    onCantidadesChange?.({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Contador de Billetes</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <table className="w-full">
            <thead>
              <tr className="text-sm text-muted-foreground">
                <th className="text-left py-2">Billete</th>
                <th className="text-center py-2">Cantidad</th>
                <th className="text-center py-2">=</th>
                <th className="text-right py-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {DENOMINACIONES.map(({ valor, label }) => {
                const cant = cantidades[valor] || 0;
                const subtotal = valor * cant;
                return (
                  <tr key={valor} className="border-t">
                    <td className="py-2 font-mono text-sm">{label}</td>
                    <td className="py-2">
                      <Input
                        type="number"
                        min="0"
                        value={cantidades[valor] || ''}
                        onChange={(e) => handleCantidadChange(valor, e.target.value)}
                        placeholder="0"
                        className="text-center"
                      />
                    </td>
                    <td className="py-2 text-center">x</td>
                    <td className="py-2 text-right font-mono text-sm">
                      {cant > 0 ? subtotal.toLocaleString('es-CO') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="border-t-2 border-black pt-4 mt-4">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>TOTAL:</span>
              <span className="text-green-600 text-2xl">${totalCalculado.toLocaleString('es-CO')}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleLimpiar}>Limpiar</Button>
          <Button onClick={handleConfirmar}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}