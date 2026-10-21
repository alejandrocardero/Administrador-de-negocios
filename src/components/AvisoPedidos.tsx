import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared';
import { AlertTriangle, Loader2, Package, User } from 'lucide-react';
import { usePedidos, formatDate, toFechaLocal } from '@/hooks/supabase/useSupabaseData';

interface AvisoPedidosProps {
  onProcesar?: () => void;
}

export default function AvisoPedidos({ onProcesar }: AvisoPedidosProps) {
  const { getPedidosPendientes, actualizarPedido } = usePedidos();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const pendientes = getPedidosPendientes();

  const diasPendientes = (fecha: string) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const f = new Date(fecha);
    f.setHours(0, 0, 0, 0);
    return Math.ceil((hoy.getTime() - f.getTime()) / 86400000);
  };

  const hasShownRef = useRef(false);

  useEffect(() => {
    if (hasShownRef.current) return;
    
    const force = sessionStorage.getItem('avisoPedidosForce') === '1';
    const lastShown = localStorage.getItem('avisoPedidosFecha');
    const hoy = toFechaLocal(new Date());
    const hayPendientes = pendientes.length > 0;

    if (hayPendientes && (force || lastShown !== hoy)) {
      hasShownRef.current = true;
      setIsOpen(true);
    }

    if (force) {
      sessionStorage.removeItem('avisoPedidosForce');
    }
  }, [pendientes.length]);

  const handleProcesar = (id: string) => {
    setConfirmId(id);
  };

  const confirmProcesar = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (confirmId) {
        await actualizarPedido(confirmId, { estado: 'aprobado' });
        setConfirmId(null);
        onProcesar?.();
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleClose = () => {
    const hoy = toFechaLocal(new Date());
    localStorage.setItem('avisoPedidosFecha', hoy);
    setIsOpen(false);
  };

  if (!isOpen || pendientes.length === 0) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="rounded-xl border border-primary/40 bg-primary/10 p-4">
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-foreground">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
              Pedidos Pendientes de Aprobar
            </DialogTitle>
            <DialogDescription>
              Tienes {pendientes.length} pedido{pendientes.length > 1 ? 's' : ''} pendiente{pendientes.length > 1 ? 's' : ''}.
              Se muestra una vez al día o al iniciar sesión hasta que se aprueben.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4 max-h-[60vh] overflow-y-auto">
            {pendientes
              .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
              .map((pedido) => {
                const dias = diasPendientes(pedido.fecha);
                return (
                  <div key={pedido.id} className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="font-medium">{pedido.productoNombre}</span>
                          <StatusBadge tone="warning">
                            {dias} día{dias !== 1 ? 's' : ''} pendiente
                          </StatusBadge>
                        </div>
                        <p className="mb-1 text-sm text-muted-foreground">{pedido.notas || 'Sin notas'}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="size-3" aria-hidden />
                            Cantidad: {pedido.cantidad}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="size-3" aria-hidden />
                            Vendedor: {pedido.vendedorNombre}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(pedido.fecha)}
                        </p>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleProcesar(pedido.id)}
                        className="shrink-0"
                      >
                        Aprobar
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>

          <p className="mt-2 text-center text-sm text-muted-foreground">
            Se cerrará y volverá a aparecer mañana si quedan pendientes.
          </p>
        </DialogContent>
      </Dialog>

      {confirmId && (
        <Dialog open={true} onOpenChange={(open) => !open && setConfirmId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar Aprobación</DialogTitle>
              <DialogDescription>
                ¿Marcar como aprobado el pedido? Se cambiará el estado a "aprobado".
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 py-4">
              <Button variant="outline" onClick={() => setConfirmId(null)}>Cancelar</Button>
              <Button onClick={confirmProcesar} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar Aprobación
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}