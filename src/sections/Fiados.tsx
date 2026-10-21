import { useState, useMemo } from 'react';
import { CheckCircle2, Clock, HandCoins, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertActionButton } from '@/components/ui/action-button';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonCards,
  SkeletonTable,
  StatusBadge,
  TablePagination,
  usePagination,
} from '@/components/shared';
import { useFiados, formatCurrency, formatDate } from '@/hooks/supabase/useSupabaseData';
import type { Fiado } from '@/types';

const diasPendientes = (fecha: string) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha);
  f.setHours(0, 0, 0, 0);
  return Math.ceil((hoy.getTime() - f.getTime()) / 86400000);
};

export default function Fiados() {
  const { fiados, getPendientes, getCobrados, cobrarFiado, loading } = useFiados();
  const [searchQuery, setSearchQuery] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<'todos' | 'pendiente' | 'cobrado'>('todos');
  const [confirmId, setConfirmId] = useState<string | null>(null);

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

  const { pageItems, page, pageCount, setPage, reset } = usePagination(fiadosFiltrados);

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
    if (confirmId) {
      await cobrarFiado(confirmId);
      setConfirmId(null);
      toast.success('Cobro registrado');
    }
  };

  const estadoBadge = (fiado: Fiado) => (
    fiado.estado === 'pendiente' ? (
      <StatusBadge tone="danger" className="gap-1">
        <Clock className="size-3" aria-hidden />
        Pendiente
        {diasPendientes(fiado.fecha) > 0 && (
          <span className="text-xs">({diasPendientes(fiado.fecha)}d)</span>
        )}
      </StatusBadge>
    ) : (
      <StatusBadge tone="success" className="gap-1">
        <CheckCircle2 className="size-3" aria-hidden />
        Cobrado
      </StatusBadge>
    )
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiados (Ventas a Plazo)"
        description="Registro y control de productos vendidos a crédito"
        icon={HandCoins}
      />

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total por Cobrar</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(totalPendiente)}</p>
              </div>
              <XCircle className="w-8 h-8 text-destructive/70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fiados Pendientes</p>
                <p className="text-2xl font-bold">{getPendientes().length}</p>
              </div>
              <Clock className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cobrado este Mes</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalCobradoMes)}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-success/70" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchQuery}
              onChange={(value) => { setSearchQuery(value); reset(); }}
              placeholder="Buscar por cliente, vendedor, productos…"
            />
            <Select
              value={estadoFilter}
              onValueChange={(value) => {
                setEstadoFilter(value as 'todos' | 'pendiente' | 'cobrado');
                reset();
              }}
            >
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

          {loading ? (
            <>
              <div className="hidden md:block">
                <SkeletonTable cols={8} />
              </div>
              <div className="md:hidden">
                <SkeletonCards count={4} />
              </div>
            </>
          ) : fiados.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="Sin fiados registrados"
              description="Las ventas a crédito que registres aparecerán aquí para su seguimiento y cobro."
            />
          ) : fiadosFiltrados.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Sin resultados para tu búsqueda"
              description="Prueba con otro cliente, vendedor o producto, o cambia el filtro de estado."
            />
          ) : (
            <>
              {/* Vista de tabla (escritorio) */}
              <div className="hidden md:block">
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
                    {pageItems.map((fiado) => (
                      <TableRow key={fiado.id}>
                        <TableCell className="py-3">{formatDate(fiado.fecha)}</TableCell>
                        <TableCell className="py-3">{fiado.vendedorNombre}</TableCell>
                        <TableCell className="py-3 font-medium">{fiado.clienteNombre}</TableCell>
                        <TableCell className="py-3 max-w-xs truncate">{fiado.descripcion}</TableCell>
                        <TableCell className="py-3 text-right font-bold">{formatCurrency(fiado.monto)}</TableCell>
                        <TableCell className="py-3">{estadoBadge(fiado)}</TableCell>
                        <TableCell className="py-3">{fiado.fechaCobro ? formatDate(fiado.fechaCobro) : '-'}</TableCell>
                        <TableCell className="py-3 text-right">
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
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Vista de tarjetas (móvil) */}
              <div className="md:hidden space-y-3">
                {pageItems.map((fiado) => (
                  <Card key={fiado.id} className="p-0">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{fiado.clienteNombre}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(fiado.fecha)} · {fiado.vendedorNombre}</p>
                        </div>
                        <div className="shrink-0">
                          {estadoBadge(fiado)}
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">Monto</dt>
                          <dd className="font-bold">{formatCurrency(fiado.monto)}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">Fecha Cobro</dt>
                          <dd>{fiado.fechaCobro ? formatDate(fiado.fechaCobro) : '-'}</dd>
                        </div>
                        {fiado.descripcion && (
                          <div className="col-span-2 min-w-0">
                            <dt className="text-xs text-muted-foreground">Productos</dt>
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
                ))}
              </div>

              <TablePagination page={page} pageCount={pageCount} setPage={setPage} />
            </>
          )}
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
              <AlertActionButton variant="default" onAction={confirmCobrar}>
                Confirmar Cobro
              </AlertActionButton>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
