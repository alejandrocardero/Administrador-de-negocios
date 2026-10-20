// Utilidades puras de ganancia / margen.
//
// Fórmula definida por el usuario (margen sobre el precio de venta, NO markup
// sobre costo):
//
//   % ganancia = (PV − PC) / PV × 100
//   PV = PC / (1 − %/100)          (inversa exacta)
//
// Ejemplos: PC=800, 25% → PV=1.066,67; PC=1.000, 40% → PV=1.666,67.
// Caso límite: %=100 → PV infinito → se bloquea con tope MARGEN_MAX = 99.

/** Margen mínimo permitido (porcentaje sobre el precio de venta). */
export const MARGEN_MIN = 0;

/** Margen máximo permitido (99 % — 100 % daría un precio infinito). */
export const MARGEN_MAX = 99;

/** Redondea a 2 decimales (evita errores de coma flotante con +EPSILON). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Limita un porcentaje de margen al rango válido [0, 99]. */
export function clampMargen(pct: number): number {
  if (!Number.isFinite(pct)) return MARGEN_MIN;
  return Math.min(MARGEN_MAX, Math.max(MARGEN_MIN, pct));
}

/**
 * Margen real (%) a partir de los precios: (PV − PC) / PV × 100.
 * Devuelve null si PV ≤ 0 (el % no es calculable).
 */
export function margen(pv: number, pc: number): number | null {
  if (!Number.isFinite(pv) || pv <= 0) return null;
  return round2(((pv - pc) / pv) * 100);
}

/**
 * Precio de venta a partir del precio de compra y el margen deseado:
 * PV = PC / (1 − %/100). El % se limita a [0, 99]; PC ≤ 0 → PV = 0.
 */
export function precioDesdeMargen(pc: number, pct: number): number {
  const clamped = clampMargen(pct);
  if (!Number.isFinite(pc) || pc <= 0) return 0;
  return round2(pc / (1 - clamped / 100));
}

/**
 * Margen (%) a partir de precios (inversa de precioDesdeMargen):
 * (PV − PC) / PV × 100. Devuelve null si PV ≤ 0 (ej.: PC=0, PV=0).
 */
export function margenDesdePrecio(pc: number, pv: number): number | null {
  if (!Number.isFinite(pv) || pv <= 0) return null;
  return round2(((pv - pc) / pv) * 100);
}

/** Ganancia total de un producto: cantidad vendida × (PV − PC). */
export function gananciaProducto(vendido: number, pv: number, pc: number): number {
  return round2(vendido * (pv - pc));
}

/** Formatea un porcentaje de margen en es-CO: 25.5 → "25,5 %". null → "—". */
export function formatMargen(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return '—';
  const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(pct);
  return `${num} %`;
}
