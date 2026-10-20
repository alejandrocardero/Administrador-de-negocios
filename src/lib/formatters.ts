export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Fecha local 'YYYY-MM-DD' para columnas DATE.
 * NUNCA uses toISOString() para esto: en UTC-5, después de las 19:00 la fecha
 * UTC cae al día siguiente (venta del 18 guardada como 19). Las fechas que ya
 * vienen como 'YYYY-MM-DD' pasan tal cual.
 */
export function toFechaLocal(d: Date | string): string {
  if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return toFechaLocal(new Date(d));
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Adjust for timezone issues by creating date in UTC
  const adjustedDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return adjustedDate.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}