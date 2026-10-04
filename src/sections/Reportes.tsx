import { useState, useMemo } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, Printer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend,
  AreaChart, Area
} from 'recharts';
import { 
  useVentasDiarias, useCompras, useGastos, 
  formatCurrency, formatDate 
} from '@/hooks/supabase/useSupabaseData';
import type { Compra, Gasto, ReportFilters } from '@/types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function Reportes({ initialFilters }: { initialFilters?: ReportFilters }) {
  const { getVentasByFecha } = useVentasDiarias();
  const { getComprasByFecha } = useCompras();
  const { getGastosByFecha } = useGastos();

  const [fechaInicio, setFechaInicio] = useState<string>(initialFilters?.fechaInicio || (() => {
    const hoy = new Date();
    const date = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  })());
  const [fechaFin, setFechaFin] = useState<string>(initialFilters?.fechaFin || (() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  })());
  const [reporteTipo, setReporteTipo] = useState<'general' | 'ventas' | 'compras' | 'gastos' | 'utilidad'>(initialFilters?.reporteTipo || 'general');

  const ventasPeriodo = useMemo(() => getVentasByFecha(fechaInicio, fechaFin), [fechaInicio, fechaFin, getVentasByFecha]);
  const comprasPeriodo = useMemo(() => getComprasByFecha(fechaInicio, fechaFin), [fechaInicio, fechaFin, getComprasByFecha]);
  const gastosPeriodo = useMemo(() => getGastosByFecha(fechaInicio, fechaFin), [fechaInicio, fechaFin, getGastosByFecha]);

  const data = useMemo(() => {
    const totalVentas = ventasPeriodo.reduce((sum, v) => sum + v.totalVendido, 0);
    const totalCompras = comprasPeriodo.reduce((sum, c) => sum + c.total, 0);
    const totalGastos = gastosPeriodo.reduce((sum, g) => sum + g.monto, 0);
    const utilidad = totalVentas - totalCompras - totalGastos;
    const margen = totalVentas > 0 ? (utilidad / totalVentas) * 100 : 0;

    // Ventas por día
    const ventasPorDiaMap = new Map<string, number>();
    ventasPeriodo.forEach((v) => {
      const fecha = v.fecha.split('T')[0];
      ventasPorDiaMap.set(fecha, (ventasPorDiaMap.get(fecha) || 0) + v.totalVendido);
    });
    const ventasPorDia = Array.from(ventasPorDiaMap.entries())
      .map(([fecha, total]) => ({ fecha, total }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // Gastos por categoría
    const gastosPorCategoriaMap = new Map<string, number>();
    gastosPeriodo.forEach((g) => {
      gastosPorCategoriaMap.set(g.categoria, (gastosPorCategoriaMap.get(g.categoria) || 0) + g.monto);
    });
    const gastosPorCategoria = Array.from(gastosPorCategoriaMap.entries())
      .map(([categoria, total]) => ({ categoria, total }));

    // Productos más vendidos (de compras)
    const productosCompradosMap = new Map<string, {nombre: string; cantidad: number; total: number}>();
    comprasPeriodo.forEach((c) => {
      c.detalles.forEach((d) => {
        const actual = productosCompradosMap.get(d.productoId) || { nombre: d.productoNombre, cantidad: 0, total: 0 };
        actual.cantidad += d.cantidad;
        actual.total += d.subtotal;
        productosCompradosMap.set(d.productoId, actual);
      });
    });
    const productosMasVendidos = Array.from(productosCompradosMap.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    return {
      ventas: ventasPeriodo,
      compras: comprasPeriodo,
      gastos: gastosPeriodo,
      ventasPorDia,
      gastosPorCategoria,
      productosMasVendidos,
      resumen: {
        totalVentas,
        totalCompras,
        totalGastos,
        utilidad,
        margen,
      },
    };
  }, [ventasPeriodo, comprasPeriodo, gastosPeriodo]);

  const handlePrint = () => {
    window.print();
  };

  const getCategoriaLabel = (cat: string) => {
    const labels: Record<string, string> = {
      servicios: 'Servicios Públicos',
      nomina: 'Nómina',
      arriendo: 'Arriendo',
      impuestos: 'Impuestos',
      mantenimiento: 'Mantenimiento',
      otros: 'Otros',
    };
    return labels[cat] || cat;
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 w-full">
              <div className="space-y-2">
                <Label>Fecha Inicio</Label>
                <Input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Fin</Label>
                <Input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Reporte</Label>
                <Select value={reporteTipo} onValueChange={(val) => setReporteTipo(val as typeof reporteTipo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="ventas">Ventas</SelectItem>
                    <SelectItem value="compras">Compras</SelectItem>
                    <SelectItem value="gastos">Gastos</SelectItem>
                    <SelectItem value="utilidad">Utilidad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Acciones</Label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePrint} className="flex-1">
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ventas</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(data.resumen.totalVentas)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Compras</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(data.resumen.totalCompras)}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Gastos</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(data.resumen.totalGastos)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Utilidad</p>
                <p className={`text-xl font-bold ${data.resumen.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(data.resumen.utilidad)}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Margen</p>
                <p className={`text-xl font-bold ${data.resumen.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.resumen.margen.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <Tabs value={reporteTipo} onValueChange={(val) => setReporteTipo(val as typeof reporteTipo)}>
        <TabsList className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="utilidad">Utilidad</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ventas vs Compras vs Gastos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Ventas', valor: data.resumen.totalVentas, fill: '#10b981' },
                      { name: 'Compras', valor: data.resumen.totalCompras, fill: '#3b82f6' },
                      { name: 'Gastos', valor: data.resumen.totalGastos, fill: '#ef4444' },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="valor" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evolución de Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.ventasPorDia}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" tickFormatter={(value) => new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ventas" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evolución de Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.ventasPorDia}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" tickFormatter={(value) => new Date(value).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Area type="monotone" dataKey="total" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Productos Más Vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.productosMasVendidos} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="nombre" type="category" width={150} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="total" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compras" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historial de Compras</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Fecha</th>
                      <th className="text-left py-2">Comprador</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.compras.slice().reverse().map((compra: Compra) => (
                      <tr key={compra.id} className="border-b">
                        <td className="py-2">{formatDate(compra.fecha)}</td>
                        <td className="py-2">{compra.compradorNombre}</td>
                        <td className="py-2 text-right">{formatCurrency(compra.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gastos" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gastos por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={data.gastosPorCategoria}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${getCategoriaLabel(name)} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="total"
                      >
                        {data.gastosPorCategoria.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalle de Gastos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Fecha</th>
                        <th className="text-left py-2">Concepto</th>
                        <th className="text-left py-2">Categoría</th>
                        <th className="text-right py-2">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.gastos.slice().reverse().map((gasto: Gasto) => (
                        <tr key={gasto.id} className="border-b">
                          <td className="py-2">{formatDate(gasto.fecha)}</td>
                          <td className="py-2">{gasto.concepto}</td>
                          <td className="py-2">{getCategoriaLabel(gasto.categoria)}</td>
                          <td className="py-2 text-right">{formatCurrency(gasto.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="utilidad" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Análisis de Utilidad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600">Ingresos Totales</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(data.resumen.totalVentas)}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-red-600">Costos Totales</p>
                    <p className="text-2xl font-bold text-red-700">
                      {formatCurrency(data.resumen.totalCompras + data.resumen.totalGastos)}
                    </p>
                  </div>
                  <div className={`p-4 rounded-lg ${data.resumen.utilidad >= 0 ? 'bg-blue-50' : 'bg-yellow-50'}`}>
                    <p className={`text-sm ${data.resumen.utilidad >= 0 ? 'text-blue-600' : 'text-yellow-600'}`}>
                      Utilidad Neta
                    </p>
                    <p className={`text-2xl font-bold ${data.resumen.utilidad >= 0 ? 'text-blue-700' : 'text-yellow-700'}`}>
                      {formatCurrency(data.resumen.utilidad)}
                    </p>
                  </div>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Ingresos', valor: data.resumen.totalVentas },
                      { name: 'Costos', valor: data.resumen.totalCompras + data.resumen.totalGastos },
                      { name: 'Utilidad', valor: data.resumen.utilidad },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="valor" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
