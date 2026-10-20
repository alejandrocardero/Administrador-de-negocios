// Acceso "flojo" (estructuralmente tipado, sin `any`) al cliente de Supabase
// para las columnas, tablas y RPCs que la migración 004 añade pero que
// `src/types/database.ts` aún no conoce (TODO del plan, Fase 3: regenerar los
// tipos tras aplicar la migración: `sync_rev`, tablas `sync_*`,
// `detalles_compra.business_id` y los RPCs `apply_mutation` / `ajustar_stock` /
// `resolver_conflicto`).
//
// Este módulo es la ÚNICA costura (seam) con cast de todo el motor: tipa lo
// mínimo imprescindible para que pull.ts/push.ts compilen hoy y sea trivial
// migrar mañana a los tipos generados (basta sustituir `looseFrom`/`looseRpc`
// por `supabase.from`/`supabase.rpc` sin tocar la lógica).
//
// Nota sobre errores: supabase-js 2.x RESUELVE los fallos en vez de rechazar
// (ni siquiera los de transporte), con esta forma:
//   - red/timeout/abort → `{ error: {...}, status: 0 }` (mensaje con prefijo
//     `FetchError:`/`TypeError:`/`AbortError:`);
//   - 401 (JWT expirado/inválido) → `status: 401` (PostgREST: código PGRST301);
//   - 4xx/5xx → `status` con el código HTTP correspondiente.

import { supabase } from '@/lib/supabase'

/** Error de PostgREST/transporte con la forma mínima que consumimos. */
export interface LooseError {
  message: string
  details?: string
  hint?: string
  code?: string
}

/**
 * Respuesta de una consulta loose. Refleja `PostgrestSingleResponse`:
 * `data` + `error` (+ `status`, que en fallos de transporte es 0).
 */
export interface LooseResult<T> {
  data: T | null
  error: LooseError | null
  status?: number
  statusText?: string
}

/**
 * Consulta encadenable (eq/gt/order/limit) y awaitable. El builder real de
 * postgrest-js es awaitable y cada `await` re-ejecuta la petición, lo que
 * permite reintentar la MISMA consulta tras refrescar sesión (401).
 */
export interface LooseQuery extends PromiseLike<LooseResult<unknown>> {
  eq(column: string, value: string | number | boolean | null): LooseQuery
  gt(column: string, value: string | number): LooseQuery
  order(column: string, options?: { ascending?: boolean }): LooseQuery
  limit(count: number): LooseQuery
}

interface LooseTable {
  select(columns?: string): LooseQuery
  upsert(
    values: Record<string, unknown> | Array<Record<string, unknown>>,
    options?: { onConflict?: string },
  ): LooseQuery
}

type FromFn = (table: string) => LooseTable
type RpcFn = (fn: string, args?: Record<string, unknown>) => PromiseLike<LooseResult<unknown>>

/**
 * Vista estructural mínima del cliente tipado. El cast NO cambia la instancia:
 * los métodos se invocan sobre el propio objeto, conservando el `this`.
 */
const looseClient = supabase as unknown as {
  from: FromFn
  rpc: RpcFn
}

/** `supabase.from(table)` sin tipado por esquema (tablas de la migración 004). */
export function looseFrom(table: string): LooseTable {
  return looseClient.from(table)
}

/** `supabase.rpc(fn, args)` sin tipado por esquema (RPCs de la migración 004). */
export async function looseRpc(fn: string, args: Record<string, unknown>): Promise<LooseResult<unknown>> {
  return looseClient.rpc(fn, args)
}

// ── Clasificación de errores (push.ts/pull.ts ramifican sobre esto) ──

/**
 * ¿Fallo de transporte (sin respuesta HTTP)? status 0 (fetch rechazado o
 * timeout/abort). Cualquier otro estado con error es una respuesta real.
 */
export function isNetworkResult(result: LooseResult<unknown>): boolean {
  if (!result.error) return false
  if ((result.status ?? 0) === 0) return true
  return /^(TypeError|FetchError|AbortError)\b/.test(result.error.message)
}

/** ¿401 / JWT inválido-expirado? (PostgREST: HTTP 401, código PGRST301). */
export function isUnauthorizedResult(result: LooseResult<unknown>): boolean {
  if (!result.error) return false
  if (result.status === 401) return true
  return result.error.code === 'PGRST301'
}

/** ¿5xx (error del servidor; se reintenta con backoff, nunca dead-letter directo)? */
export function isServerErrorResult(result: LooseResult<unknown>): boolean {
  return (result.status ?? 0) >= 500
}

/** Texto de diagnóstico del error (para lastError / dead-letter / estado). */
export function errorText(result: LooseResult<unknown>): string {
  const e = result.error
  if (!e) return 'respuesta sin error pero inválida'
  const code = e.code ? ` (código ${e.code})` : ''
  return `${e.message}${code}`.trim()
}

// ── Recuperación de sesión tras 401 (trampa 13, §7: pausar, no descartar) ──

export type SessionRecovery = { ok: true } | { ok: false; reason: 'network' | 'token' }

/**
 * Recupera/renueva la sesión UNA sola vez tras un 401. `auth.getSession()`
 * refresca internamente el access token si está expirado; clasificamos el
 * fallo:
 * - sin respuesta de auth (red) → 'network' → pausa SIN needsRelogin;
 * - respuesta de auth (refresh inválido/revocado) o sin sesión → 'token' →
 *   pausa CON needsRelogin.
 */
export async function ensureFreshSession(): Promise<SessionRecovery> {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      // AuthApiError lleva status HTTP (fallo de token); AuthRetryableError
      // no lo lleva (fallo de red al contactar auth).
      const status = (error as unknown as { status?: unknown }).status
      return typeof status === 'number' ? { ok: false, reason: 'token' } : { ok: false, reason: 'network' }
    }
    return data.session ? { ok: true } : { ok: false, reason: 'token' }
  } catch {
    // Excepción inesperada: tratamos como red (conservador, se reintenta).
    return { ok: false, reason: 'network' }
  }
}
