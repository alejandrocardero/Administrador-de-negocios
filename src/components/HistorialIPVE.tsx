import { useState, useMemo } from 'react';
import { FileSpreadsheet, Eye } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { useVendedores, useIPVE } from '@/hooks/useStorage';

interface HistorialIPVEProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function HistorialIPVE({ open, onOpenChange }: HistorialIPVEProps) {
  const { vendedores } = useVendedores();
  const { registros } = useIPVE();
  
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
            <FileSpreadsheet className="h-5 w-5" />
            Historial de IPVE
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 mb-4">
          <div className="space-y-2">
            <Label>Vendedor</Label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
            >
              <option value="">Todos los vendedores</option>
              {vendedores?.map(v => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Fecha</Label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={selectedFecha}
              onChange={(e) => setSelectedFecha(e.target.value)}
            >
              <option value="">Todas las fechas</option>
              {fechasDisponibles.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedRegistro ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>Solo visualización - No editable</span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Final</TableHead>
                  <TableHead>Vendido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedRegistro.registros.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.productoNombre}</TableCell>
                    <TableCell>{r.inicio}</TableCell>
                    <TableCell>{r.entrada}</TableCell>
                    <TableCell>{r.final}</TableCell>
                    <TableCell className="font-bold">{r.inicio + r.entrada - r.final}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Total Inicio</p>
                <p className="text-lg font-bold">{selectedRegistro.totalInicio}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Entrada</p>
                <p className="text-lg font-bold">{selectedRegistro.totalEntrada}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Final</p>
                <p className="text-lg font-bold">{selectedRegistro.totalFinal}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Vendido</p>
                <p className="text-lg font-bold text-green-600">{selectedRegistro.totalVendido}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No hay registros de IPVE guardados
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}