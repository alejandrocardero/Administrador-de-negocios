import { useState, useMemo, useCallback } from 'react';
import { Plus, Edit2, Trash2, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { useVendedores, formatDate } from '@/hooks/supabase/useSupabaseData';
import type { Vendedor } from '@/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  PageHeader, SearchInput, EmptyState, SkeletonTable, SkeletonCards,
  usePagination, TablePagination, StatusBadge, LabeledInput,
} from '@/components/shared';

const vendedorSchema = z.object({
  nombre: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
});

export default function Vendedores() {
  const {
    data: vendedores,
    loading,
    create: agregarVendedor,
    update: actualizarVendedor,
    delete: eliminarVendedor,
  } = useVendedores();

  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendedorToDelete, setVendedorToDelete] = useState<Vendedor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof vendedorSchema>>({
    resolver: zodResolver(vendedorSchema),
    defaultValues: { nombre: '' }
  });

  const buscarVendedores = useCallback((query: string) => {
    const q = query.toLowerCase();
    return vendedores.filter(v => v.activo && v.nombre.toLowerCase().includes(q));
  }, [vendedores]);

  const filteredVendedores = useMemo(() => {
    return searchQuery ? buscarVendedores(searchQuery) : vendedores;
  }, [searchQuery, vendedores, buscarVendedores]);

  const { pageItems, page, pageCount, setPage, reset: resetPage } = usePagination(filteredVendedores);

  const handleOpenDialog = (vendedor?: Vendedor) => {
    if (vendedor) {
      setEditingVendedor(vendedor);
      reset({ nombre: vendedor.nombre });
    } else {
      setEditingVendedor(null);
      reset({ nombre: '' });
    }
    setDialogOpen(true);
  };

  const handleSave = async (data: z.infer<typeof vendedorSchema>) => {
    try {
      if (editingVendedor) {
        await actualizarVendedor(editingVendedor.id, data);
        toast.success('Vendedor actualizado');
      } else {
        await agregarVendedor(data);
        toast.success('Vendedor creado');
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Error guardando vendedor:', error);
      toast.error('Error al guardar el vendedor');
    }
  };

  const handleDelete = (vendedor: Vendedor) => {
    setVendedorToDelete(vendedor);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!vendedorToDelete) return;
    setDeleting(true);
    try {
      await eliminarVendedor(vendedorToDelete.id);
      toast.success('Vendedor eliminado');
      setDeleteDialogOpen(false);
      setVendedorToDelete(null);
    } catch (error) {
      console.error('Error eliminando vendedor:', error);
      toast.error('Error al eliminar el vendedor');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendedores"
        description="Gestiona el equipo de vendedores de tu negocio"
        icon={Users}
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="size-4" aria-hidden />
            Nuevo Vendedor
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchQuery}
              onChange={(value) => { setSearchQuery(value); resetPage(); }}
              placeholder="Buscar vendedor..."
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
          ) : filteredVendedores.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No se encontraron vendedores"
              description={
                searchQuery
                  ? "Ningún vendedor activo coincide con tu búsqueda."
                  : "Agrega tu primer vendedor para comenzar."
              }
              action={
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="size-4" aria-hidden />
                  Nuevo vendedor
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
                    {pageItems.map((vendedor) => (
                      <TableRow key={vendedor.id} className="hover:bg-muted/50">
                        <TableCell className="py-3 font-medium">{vendedor.nombre}</TableCell>
                        <TableCell className="py-3">{formatDate(vendedor.fechaRegistro)}</TableCell>
                        <TableCell className="py-3">
                          <StatusBadge tone={vendedor.activo ? 'success' : 'neutral'}>
                            {vendedor.activo ? 'Activo' : 'Inactivo'}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(vendedor)}
                              aria-label={`Editar ${vendedor.nombre}`}
                            >
                              <Edit2 className="size-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(vendedor)}
                              aria-label={`Eliminar ${vendedor.nombre}`}
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
                {pageItems.map((vendedor) => (
                  <Card key={vendedor.id} className="rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{vendedor.nombre}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Registrado el {formatDate(vendedor.fechaRegistro)}
                        </p>
                      </div>
                      <StatusBadge tone={vendedor.activo ? 'success' : 'neutral'}>
                        {vendedor.activo ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </div>
                    <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(vendedor)}
                      >
                        <Edit2 className="size-4" aria-hidden />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(vendedor)}
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

      {/* Dialog para agregar/editar vendedor */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVendedor ? 'Editar Vendedor' : 'Nuevo Vendedor'}
            </DialogTitle>
            <DialogDescription>
              Complete el nombre del vendedor.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
            <Controller
              name="nombre"
              control={control}
              render={({ field }) => (
                <LabeledInput
                  label="Nombre Completo *"
                  placeholder="Nombre del vendedor"
                  error={errors.nombre?.message}
                  {...field}
                />
              )}
            />
            <DialogFooter className="gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingVendedor ? 'Guardar Cambios' : 'Crear Vendedor'}
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
              ¿Está seguro de que desea eliminar al vendedor "{vendedorToDelete?.nombre}"?
              Esta acción marcará al vendedor como inactivo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <ActionButton variant="destructive" onAction={confirmDelete} disabled={deleting} successMessage="Eliminado">
              Eliminar
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
