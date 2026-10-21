import { useMemo, useState, useRef } from 'react';
import { Save, DollarSign, Users, TrendingUp, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  EmptyState,
  PageHeader,
  SkeletonTable,
  StatusBadge,
  TablePagination,
  usePagination,
  type StatusTone,
} from '@/components/shared';
import { useSalariosFijos, formatCurrency, useVentasDiarias, useVendedores } from '@/hooks/supabase/useSupabaseData';

const rolTone: Record<string, StatusTone> = {
  jefe: 'info',
  admin: 'info',
  comprador: 'success',
  vendedor: 'warning',
};

export default function Salarios() {
  const { salariosFijos, upsertSalario, loading } = useSalariosFijos();
  const { ventas } = useVentasDiarias();
  const { vendedores } = useVendedores();
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [guardado, setGuardado] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const { pageItems, page, pageCount, setPage } = usePagination(salariosFijos);

  const inicioSemana = useMemo(() => {
    const hoy = new Date();
    const fecha = new Date(hoy);
    const diaSemana = hoy.getDay();
    const diasDesdeSabado = (diaSemana + 1) % 7;
    fecha.setDate(hoy.getDate() - diasDesdeSabado);
    fecha.setHours(0, 0, 0, 0);
    return fecha;
  }, []);

  const ventasSemana = useMemo(() =>
    ventas.filter(v => new Date(v.fecha) >= inicioSemana),
    [ventas, inicioSemana]
  );

  const totalComisionesVendedores = ventasSemana.reduce((s, v) => s + v.salarioCalculado, 0);

  const handleGuardar = async (rol: string) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const monto = parseFloat(editando[rol]?.replace(/[^0-9.]/g, '') || '0');
      if (monto >= 0) {
        await upsertSalario(rol as import('@/types').UserRole, monto);
        setGuardado(rol);
        setTimeout(() => setGuardado(null), 2000);
        toast.success('Salario actualizado');
      }
    } catch (error) {
      toast.error('No se pudo guardar el salario');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const totalSalariosFijos = salariosFijos.reduce((s, sf) => s + sf.montoSemanal, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salarios"
        description="Salarios fijos por rol y resumen de nómina semanal"
        icon={Wallet}
      />

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Salarios Fijos (Semana)</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSalariosFijos)}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comisiones Vendedores (Semana)</p>
                <p className="text-2xl font-bold">{formatCurrency(totalComisionesVendedores)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Nómina (Semana)</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSalariosFijos + totalComisionesVendedores)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Salarios Fijos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable cols={3} rows={4} />
          ) : salariosFijos.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Sin salarios configurados"
              description="Define el salario semanal de cada rol para calcular tu nómina."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rol</TableHead>
                    <TableHead>Salario Semanal</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((sf) => (
                    <TableRow key={sf.rol}>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge tone={rolTone[sf.rol] ?? 'neutral'}>
                            {sf.rol.charAt(0).toUpperCase() + sf.rol.slice(1)}
                          </StatusBadge>
                          <span className="font-medium">{sf.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2 max-w-[200px]">
                          <span className="text-sm text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="1000"
                            value={editando[sf.rol] ?? sf.montoSemanal.toString()}
                            onChange={(e) => setEditando(prev => ({ ...prev, [sf.rol]: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleGuardar(sf.rol)}
                          disabled={saving}
                          variant={guardado === sf.rol ? 'outline' : 'default'}
                          className={guardado === sf.rol ? 'border-success/50 text-success' : ''}
                        >
                          {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                          <Save className="w-4 h-4 mr-1" />
                          {guardado === sf.rol ? 'Guardado' : 'Guardar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination page={page} pageCount={pageCount} setPage={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de Nómina de la Semana</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable cols={3} rows={4} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salariosFijos.filter(sf => sf.montoSemanal > 0).map((sf) => (
                  <TableRow key={`fijo-${sf.rol}`}>
                    <TableCell className="py-3">
                      <StatusBadge tone={rolTone[sf.rol] ?? 'neutral'}>Fijo</StatusBadge>
                    </TableCell>
                    <TableCell className="py-3">{sf.nombre}</TableCell>
                    <TableCell className="py-3 text-right font-bold">{formatCurrency(sf.montoSemanal)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="py-3"><StatusBadge tone="warning">Comisión</StatusBadge></TableCell>
                  <TableCell className="py-3">Vendedores ({vendedores.length} activos)</TableCell>
                  <TableCell className="py-3 text-right font-bold">{formatCurrency(totalComisionesVendedores)}</TableCell>
                </TableRow>
                <TableRow className="border-t-2 border-border">
                  <TableCell colSpan={2} className="py-3 font-bold text-base">Total Nómina de la Semana</TableCell>
                  <TableCell className="py-3 text-right font-bold text-base text-primary">
                    {formatCurrency(totalSalariosFijos + totalComisionesVendedores)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
