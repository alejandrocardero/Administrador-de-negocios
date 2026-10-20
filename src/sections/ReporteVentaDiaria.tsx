import { useMemo, useState } from 'react';
import {
  CalendarIcon, CalendarCheck, DollarSign, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Lock, Loader2, PiggyBank, Package, History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover, PopoverContent, PopoverTrigger as PopoverTriggerRoot
} from '@/components/ui/popover';
import {
  useVentasDiarias, useRegistrosIPVE, useProductos, formatCurrency
} from '@/hooks/supabase/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { round2, gananciaProducto, formatMargen } from '@/lib/ganancia';
import type { VentaDiaria } from '@/types';
import { cn } from '@/lib/utils';
import { format as formatFns, subDays, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

/** Fecha local en formato YYYY-MM-DD (el formato de `fecha` en registros IPVE). */
function toFechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Inicio local del día en ISO. `getVentasByFecha` ajusta las horas
 * (0:00:00 para inicio, 23:59:59 para fin), así que con la misma fecha en
 * ambos extremos se obtiene exactamente ese día local.
 */
function inicioDelDia(d: Date): string {
  return `${toFechaLocal(d)}T00:00:00`;
}

interface ProductoVendidoDia {
  productoId: string;
  nombre: string;
  vendido: number;
  importe: number;
  ganancia: number;
  precioVenta: number;
  precioCompra: number;
  existeProducto: boolean;
}

/** Badge de variación ±%: verde si sube, rojo si baja, "n/d" si el día base fue 0. */
function VariacionBadge({ variacion }: { variacion: number | null }) {
  if (variacion === null) {
    return <Badge variant="secondary">n/d</Badge>;
  }
  const esSubida = variacion > 0;
  const esBajada = variacion < 0;
  const Icon = esSubida ? TrendingUp : esBajada ? TrendingDown : Minus;
  return (
    <Badge
      variant="secondary"
      className={cn(
        esSubida && 'bg-green-100 text-green-800',
        esBajada && 'bg-red-100 text-red-700',
        !esSubida && !esBajada && 'bg-slate-100 text-slate-600'
      )}
    >
      <Icon className="w-3 h-3" />
      {esSubida ? '+' : ''}{formatMargen(variacion)}
    </Badge>
  );
}

export default function ReporteVentaDiaria() {
  const { user } = useAuth();
  const { getVentasByFecha, loading: loadingVentas } = useVentasDiarias();
  const { getRegistrosByFecha } = useRegistrosIPVE();
  const { getById, loading: loadingProductos } = useProductos();

  const [fecha, setFecha] = useState<Date>(new Date());
  const [popoverAbierto, setPopoverAbierto] = useState(false);

  // ----- Nivel venta: día D, D−7d (misma semana anterior) y D−1mes -----
  const dia = useMemo(() => {
    const delDia = (d: Date) => getVentasByFecha(inicioDelDia(d), inicioDelDia(d));
    const total = (vs: VentaDiaria[]) => vs.reduce((s, v) => s + v.totalVendido, 0);
    const suma = (vs: VentaDiaria[], campo: 'salarioCalculado' | 'montoEfectivo' | 'montoTransferencia') =>
      vs.reduce((s, v) => s + v[campo], 0);

    const ventasHoy = delDia(fecha);
    const ventasSemanaAnterior = delDia(subDays(fecha, 7));
    const ventasMesAnterior = delDia(subMonths(fecha, 1));

    const totalHoy = total(ventasHoy);
    const totalSemanaAnterior = total(ventasSemanaAnterior);
    const totalMesAnterior = total(ventasMesAnterior);

    return {
      ventasHoy,
      totalHoy,
      salariosHoy: suma(ventasHoy, 'salarioCalculado'),
      efectivoHoy: suma(ventasHoy, 'montoEfectivo'),
      transferenciaHoy: suma(ventasHoy, 'montoTransferencia'),
      totalSemanaAnterior,
      totalMesAnterior,
      variacionSemana: totalSemanaAnterior > 0
        ? round2(((totalHoy - totalSemanaAnterior) / totalSemanaAnterior) * 100)
        : null,
      variacionMes: totalMesAnterior > 0
        ? round2(((totalHoy - totalMesAnterior) / totalMesAnterior) * 100)
        : null,
    };
  }, [fecha, getVentasByFecha]);

  // ----- Nivel producto: IPVE histórico del día -----
  const fechaISO = toFechaLocal(fecha);
  const registros = useMemo(() => getRegistrosByFecha(fechaISO), [getRegistrosByFecha, fechaISO]);

  const productosDelDia = useMemo(() => {
    const mapa = new Map<string, ProductoVendidoDia>();
    const sinProducto = new Set<string>();

    for (const r of registros) {
      const producto = getById(r.productoId);
      if (!producto) sinProducto.add(r.productoId);
      const precioCompra = producto?.precioCompra ?? 0;

      // vendido_fila = (inicio + entrada) − final
      const vendidoFila = r.inicio + r.entrada - r.final;
      const importeFila = round2(vendidoFila * r.precioVenta);
      const gananciaFila = gananciaProducto(vendidoFila, r.precioVenta, precioCompra);

      const previo = mapa.get(r.productoId);
      if (previo) {
        previo.vendido += vendidoFila;
        previo.importe = round2(previo.importe + importeFila);
        previo.ganancia = round2(previo.ganancia + gananciaFila);
        previo.precioVenta = r.precioVenta;
      } else {
        mapa.set(r.productoId, {
          productoId: r.productoId,
          nombre: producto?.nombre || r.productoNombre,
          vendido: vendidoFila,
          importe: importeFila,
          ganancia: gananciaFila,
          precioVenta: r.precioVenta,
          precioCompra,
          existeProducto: Boolean(producto),
        });
      }
    }

    return {
      lista: Array.from(mapa.values()).sort((a, b) => b.importe - a.importe),
      sinProducto: Array.from(sinProducto),
    };
  }, [registros, getById]);

  const hayRegistrosIpve = registros.length > 0;
  const totalImporte = round2(productosDelDia.lista.reduce((s, p) => s + p.importe, 0));
  const unidadesVendidas = productosDelDia.lista.reduce((s, p) => s + p.vendido, 0);
  const gananciaReal = round2(productosDelDia.lista.reduce((s, p) => s + p.ganancia, 0));
  const pctMargenGlobal = totalImporte > 0 ? round2((gananciaReal / totalImporte) * 100) : null;
  const gananciaNeta = round2(gananciaReal - dia.salariosHoy);
  const cargando = loadingVentas || loadingProductos;

  // Guard de rol (defensa en profundidad: además solo aparece en el menú del jefe)
  if (user?.role !== 'jefe') {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-center space-y-3">
          <Lock className="w-10 h-10 text-red-500 mx-auto" />
          <p className="text-lg font-semibold">No autorizado</p>
          <p className="text-sm text-slate-500">
            Esta sección está disponible únicamente para el rol jefe.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de fecha */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <CalendarCheck className="w-8 h-8 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Fecha del reporte</p>
                <p className="font-semibold capitalize truncate">
                  {formatFns(fecha, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setFecha(new Date())}>
                Hoy
              </Button>
              <Popover open={popoverAbierto} onOpenChange={setPopoverAbierto}>
                <PopoverTriggerRoot asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatFns(fecha, "PPP", { locale: es })}
                  </Button>
                </PopoverTriggerRoot>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={fecha}
                    onSelect={(d) => {
                      if (d) {
                        setFecha(d);
                        setPopoverAbierto(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Ventas del día</p>
                {cargando ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                ) : (
                  <p className="text-2xl font-bold">{formatCurrency(dia.totalHoy)}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Efectivo: {formatCurrency(dia.efectivoHoy)} · Transf.: {formatCurrency(dia.transferenciaHoy)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Vs. semana anterior</p>
                <div className="mt-1">
                  {cargando ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  ) : (
                    <VariacionBadge variacion={dia.variacionSemana} />
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {formatFns(subDays(fecha, 7), "d 'de' MMM", { locale: es })}: {formatCurrency(dia.totalSemanaAnterior)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Vs. mismo día mes anterior</p>
                <div className="mt-1">
                  {cargando ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  ) : (
                    <VariacionBadge variacion={dia.variacionMes} />
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {formatFns(subMonths(fecha, 1), "d 'de' MMM", { locale: es })}: {formatCurrency(dia.totalMesAnterior)}
                </p>
              </div>
              <History className="w-8 h-8 text-violet-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Ganancia real del día</p>
                <p className={cn('text-2xl font-bold', gananciaReal >= 0 ? 'text-green-600' : 'text-red-600')}>
                  {hayRegistrosIpve ? formatCurrency(gananciaReal) : '—'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {hayRegistrosIpve ? `Margen: ${formatMargen(pctMargenGlobal)}` : 'Requiere IPVE del día'}
                </p>
              </div>
              <PiggyBank className="w-8 h-8 text-green-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Avisos */}
      {!cargando && dia.ventasHoy.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800">No hay ventas registradas para este día.</p>
          </CardContent>
        </Card>
      )}

      {!hayRegistrosIpve && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800">
              Registra el IPVE del día para ver el detalle por producto.
            </p>
          </CardContent>
        </Card>
      )}

      {productosDelDia.sinProducto.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800">
              No se encontraron {productosDelDia.sinProducto.length} producto(s) del catálogo;
              se asume precio de compra $0 para su ganancia.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Detalle por producto + totales (requiere IPVE del día) */}
      {hayRegistrosIpve && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                Productos Vendidos del Día
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Vista de tabla (escritorio) */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Vendido</TableHead>
                      <TableHead className="text-right">Precio Venta</TableHead>
                      <TableHead className="text-right">Precio Compra</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                      <TableHead className="text-right">Ganancia</TableHead>
                      <TableHead className="text-right">% Margen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosDelDia.lista.map((p) => {
                      const pct = p.importe > 0 ? round2((p.ganancia / p.importe) * 100) : null;
                      return (
                        <TableRow key={p.productoId}>
                          <TableCell className="font-medium">
                            {p.nombre}
                            {!p.existeProducto && (
                              <span className="text-xs text-amber-600"> (sin producto)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{p.vendido}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.precioVenta)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.precioCompra)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(p.importe)}</TableCell>
                          <TableCell className={cn('text-right font-medium', p.ganancia >= 0 ? 'text-green-600' : 'text-red-600')}>
                            {formatCurrency(p.ganancia)}
                          </TableCell>
                          <TableCell className="text-right">
                            {pct !== null ? formatMargen(pct) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">TOTAL</TableCell>
                      <TableCell className="text-right font-bold">{unidadesVendidas}</TableCell>
                      <TableCell colSpan={2} />
                      <TableCell className="text-right font-bold">{formatCurrency(totalImporte)}</TableCell>
                      <TableCell className={cn('text-right font-bold', gananciaReal >= 0 ? 'text-green-600' : 'text-red-600')}>
                        {formatCurrency(gananciaReal)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {pctMargenGlobal !== null ? formatMargen(pctMargenGlobal) : '—'}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>

              {/* Vista de tarjetas (móvil) */}
              <div className="md:hidden space-y-3">
                {productosDelDia.lista.map((p) => {
                  const pct = p.importe > 0 ? round2((p.ganancia / p.importe) * 100) : null;
                  return (
                    <Card key={p.productoId} className="p-0">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.nombre}</p>
                            {!p.existeProducto && (
                              <p className="text-xs text-amber-600">Producto no encontrado (PC = $0)</p>
                            )}
                          </div>
                          <p className="text-sm font-bold shrink-0">{formatCurrency(p.importe)}</p>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="min-w-0">
                            <dt className="text-xs text-slate-500">Vendido</dt>
                            <dd>{p.vendido}</dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs text-slate-500">% Margen</dt>
                            <dd>{pct !== null ? formatMargen(pct) : '—'}</dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs text-slate-500">Precio Venta</dt>
                            <dd>{formatCurrency(p.precioVenta)}</dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs text-slate-500">Precio Compra</dt>
                            <dd>{formatCurrency(p.precioCompra)}</dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs text-slate-500">Importe</dt>
                            <dd className="font-bold">{formatCurrency(p.importe)}</dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs text-slate-500">Ganancia</dt>
                            <dd className={cn('font-bold', p.ganancia >= 0 ? 'text-green-600' : 'text-red-600')}>
                              {formatCurrency(p.ganancia)}
                            </dd>
                          </div>
                        </dl>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Resumen de totales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen del Día</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-slate-500">Importe productos</p>
                  <p className="text-xl font-bold">{formatCurrency(totalImporte)}</p>
                  <p className="text-xs text-slate-400 mt-1">Suma del IPVE del día</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-slate-500">Ganancia real</p>
                  <p className={cn('text-xl font-bold', gananciaReal >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {formatCurrency(gananciaReal)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Ventas − costo de compra</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-slate-500">Salarios del día</p>
                  <p className="text-xl font-bold text-slate-600">{formatCurrency(dia.salariosHoy)}</p>
                  <p className="text-xs text-slate-400 mt-1">Suma de salarios calculados</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-slate-500">Ganancia neta</p>
                  <p className={cn('text-xl font-bold', gananciaNeta >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {formatCurrency(gananciaNeta)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Ganancia real − salarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
