import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsErrorResponse, corsSuccessResponse, handleCors, getCorsHeaders, validateOrigin } from '../_shared/cors.ts'
import { withRateLimit } from '../_shared/rate-limit.ts'

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Validate origin for mutating requests
  const { valid, origin } = validateOrigin(req)
  if (!valid && req.method !== 'GET') {
    return corsErrorResponse('Origin not allowed', 403, origin)
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Only allow POST for onboarding
    if (req.method !== 'POST') {
      return corsErrorResponse('Method not allowed', 405, origin)
    }

    const body = await req.json()
    const {
      nombre,
      slug,
      nit,
      direccion,
      telefono,
      email,
      regimen,
      tarifa_iva,
      moneda,
      jefe_nombre,
      jefe_email,
      jefe_password,
      roles
    } = body

    // Input validation with detailed errors
    const errors: string[] = []
    
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      errors.push('El nombre del negocio es obligatorio (mínimo 2 caracteres)')
    }
    
    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]{3,50}$/.test(slug)) {
      errors.push('El identificador (slug) debe tener 3-50 caracteres: minúsculas, números y guiones')
    }
    
    if (!jefe_nombre || typeof jefe_nombre !== 'string' || jefe_nombre.trim().length < 2) {
      errors.push('El nombre del jefe es obligatorio (mínimo 2 caracteres)')
    }
    
    if (!jefe_email || typeof jefe_email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(jefe_email)) {
      errors.push('El email del jefe no es válido')
    }
    
    if (!jefe_password || typeof jefe_password !== 'string' || jefe_password.length < 6) {
      errors.push('La contraseña debe tener al menos 6 caracteres')
    }

    // Validate required roles
    const requiredRoles = ['admin', 'comprador', 'vendedor'] as const
    for (const role of requiredRoles) {
      const roleData = roles?.[role]
      if (!roleData?.username || typeof roleData.username !== 'string' || 
          !/^[a-z0-9_.-]{3,30}$/.test(roleData.username)) {
        errors.push(`Usuario inválido para rol ${role}: 3-30 caracteres (letras, números, punto, guion o guion bajo)`)
      }
      if (!roleData?.password || typeof roleData.password !== 'string' || roleData.password.length < 6) {
        errors.push(`Contraseña inválida para rol ${role}: mínimo 6 caracteres`)
      }
      if (!roleData?.nombre || typeof roleData.nombre !== 'string' || roleData.nombre.trim().length < 2) {
        errors.push(`Nombre inválido para rol ${role}: mínimo 2 caracteres`)
      }
    }

    if (errors.length > 0) {
      return corsErrorResponse(errors.join('; '), 400, origin)
    }

    // Check slug uniqueness
    const { data: existingSlug } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingSlug) {
      return corsErrorResponse('El nombre corto (slug) ya está en uso', 400, origin)
    }

    // Call atomic onboarding RPC
    const { data, error } = await supabaseAdmin.rpc('onboard_business', {
      p_nombre: nombre.trim(),
      p_slug: slug.trim().toLowerCase(),
      p_nit: nit?.trim() || null,
      p_direccion: direccion?.trim() || null,
      p_telefono: telefono?.trim() || null,
      p_email: email?.trim() || null,
      p_regimen: regimen || 'simplificado',
      p_tarifa_iva: tarifa_iva ?? 19,
      p_moneda: moneda || 'COP',
      p_jefe_nombre: jefe_nombre.trim(),
      p_jefe_email: jefe_email.trim().toLowerCase(),
      p_jefe_password: jefe_password,
      p_roles_json: roles
    })

    if (error) {
      console.error('Onboard error:', error)
      return corsErrorResponse(error.message, 400, origin)
    }

    // Log audit event (non-blocking)
    try {
      await supabaseAdmin.rpc('log_audit_event', {
        p_event_type: 'business_created',
        p_business_id: data?.business_id,
        p_user_id: data?.owner_id,
        p_severity: 'info',
        p_details: { slug: nombre, owner_email: jefe_email }
      })
    } catch (auditError) {
      console.warn('Audit log failed:', auditError)
    }

    return corsSuccessResponse(data, 200, origin)

  } catch (err) {
    console.error('Edge function error:', err)
    return corsErrorResponse('Error interno del servidor', 500, origin)
  }
}

// Wrap with rate limiting (onboard: 5 req/min per IP)
serve(withRateLimit(handler))