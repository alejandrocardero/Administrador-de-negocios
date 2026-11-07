/**
 * Security utilities for XSS prevention, CSRF protection, and input validation
 */

import { z } from 'zod'

// ============================================================================
// XSS Prevention - DOMPurify-style sanitization
// ============================================================================

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
  /<input\b[^>]*>/gi,
  /<textarea\b[^<]*(?:(?!<\/textarea>)<[^<]*)*<\/textarea>/gi,
  /<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gi,
  /on\w+\s*=/gi, // Event handlers: onclick, onload, etc.
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
  /expression\s*\(/gi, // CSS expressions
  /url\s*\(\s*javascript:/gi,
]

const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'p', 'br', 'span', 'div']

/**
 * Sanitizes HTML input to prevent XSS attacks
 * Removes dangerous tags, event handlers, and javascript: URLs
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') return ''

  let sanitized = input

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }

  // Remove any remaining HTML tags except allowed ones
  sanitized = sanitized.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    const lowerTag = tagName.toLowerCase()
    if (ALLOWED_TAGS.includes(lowerTag)) {
      // Keep allowed tags but strip dangerous attributes
      return match.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\s+style\s*=\s*["'][^"']*expression\s*\([^"']*["']/gi, '')
    }
    return '' // Remove disallowed tags
  })

  return sanitized
}

/**
 * Sanitizes plain text input (no HTML allowed)
 * Escapes HTML entities
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return ''

  return input
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/\//g, '&#x2F;')
}

/**
 * Validates and sanitizes a URL
 */
export function sanitizeURL(input: string): string {
  if (!input || typeof input !== 'string') return ''

  const trimmed = input.trim()

  // Block javascript: and data: URLs
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return ''
  }

  try {
    const url = new URL(trimmed)
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return ''
    }
    return url.toString()
  } catch {
    // Relative URLs or invalid URLs - return empty
    return ''
  }
}

// ============================================================================
// CSRF Protection
// ============================================================================

let csrfToken: string | null = null

/**
 * Generates a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  csrfToken = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  return csrfToken
}

/**
 * Gets the current CSRF token, generating one if needed
 */
export function getCSRFToken(): string {
  if (!csrfToken) {
    return generateCSRFToken()
  }
  return csrfToken
}

/**
 * Verifies a CSRF token
 */
export function verifyCSRFToken(token: string): boolean {
  return csrfToken !== null && token === csrfToken
}

/**
 * Clears the CSRF token (e.g., on logout)
 */
export function clearCSRFToken(): void {
  csrfToken = null
}

// ============================================================================
// Input Validation with Zod
// ============================================================================

/**
 * Validates form data against a Zod schema
 */
export function validateAndSanitize(
  formData: Record<string, unknown>,
  schema: z.ZodTypeAny
): { success: boolean; data?: z.infer<z.ZodTypeAny>; errors?: string[] } {
  try {
    // First sanitize all string inputs
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(formData)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeText(value)
      } else {
        sanitized[key] = value
      }
    }

    const result = schema.safeParse(sanitized)

    if (result.success) {
      return { success: true, data: result.data }
    }

    const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
    return { success: false, errors }
  } catch (error) {
    return { success: false, errors: ['Error de validación interno'] }
  }
}

// ============================================================================
// Common Validation Schemas
// ============================================================================

export const loginSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(128),
  businessId: z.string().uuid().optional(),
})

export const registerSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
  confirmPassword: z.string(),
  slug: z.string().min(3, 'El slug debe tener al menos 3 caracteres').max(50)
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener minúsculas, números y guiones'),
  nit: z.string().max(20).optional(),
  direccion: z.string().max(200).optional(),
  telefono: z.string().max(20).optional(),
  emailNegocio: z.string().email('Email inválido').max(255).optional().or(z.literal('')),
  regimen: z.enum(['simplificado', 'comun']).optional(),
  tarifa_iva: z.number().min(0).max(100).optional(),
  moneda: z.string().max(10).optional(),
  jefe_nombre: z.string().min(2).max(100),
  jefe_email: z.string().email().max(255),
  jefe_password: z.string().min(6).max(128),
  roles: z.object({
    admin: z.object({
      username: z.string().min(3).max(30).regex(/^[a-z0-9_.-]+$/),
      password: z.string().min(6).max(128),
      nombre: z.string().min(2).max(100),
    }),
    comprador: z.object({
      username: z.string().min(3).max(30).regex(/^[a-z0-9_.-]+$/),
      password: z.string().min(6).max(128),
      nombre: z.string().min(2).max(100),
    }),
    vendedor: z.object({
      username: z.string().min(3).max(30).regex(/^[a-z0-9_.-]+$/),
      password: z.string().min(6).max(128),
      nombre: z.string().min(2).max(100),
    }),
  }),
})
.refine(data => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

export const businessConfigSchema = z.object({
  nombre: z.string().min(2).max(100),
  nit: z.string().max(20).optional(),
  direccion: z.string().max(200).optional(),
  telefono: z.string().max(20).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
  regimen: z.enum(['simplificado', 'comun']),
  tarifa_iva: z.number().min(0).max(100),
  moneda: z.string().max(10),
})

export const formulaConfigSchema = z.object({
  salario_usar_formula: z.boolean(),
  salario_formula: z.string().max(500).optional(),
  salario_base_fija: z.number().min(0).max(1_000_000_000),
  salario_comision_porcentaje: z.number().min(0).max(100),
  salario_meta_ventas: z.number().min(0).max(1_000_000_000),
  salario_bono_meta: z.number().min(0).max(1_000_000_000),
  salario_formula_descripcion: z.string().max(500).optional(),
  salario_roles_formula: z.array(z.enum(['jefe', 'admin', 'comprador', 'vendedor'])).min(1),
})

// ============================================================================
// Secure Storage (client-side encryption for sensitive data)
// ============================================================================

const ENCRYPTION_KEY = 'adminnegocio-pro-secure-storage-2024'

/**
 * Simple XOR-based encryption for localStorage (not cryptographically secure,
 * but prevents plain-text storage of sensitive data)
 */
function xorEncrypt(data: string, key: string): string {
  let result = ''
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return btoa(result)
}

function xorDecrypt(encrypted: string, key: string): string {
  try {
    const decoded = atob(encrypted)
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    return result
  } catch {
    return ''
  }
}

export const secureStorage = {
  setItem(key: string, value: unknown): void {
    try {
      const json = JSON.stringify(value)
      const encrypted = xorEncrypt(json, ENCRYPTION_KEY)
      localStorage.setItem(`secure_${key}`, encrypted)
    } catch {
      // Fail silently
    }
  },

  getItem<T>(key: string): T | null {
    try {
      const encrypted = localStorage.getItem(`secure_${key}`)
      if (!encrypted) return null
      const decrypted = xorDecrypt(encrypted, ENCRYPTION_KEY)
      return JSON.parse(decrypted) as T
    } catch {
      return null
    }
  },

  removeItem(key: string): void {
    localStorage.removeItem(`secure_${key}`)
  },

  clear(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('secure_')) {
        localStorage.removeItem(key)
      }
    })
  },
}

// ============================================================================
// Environment Validation
// ============================================================================

interface EnvConfig {
  VITE_SUPABASE_URL: string
  VITE_SUPABASE_ANON_KEY: string
}

/**
 * Validates all required environment variables at startup
 */
export function validateEnvironment(): EnvConfig {
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const
  const missing = required.filter(key => !import.meta.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Validate URL format
  try {
    new URL(import.meta.env.VITE_SUPABASE_URL)
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid URL')
  }

  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}