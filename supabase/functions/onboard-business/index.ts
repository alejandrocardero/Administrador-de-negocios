import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

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

    // Validaciones
    if (!nombre || !slug || !jefe_nombre || !jefe_email || !jefe_password) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos obligatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar roles requeridos
    const requiredRoles = ['admin', 'comprador', 'vendedor']
    for (const role of requiredRoles) {
      if (!roles?.[role]?.username || !roles?.[role]?.password || !roles?.[role]?.nombre) {
        return new Response(
          JSON.stringify({ error: `Faltan credenciales para rol ${role}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Verificar slug único
    const { data: existingSlug } = await supabaseAdmin
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingSlug) {
      return new Response(
        JSON.stringify({ error: 'El nombre corto (slug) ya está en uso' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Llamar función RPC de onboarding atómico
    const { data, error } = await supabaseAdmin.rpc('onboard_business', {
      p_nombre: nombre,
      p_slug: slug,
      p_nit: nit || '',
      p_direccion: direccion || '',
      p_telefono: telefono || '',
      p_email: email || '',
      p_regimen: regimen || 'simplificado',
      p_tarifa_iva: tarifa_iva || 19,
      p_moneda: moneda || 'COP',
      p_jefe_nombre: jefe_nombre,
      p_jefe_email: jefe_email,
      p_jefe_password: jefe_password,
      p_roles_json: roles
    })

    if (error) {
      console.error('Onboard error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})