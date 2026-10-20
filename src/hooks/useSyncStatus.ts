// Hook reactivo del estado de sincronización (Fase 5). La UI (SyncIndicator,
// Fase 7) y la resolución de conflictos (Fase 6) consumen este hook:
//   - `pending` (outbox.countPending) y `conflicts` (conflictos abiertos)
//     vía `useLiveQuery` de Dexie (reactivos a IndexedDB);
//   - estado del motor (SyncEngineState) vía la suscripción de syncEngine;
//   - `isOnline` vía navigator.onLine + listeners online/offline;
//   - `syncNow` fuerza una pasada push → pull.

import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'
import { open as openConflicts, type LocalConflict } from '@/lib/db/conflicts'
import { countPending } from '@/lib/db/outbox'
import { getState, subscribeSyncEngine, syncNow as engineSyncNow } from '@/lib/sync/syncEngine'
import type { SyncEngineState, SyncStatus } from '@/lib/sync/types'

export interface UseSyncStatusResult {
  /** Estado plano del motor: idle/syncing/offline/error/paused. */
  status: SyncStatus
  /** true si la pausa exige re-login (token no renovable; cola intacta). */
  needsRelogin: boolean
  /** Ops pendientes de push (excluye in_flight y dead_letter). */
  pending: number
  /** Conflictos abiertos, del más antiguo al más reciente (Fase 6). */
  conflicts: LocalConflict[]
  /** Conectividad del navegador. */
  isOnline: boolean
  /** Fuerza una pasada push → pull ahora. */
  syncNow: () => void
}

export function useSyncStatus(): UseSyncStatusResult {
  // Reactivos a IndexedDB (outbox y conflictos)
  const pending = useLiveQuery(() => countPending(), [], 0)
  const conflicts = useLiveQuery(() => openConflicts(), [], [] as LocalConflict[])

  // Estado del motor por suscripción (inicial: la instantánea actual)
  const [engine, setEngine] = useState<SyncEngineState>(() => getState())
  useEffect(() => subscribeSyncEngine(setEngine), [])

  // Conectividad del navegador
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const goOnline = (): void => setIsOnline(true)
    const goOffline = (): void => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const syncNow = useCallback((): void => {
    void engineSyncNow()
  }, [])

  return {
    status: engine.status,
    needsRelogin: engine.needsRelogin,
    pending,
    conflicts,
    isOnline,
    syncNow,
  }
}
