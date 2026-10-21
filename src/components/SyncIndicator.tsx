// Fase 7 (PLAN-OFFLINE-RESPONSIVE): indicador global del estado de sync.
// 🟢 al día · 🟡 sincronizando / con pendientes · 🔴 error o conflictos · ⚪ offline.
// Es solo lectura del estado: el motor se gestiona en syncEngine y los
// conflictos se resuelven en ConflictResolver (Fase 6).

import { Popover, PopoverContent, PopoverTrigger as PopoverTriggerRoot } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { StatusBadge, type StatusTone } from '@/components/shared';
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

const PUNTO_TONO: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-primary',
  neutral: 'bg-muted-foreground/60',
};

export default function SyncIndicator() {
  const { status, needsRelogin, pending, conflicts, isOnline, syncNow } = useSyncStatus();

  const tono: StatusTone =
    conflicts.length > 0 || needsRelogin || status === 'error'
      ? 'danger'
      : !isOnline
        ? 'neutral'
        : status === 'syncing' || pending > 0 || status === 'paused'
          ? 'warning'
          : 'success';

  // El pulso solo comunica trabajo pendiente por enviar.
  const conPulso = tono === 'warning' && pending > 0;

  return (
    <Popover>
      <PopoverTriggerRoot asChild>
        <button
          type="button"
          aria-label="Estado de sincronización"
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
        >
          <span className={cn('size-2 shrink-0 rounded-full', PUNTO_TONO[tono], conPulso && 'animate-pulse')} />
          {(pending > 0 || conflicts.length > 0) && (
            <span className="font-medium text-foreground">{pending + conflicts.length}</span>
          )}
        </button>
      </PopoverTriggerRoot>
      <PopoverContent align="end" className="w-72 space-y-2 p-3">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <StatusBadge tone={tono}>{ETIQUETA_ESTADO[status]}</StatusBadge>
          {!isOnline && <span className="text-xs font-normal text-muted-foreground">(navegador offline)</span>}
        </p>

        <p className="text-xs text-muted-foreground">
          Cambios pendientes de enviar: <strong className="text-foreground">{pending}</strong>
        </p>

        {conflicts.length > 0 && (
          <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <strong>{conflicts.length}</strong> {conflicts.length === 1 ? 'conflicto' : 'conflictos'} por resolver (barra roja arriba).
            </span>
          </p>
        )}

        {needsRelogin && (
          <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 p-2 text-xs text-warning-foreground">
            <LogIn className="mt-0.5 size-3.5 shrink-0" aria-hidden />
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
          {status === 'syncing' ? <RefreshCw className="animate-spin" aria-hidden /> : <CloudUpload aria-hidden />}
          Sincronizar ahora
        </Button>
      </PopoverContent>
    </Popover>
  );
}
