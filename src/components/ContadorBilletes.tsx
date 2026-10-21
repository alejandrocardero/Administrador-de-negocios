import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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

        <div className="space-y-4 py-2">
          <Card className="gap-0 overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-3">Billete</TableHead>
                  <TableHead className="py-3 text-right">Cantidad</TableHead>
                  <TableHead className="w-8 py-3 text-center" aria-label="por" />
                  <TableHead className="py-3 text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DENOMINACIONES.map(({ valor, label }) => {
                  const cant = cantidades[valor] || 0;
                  const subtotal = valor * cant;
                  return (
                    <TableRow key={valor}>
                      <TableCell className="py-3 font-mono text-sm">{label}</TableCell>
                      <TableCell className="py-3">
                        <Input
                          type="number"
                          min="0"
                          value={cantidades[valor] || ''}
                          onChange={(e) => handleCantidadChange(valor, e.target.value)}
                          placeholder="0"
                          aria-label={`Cantidad de billetes de ${label}`}
                          className="text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="py-3 text-center text-muted-foreground">×</TableCell>
                      <TableCell className="py-3 text-right font-mono text-sm font-semibold tabular-nums">
                        {cant > 0 ? subtotal.toLocaleString('es-CO') : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Fila de total destacada dentro de la tarjeta */}
            <div className="flex items-center justify-between border-t bg-muted/50 px-4 py-3">
              <span className="text-sm font-semibold">TOTAL</span>
              <span className="text-xl font-semibold text-success tabular-nums">
                ${totalCalculado.toLocaleString('es-CO')}
              </span>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleLimpiar}>Limpiar</Button>
          <Button onClick={handleConfirmar}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
