import { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Edit2, Trash2, Loader2, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { useCompradores, formatDate } from '@/hooks/supabase/useSupabaseData';
import type { Comprador } from '@/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  PageHeader, SearchInput, EmptyState, SkeletonTable, SkeletonCards,
  usePagination, TablePagination, StatusBadge, LabeledInput,
} from '@/components/shared';

const compradorSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
});

export default function Compradores() {
  const {
    data: compradores,
    loading,
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
  const [deleting, setDeleting] = useState(false);
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

  const { pageItems, page, pageCount, setPage, reset: resetPage } = usePagination(filteredCompradores);

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
        toast.success('Comprador actualizado');
      } else {
        await agregarComprador(data);
        toast.success('Comprador creado');
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Error guardando comprador:', error);
      toast.error('Error al guardar el comprador');
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
    if (!compradorToDelete) return;
    setDeleting(true);
    try {
      await eliminarComprador(compradorToDelete.id);
      toast.success('Comprador eliminado');
      setDeleteDialogOpen(false);
      setCompradorToDelete(null);
    } catch (error) {
      console.error('Error eliminando comprador:', error);
      toast.error('Error al eliminar el comprador');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compradores"
        description="Gestiona los compradores de tu negocio"
        icon={Users}
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="size-4" aria-hidden />
            Nuevo Comprador
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchQuery}
              onChange={(value) => { setSearchQuery(value); resetPage(); }}
              placeholder="Buscar comprador..."
            />
          </div>

          {loading ? (
            <>
              <div className="hidden md:block">
                <SkeletonTable cols={4} />
              </div>
              <div className="grid gap-4 md:hidden">
                <SkeletonCards count={3} />
              </div>
            </>
          ) : filteredCompradores.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No se encontraron compradores"
              description={
                searchQuery
                  ? "Ningún comprador activo coincide con tu búsqueda."
                  : "Agrega tu primer comprador para comenzar."
              }
              action={
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="size-4" aria-hidden />
                  Nuevo comprador
                </Button>
              }
            />
          ) : (
            <>
              {/* Tabla: escritorio */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Fecha de Registro</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((comprador) => (
                      <TableRow key={comprador.id} className="hover:bg-muted/50">
                        <TableCell className="py-3 font-medium">{comprador.nombre}</TableCell>
                        <TableCell className="py-3">{formatDate(comprador.fechaRegistro)}</TableCell>
                        <TableCell className="py-3">
                          <StatusBadge tone={comprador.activo ? 'success' : 'neutral'}>
                            {comprador.activo ? 'Activo' : 'Inactivo'}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(comprador)}
                              aria-label={`Editar ${comprador.nombre}`}
                            >
                              <Edit2 className="size-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(comprador)}
                              aria-label={`Eliminar ${comprador.nombre}`}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Cards: móvil */}
              <div className="grid gap-4 md:hidden">
                {pageItems.map((comprador) => (
                  <Card key={comprador.id} className="rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{comprador.nombre}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Registrado el {formatDate(comprador.fechaRegistro)}
                        </p>
                      </div>
                      <StatusBadge tone={comprador.activo ? 'success' : 'neutral'}>
                        {comprador.activo ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </div>
                    <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(comprador)}
                      >
                        <Edit2 className="size-4" aria-hidden />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(comprador)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Eliminar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              <TablePagination page={page} pageCount={pageCount} setPage={setPage} />
            </>
          )}
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

          <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
            <Controller
              name="nombre"
              control={control}
              render={({ field }) => (
                <LabeledInput
                  label="Nombre Completo *"
                  placeholder="Nombre del comprador"
                  error={errors.nombre?.message}
                  disabled={saving}
                  {...field}
                />
              )}
            />
            <DialogFooter className="gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
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
              ¿Está seguro de que desea eliminar al comprador "{compradorToDelete?.nombre}"?
              Esta acción marcará al comprador como inactivo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
