import { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { useCompradores, formatDate } from '@/hooks/supabase/useSupabaseData';
import type { Comprador } from '@/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const compradorSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
});

export default function Compradores() {
  const { 
    data: compradores, 
    create: agregarComprador, 
    update: actualizarComprador, 
    delete: eliminarComprador,
  } = useCompradores();

  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingComprador, setEditingComprador] = useState<Comprador | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [compradorToDelete, setCompradorToDelete] = useState<Comprador | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof compradorSchema>>({
    resolver: zodResolver(compradorSchema),
    defaultValues: { nombre: '' }
  });

  const buscarCompradores = useCallback((query: string) => {
    const q = query.toLowerCase();
    return compradores.filter(c => c.activo && c.nombre.toLowerCase().includes(q));
  }, [compradores]);

  const filteredCompradores = useMemo(() => {
    return searchQuery ? buscarCompradores(searchQuery) : compradores;
  }, [searchQuery, compradores, buscarCompradores]);

  const handleOpenDialog = (comprador?: Comprador) => {
    if (comprador) {
      setEditingComprador(comprador);
      reset({ nombre: comprador.nombre });
    } else {
      setEditingComprador(null);
      reset({ nombre: '' });
    }
    setDialogOpen(true);
  };

  const handleSave = async (data: z.infer<typeof compradorSchema>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (editingComprador) {
        await actualizarComprador(editingComprador.id, data);
      } else {
        await agregarComprador(data);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Error guardando comprador:', error);
      alert('Error al guardar el comprador');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = (comprador: Comprador) => {
    setCompradorToDelete(comprador);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (compradorToDelete) {
      try {
        await eliminarComprador(compradorToDelete.id);
        setDeleteDialogOpen(false);
        setCompradorToDelete(null);
      } catch (error) {
        console.error('Error eliminando comprador:', error);
        alert('Error al eliminar el comprador');
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg">Lista de Compradores</CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar comprador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Comprador
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fecha de Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
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
                      <TableCell className="font-medium">{comprador.nombre}</TableCell>
                      <TableCell>{formatDate(comprador.fechaRegistro)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(comprador)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(comprador)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para agregar/editar comprador */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingComprador ? 'Editar Comprador' : 'Nuevo Comprador'}
            </DialogTitle>
            <DialogDescription>
              Complete el nombre del comprador.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(handleSave)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre Completo *</Label>
              <Controller
                name="nombre"
                control={control}
                render={({ field }) => (
                  <Input {...field} id="nombre" placeholder="Nombre del comprador" disabled={saving} />
                )}
              />
              {errors.nombre && <p className="text-sm text-red-500">{errors.nombre.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingComprador ? 'Guardar Cambios' : 'Crear Comprador'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para eliminar */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea eliminar al comprador &quot;{compradorToDelete?.nombre}&quot;?
              Esta acción marcará al comprador como inactivo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
