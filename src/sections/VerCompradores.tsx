import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { useCompradores, formatDate } from '@/hooks/supabase/useSupabaseData';

export default function VerCompradores() {
  const { data: compradores, loading } = useCompradores();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCompradores = useMemo(() => {
    if (!searchQuery) return compradores;
    const q = searchQuery.toLowerCase();
    return compradores.filter(c => c.nombre.toLowerCase().includes(q));
  }, [searchQuery, compradores]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compradores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar compradores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompradores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                      No se encontraron compradores
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompradores.map((comprador) => (
                    <TableRow key={comprador.id}>
                      <TableCell>{comprador.nombre}</TableCell>
                      <TableCell>
                        <span className={comprador.activo ? 'text-green-600' : 'text-red-600'}>
                          {comprador.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(comprador.fechaRegistro)}</TableCell>
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