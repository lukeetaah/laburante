import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') || ''
const SITE_URL = Deno.env.get('SITE_URL') || 'https://laburante.ar'

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, baggage, traceparent, tracestate, sentry-trace, x-cron-secret',
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

  // Validar autorización: o bien CRON_SECRET en cabecera, o bien JWT de Admin
  const authHeader = req.headers.get('Authorization') || ''
  const cronHeader = req.headers.get('x-cron-secret') || ''
  let authorized = false

  if (CRON_SECRET && (cronHeader === CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`)) {
    authorized = true
  } else if (authHeader.startsWith('Bearer ')) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData } = await userClient.auth.getUser()
    const role = (authData?.user?.app_metadata as Record<string, unknown>)?.role
    if (role === 'admin') {
      authorized = true
    }
  }

  if (!authorized) {
    return jsonResponse({ error: 'unauthorized' }, 403, origin)
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Obtener configuración operativa de admin_settings
  const { data: settingsData } = await adminClient
    .from('admin_settings')
    .select('key, value')
    .in('key', ['email_reminders_enabled', 'email_reminders_max_count'])

  const settingsMap = new Map((settingsData || []).map((s: { key: string; value: string }) => [s.key, s.value]))
  const remindersEnabled = settingsMap.get('email_reminders_enabled') !== 'false'
  const maxReminders = Math.max(1, Math.min(5, Number(settingsMap.get('email_reminders_max_count') || 2)))

  if (!remindersEnabled) {
    return jsonResponse({
      ok: true,
      status: 'skipped',
      reason: 'email_reminders_disabled_in_settings',
      processed: 0,
    }, 200, origin)
  }

  // 2. Ejecutar RPC unificada de candidatos a recordatorio
  // La consulta filtra cuentas sin confirmar, sin actividad, con automatic_reminder_count < maxReminders
  const { data: unconfirmedList, error: listError } = await adminClient.rpc('admin_get_auth_users_verification_status', {
    p_filter: 'esperando',
  })

  if (listError || !Array.isArray(unconfirmedList)) {
    return jsonResponse({
      error: 'failed_to_fetch_unconfirmed_users',
      details: listError?.message,
    }, 500, origin)
  }

  const now = Date.now()
  const eligibleUsers = unconfirmedList.filter((user: any) => {
    // Excluir si ya fue confirmado
    if (user.email_confirmed_at) return false
    // Excluir si ya completó el cupo de recordatorios automáticos
    if ((user.automatic_reminder_count || 0) >= maxReminders) return false
    // Excluir si está marcado como excluido por actividad
    if (user.status === 'excluido_actividad') return false

    // Verificar ventana de recordatorio (ej. 7 días tras alta o 7 días tras el último recordatorio)
    const daysSinceCreation = user.days_elapsed || 0
    if (daysSinceCreation < 7) return false

    if (user.last_automatic_reminder_at) {
      const daysSinceLastAuto = (now - new Date(user.last_automatic_reminder_at).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceLastAuto < 6) return false // ventana de seguridad de al menos 6 días
    }

    return true
  }).slice(0, 50) // Procesamiento en lote de hasta 50 por ejecución para control estricto

  let sentCount = 0
  let skippedCount = 0
  const errors: Array<{ user_id: string; error: string }> = []

  const redirectUrl = `${SITE_URL}/ingresar?confirmado=1`

  for (const candidate of eligibleUsers) {
    try {
      // Reclamación inmediata en DB para evitar condiciones de carrera entre ejecuciones simultáneas
      const newAutoCount = (candidate.automatic_reminder_count || 0) + 1
      const { error: claimError } = await adminClient
        .from('account_confirmation_tracking')
        .upsert({
          user_id: candidate.user_id,
          email: candidate.email,
          automatic_reminder_count: newAutoCount,
          last_automatic_reminder_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (claimError) {
        skippedCount++
        continue
      }

      // Enviar confirmación vía Supabase Auth nativo
      const { error: sendError } = await adminClient.auth.resend({
        type: 'signup',
        email: candidate.email,
        options: { emailRedirectTo: redirectUrl },
      })

      if (sendError) {
        errors.push({ user_id: candidate.user_id, error: sendError.message })
        // Revertir contador de recordatorio si falló el envío
        await adminClient
          .from('account_confirmation_tracking')
          .update({
            automatic_reminder_count: candidate.automatic_reminder_count || 0,
            last_resend_error: sendError.message,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', candidate.user_id)
      } else {
        sentCount++
      }
    } catch (err: any) {
      errors.push({ user_id: candidate.user_id, error: err.message || String(err) })
    }
  }

  return jsonResponse({
    ok: true,
    total_candidates: eligibleUsers.length,
    sent: sentCount,
    skipped: skippedCount,
    errors_count: errors.length,
    errors: errors.slice(0, 5),
  }, 200, origin)
  } catch (err: any) {
    return jsonResponse({
      error: 'internal_server_error',
      message: err.message || 'Error inesperado en Edge Function.',
    }, 500, origin)
  }
})
