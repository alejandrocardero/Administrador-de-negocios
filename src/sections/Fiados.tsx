import { useState, useMemo, useRef } from 'react';
import { Search, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { useFiados, formatCurrency, formatDate } from '@/hooks/supabase/useSupabaseData';

const diasPendientes = (fecha: string) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha);
  f.setHours(0, 0, 0, 0);
  return Math.ceil((hoy.getTime() - f.getTime()) / 86400000);
};

export default function Fiados() {
  const { fiados, getPendientes, getCobrados, cobrarFiado } = useFiados();
  const [searchQuery, setSearchQuery] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<'todos' | 'pendiente' | 'cobrado'>('todos');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const fiadosFiltrados = useMemo(() => {
    let resultado = estadoFilter === 'todos' ? fiados : (estadoFilter === 'pendiente' ? getPendientes() : getCobrados());
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      resultado = resultado.filter(f =>
        f.clienteNombre.toLowerCase().includes(q) ||
        f.vendedorNombre.toLowerCase().includes(q) ||
        f.descripcion?.toLowerCase().includes(q)
      );
    }
    return resultado.sort((a, b) => {
      if (a.estado !== b.estado) return a.estado === 'pendiente' ? -1 : 1;
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  }, [fiados, getPendientes, getCobrados, searchQuery, estadoFilter]);

  const totalPendiente = getPendientes().reduce((sum, f) => sum + f.monto, 0);
  const totalCobradoMes = getCobrados()
    .filter(f => {
      if (!f.fechaCobro) return false;
      const cobro = new Date(f.fechaCobro);
      const ahora = new Date();
      return cobro.getFullYear() === ahora.getFullYear() && cobro.getMonth() === ahora.getMonth();
    })
    .reduce((sum, f) => sum + f.monto, 0);

  const handleCobrar = (id: string) => {
    setConfirmId(id);
  };

  const confirmCobrar = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (confirmId) {
        await cobrarFiado(confirmId);
        setConfirmId(null);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fiados (Ventas a Plazo)</h1>
          <p className="text-slate-500">Registro y control de productos vendidos a crédito</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total por Cobrar</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPendiente)}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Fiados Pendientes</p>
                <p className="text-2xl font-bold">{getPendientes().length}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Cobrado este Mes</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCobradoMes)}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente, vendedor, productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={estadoFilter} onValueChange={(value) => setEstadoFilter(value as 'todos' | 'pendiente' | 'cobrado')}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="cobrado">Cobrados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lista de Fiados</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Vista de tabla (escritorio) */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Cobro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fiadosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      No se encontraron fiados
                    </TableCell>
                  </TableRow>
                ) : (
                  fiadosFiltrados.map((fiado) => (
                    <TableRow key={fiado.id}>
                      <TableCell>{formatDate(fiado.fecha)}</TableCell>
                      <TableCell>{fiado.vendedorNombre}</TableCell>
                      <TableCell className="font-medium">{fiado.clienteNombre}</TableCell>
                      <TableCell className="max-w-xs truncate">{fiado.descripcion}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(fiado.monto)}</TableCell>
                      <TableCell>
                        {fiado.estado === 'pendiente' ? (
                          <Badge variant="destructive" className="gap-1">
                            <Clock className="w-3 h-3" />
                            Pendiente {diasPendientes(fiado.fecha) > 0 && (
                              <span className="text-xs">({diasPendientes(fiado.fecha)}d)</span>
                            )}
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Cobrado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{fiado.fechaCobro ? formatDate(fiado.fechaCobro) : '-'}</TableCell>
                      <TableCell className="text-right">
                        {fiado.estado === 'pendiente' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleCobrar(fiado.id)}
                            className="gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Cobrar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Vista de tarjetas (móvil) */}
          <div className="md:hidden space-y-3">
            {fiadosFiltrados.length === 0 ? (
              <p className="text-center py-8 text-slate-500">No se encontraron fiados</p>
            ) : (
              fiadosFiltrados.map((fiado) => (
                <Card key={fiado.id} className="p-0">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{fiado.clienteNombre}</p>
                        <p className="text-xs text-slate-500">{formatDate(fiado.fecha)} · {fiado.vendedorNombre}</p>
                      </div>
                      <div className="shrink-0">
                        {fiado.estado === 'pendiente' ? (
                          <Badge variant="destructive" className="gap-1">
                            <Clock className="w-3 h-3" />
                            Pendiente {diasPendientes(fiado.fecha) > 0 && (
                              <span className="text-xs">({diasPendientes(fiado.fecha)}d)</span>
                            )}
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Cobrado
                          </Badge>
                        )}
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">Monto</dt>
                        <dd className="font-bold">{formatCurrency(fiado.monto)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">Fecha Cobro</dt>
                        <dd>{fiado.fechaCobro ? formatDate(fiado.fechaCobro) : '-'}</dd>
                      </div>
                      {fiado.descripcion && (
                        <div className="col-span-2 min-w-0">
                          <dt className="text-xs text-slate-500">Productos</dt>
                          <dd className="break-words">{fiado.descripcion}</dd>
                        </div>
                      )}
                    </dl>
                    {fiado.estado === 'pendiente' && (
                      <div className="flex justify-end">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleCobrar(fiado.id)}
                          className="gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Cobrar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {confirmId && (
        <AlertDialog open={true} onOpenChange={(open) => !open && setConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Cobro</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Marcar como cobrado el fiado? Se registrará como venta de hoy con el monto en efectivo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmId(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmCobrar} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar Cobro
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}