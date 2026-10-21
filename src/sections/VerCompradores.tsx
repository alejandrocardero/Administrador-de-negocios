import { useState, useMemo } from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  PageHeader, SearchInput, EmptyState, SkeletonTable,
  StatusBadge, usePagination, TablePagination
} from '@/components/shared';
import { useCompradores, formatDate } from '@/hooks/supabase/useSupabaseData';

export default function VerCompradores() {
  const { data: compradores, loading } = useCompradores();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCompradores = useMemo(() => {
    if (!searchQuery) return compradores;
    const q = searchQuery.toLowerCase();
    return compradores.filter(c => c.nombre.toLowerCase().includes(q));
  }, [searchQuery, compradores]);

  const { pageItems, page, pageCount, setPage, reset } = usePagination(filteredCompradores, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compradores"
        description="Consulta el listado de compradores registrados"
        icon={Users}
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchQuery}
              onChange={(v) => { setSearchQuery(v); reset(); }}
              placeholder="Buscar compradores..."
            />
          </div>

          {loading ? (
            <SkeletonTable rows={5} cols={3} />
          ) : filteredCompradores.length === 0 ? (
            <EmptyState
              icon={Users}
              title={searchQuery ? 'Sin resultados' : 'No hay compradores'}
              description={
                searchQuery
                  ? 'Ningún comprador coincide con tu búsqueda.'
                  : 'Los compradores aparecerán aquí cuando se registren.'
              }
            />
          ) : (
            <>
              <Table className="[&_td]:py-3 [&_th]:py-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((comprador) => (
                    <TableRow key={comprador.id}>
                      <TableCell className="font-medium">{comprador.nombre}</TableCell>
                      <TableCell>
                        <StatusBadge tone={comprador.activo ? 'success' : 'danger'}>
                          {comprador.activo ? 'Activo' : 'Inactivo'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{formatDate(comprador.fechaRegistro)}</TableCell>
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
