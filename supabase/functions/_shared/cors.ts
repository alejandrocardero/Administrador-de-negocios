/**
 * Shared CORS utilities for Supabase Edge Functions
 * Strict origin validation and security headers
 */

// Allowed origins - configure based on your deployment
const ALLOWED_ORIGINS = [
  'https://podoudwdhkzzltdxgbnv.supabase.co',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
] as const

type AllowedOrigin = typeof ALLOWED_ORIGINS[number]

/**
 * Validates if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): origin is AllowedOrigin {
  if (!origin) return false
  return ALLOWED_ORIGINS.includes(origin as AllowedOrigin)
}

/**
 * Generates CORS headers for a given origin
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = isOriginAllowed(origin)
  
  return {
    'Access-Control-Allow-Origin': allowed ? origin! : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
  }
}

/**
 * Handles CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin')
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    })
  }
  return null
}

/**
 * Validates request origin for mutating operations
 */
export function validateOrigin(req: Request): { valid: boolean; origin: string | null } {
  const origin = req.headers.get('Origin')
  
  // For same-origin requests (no Origin header), allow
  if (!origin) return { valid: true, origin: null }
  
  const allowed = isOriginAllowed(origin)
  return { valid: allowed, origin }
}

/**
 * Creates a standardized error response with CORS headers
 */
export function corsErrorResponse(
  message: string, 
  status: number = 400, 
  origin: string | null = null
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  })
}

/**
 * Creates a standardized success response with CORS headers
 */
export function corsSuccessResponse<T>(
  data: T, 
  status: number = 200, 
  origin: string | null = null
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  })
}