import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonTable,
  StatusBadge,
  TablePagination,
  usePagination,
} from '@/components/shared';
import { useProductos } from '@/hooks/supabase/useSupabaseData';

export default function AlertaStock() {
  const { data: productos, loading } = useProductos();
  const [query, setQuery] = useState('');

  const productosAlerta = useMemo(
    () => productos.filter(p =>
      (p.stock <= p.stockMinimo || p.stock <= 0) && p.activo
    ),
    [productos]
  );

  const productosAgotados = productosAlerta.filter(p => p.stock <= 0);
  const productosBajoStock = productosAlerta.filter(p => p.stock > 0 && p.stock <= p.stockMinimo);

  const alertaFiltrada = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return productosAlerta;
    return productosAlerta.filter(
      p => p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)
    );
  }, [productosAlerta, query]);

  const { pageItems, page, pageCount, setPage, reset } = usePagination(alertaFiltrada);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertas de Stock"
        description="Productos que requieren reposición"
        icon={AlertTriangle}
      />

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total en Alerta</p>
                <p className="text-2xl font-bold text-destructive">{productosAlerta.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive/70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agotados</p>
                <p className="text-2xl font-bold text-destructive">{productosAgotados.length}</p>
              </div>
              <Package className="w-8 h-8 text-destructive/70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bajo Stock</p>
                <p className="text-2xl font-bold text-warning-foreground">{productosBajoStock.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Productos que Requieren Reposición
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={query}
              onChange={(value) => { setQuery(value); reset(); }}
              placeholder="Buscar por nombre o categoría…"
            />
          </div>

          {loading ? (
            <SkeletonTable cols={4} />
          ) : productosAlerta.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Sin productos en alerta"
              description="Todo tu inventario está por encima del stock mínimo. ¡Buen trabajo!"
            />
          ) : alertaFiltrada.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Sin resultados para tu búsqueda"
              description="Prueba con otro nombre de producto o categoría."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Reponer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((producto) => (
                    <TableRow key={producto.id}>
                      <TableCell className="py-3 font-medium">{producto.nombre}</TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline">{producto.categoria}</Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        {producto.stock <= 0 ? (
                          <StatusBadge tone="danger">Agotado</StatusBadge>
                        ) : (
                          <StatusBadge tone="warning">Bajo Stock</StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusBadge tone="success">Sí</StatusBadge>
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
    </div>
  );
}
