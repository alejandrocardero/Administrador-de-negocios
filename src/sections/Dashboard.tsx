import { useMemo } from 'react';
import { 
  TrendingUp, Package, DollarSign, 
  ShoppingCart, AlertTriangle, Receipt, Wallet, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  useVentasDiarias, useCompras, useGastos, useProductos, 
  useMovimientosCaja,
  useImpuestos,
  formatCurrency 
} from '@/hooks/useStorage';
import type { Impuesto, Section, Producto } from '@/types';
import { cn } from '@/lib/utils';

interface Alerta {
  tipo: string;
  mensaje: string;
  severidad: 'error' | 'warning';
}

function KPICard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  color = 'blue',
  onClick
}: { 
  title: string; 
  value: string; 
  subtitle?: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  onClick?: () => void;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-lg hover:-translate-y-1'
      )}
    >
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500">{title}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
              {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
            </div>
            <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertasPanel({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-green-500" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-center py-4">No hay alertas pendientes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Alertas ({alertas.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {alertas.map((alerta, index) => (
            <div 
              key={index}
              className={`p-3 rounded-lg text-sm ${
                alerta.severidad === 'error' 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              }`}
            >
              {alerta.mensaje}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard({ 
  onSectionChange 
}: { 
  onSectionChange: (section: Section) => void 
}) {
  const { ventas } = useVentasDiarias();
  const { compras } = useCompras();
  const { gastos } = useGastos();
  const { productos } = useProductos();
  const { movimientos } = useMovimientosCaja();
  const { impuestos } = useImpuestos();

  const hoy = new Date();
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const inicioMesISO = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}-${String(inicioMes.getDate()).padStart(2, '0')}`;
  const finMesISO = `${finMes.getFullYear()}-${String(finMes.getMonth() + 1).padStart(2, '0')}-${String(finMes.getDate()).padStart(2, '0')}`;

  const stats = useMemo(() => {
    const ahora = new Date();
    const hoyStr = ahora.toDateString();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    const ventasHoy = ventas.filter(v => new Date(v.fecha).toDateString() === hoyStr);
    const ventasMes = ventas.filter(v => new Date(v.fecha) >= inicioMes);
    const comprasMes = compras.filter(c => new Date(c.fecha) >= inicioMes && c.estado === 'completada');
    const gastosMes = gastos.filter(g => new Date(g.fecha) >= inicioMes);

    const totalVentasHoy = ventasHoy.reduce((sum, v) => sum + v.totalVendido, 0);
    const totalVentasMes = ventasMes.reduce((sum, v) => sum + v.totalVendido, 0);
    const totalSalariosMes = ventasMes.reduce((sum, v) => sum + v.salarioCalculado, 0);
    const totalComprasMes = comprasMes.reduce((sum, c) => sum + c.total, 0);
    const totalGastosMes = gastosMes.reduce((sum, g) => sum + g.monto, 0);
    
    const productosBajoStock = productos.filter(p => p.stock <= p.stockMinimo && p.activo);
    // const cxpPendientes = cxp.filter(c => c.estado !== 'pagado'); // Removed as CuentasPorPagar is deprecated

    const balanceCaja = movimientos.reduce((total, m) => {
      return m.tipo === 'entrada' ? total + m.monto : total - m.monto;
    }, 0);

    return {
      ventasHoy: totalVentasHoy,
      ventasMes: totalVentasMes,
      salariosMes: totalSalariosMes,
      comprasMes: totalComprasMes,
      gastosMes: totalGastosMes,
      utilidadMes: totalVentasMes - totalComprasMes - totalGastosMes - totalSalariosMes,
      productosBajoStock: productosBajoStock.length,
      // cuentasPorPagar: cxpPendientes.reduce((sum, c) => sum + c.saldoPendiente, 0), // Removed
      balanceCaja: balanceCaja,
    };
  }, [ventas, compras, gastos, productos, movimientos]); // cxp removed from dependency array

  const ventasPorDia = useMemo(() => {
    const hoy = new Date();
    const datosVentasDia = [];
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() - i);
      const fechaStr = fecha.toDateString();
      const ventasDia = ventas.filter(v => new Date(v.fecha).toDateString() === fechaStr);
      const totalDia = ventasDia.reduce((sum, v) => sum + v.totalVendido, 0);
      datosVentasDia.push({
        dia: fecha.toLocaleDateString('es-CO', { weekday: 'short' }),
        ventas: totalDia,
      });
    }
    return datosVentasDia;
  }, [ventas]);

  const alertas = useMemo(() => {
    const productosBajoStock = productos.filter(p => p.stock <= p.stockMinimo && p.activo);
    // const cxpVencidas = cxp.filter(c => c.estado === 'vencido'); // Removed
    const impuestosVencidos = impuestos.filter(i => i.estado === 'vencido');

    return [
      ...productosBajoStock.map((p: Producto) => ({
        tipo: 'stock',
        mensaje: `${p.nombre} - Stock bajo (${p.stock} unidades)`,
        severidad: 'warning' as const,
      })),
      // ...cxpVencidas.map((c: CuentaPorPagar) => ({ // Removed
      //   tipo: 'cxp',
      //   mensaje: `Cuenta por pagar vencida - ${c.proveedorNombre}`,
      //   severidad: 'error' as const,
      // })),
      ...impuestosVencidos.map((i: Impuesto) => ({
        tipo: 'impuesto',
        mensaje: `Impuesto vencido - ${i.nombre} (${i.periodo})`,
        severidad: 'error' as const,
      })),
    ];
  }, [productos, impuestos]); // cxp removed from dependency array


  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Ventas Hoy"
          value={formatCurrency(stats.ventasHoy)}
          subtitle="Total del día"
          icon={ShoppingCart}
          color="blue"
          onClick={() => onSectionChange({ id: 'reportes', params: { reporteTipo: 'ventas', fechaInicio: hoyISO, fechaFin: hoyISO } })}
        />
        <KPICard
          title="Ventas del Mes"
          value={formatCurrency(stats.ventasMes)}
          subtitle="Este mes"
          icon={TrendingUp}
          color="green"
          onClick={() => onSectionChange({ id: 'reportes', params: { reporteTipo: 'ventas', fechaInicio: inicioMesISO, fechaFin: finMesISO } })}
        />
        <KPICard
          title="Utilidad del Mes"
          value={formatCurrency(stats.utilidadMes)}
          subtitle="Ventas - Compras - Gastos"
          icon={DollarSign}
          color="purple"
          onClick={() => onSectionChange({ id: 'reportes', params: { reporteTipo: 'utilidad', fechaInicio: inicioMesISO, fechaFin: finMesISO } })}
        />
        <KPICard
          title="Balance de Caja"
          value={formatCurrency(stats.balanceCaja)}
          subtitle="Disponible"
          icon={Wallet}
          color="yellow"
        />
      </div>

      {/* Segunda fila de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Productos Bajo Stock"
          value={stats.productosBajoStock.toString()}
          subtitle="Requieren atención"
          icon={Package}
          color="red"
          onClick={() => onSectionChange({ id: 'inventario' })}
        />
        <KPICard
          title="Salarios del Mes"
          value={formatCurrency(stats.salariosMes)}
          subtitle="Total salarios calculados"
          icon={Users}
          color="blue"
          onClick={() => onSectionChange({ id: 'vendedores' })}
        />
        <KPICard
          title="Compras del Mes"
          value={formatCurrency(stats.comprasMes)}
          subtitle="Total compras"
          icon={Receipt}
          color="yellow"
          onClick={() => onSectionChange({ id: 'reportes', params: { reporteTipo: 'compras', fechaInicio: inicioMesISO, fechaFin: finMesISO } })}
        />
        <KPICard
          title="Impuestos Pendientes"
          value={impuestos.filter(i => i.estado === 'pendiente' || i.estado === 'vencido').length.toString()}
          subtitle="Por pagar"
          icon={Receipt}
          color="red"
          onClick={() => onSectionChange({ id: 'impuestos' })}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ventas de los Últimos 7 Días</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ventasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="ventas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <AlertasPanel alertas={alertas} />
    </div>
  );
}
