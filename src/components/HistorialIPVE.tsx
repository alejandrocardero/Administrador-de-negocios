import { useState, useMemo } from 'react';
import { FileSpreadsheet, Eye } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { EmptyState, StatusBadge } from '@/components/shared';
import { useVendedores, useRegistrosIPVE } from '@/hooks/supabase/useSupabaseData';

/** Sentinelas para "sin filtro": Radix Select no admite value="". */
const TODOS_VENDEDORES = '__todos__';
const TODAS_FECHAS = '__todas__';

interface HistorialIPVEProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function HistorialIPVE({ open, onOpenChange }: HistorialIPVEProps) {
  const { vendedores } = useVendedores();
  const { data: registros } = useRegistrosIPVE();
  
  const [vendedorId, setVendedorId] = useState<string>('');
  const [selectedFecha, setSelectedFecha] = useState<string>('');

  const historialAgrupado = useMemo(() => {
    const grouped: Record<string, typeof registros> = {};
    
    if (!registros || !Array.isArray(registros)) return [];
    
    registros
      .filter(r => r.tipo === 'historico')
      .forEach(r => {
        if (!grouped[r.fecha]) {
          grouped[r.fecha] = [];
        }
        grouped[r.fecha].push(r);
      });
    
    return Object.entries(grouped)
      .map(([fecha, items]) => ({
        fecha,
        vendedorId: items[0]?.vendedorId || '',
        vendedorNombre: items[0]?.vendedorNombre || '',
        registros: items,
        totalInicio: items.reduce((sum, r) => sum + r.inicio, 0),
        totalEntrada: items.reduce((sum, r) => sum + r.entrada, 0),
        totalFinal: items.reduce((sum, r) => sum + r.final, 0),
        totalVendido: items.reduce((sum, r) => sum + (r.inicio + r.entrada - r.final), 0),
        totalImporte: items.reduce((sum, r) => sum + (r.inicio + r.entrada - r.final) * r.precioVenta, 0),
      }))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [registros]);

  const fechasDisponibles = useMemo(() => {
    const fechas = new Set(historialAgrupado.map(h => h.fecha));
    return Array.from(fechas).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [historialAgrupado]);

  const historialFiltrado = useMemo(() => {
    return historialAgrupado.filter(h => {
      if (vendedorId && h.vendedorId !== vendedorId) return false;
      if (selectedFecha && h.fecha !== selectedFecha) return false;
      return true;
    });
  }, [historialAgrupado, vendedorId, selectedFecha]);

  const selectedRegistro = historialFiltrado.length > 0 ? historialFiltrado[0] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" aria-hidden />
            Historial de IPVE
          </DialogTitle>
          <DialogDescription>
            Consulta los registros históricos de inventario por vendedor y fecha.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex-1 space-y-2 sm:flex-none">
            <Label className="text-sm font-medium">Vendedor</Label>
            <Select
              value={vendedorId || TODOS_VENDEDORES}
              onValueChange={(v) => setVendedorId(v === TODOS_VENDEDORES ? '' : v)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Todos los vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_VENDEDORES}>Todos los vendedores</SelectItem>
                {vendedores?.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-2 sm:flex-none">
            <Label className="text-sm font-medium">Fecha</Label>
            <Select
              value={selectedFecha || TODAS_FECHAS}
              onValueChange={(f) => setSelectedFecha(f === TODAS_FECHAS ? '' : f)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Todas las fechas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS_FECHAS}>Todas las fechas</SelectItem>
                {fechasDisponibles.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedRegistro ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge tone="neutral">
                <Eye aria-hidden />
                Solo visualización — no editable
              </StatusBadge>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Inicio</TableHead>
                    <TableHead className="text-right">Entrada</TableHead>
                    <TableHead className="text-right">Final</TableHead>
                    <TableHead className="text-right">Vendido</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRegistro.registros.map(r => {
                    const vendido = r.inicio + r.entrada - r.final;
                    const importe = vendido * r.precioVenta;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="py-3">{r.productoNombre}</TableCell>
                        <TableCell className="py-3 text-right tabular-nums">{r.inicio}</TableCell>
                        <TableCell className="py-3 text-right tabular-nums">{r.entrada}</TableCell>
                        <TableCell className="py-3 text-right tabular-nums">{r.final}</TableCell>
                        <TableCell className="py-3 text-right font-semibold tabular-nums">{vendido}</TableCell>
                        <TableCell className="py-3 text-right tabular-nums">{r.precioVenta.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="py-3 text-right font-semibold tabular-nums">{importe.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-muted/50 p-4 sm:grid-cols-5">
              <div>
                <p className="text-sm text-muted-foreground">Total Inicio</p>
                <p className="text-lg font-semibold tabular-nums">{selectedRegistro.totalInicio}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Entrada</p>
                <p className="text-lg font-semibold tabular-nums">{selectedRegistro.totalEntrada}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Final</p>
                <p className="text-lg font-semibold tabular-nums">{selectedRegistro.totalFinal}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Vendido</p>
                <p className="text-lg font-semibold text-success tabular-nums">{selectedRegistro.totalVendido}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Importe</p>
                <p className="text-lg font-semibold text-primary tabular-nums">{selectedRegistro.totalImporte.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={FileSpreadsheet}
            title="No hay registros de IPVE guardados"
            description="Los registros aparecerán aquí cuando se guarde el inventario del día."
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
