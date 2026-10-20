// Generación de IDs de cliente (plan offline-responsive, §3 regla 2):
// los inserts usan UUIDs generados localmente para que el servidor pueda
// deduplicarlos por `id` de forma idempotente.

/**
 * Genera un UUID v4 (RFC 4122, variante 1).
 *
 * Usa `crypto.randomUUID()` cuando esté disponible (contextos seguros:
 * HTTPS, localhost, Electron) y recurre a un polyfill basado en
 * `crypto.getRandomValues()` —o, en su defecto, `Math.random` + marca de
 * tiempo— para navegadores sin Web Crypto o contextos no seguros.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return uuidV4Polyfill()
}

function uuidV4Polyfill(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    // Sin Web Crypto: Math.random + timestamp (unicidad probabilística
    // suficiente para IDs de cliente; no usar para criptografía).
    const now = Date.now()
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
    // Mezcla el timestamp en los primeros 6 bytes para evitar colisiones
    // entre sesiones distintas iniciadas casi a la vez.
    for (let i = 0; i < 6; i++) {
      bytes[i] ^= (now >>> (i * 8)) & 0xff
    }
  }
  // Fija versión 4 y variante RFC 4122 (bits requeridos por el formato).
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return formatUuid(bytes)
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}
