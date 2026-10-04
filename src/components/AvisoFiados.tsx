import { useState, useEffect, useRef } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useFiados, formatCurrency, formatDate } from '@/hooks/supabase/useSupabaseData';

interface AvisoFiadosProps {
  onCobrado?: () => void;
}

export default function AvisoFiados({ onCobrado }: AvisoFiadosProps) {
  const { getPendientes, cobrarFiado } = useFiados();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const pendientes = getPendientes();

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
    
    const force = sessionStorage.getItem('avisoFiadosForce') === '1';
    const lastShown = localStorage.getItem('avisoFiadosFecha');
    const hoy = new Date().toISOString().split('T')[0];
    const hayPendientes = pendientes.length > 0;

    if (hayPendientes && (force || lastShown !== hoy)) {
      hasShownRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
    }

    if (force) {
      sessionStorage.removeItem('avisoFiadosForce');
    }
  }, [pendientes.length]);

  const handleCobrar = (id: string) => {
    setConfirmId(id);
  };

  const confirmCobrar = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (confirmId) {
        await cobrarFiado(confirmId);
        setConfirmId(null);
        onCobrado?.();
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleClose = () => {
    const hoy = new Date().toISOString().split('T')[0];
    localStorage.setItem('avisoFiadosFecha', hoy);
    setIsOpen(false);
  };

  if (!isOpen || pendientes.length === 0) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              Fiados Pendientes por Cobrar
            </DialogTitle>
            <DialogDescription>
              Tienes {pendientes.length} fiado{pendientes.length > 1 ? 's' : ''} pendiente{pendientes.length > 1 ? 's' : ''}. 
              Se muestra una vez al día o al iniciar sesión hasta que se cobren.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4 max-h-[60vh] overflow-y-auto">
            {pendientes
              .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
              .map((fiado) => {
                const dias = diasPendientes(fiado.fecha);
                return (
                  <div key={fiado.id} className="border rounded-lg p-4 bg-slate-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">{fiado.clienteNombre}</span>
                          <Badge variant="destructive" className="text-xs">
                            {dias} día{dias !== 1 ? 's' : ''} pendiente
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mb-1">{fiado.descripcion}</p>
                        <p className="text-xs text-slate-500">
                          Vendedor: {fiado.vendedorNombre} · {formatDate(fiado.fecha)}
                        </p>
                        <p className="text-lg font-bold text-red-600 mt-1">{formatCurrency(fiado.monto)}</p>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleCobrar(fiado.id)}
                        className="flex-shrink-0"
                      >
                        Cobrado
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>

          <DialogDescription className="text-center text-sm text-slate-500 mt-2">
            Se cerrará y volverá a aparecer mañana si quedan pendientes.
          </DialogDescription>
        </DialogContent>
      </Dialog>

      {confirmId && (
        <AlertDialog open={true} onOpenChange={(open) => !open && setConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Cobro</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Marcar como cobrado el fiado? Se registrará como venta de hoy con el monto en efectivo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmId(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmCobrar} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar Cobro
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}