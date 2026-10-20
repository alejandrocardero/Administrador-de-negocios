// Motor de sincronización (Fase 5, §5 del plan): orquesta push → pull con
// mutex (una sola pasada concurrente), expone el estado a la UI (useSyncStatus
// / SyncIndicator, Fases 6–7) y arma los disparadores:
//   - arranque (init reclama las ops `in_flight` huérfanas de una sesión
//     caída —vuelven a `pending`— y dispara la primera pasada);
//   - mutaciones locales en el outbox → requestSync debounced 1.5 s;
//   - `online` del navegador → syncNow inmediato;
//   - `visibilitychange`/focus → syncNow si hay pendientes;
//   - intervalo de 60 s → syncNow si hay pendientes.
//
// NOTA sobre `db.on('changes')`: la spec pedía el evento `changes` de
// Dexie, pero ese evento pertenece al addon `dexie-observable` (no instalado);
// Dexie 4 integra la observabilidad en el core vía el evento global
// `Dexie.on('storagemutated')` con un `ObservabilitySet` cuyas partes tienen
// la forma `idb://${db}/${tabla}/${índice}`. Es el equivalente exacto y se
// filtra por la tabla `outbox`.

import { Dexie, type ObservabilitySet } from 'dexie'
import { db } from '@/lib/db/localDb'
import { countPending } from '@/lib/db/outbox'
import { pullAll } from './pull'
import { pushAll, resetPushBackoff } from './push'
import type { SyncEngineState, SyncStatus } from './types'

/** Opciones de arranque del motor (login / cambio de negocio). */
export interface SyncEngineOptions {
  businessId: string
  userId: string | null
}

/** Debounce de requestSync tras mutaciones locales (spec: 1.5 s). */
const SYNC_DEBOUNCE_MS = 1_500
/** Intervalo de reintento con pendientes (spec: 60 s). */
const SYNC_INTERVAL_MS = 60_000

interface EngineContext {
  businessId: string
  userId: string | null
}

let ctx: EngineContext | null = null
let running = false
/** Token de la pasada en curso: evita que un `finally` ajeno baaje el mutex. */
let runningToken = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<(state: SyncEngineState) => void>()

let state: SyncEngineState = {
  status: 'idle',
  needsRelogin: false,
  lastError: null,
  lastSyncAt: null,
}

function setState(patch: Partial<SyncEngineState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener(state)
}

/** Estado plano del motor (spec: `getStatus(): SyncStatus`). */
export function getStatus(): SyncStatus {
  return state.status
}

/** Instantánea completa del estado (status + contexto) para la UI. */
export function getState(): SyncEngineState {
  return state
}

/** Suscripción simple (Set de listeners); devuelve la función de baja. */
export function subscribeSyncEngine(listener: (state: SyncEngineState) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

// ── Disparadores ─────────────────────────────────────────────────────────────

/** Mutación en IndexedDB: solo interesa la tabla `outbox` → requestSync. */
function onStorageMutated(parts: ObservabilitySet): void {
  const prefix = `idb://${db.name}/outbox/`
  for (const part of Object.keys(parts)) {
    if (part.startsWith(prefix)) {
      requestSync()
      return
    }
  }
}

function onOnline(): void {
  void syncNow()
}

function onOffline(): void {
  // Sin red no se intenta nada hasta que vuelva (o el intervalo re-compruebe)
  if (state.status !== 'syncing') setState({ status: 'offline', lastError: null })
}

/** Foco/visibilidad/intervalo: sincroniza SOLO si hay pendientes. */
async function onResume(): Promise<void> {
  if (!ctx) return
  if ((await countPending()) > 0) void syncNow()
}

function onVisibility(): void {
  if (document.visibilityState === 'visible') void onResume()
}

function onInterval(): void {
  void onResume()
}

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Arranca el motor para un negocio/usuario. Idempotente: reinicia
 * disparadores y estado (llamarlo de nuevo tras re-login es seguro).
 * Reclama las ops `in_flight` huérfanas de una sesión caída (vuelven a
 * `pending`; la idempotencia por mutation_id, §4.3, hace el reintento
 * seguro) y dispara la primera pasada (pull inicial si nunca sincronizó).
 */
export async function init(options: SyncEngineOptions): Promise<void> {
  stop() // re-arranque limpio (evita disparadores duplicados)
  ctx = { businessId: options.businessId, userId: options.userId }
  resetPushBackoff()

  Dexie.on.storagemutated.subscribe(onStorageMutated)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  window.addEventListener('focus', onResume)
  document.addEventListener('visibilitychange', onVisibility)
  intervalTimer = setInterval(onInterval, SYNC_INTERVAL_MS)

  await db.outbox
    .where('status')
    .equals('in_flight')
    .modify((op) => {
      op.status = 'pending'
    })

  void syncNow() // disparador de arranque
}

/** Detiene el motor (logout / cambio de negocio). La cola NO se toca. */
export function stop(): void {
  ctx = null
  running = false
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (intervalTimer !== null) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
  Dexie.on.storagemutated.unsubscribe(onStorageMutated)
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  window.removeEventListener('focus', onResume)
  document.removeEventListener('visibilitychange', onVisibility)
  setState({ status: 'idle', needsRelogin: false, lastError: null })
}

/**
 * Solicita una pasada de sync con debounce (tras cada mutación local).
 * Si llegan varias escrituras seguidas solo se dispara una al final.
 */
export function requestSync(): void {
  if (!ctx) return
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void syncNow()
  }, SYNC_DEBOUNCE_MS)
}

/**
 * Una pasada completa: push → pull, con mutex (se ignora si ya corre).
 * El orden importa: primero drenar lo local (que el servidor vea nuestra
 * versión lo antes posible) y después incorporar los cambios remotos.
 * Si el motor está pausado por token inválido, no hace nada hasta que
 * `init` se llame de nuevo tras re-login (la cola queda intacta).
 */
export async function syncNow(): Promise<void> {
  const runCtx = ctx
  if (!runCtx || running) return
  if (state.status === 'paused' && state.needsRelogin) return

  running = true
  const token = ++runningToken
  try {
    if (!isOnline()) {
      setState({ status: 'offline', lastError: null })
      return
    }
    setState({ status: 'syncing', lastError: null })

    // ── Push ──
    const pushOutcome = await pushAll()
    if (ctx !== runCtx) return // stop() durante la pasada
    if (pushOutcome.kind === 'paused') {
      setState({
        status: 'paused',
        needsRelogin: pushOutcome.needsRelogin,
        lastError: pushOutcome.needsRelogin
          ? 'Sesión inválida: vuelve a iniciar sesión'
          : 'Sin conexión para renovar la sesión',
      })
      return
    }
    if (pushOutcome.kind === 'aborted' && pushOutcome.reason === 'network') {
      // Sin red no tiene sentido intentar el pull
      setState({ status: isOnline() ? 'error' : 'offline', lastError: 'Fallo de red al enviar cambios pendientes' })
      return
    }
    // 'completed' o backoff activo → el pull puede seguir (los datos remotos
    // pueden estar sanos aunque el push esté en espera)

    // ── Pull ──
    const pullOutcome = await pullAll(runCtx.businessId, runCtx.userId)
    if (ctx !== runCtx) return
    switch (pullOutcome.kind) {
      case 'paused':
        setState({
          status: 'paused',
          needsRelogin: pullOutcome.needsRelogin,
          lastError: pullOutcome.needsRelogin
            ? 'Sesión inválida: vuelve a iniciar sesión'
            : 'Sin conexión para renovar la sesión',
        })
        return
      case 'failed':
        setState({
          status: pullOutcome.offline ? 'offline' : 'error',
          lastError: pullOutcome.error,
        })
        return
      case 'completed': {
        const now = new Date().toISOString()
        if (pullOutcome.errors.length > 0) {
          // Datos aplicados, pero alguna tabla falló (reintenta sola)
          setState({ status: 'error', lastError: pullOutcome.errors.join(' · '), lastSyncAt: now, needsRelogin: false })
        } else {
          setState({ status: 'idle', lastError: null, lastSyncAt: now, needsRelogin: false })
        }
        break
      }
    }

    // Si llegaron ops nuevas durante la pasada → otro ciclo (debounced).
    // Solo cuando el push drenó: si abortó, el reintento lo llevan el
    // intervalo/online/foco (con su backoff), evitando bucles.
    if (pushOutcome.kind === 'completed' && state.status !== 'paused') {
      if ((await countPending()) > 0) requestSync()
    }
  } catch (err) {
    setState({ status: 'error', lastError: err instanceof Error ? err.message : String(err) })
  } finally {
    if (token === runningToken) running = false
  }
}
