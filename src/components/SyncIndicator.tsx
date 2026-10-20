// Fase 7 (PLAN-OFFLINE-RESPONSIVE): indicador global del estado de sync.
// 🟢 al día · 🟡 sincronizando / con pendientes · 🔴 offline, error o conflictos.
// Es solo lectura del estado: el motor se gestiona en syncEngine y los
// conflictos se resuelven en ConflictResolver (Fase 6).

import { Popover, PopoverContent, PopoverTrigger as PopoverTriggerRoot } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CloudUpload, RefreshCw, TriangleAlert, LogIn } from 'lucide-react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { cn } from '@/lib/utils';
import type { SyncStatus } from '@/lib/sync/types';

const ETIQUETA_ESTADO: Record<SyncStatus, string> = {
  idle: 'Todo sincronizado',
  syncing: 'Sincronizando…',
  offline: 'Sin conexión',
  error: 'Error de sincronización',
  paused: 'Sincronización en pausa',
};

export default function SyncIndicator() {
  const { status, needsRelogin, pending, conflicts, isOnline, syncNow } = useSyncStatus();

  const nivel: 'ok' | 'warn' | 'error' =
    !isOnline || needsRelogin || status === 'error' || conflicts.length > 0
      ? 'error'
      : status === 'syncing' || pending > 0 || status === 'paused'
        ? 'warn'
        : 'ok';

  const colorPunto =
    nivel === 'ok' ? 'bg-green-500' : nivel === 'warn' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <Popover>
      <PopoverTriggerRoot asChild>
        <button
          type="button"
          aria-label="Estado de sincronización"
          className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <span className={cn('w-2 h-2 rounded-full shrink-0', colorPunto)} />
          {(pending > 0 || conflicts.length > 0) && (
            <span className="font-medium">{pending + conflicts.length}</span>
          )}
        </button>
      </PopoverTriggerRoot>
      <PopoverContent align="end" className="w-72 p-3 space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', colorPunto)} />
          {ETIQUETA_ESTADO[status]}
          {!isOnline && <span className="text-xs text-slate-500">(navegador offline)</span>}
        </p>

        <p className="text-xs text-slate-600">
          Cambios pendientes de enviar: <strong>{pending}</strong>
        </p>

        {conflicts.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-red-700">
            <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>{conflicts.length}</strong> {conflicts.length === 1 ? 'conflicto' : 'conflictos'} por resolver (barra roja arriba).
            </span>
          </p>
        )}

        {needsRelogin && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700">
            <LogIn className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Sesión expirada sin conexión. Vuelve a iniciar sesión para sincronizar; tus cambios siguen guardados.</span>
          </p>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={syncNow}
          disabled={status === 'syncing' || !isOnline}
        >
          {status === 'syncing' ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-2" />}
          Sincronizar ahora
        </Button>
      </PopoverContent>
    </Popover>
  );
}
