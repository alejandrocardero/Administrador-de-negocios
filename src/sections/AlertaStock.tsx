import { AlertTriangle, Package, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { useProductos } from '@/hooks/supabase/useSupabaseData';

export default function AlertaStock() {
  const { data: productos, loading } = useProductos();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  const productosAlerta = productos.filter(p =>
    (p.stock <= p.stockMinimo || p.stock <= 0) && p.activo
  );

  const productosAgotados = productosAlerta.filter(p => p.stock <= 0);
  const productosBajoStock = productosAlerta.filter(p => p.stock > 0 && p.stock <= p.stockMinimo);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total en Alerta</p>
                <p className="text-2xl font-bold text-red-600">{productosAlerta.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Agotados</p>
                <p className="text-2xl font-bold text-red-600">{productosAgotados.length}</p>
              </div>
              <Package className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Bajo Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{productosBajoStock.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Productos que Requieren Reposición
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                {productosAlerta.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Check className="w-8 h-8 text-green-500" />
                        <p>No hay productos en alerta</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  productosAlerta.map((producto) => (
                    <TableRow key={producto.id}>
                      <TableCell className="font-medium">{producto.nombre}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{producto.categoria}</Badge>
                      </TableCell>
                      <TableCell>
                        {producto.stock <= 0 ? (
                          <Badge variant="destructive">Agotado</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-yellow-500">Bajo Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
                          Sí
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}