import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const SITE_URL = Deno.env.get('SITE_URL') || 'https://laburante.ar'
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'notificaciones@laburante.ar'
const REPLY_TO = Deno.env.get('RESEND_REPLY_TO') || 'admin@laburante.ar'
function parsePositiveLimit(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const MONTHLY_LIMIT = parsePositiveLimit(Deno.env.get('EMAIL_MONTHLY_LIMIT'), 500)
const DAILY_LIMIT = parsePositiveLimit(Deno.env.get('EMAIL_DAILY_LIMIT'), 50)
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

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || ''
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : SITE_URL,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, baggage, traceparent, tracestate, sentry-trace',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}

const PREFERENCES_TABLE_MISSING_RE = /relation .*notification_preferences.*does not exist|Could not find the table .*notification_preferences|schema cache.*notification_preferences/i

const allowedTypes = new Set(['job', 'budget', 'status', 'review', 'system'])
const typeLabels: Record<string, string> = {
  job: 'Novedad sobre un pedido',
  budget: 'Novedad sobre un presupuesto',
  status: 'Actualización de una actividad',
  review: 'Nueva reseña para revisar',
  system: 'Aviso importante de LABURANTE',
}

type Notification = {
  id: string
  user_id: string
  created_by: string | null
  title: string
  message: string
  type: string
  link: string | null
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeAppLink(link: string | null) {
  if (!link) return null
  try {
    const url = new URL(link, SITE_URL)
    const site = new URL(SITE_URL)
    return url.origin === site.origin ? url.toString() : null
  } catch {
    return null
  }
}

function emailHtml(notification: Notification, link: string | null) {
  const label = typeLabels[notification.type] || typeLabels.system
  const title = escapeHtml(notification.title.slice(0, 180))
  const message = escapeHtml(notification.message.slice(0, 2400))
  const cta = link
    ? `<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#202936;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Ver en LABURANTE</a></p>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#f5f5f0;color:#202936;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:28px 18px"><div style="background:#fff;border:1px solid #e4e4dc;border-radius:12px;padding:28px"><p style="margin:0 0 20px;font-size:12px;font-weight:700;letter-spacing:.08em">LABURANTE</p><p style="margin:0 0 10px;color:#5b6470;font-size:13px">${escapeHtml(label)}</p><h1 style="margin:0;font-size:22px;line-height:1.25">${title}</h1><p style="margin:16px 0 0;font-size:15px;line-height:1.6">${message}</p>${cta}</div><p style="margin:16px 4px 0;color:#6b7280;font-size:11px;line-height:1.5">Recibís este email porque tenés activadas las notificaciones de LABURANTE. Podés desactivarlas desde tu perfil.</p></div></body></html>`
}

async function updateDelivery(admin: ReturnType<typeof createClient>, notificationId: string, values: Record<string, unknown>) {
  await admin.from('notification_email_deliveries').update({ ...values, updated_at: new Date().toISOString() }).eq('notification_id', notificationId)
}

async function isValidNotificationContext(admin: ReturnType<typeof createClient>, notification: Notification, actor: { id: string; app_metadata?: Record<string, unknown> }) {
  if (notification.link === '/crear-perfil') {
    if (actor.app_metadata?.role !== 'admin') return false
    const { data: targetProfile } = await admin.from('profiles').select('id').eq('id', notification.user_id).maybeSingle()
    return Boolean(targetProfile)
  }
  if (notification.link === '/admin') {
    return actor.app_metadata?.role === 'admin' && notification.type === 'system'
  }
  if (!notification.link) return false

  let url: URL
  try {
    url = new URL(notification.link, SITE_URL)
  } catch {
    return false
  }
  if (url.origin !== new URL(SITE_URL).origin) return false

  const jobId = url.searchParams.get('pedido')
  if (jobId && url.pathname === '/mis-trabajos') {
    const { data: job } = await admin.from('job_requests').select('client_id, profile_id').eq('id', jobId).maybeSingle()
    if (!job) return false
    const participants = [job.client_id, job.profile_id]
    return participants.includes(actor.id) && participants.includes(notification.user_id)
  }

  const inquiryId = url.searchParams.get('seleccion')
  if (inquiryId && (url.pathname === '/empresa' || url.pathname === '/mis-trabajos')) {
    const { data: inquiry } = await admin.from('company_candidate_inquiries').select('company_id, profile_id').eq('id', inquiryId).maybeSingle()
    if (!inquiry) return false
    const participants = [inquiry.company_id, inquiry.profile_id]
    return participants.includes(actor.id) && participants.includes(notification.user_id)
  }

  const sharedOpportunityId = url.searchParams.get('oportunidad-compartida')
  if (sharedOpportunityId && url.pathname === '/empresa') {
    const { data: share } = await admin.from('company_opportunity_shares').select('source_company_id, recipient_company_id').eq('id', sharedOpportunityId).maybeSingle()
    return Boolean(share && share.source_company_id === actor.id && share.recipient_company_id === notification.user_id)
  }

  const opportunityId = url.searchParams.get('oportunidad')
  if (opportunityId && url.pathname === '/empresa') {
    const { data: share } = await admin.from('company_opportunity_shares').select('source_company_id, recipient_company_id').eq('opportunity_id', opportunityId).eq('recipient_company_id', actor.id).maybeSingle()
    return Boolean(share && share.source_company_id === notification.user_id)
  }

  if (url.pathname.startsWith('/p/')) {
    const slug = decodeURIComponent(url.pathname.slice(3))
    const { data: profile } = await admin.from('profiles').select('id, whatsapp_verified').eq('slug', slug).maybeSingle()
    if (!profile || profile.id !== notification.user_id) return false
    if (url.hash === '#resenas') {
      const { data: review } = await admin.from('recommendations').select('id').eq('to_profile_id', profile.id).eq('from_user_id', actor.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      return Boolean(review)
    }
    return actor.id === profile.id && profile.whatsapp_verified === true
  }

  return false
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json(request, { error: 'email_service_unavailable' }, 503)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json(request, { error: 'unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json(request, { error: 'unauthorized' }, 401)

  let body: { notification_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return json(request, { error: 'invalid_json' }, 400)
  }
  const notificationId = typeof body.notification_id === 'string' ? body.notification_id : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(notificationId)) {
    return json(request, { error: 'invalid_notification_id' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: notification, error: notificationError } = await admin
    .from('notifications')
    .select('id, user_id, created_by, title, message, type, link')
    .eq('id', notificationId)
    .maybeSingle() as { data: Notification | null; error: { message: string } | null }

  if (notificationError || !notification || notification.created_by !== authData.user.id) {
    return json(request, { error: 'notification_not_found' }, 404)
  }
  if (!allowedTypes.has(notification.type)) return json(request, { error: 'notification_type_not_allowed' }, 400)
  if (!await isValidNotificationContext(admin, notification, authData.user)) {
    console.warn('notification_email_invalid_context', { notificationId })
    return json(request, { ok: true, status: 'skipped', reason: 'invalid_context' })
  }

  const { data: claimData, error: claimError } = await admin.rpc('claim_notification_email_delivery', {
    notification_id_value: notificationId,
    recipient_user_id_value: notification.user_id,
  })
  if (claimError) {
    console.error('notification_email_claim_failed', { notificationId })
    return json(request, { error: 'delivery_unavailable' }, 503)
  }
  const claim = Array.isArray(claimData) ? claimData[0] : claimData
  if (!claim?.claimed) return json(request, { ok: true, status: claim?.status || 'already_processing' })

  const { data: preference, error: preferenceError } = await admin
    .from('notification_preferences')
    .select('email_notifications_enabled')
    .eq('user_id', notification.user_id)
    .maybeSingle()
  if (preferenceError && !PREFERENCES_TABLE_MISSING_RE.test(preferenceError.message || '')) {
    await updateDelivery(admin, notificationId, { status: 'failed', error_code: 'preferences_unavailable' })
    return json(request, { error: 'email_service_unavailable' }, 503)
  }
  if (preference?.email_notifications_enabled === false) {
    await updateDelivery(admin, notificationId, { status: 'skipped', error_code: 'preference_disabled' })
    return json(request, { ok: true, status: 'skipped', reason: 'preference_disabled' })
  }

  const { data: recipientData, error: recipientError } = await admin.auth.admin.getUserById(notification.user_id)
  const recipientEmail = recipientData?.user?.email
  if (recipientError || !recipientEmail) {
    await updateDelivery(admin, notificationId, { status: 'skipped', error_code: 'recipient_email_unavailable' })
    return json(request, { ok: true, status: 'skipped', reason: 'recipient_email_unavailable' })
  }

  if (!RESEND_API_KEY) {
    await updateDelivery(admin, notificationId, { status: 'failed', error_code: 'resend_key_missing' })
    return json(request, { error: 'email_service_unavailable' }, 503)
  }

  const { data: quotaData, error: quotaError } = await admin.rpc('reserve_notification_email_quota', {
    daily_limit_value: DAILY_LIMIT,
    monthly_limit_value: MONTHLY_LIMIT,
  })
  const quota = Array.isArray(quotaData) ? quotaData[0] : quotaData
  if (quotaError || !quota?.allowed) {
    const reason = quota?.reason || 'rate_limit_unavailable'
    await updateDelivery(admin, notificationId, { status: 'skipped', error_code: reason })
    return json(request, { ok: true, status: 'skipped', reason })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Idempotency-Key': `notification/${notificationId}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [recipientEmail],
      reply_to: REPLY_TO,
      subject: `LABURANTE · ${typeLabels[notification.type] || typeLabels.system}`,
      html: emailHtml(notification, safeAppLink(notification.link)),
    }),
  })

  if (!response.ok) {
    const errorCode = `resend_http_${response.status}`
    await updateDelivery(admin, notificationId, { status: 'failed', error_code: errorCode })
    console.error('notification_email_send_failed', { notificationId, errorCode })
    return json(request, { error: 'email_send_failed' }, 502)
  }

  const resendResult = await response.json().catch(() => ({}))
  await updateDelivery(admin, notificationId, {
    status: 'sent',
    resend_id: typeof resendResult?.id === 'string' ? resendResult.id : null,
    error_code: null,
    sent_at: new Date().toISOString(),
  })
  return json(request, { ok: true, status: 'sent' })
})
