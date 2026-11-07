/**
 * Mapa de códigos de error Supabase/PostgREST → mensajes amigables en español.
 * Uso: import { getErrorMessage } from '@/lib/errorMessages';
 *      toast.error(getErrorMessage(error));
 */

// Códigos de error PostgreSQL comunes
const PG_ERROR_CODES: Record<string, string> = {
  // Integridad
  '23502': 'Falta un campo obligatorio',
  '23503': 'No se puede eliminar: tiene registros relacionados',
  '23505': 'Ya existe un registro con ese valor',
  '23514': 'El valor no cumple la restricción de validación',
  '23P01': 'Violación de restricción de exclusión',

  // Permisos
  '42501': 'Sin permisos para esta acción',
  '42601': 'Error de sintaxis en la consulta',
  '42703': 'Columna no encontrada',
  '42P01': 'Tabla no encontrada',
  '42P07': 'Tabla ya existe',
  '42883': 'Función no existe',

  // Conexión/Transacción
  '08000': 'Error de conexión con la base de datos',
  '08003': 'Conexión no existe',
  '08006': 'Error de conexión',
  '40001': 'Deadlock detectado, reintente la operación',
  '40P01': 'Deadlock detectado',

  // Datos
  '22001': 'Valor demasiado largo para el campo',
  '22003': 'Valor numérico fuera de rango',
  '22007': 'Formato de fecha inválido',
  '22012': 'División por cero',
  '22P02': 'Formato de entrada inválido',
};

// Códigos PostgREST / Supabase
const POSTGREST_CODES: Record<string, string> = {
  PGRST116: 'No se encontró el registro',
  PGRST200: 'Error en la consulta',
  PGRST201: 'Error al insertar',
  PGRST202: 'Error al actualizar',
  PGRST203: 'Error al eliminar',
  PGRST204: 'Error en la estructura de la base de datos',
  PGRST301: 'Recurso no encontrado',
  PGRST302: 'Error de autenticación',
  PGRST303: 'Sesión expirada',
  PGRST304: 'Permisos insuficientes',
};

const NETWORK_ERRORS = [
  'Failed to fetch',
  'NetworkError',
  'TypeError: Failed to fetch',
  'Network request failed',
];

/**
 * Extrae el código de error de un objeto de error de Supabase/PostgREST
 */
function extractErrorCode(error: unknown): string | null {
  if (!error) return null;

  // PostgrestError shape
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    // Supabase error object
    if (typeof err.code === 'string') return err.code;
    if (typeof err.message === 'string') {
      // A veces el código viene en el mensaje
      const match = err.message.match(/\b(\d{5}|PGRST\d+)\b/);
      if (match) return match[1];
    }
    if (typeof err.details === 'string') return err.details;
    if (typeof err.hint === 'string') return err.hint;
  }

  // Error nativo
  if (error instanceof Error) {
    const match = error.message.match(/\b(\d{5}|PGRST\d+)\b/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Verifica si el error es de red/conexión
 */
function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    const msg = typeof err.message === 'string' ? err.message : '';
    if (msg && NETWORK_ERRORS.some((ne) => msg.includes(ne))) {
      return true;
    }
  }
  return false;
}

/**
 * Obtiene un mensaje amigable en español para cualquier error
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return 'Ocurrió un error desconocido';

  // Error de red
  if (isNetworkError(error)) {
    return 'Error de conexión. Verifica tu internet e intenta de nuevo';
  }

  // Extraer código
  const code = extractErrorCode(error);

  // Buscar en mapas
  if (code) {
    if (PG_ERROR_CODES[code]) return PG_ERROR_CODES[code];
    if (POSTGREST_CODES[code]) return POSTGREST_CODES[code];
  }

  // Mensaje directo si es string simple
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.message === 'string') return err.message;
    if (typeof err.error_description === 'string') return err.error_description;
    return JSON.stringify(error);
  }

  return 'Ocurrió un error inesperado';
}

/**
 * Versión que también retorna el código técnico para logging
 */
export function getErrorInfo(error: unknown): { message: string; code: string | null } {
  const code = extractErrorCode(error);
  return {
    message: getErrorMessage(error),
    code,
  };
}