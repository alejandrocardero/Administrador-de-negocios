import { useSalariosFijos, formatCurrency, useVentasDiarias, useVendedores } from '@/hooks/supabase/useSupabaseData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState, useRef } from 'react';
import { Save, DollarSign, Users, TrendingUp, Loader2 } from 'lucide-react';

export default function Salarios() {
  const { salariosFijos, upsertSalario } = useSalariosFijos();
  const { ventas } = useVentasDiarias();
  const { vendedores } = useVendedores();
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [guardado, setGuardado] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

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
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const getBadgeColor = (rol: string) => {
    const map: Record<string, string> = { jefe: 'bg-purple-500', admin: 'bg-blue-500', comprador: 'bg-green-500', vendedor: 'bg-orange-500' };
    return map[rol] || 'bg-slate-500';
  };

  const totalSalariosFijos = salariosFijos.reduce((s, sf) => s + sf.montoSemanal, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Salarios Fijos (Semana)</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSalariosFijos)}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Comisiones Vendedores (Semana)</p>
                <p className="text-2xl font-bold">{formatCurrency(totalComisionesVendedores)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Nómina (Semana)</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSalariosFijos + totalComisionesVendedores)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Salarios Fijos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rol</TableHead>
                <TableHead>Salario Semanal</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salariosFijos.map((sf) => (
                <TableRow key={sf.rol}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge className={getBadgeColor(sf.rol)}>
                        {sf.rol.charAt(0).toUpperCase() + sf.rol.slice(1)}
                      </Badge>
                      <span className="font-medium">{sf.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 max-w-[200px]">
                      <span className="text-sm text-slate-500">$</span>
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
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => handleGuardar(sf.rol)}
                      disabled={saving}
                      variant={guardado === sf.rol ? 'default' : 'outline'}
                      className={guardado === sf.rol ? 'bg-green-600 hover:bg-green-700' : ''}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de Nómina de la Semana</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <TableCell><Badge className={getBadgeColor(sf.rol)}>Fijo</Badge></TableCell>
                  <TableCell>{sf.nombre}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(sf.montoSemanal)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell><Badge className="bg-orange-500">Comisión</Badge></TableCell>
                <TableCell>Vendedores ({vendedores.length} activos)</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totalComisionesVendedores)}</TableCell>
              </TableRow>
              <TableRow className="border-t-2 border-slate-300">
                <TableCell colSpan={2} className="font-bold text-base">Total Nómina de la Semana</TableCell>
                <TableCell className="text-right font-bold text-base text-blue-600">
                  {formatCurrency(totalSalariosFijos + totalComisionesVendedores)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}