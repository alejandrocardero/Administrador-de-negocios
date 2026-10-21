import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/hooks/supabase/useSupabaseData';
import type { ProductRotationStats } from '@/types';

function LeaderCardStats({ rot }: { rot: ProductRotationStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Vendidos (Sem/Mes/Total)</p>
        <p className="text-sm font-medium">{rot.vendidoSemana} / {rot.vendidoMes} / {rot.totalVendido}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Precio / Ganancia Ud.</p>
        <p className="text-sm font-medium truncate">{formatCurrency(rot.precioVenta)} / {formatCurrency(rot.gananciaPorUnidad)}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Ganancia Semanal</p>
        <p className="text-sm font-medium text-success">{formatCurrency(rot.gananciaSemanal)}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Ganancia Mensual</p>
        <p className="text-sm font-medium text-success">{formatCurrency(rot.gananciaMensual)}</p>
      </div>
    </div>
  );
}

interface InventarioTopRotacionProps {
  products: ProductRotationStats[];
}

/** Tarjetas de los productos líderes por rotación (Top 10). */
export function InventarioTopRotacion({ products }: InventarioTopRotacionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Productos Líderes (Top 10 por Rotación)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((rot, index) => (
            <div key={rot.productoId} className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="w-6 h-6 shrink-0 flex items-center justify-center bg-primary/10 text-primary rounded-full text-sm font-bold">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{rot.productoNombre}</p>
                    <p className="text-xs text-muted-foreground truncate">{rot.productoCodigo || '—'}</p>
                  </div>
                </div>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded shrink-0 whitespace-nowrap">
                  Rot: {rot.rotacion.toFixed(2)}
                </span>
              </div>
              <LeaderCardStats rot={rot} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
