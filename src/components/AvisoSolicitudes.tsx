import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared';
import { AlertTriangle, Loader2, Package, User, MessageSquare } from 'lucide-react';
import { useSolicitudesProductoNuevo, formatCurrency, formatDate, toFechaLocal } from '@/hooks/supabase/useSupabaseData';

interface AvisoSolicitudesProps {
  onProcesar?: () => void;
}

export default function AvisoSolicitudes({ onProcesar }: AvisoSolicitudesProps) {
  const { getSolicitudesPendientes, aprobarSolicitud, rechazarSolicitud } = useSolicitudesProductoNuevo();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'aprobar' | 'rechazar' | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const pendientes = getSolicitudesPendientes();

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
    
    const force = sessionStorage.getItem('avisoSolicitudesForce') === '1';
    const lastShown = localStorage.getItem('avisoSolicitudesFecha');
    const hoy = toFechaLocal(new Date());
    const hayPendientes = pendientes.length > 0;

    if (hayPendientes && (force || lastShown !== hoy)) {
      hasShownRef.current = true;
      setIsOpen(true);
    }

    if (force) {
      sessionStorage.removeItem('avisoSolicitudesForce');
    }
  }, [pendientes.length]);

  const handleProcesar = (id: string, action: 'aprobar' | 'rechazar') => {
    setConfirmId(id);
    setConfirmAction(action);
  };

  const confirmProcesar = async () => {
    if (savingRef.current || !confirmId || !confirmAction) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (confirmAction === 'aprobar') {
        // For approval, we need additional data - for now just approve with defaults
        // The admin will need to go to AprobarProductos section for full details
        await aprobarSolicitud(confirmId, 0, 0, '', 'Aprobado desde notificación');
      } else {
        await rechazarSolicitud(confirmId, 'Rechazado desde notificación');
      }
      setConfirmId(null);
      setConfirmAction(null);
      onProcesar?.();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleClose = () => {
    const hoy = toFechaLocal(new Date());
    localStorage.setItem('avisoSolicitudesFecha', hoy);
    setIsOpen(false);
  };

  if (!isOpen || pendientes.length === 0) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4">
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
              Solicitudes de Productos Nuevos Pendientes
            </DialogTitle>
            <DialogDescription>
              Tienes {pendientes.length} solicitud{pendientes.length > 1 ? 'es' : ''} pendiente{pendientes.length > 1 ? 's' : ''}.
              Se muestra una vez al día o al iniciar sesión hasta que se procesen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4 max-h-[60vh] overflow-y-auto">
            {pendientes
              .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
              .map((solicitud) => {
                const dias = diasPendientes(solicitud.fecha);
                return (
                  <div key={solicitud.id} className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-blue-500/40">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="font-medium">{solicitud.nombreProducto}</span>
                          <StatusBadge tone="info">
                            {dias} día{dias !== 1 ? 's' : ''} pendiente
                          </StatusBadge>
                        </div>
                        <p className="mb-1 text-sm text-muted-foreground">{solicitud.notas || 'Sin notas'}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="size-3" aria-hidden />
                            Cantidad: {solicitud.cantidad}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="size-3" aria-hidden />
                            Comprador: {solicitud.compradorNombre}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="size-3" aria-hidden />
                            Precio compra: {formatCurrency(solicitud.precioCompra)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(solicitud.fecha)}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleProcesar(solicitud.id, 'aprobar')}
                          className="shrink-0"
                        >
                          Aprobar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleProcesar(solicitud.id, 'rechazar')}
                          className="shrink-0"
                        >
                          Rechazar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <p className="mt-2 text-center text-sm text-muted-foreground">
            Se cerrará y volverá a aparecer mañana si quedan pendientes.
            Para aprobaciones completas (precio venta, stock mínimo), use la sección "Aprobar Productos".
          </p>
        </DialogContent>
      </Dialog>

      {confirmId && confirmAction && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setConfirmId(null); setConfirmAction(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{confirmAction === 'aprobar' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}</DialogTitle>
              <DialogDescription>
                {confirmAction === 'aprobar'
                  ? '¿Marcar como aprobada la solicitud? Se creará el producto con los valores por defecto (precio venta = 0, stock mínimo = 0). Para configurar correctamente, use la sección "Aprobar Productos".'
                  : '¿Marcar como rechazada la solicitud?'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 py-4">
              <Button variant="outline" onClick={() => { setConfirmId(null); setConfirmAction(null); }}>Cancelar</Button>
              <Button variant={confirmAction === 'aprobar' ? 'default' : 'destructive'} onClick={confirmProcesar} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {confirmAction === 'aprobar' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}