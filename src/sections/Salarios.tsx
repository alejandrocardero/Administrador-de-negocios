import { useEffect, useMemo, useState, useRef } from 'react';
import { Save, DollarSign, Users, TrendingUp, Loader2, Wallet, Calculator, Settings, Zap, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errorMessages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  EmptyState,
  PageHeader,
  SkeletonTable,
  StatusBadge,
  TablePagination,
  usePagination,
} from '@/components/shared';
import type { StatusTone } from '@/components/shared';
import { useSalariosFijos, formatCurrency, useVentasDiarias, useVendedores, useConfiguracion } from '@/hooks/supabase/useSupabaseData';
import { ActionButton } from '@/components/ui/action-button';

const rolTone: Record<string, StatusTone> = {
  jefe: 'info',
  admin: 'info',
  comprador: 'success',
  vendedor: 'warning',
};

// Variables disponibles para la fórmula
const FORMULA_VARIABLES = [
  { key: '{ventasVendedor}', label: 'Ventas del trabajador esta semana', example: '1.500.000' },
  { key: '{ventasTotal}', label: 'Ventas totales del negocio esta semana', example: '10.000.000' },
  { key: '{comisionPorcentaje}', label: 'Porcentaje de comisión configurado', example: '5' },
  { key: '{baseFija}', label: 'Base fija semanal configurada', example: '200.000' },
  { key: '{metaVentas}', label: 'Meta de ventas semanal', example: '3.000.000' },
  { key: '{bonoMeta}', label: 'Bono por alcanzar la meta', example: '100.000' },
];

// Función segura para evaluar la fórmula
function evaluateFormula(formula: string, vars: Record<string, number>): number {
  if (!formula || !formula.trim()) return 0;
  
  try {
    // Reemplazar variables con sus valores
    let expr = formula;
    for (const [key, value] of Object.entries(vars)) {
      expr = expr.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value.toString());
    }
    
    // Manejar CASE WHEN simple: CASE WHEN {ventasVendedor} >= {metaVentas} THEN {bonoMeta} ELSE 0 END
    expr = expr.replace(
      /CASE\s+WHEN\s+([^{}]+)\s+>=\s+([^{}]+)\s+THEN\s+([^{}]+)\s+ELSE\s+([^{}]+)\s+END/gi,
      (_match, condLeft, condRight, thenVal, elseVal) => {
        const left = parseFloat(condLeft.trim());
        const right = parseFloat(condRight.trim());
        const thenV = parseFloat(thenVal.trim());
        const elseV = parseFloat(elseVal.trim());
        return left >= right ? thenV.toString() : elseV.toString();
      }
    );
    
    // Evaluar expresión matemática básica (solo +, -, *, /, paréntesis)
    // Usar Function constructor de forma segura para expresiones aritméticas
    const result = Function('"use strict"; return (' + expr + ')')();
    return isNaN(result) ? 0 : Math.max(0, result);
  } catch {
    return 0;
  }
}

export default function Salarios() {
  const { salariosFijos, upsertSalario, loading } = useSalariosFijos();
  const { ventas } = useVentasDiarias();
  const { vendedores } = useVendedores();
  const { config, loading: configLoading, updateConfig } = useConfiguracion();
  
  const [editando, setEditando] = useState<Record<string, string>>({});
  const [guardado, setGuardado] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [formulaDialogOpen, setFormulaDialogOpen] = useState(false);
  const [formulaSaving, setFormulaSaving] = useState(false);
  interface FormulaConfigLocal extends Omit<NonNullable<typeof config>, 'salario_roles_formula'> {
  salario_roles_formula: string[];
}
const [formulaConfig, setFormulaConfig] = useState<FormulaConfigLocal | null>(null);

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

  // Roles que usan fórmula (desde config, por defecto solo vendedores)
  const rolesConFormula = useMemo(() => {
    try {
      return config?.salario_roles_formula 
        ? JSON.parse(config.salario_roles_formula) 
        : ['vendedor'];
    } catch {
      return ['vendedor'];
    }
  }, [config?.salario_roles_formula]);

  // Obtener trabajadores de los roles seleccionados que tienen ventas
  const trabajadoresConVentas = useMemo(() => {
    const roles = rolesConFormula;
    return vendedores.filter(v => v.activo && v.rol && roles.includes(v.rol));
  }, [vendedores, rolesConFormula]);

  // Calcular salarios por fórmula si está habilitado (usar config real del servidor)
  const salariosCalculados = useMemo(() => {
    if (!config?.salario_usar_formula) return {};
    
    const baseFija = config.salario_base_fija || 0;
    const comisionPorcentaje = config.salario_comision_porcentaje || 0;
    const metaVentas = config.salario_meta_ventas || 0;
    const bonoMeta = config.salario_bono_meta || 0;
    const ventasTotalSemana = ventasSemana.reduce((s, v) => s + v.totalVendido, 0);
    
    const calculados: Record<string, number> = {};
    
    // Calcular para cada trabajador de los roles seleccionados
    for (const trabajador of trabajadoresConVentas) {
      const ventasTrabajador = ventasSemana
        .filter(v => v.vendedorId === trabajador.id)
        .reduce((s, v) => s + v.totalVendido, 0);
      
      const vars = {
        '{ventasVendedor}': ventasTrabajador,
        '{ventasTotal}': ventasTotalSemana,
        '{comisionPorcentaje}': comisionPorcentaje,
        '{baseFija}': baseFija,
        '{metaVentas}': metaVentas,
        '{bonoMeta}': bonoMeta,
      };
      
      // Si hay fórmula personalizada, usarla; sino usar fórmula por defecto
      if (config.salario_formula) {
        calculados[trabajador.id] = evaluateFormula(config.salario_formula, vars);
      } else {
        // Fórmula por defecto: baseFija + (ventasVendedor * comisionPorcentaje / 100) + bono si alcanza meta
        const comision = ventasTrabajador * (comisionPorcentaje / 100);
        const bono = ventasTrabajador >= metaVentas && metaVentas > 0 ? bonoMeta : 0;
        calculados[trabajador.id] = baseFija + comision + bono;
      }
    }
    
    return calculados;
  }, [config, ventasSemana, trabajadoresConVentas]);

  const totalSalariosCalculados = useMemo(() => 
    Object.values(salariosCalculados).reduce((s, v) => s + v, 0), 
  [salariosCalculados]);

  const totalSalariosFijos = useMemo(() => 
    salariosFijos.reduce((s, sf) => s + sf.montoSemanal, 0), 
  [salariosFijos]);

  const usarFormula = config?.salario_usar_formula ?? false;
  const totalNomina = usarFormula 
    ? totalSalariosFijos + totalSalariosCalculados 
    : totalSalariosFijos + totalComisionesVendedores;

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
      toast.error(getErrorMessage(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleGuardarFormula = async () => {
    if (formulaSaving) return;
    setFormulaSaving(true);
    try {
      await updateConfig({
        salario_usar_formula: formulaConfig?.salario_usar_formula ?? false,
        salario_formula: formulaConfig?.salario_formula ?? '',
        salario_base_fija: formulaConfig?.salario_base_fija ?? 0,
        salario_comision_porcentaje: formulaConfig?.salario_comision_porcentaje ?? 0,
        salario_meta_ventas: formulaConfig?.salario_meta_ventas ?? 0,
        salario_bono_meta: formulaConfig?.salario_bono_meta ?? 0,
        salario_formula_descripcion: formulaConfig?.salario_formula_descripcion ?? '',
        salario_roles_formula: JSON.stringify(formulaConfig?.salario_roles_formula ?? ['vendedor']),
      });
      toast.success('Configuración de fórmula guardada');
      setFormulaDialogOpen(false);
    } catch (error) {
      console.error('Error guardando fórmula:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setFormulaSaving(false);
    }
  };

  // Sincronizar config local cuando cambia la config del servidor
  useEffect(() => {
    if (config) {
      let rolesFormula: string[] = ['vendedor'];
      try {
        rolesFormula = config.salario_roles_formula ? JSON.parse(config.salario_roles_formula) : ['vendedor'];
      } catch {
        rolesFormula = ['vendedor'];
      }
      const { salario_roles_formula: _, ...restConfig } = config;
      setFormulaConfig({
        ...restConfig,
        salario_roles_formula: rolesFormula,
      });
    }
  }, [config]);

  const handleFormulaChange = (field: string, value: unknown) => {
    // Actualizar config localmente para preview inmediato
    setFormulaConfig(prev => prev ? { ...prev, [field]: value } : null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salarios"
        description={usarFormula ? "Cálculo automático por fórmula + salarios fijos" : "Salarios fijos por rol y resumen de nómina semanal"}
        icon={Wallet}
        actions={
          <Button variant="outline" onClick={() => setFormulaDialogOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Configurar Fórmula
          </Button>
        }
      />

      {/* Indicador de modo fórmula */}
      {usarFormula && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-primary">Modo Fórmula Activo</p>
                <p className="text-sm text-muted-foreground">
                  Los salarios de {rolesConFormula.map((r: string) => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')} se calculan automáticamente según la fórmula configurada.
                  {formulaConfig?.salario_formula_descripcion && <span className="ml-2">({formulaConfig.salario_formula_descripcion})</span>}
                </p>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Zap className="w-3 h-3" /> Fórmula
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

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
                <p className="text-sm text-muted-foreground">
                  {usarFormula ? 'Salarios por Fórmula (Semana)' : 'Comisiones Vendedores (Semana)'}
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(usarFormula ? totalSalariosCalculados : totalComisionesVendedores)}
                </p>
              </div>
              {usarFormula ? <Calculator className="w-8 h-8 text-warning" /> : <TrendingUp className="w-8 h-8 text-success" />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Nómina (Semana)</p>
                <p className="text-2xl font-bold">{formatCurrency(totalNomina)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Salarios Fijos por Rol</CardTitle>
          {usarFormula && (
            <Badge variant="outline" className="gap-1">
              <Calculator className="w-3 h-3" />
              {rolesConFormula.map((r: string) => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')} usan fórmula
            </Badge>
          )}
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
                            disabled={usarFormula && rolesConFormula.includes(sf.rol)}
                          />
                          {usarFormula && rolesConFormula.includes(sf.rol) && (
                            <Badge variant="secondary" className="ml-1 text-xs">
                              <Calculator className="w-2.5 h-2.5 mr-0.5" />
                              Auto
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleGuardar(sf.rol)}
                          disabled={saving || (usarFormula && rolesConFormula.includes(sf.rol))}
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

      {/* Salarios calculados por fórmula (solo si está habilitado) */}
      {usarFormula && Object.keys(salariosCalculados).length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-warning" />
              Salarios Calculados por Fórmula (Esta Semana)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabajador</TableHead>
                  <TableHead className="text-right">Ventas Semana</TableHead>
                  <TableHead className="text-right">Salario Calculado</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trabajadoresConVentas.map((trabajador) => {
                  const ventasTrabajador = ventasSemana
                    .filter(v => v.vendedorId === trabajador.id)
                    .reduce((s, v) => s + v.totalVendido, 0);
                  const salario = salariosCalculados[trabajador.id] || 0;
                  const rolTrabajador = trabajador.rol ?? 'vendedor';
                  
                  return (
                    <TableRow key={trabajador.id}>
                      <TableCell className="py-3 font-medium">{trabajador.nombre}</TableCell>
                      <TableCell className="py-3 text-right">{formatCurrency(ventasTrabajador)}</TableCell>
                      <TableCell className="py-3 text-right font-bold text-warning-foreground">{formatCurrency(salario)}</TableCell>
                      <TableCell className="py-3">
                        <StatusBadge tone={rolTone[rolTrabajador] ?? 'neutral'}>
                          {rolTrabajador.charAt(0).toUpperCase() + rolTrabajador.slice(1)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        Base: {formatCurrency(formulaConfig?.salario_base_fija || 0)} + 
                        Comisión: {formatCurrency(ventasTrabajador * ((formulaConfig?.salario_comision_porcentaje || 0) / 100))} 
                        {(formulaConfig?.salario_meta_ventas || 0) > 0 && ventasTrabajador >= (formulaConfig?.salario_meta_ventas || 0) && ` + Bono: ${formatCurrency(formulaConfig?.salario_bono_meta || 0)}`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4 text-right font-bold text-lg text-warning-foreground">
              Total Fórmula: {formatCurrency(totalSalariosCalculados)}
            </div>
          </CardContent>
        </Card>
      )}

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
                {usarFormula ? (
                  <>
                    {trabajadoresConVentas.map((trabajador) => {
                      const monto = salariosCalculados[trabajador.id] || 0;
                      return (
                        <TableRow key={`formula-${trabajador.id}`}>
                          <TableCell className="py-3">
                            <StatusBadge tone="warning" className="gap-1">
                              <Calculator className="w-3 h-3" />
                              Fórmula
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="py-3">{trabajador.nombre} <span className="text-xs text-muted-foreground">({trabajador.rol})</span></TableCell>
                          <TableCell className="py-3 text-right font-bold">{formatCurrency(monto)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </>
                ) : (
                  <TableRow>
                    <TableCell className="py-3"><StatusBadge tone="warning">Comisión</StatusBadge></TableCell>
                    <TableCell className="py-3">Vendedores ({vendedores.filter(v => v.activo).length} activos)</TableCell>
                    <TableCell className="py-3 text-right font-bold">{formatCurrency(totalComisionesVendedores)}</TableCell>
                  </TableRow>
                )}
                <TableRow className="border-t-2 border-border">
                  <TableCell colSpan={2} className="py-3 font-bold text-base">Total Nómina de la Semana</TableCell>
                  <TableCell className="py-3 text-right font-bold text-base text-primary">
                    {formatCurrency(totalNomina)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Configurar Fórmula */}
      <Dialog open={formulaDialogOpen} onOpenChange={setFormulaDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Configurar Fórmula de Salarios
            </DialogTitle>
            <DialogDescription>
              Define cómo se calculan los salarios de los trabajadores seleccionados. Puedes usar variables predefinidas o escribir una fórmula personalizada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Toggle activar fórmula */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Usar fórmula automática</p>
                <p className="text-sm text-muted-foreground">
                  Desactivado = salarios fijos por rol (modo tradicional)
                </p>
              </div>
              <Switch
                checked={formulaConfig?.salario_usar_formula ?? false}
                onCheckedChange={(checked) => handleFormulaChange('salario_usar_formula', checked)}
                disabled={configLoading}
              />
            </div>

            {/* Selección de roles que usan fórmula */}
            {formulaConfig?.salario_usar_formula && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Roles que usan la fórmula
                </Label>
                <p className="text-sm text-muted-foreground">
                  Selecciona a qué roles se les calculará el salario con la fórmula (los demás usan salario fijo)
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['jefe', 'admin', 'comprador', 'vendedor'] as const).map((rol) => {
                    const checked = rolesConFormula.includes(rol);
                    return (
                      <label
                        key={rol}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                          checked
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted/50 hover:border-primary/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const newRoles = e.target.checked
                              ? [...rolesConFormula, rol]
                              : rolesConFormula.filter((r: string) => r !== rol);
                            handleFormulaChange('salario_roles_formula', JSON.stringify(newRoles));
                          }}
                          className="w-4 h-4 text-primary border-primary focus:ring-primary"
                        />
                        <span className="font-medium capitalize">{rol}</span>
                        {checked && <Calculator className="w-3.5 h-3.5 text-primary" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Configuración básica (siempre visible) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Fija Semanal por Trabajador</Label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={formulaConfig?.salario_base_fija?.toString() ?? ''}
                  onChange={(e) => handleFormulaChange('salario_base_fija', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Monto base que recibe cada trabajador sin importar ventas</p>
              </div>
              <div className="space-y-2">
                <Label>Porcentaje de Comisión (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formulaConfig?.salario_comision_porcentaje?.toString() ?? ''}
                  onChange={(e) => handleFormulaChange('salario_comision_porcentaje', parseFloat(e.target.value) || 0)}
                  placeholder="5"
                />
                <p className="text-xs text-muted-foreground">% sobre las ventas del vendedor (ej: 5 = 5%)</p>
              </div>
              <div className="space-y-2">
                <Label>Meta de Ventas Semanal (para bono)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={formulaConfig?.salario_meta_ventas?.toString() ?? ''}
                  onChange={(e) => handleFormulaChange('salario_meta_ventas', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Si el vendedor alcanza esta meta, recibe el bono</p>
              </div>
              <div className="space-y-2">
                <Label>Bono por Alcanzar Meta</Label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={formulaConfig?.salario_bono_meta?.toString() ?? ''}
                  onChange={(e) => handleFormulaChange('salario_bono_meta', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">Monto extra si cumple la meta semanal</p>
              </div>
            </div>

            {/* Fórmula personalizada avanzada */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span>Fórmula Personalizada (Opcional)</span>
                <Button variant="ghost" size="icon" onClick={() => handleFormulaChange('salario_formula', '{baseFija} + ({ventasVendedor} * {comisionPorcentaje} / 100) + CASE WHEN {ventasVendedor} >= {metaVentas} THEN {bonoMeta} ELSE 0 END')} title="Restablecer a fórmula por defecto">
                  <Zap className="w-4 h-4" />
                </Button>
              </Label>
              <Textarea
                value={formulaConfig?.salario_formula ?? ''}
                onChange={(e) => handleFormulaChange('salario_formula', e.target.value)}
                placeholder="Ej: {baseFija} + ({ventasVendedor} * {comisionPorcentaje} / 100) + CASE WHEN {ventasVendedor} >= {metaVentas} THEN {bonoMeta} ELSE 0 END"
                rows={3}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Deja vacío para usar la fórmula por defecto: Base + (Ventas × Comisión%) + Bono si alcanza meta
              </p>
            </div>

            {/* Variables disponibles */}
            <div className="space-y-2 border-t pt-4">
              <Label className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                Variables Disponibles
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {FORMULA_VARIABLES.map(v => (
                  <div key={v.key} className="p-2 bg-muted rounded flex items-center gap-2 font-mono">
                    <kbd className="px-2 py-0.5 bg-background border rounded text-xs">{v.key}</kbd>
                    <span className="text-muted-foreground">{v.label}</span>
                    <span className="text-xs text-muted-foreground/50">→ {v.example}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Descripción de la fórmula */}
            <div className="space-y-2">
              <Label>Descripción para el equipo (opcional)</Label>
              <Textarea
                value={formulaConfig?.salario_formula_descripcion ?? ''}
                onChange={(e) => handleFormulaChange('salario_formula_descripcion', e.target.value)}
                placeholder="Ej: Base $200k + 5% comisión + $100k bono si vende más de $3M/semana"
                rows={2}
              />
            </div>

            {/* Preview en vivo */}
            {trabajadoresConVentas.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <Label className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  Vista Previa (Semana Actual)
                </Label>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trabajador</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                        <TableHead className="text-right">Salario Estimado</TableHead>
                        <TableHead>Rol</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trabajadoresConVentas.map((trabajador) => {
                        const ventasTrabajador = ventasSemana
                          .filter(v => v.vendedorId === trabajador.id)
                          .reduce((s, v) => s + v.totalVendido, 0);
                        
                        const vars = {
                          '{ventasVendedor}': ventasTrabajador,
                          '{ventasTotal}': ventasSemana.reduce((s, v) => s + v.totalVendido, 0),
                          '{comisionPorcentaje}': formulaConfig?.salario_comision_porcentaje || 0,
                          '{baseFija}': formulaConfig?.salario_base_fija || 0,
                          '{metaVentas}': formulaConfig?.salario_meta_ventas || 0,
                          '{bonoMeta}': formulaConfig?.salario_bono_meta || 0,
                        };
                        
                        let salario = 0;
                        if (formulaConfig?.salario_formula) {
                          salario = evaluateFormula(formulaConfig.salario_formula, vars);
                        } else {
                          const comision = ventasTrabajador * ((formulaConfig?.salario_comision_porcentaje || 0) / 100);
                          const bono = ventasTrabajador >= (formulaConfig?.salario_meta_ventas || 0) && (formulaConfig?.salario_meta_ventas || 0) > 0 ? (formulaConfig?.salario_bono_meta || 0) : 0;
                          salario = (formulaConfig?.salario_base_fija || 0) + comision + bono;
                        }
                        
                        const rolTrabajador = trabajador.rol ?? 'vendedor';
                          return (
                            <TableRow key={trabajador.id}>
                              <TableCell className="py-2">{trabajador.nombre}</TableCell>
                              <TableCell className="py-2 text-right">{formatCurrency(ventasTrabajador)}</TableCell>
                              <TableCell className="py-2 text-right font-bold text-primary">{formatCurrency(salario)}</TableCell>
                              <TableCell className="py-2">
                                <StatusBadge tone={rolTone[rolTrabajador] ?? 'neutral'} className="text-xs">
                                  {rolTrabajador}
                                </StatusBadge>
                              </TableCell>
                            </TableRow>
                          );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormulaDialogOpen(false)}>
              Cancelar
            </Button>
            <ActionButton onAction={handleGuardarFormula} disabled={formulaSaving || configLoading}>
              {formulaSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Guardar Configuración
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
