// Metadatos de sincronización en el store `meta` (key/value): watermarks de
// pull por entidad, watermark del feed de tombstones, perfil cacheado para
// arranque offline, identificador del dispositivo y fecha del último resync.

import { db } from './localDb'
import { uuid } from '@/lib/id'
import type { SyncedTableName } from '@/lib/sync/types'
import type { AuthUser } from '@/types'

/** Valor almacenable en `meta` (IndexedDB lo clona estructuradamente). */
export type MetaValue = string | number | boolean | null | object

/** Entrada del store `meta` (clave: `key`). */
export interface MetaEntry {
  key: string
  value: MetaValue
}

const WATERMARK_PREFIX = 'pull_watermark:'

/** Claves de `meta` que no son watermarks por entidad. */
export const META_KEYS = {
  deletionsWatermark: 'pull_deletions_watermark',
  cachedUser: 'cached_user',
  deviceId: 'device_id',
  lastFullSync: 'last_full_sync',
} as const

// ── Watermark de pull por entidad (mayor sync_rev ya aplicado localmente) ──

export async function getPullWatermark(entity: SyncedTableName): Promise<number> {
  const entry = await db.meta.get(`${WATERMARK_PREFIX}${entity}`)
  return typeof entry?.value === 'number' ? entry.value : 0
}

export async function setPullWatermark(entity: SyncedTableName, rev: number): Promise<void> {
  if (!Number.isFinite(rev) || rev < 0) {
    throw new RangeError(`Watermark inválida para ${entity}: ${rev}`)
  }
  await db.meta.put({ key: `${WATERMARK_PREFIX}${entity}`, value: rev })
}

// ── Watermark del feed de tombstones (mayor seq ya aplicado, §4.2) ──

export async function getPullDeletionsWatermark(): Promise<number> {
  const entry = await db.meta.get(META_KEYS.deletionsWatermark)
  return typeof entry?.value === 'number' ? entry.value : 0
}

export async function setPullDeletionsWatermark(seq: number): Promise<void> {
  if (!Number.isFinite(seq) || seq < 0) {
    throw new RangeError(`Watermark de tombstones inválida: ${seq}`)
  }
  await db.meta.put({ key: META_KEYS.deletionsWatermark, value: seq })
}

// ── Perfil cacheado (arranque sin red, Fases 3 y 6: auth tolerante a offline) ──

/** Valida mínimamente la forma del perfil cacheado antes de devolverlo. */
function isAuthUser(value: object): value is AuthUser {
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.role === 'string' &&
    typeof v.nombre === 'string' &&
    typeof v.business_id === 'string' &&
    typeof v.membership_id === 'string'
  )
}

export async function getCachedUser(): Promise<AuthUser | null> {
  const entry = await db.meta.get(META_KEYS.cachedUser)
  const value = entry?.value
  if (value === null || typeof value !== 'object') return null
  return isAuthUser(value) ? value : null
}

export async function setCachedUser(user: AuthUser): Promise<void> {
  await db.meta.put({ key: META_KEYS.cachedUser, value: user })
}

export async function clearCachedUser(): Promise<void> {
  await db.meta.delete(META_KEYS.cachedUser)
}

// ── Identificador del dispositivo (sync_devices, §4.5) ──

let deviceIdPromise: Promise<string> | null = null

/**
 * Identificador estable del dispositivo; lo genera con `uuid()` la primera
 * vez. Memoizado en el módulo para evitar que dos llamadas simultáneas
 * creen ids distintos (entre pestañas puede haber carrera benigna: gana la
 * última escritura y ambos ids se registran en sync_devices).
 */
export async function getOrCreateDeviceId(): Promise<string> {
  deviceIdPromise ??= (async () => {
    const entry = await db.meta.get(META_KEYS.deviceId)
    if (entry && typeof entry.value === 'string') return entry.value
    const id = uuid()
    await db.meta.put({ key: META_KEYS.deviceId, value: id })
    return id
  })()
  return deviceIdPromise
}

// ── Último resync completo (control de poda de tombstones, §4.5) ──

export async function getLastFullSync(): Promise<string | null> {
  const entry = await db.meta.get(META_KEYS.lastFullSync)
  return typeof entry?.value === 'string' ? entry.value : null
}

export async function setLastFullSync(isoDate: string): Promise<void> {
  await db.meta.put({ key: META_KEYS.lastFullSync, value: isoDate })
}
