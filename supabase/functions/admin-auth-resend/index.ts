import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SITE_URL = Deno.env.get('SITE_URL') || 'https://laburante.ar'

const COOLDOWN_SECONDS = 60

const ALLOWED_ORIGINS = new Set([
  SITE_URL,
  'https://laburante.ar',
  'https://www.laburante.ar',
  'http://localhost:5173',
  'http://localhost:3000',
])

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false
  if (ALLOWED_ORIGINS.has(origin)) return true
  try {
    const url = new URL(origin)
    return (
      url.hostname === 'laburante.ar' ||
      url.hostname.endsWith('.laburante.ar') ||
      url.hostname.endsWith('.vercel.app')
    )
  } catch {
    return false
  }
}

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && isAllowedOrigin(origin) ? origin : SITE_URL
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, baggage, traceparent, tracestate, sentry-trace',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, origin)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'server_configuration_error' }, 503, origin)
    }

  // 1. Validar autenticación de admin llamante
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'unauthorized' }, 401, origin)
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData?.user) {
    return jsonResponse({ error: 'unauthorized' }, 401, origin)
  }

  const actorRole = (authData.user.app_metadata as Record<string, unknown>)?.role
  if (actorRole !== 'admin') {
    return jsonResponse({ error: 'unauthorized_admin_access' }, 403, origin)
  }

  // 2. Parsear y validar payload (solo target_user_id)
  let body: { target_user_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, origin)
  }

  const targetUserId = typeof body.target_user_id === 'string' ? body.target_user_id.trim() : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
    return jsonResponse({ error: 'invalid_user_id' }, 400, origin)
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 3. Obtener el usuario objetivo directamente desde Auth en el server
  const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId)
  if (targetError || !targetData?.user) {
    return jsonResponse({ error: 'user_not_found' }, 404, origin)
  }

  const targetUser = targetData.user
  if (targetUser.email_confirmed_at) {
    return jsonResponse({ error: 'user_already_confirmed' }, 400, origin)
  }

  if (!targetUser.email) {
    return jsonResponse({ error: 'user_has_no_email' }, 400, origin)
  }

  // 4. Validar Cooldown Server-Side (60 segundos)
  const { data: tracking } = await adminClient
    .from('account_confirmation_tracking')
    .select('manual_resend_count, last_manual_resend_at')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (tracking?.last_manual_resend_at) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(tracking.last_manual_resend_at).getTime()) / 1000)
    if (elapsedSeconds < COOLDOWN_SECONDS) {
      const remainingSeconds = COOLDOWN_SECONDS - elapsedSeconds
      return jsonResponse({
        error: 'cooldown_active',
        remaining_seconds: remainingSeconds,
      }, 429, origin)
    }
  }

  // 5. Ejecutar resend nativo dentro de Supabase Auth
  const redirectUrl = `${SITE_URL}/ingresar?confirmado=1`
  const { error: resendError } = await adminClient.auth.resend({
    type: 'signup',
    email: targetUser.email,
    options: {
      emailRedirectTo: redirectUrl,
    },
  })

  if (resendError) {
    // Si falla el resend, registrar el error en tracking sin incrementar envíos exitosos ni aplicar cooldown
    await adminClient
      .from('account_confirmation_tracking')
      .upsert({
        user_id: targetUserId,
        email: targetUser.email,
        last_resend_error: resendError.message,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    return jsonResponse({
      error: 'resend_delivery_failed',
      message: resendError.message,
    }, 502, origin)
  }

  // 6. Si tuvo éxito, registrar en tracking el reenvío manual exitoso y cooldown
  const newManualCount = (tracking?.manual_resend_count || 0) + 1
  await adminClient
    .from('account_confirmation_tracking')
    .upsert({
      user_id: targetUserId,
      email: targetUser.email,
      manual_resend_count: newManualCount,
      last_manual_resend_at: new Date().toISOString(),
      last_resend_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  // 7. Respuesta segura al browser (sin exponer el email)
  return jsonResponse({
    success: true,
    remaining_cooldown: COOLDOWN_SECONDS,
  }, 200, origin)
  } catch (err: any) {
    return jsonResponse({
      error: 'internal_server_error',
      message: err.message || 'Error inesperado en Edge Function.',
    }, 500, origin)
  }
})
