import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { formatDate } from '@/hooks/useStorage';
import type { Comprador } from '@/types';

function getCompradoresFromStorage(): Comprador[] {
  try {
    const item = localStorage.getItem('compradores');
    if (item) {
      const parsed = JSON.parse(item);
      return Array.isArray(parsed) ? parsed.filter((c: Comprador) => c.activo) : [];
    }
  } catch {
  }
  return [];
}

function buscarEnStorage(compradores: Comprador[], query: string): Comprador[] {
  if (!query) return compradores;
  const q = query.toLowerCase();
  return compradores.filter(c => c.nombre.toLowerCase().includes(q));
}

export default function VerCompradores() {
  const [searchQuery, setSearchQuery] = useState('');
  const [compradores, setCompradores] = useState<Comprador[]>([]);

  useEffect(() => {
    setCompradores(getCompradoresFromStorage());
    
    const interval = setInterval(() => {
      setCompradores(getCompradoresFromStorage());
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  const filteredCompradores = useMemo(() => {
    return buscarEnStorage(compradores, searchQuery);
  }, [searchQuery, compradores]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lista de Compradores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar comprador..."
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
                  <TableHead>Fecha de Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompradores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-slate-500">
                      No se encontraron compradores
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompradores.map((comprador) => (
                    <TableRow key={comprador.id}>
                      <TableCell className="font-medium">{comprador.nombre}</TableCell>
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