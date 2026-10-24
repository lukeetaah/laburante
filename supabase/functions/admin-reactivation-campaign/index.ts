import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SITE_URL = Deno.env.get('SITE_URL') || 'https://laburante.ar'
const TITLE = 'Volvé a activar tu perfil en LABURANTE'
const MESSAGE = 'Revisá tus servicios y datos, y compartí tu perfil desde LABURANTE para que puedan encontrarte nuevamente.'

function headers(request: Request) {
  const origin = request.headers.get('Origin') || ''
  const allowed = origin === SITE_URL || origin === 'https://laburante.ar' || origin === 'https://www.laburante.ar' || origin.endsWith('.vercel.app')
  return { 'Access-Control-Allow-Origin': allowed ? origin : SITE_URL, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
}
function json(request: Request, body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: headers(request) }) }
function validUuid(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }

async function getCandidates(admin: ReturnType<typeof createClient>) {
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (authError) throw new Error('auth_users_unavailable')
  const users = (authData.users || []).filter((user) => {
    if (!user.email_confirmed_at || user.deleted_at) return false
    if ((user.app_metadata as Record<string, unknown>)?.role === 'admin') return false
    const age = Date.now() - new Date(user.created_at).getTime()
    return age >= 30 * 24 * 60 * 60 * 1000
  })
  const ids = users.map((user) => user.id)
  if (!ids.length) return []
  const [{ data: profiles }, { data: activity }, { data: preferences }] = await Promise.all([
    admin.from('profiles').select('id, slug, status').in('id', ids),
    admin.from('user_activity').select('user_id, last_activity_at').in('user_id', ids),
    admin.from('notification_preferences').select('user_id, email_notifications_enabled').in('user_id', ids),
  ])
  const profileById = new Map((profiles || []).map((profile: any) => [profile.id, profile]))
  const activityById = new Map((activity || []).map((row: any) => [row.user_id, row.last_activity_at]))
  const prefById = new Map((preferences || []).map((row: any) => [row.user_id, row.email_notifications_enabled !== false]))
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  return users.flatMap((user) => {
    const profile = profileById.get(user.id)
    if (!profile || ['suspendido', 'eliminado'].includes(profile.status)) return []
    const lastActive = activityById.get(user.id)
    const signInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0
    const activityAt = lastActive ? new Date(lastActive).getTime() : 0
    if (Math.max(signInAt, activityAt) > cutoff) return []
    return [{ id: user.id, slug: profile.slug, activitySnapshot: lastActive || user.last_sign_in_at || user.created_at, emailEnabled: prefById.get(user.id) !== false }]
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: headers(request) })
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json(request, { error: 'server_configuration_error' }, 503)
  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) return json(request, { error: 'unauthorized' }, 401)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json(request, { error: 'unauthorized' }, 401)
  if ((authData.user.app_metadata as Record<string, unknown>)?.role !== 'admin') return json(request, { error: 'unauthorized_admin_access' }, 403)
  let body: { mode?: unknown; campaign_id?: unknown; send_email?: unknown }
  try { body = await request.json() } catch { return json(request, { error: 'invalid_json' }, 400) }
  const mode = body.mode === 'send' ? 'send' : 'preview'
  const campaignId = validUuid(body.campaign_id) ? body.campaign_id : crypto.randomUUID()
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const candidates = await getCandidates(admin)
    const emailCount = candidates.filter((candidate) => candidate.emailEnabled).length
    const result = { campaign_id: campaignId, mode, title: TITLE, message: MESSAGE, link: '/crear-perfil', eligible: candidates.length, channels: { in_app: candidates.length, email: emailCount, email_excluded_by_preference: candidates.length - emailCount, push: 0 }, excluded: { recently_active_or_never_inactive: 0, suspended_or_missing_profile: 0, unconfirmed_or_admin: 0 } }
    if (mode === 'preview') return json(request, result)

    let created = 0
    let alreadyProcessed = 0
    let emailRequested = 0
    let emailSkipped = 0
    for (const candidate of candidates) {
      const dedupeKey = `reactivation:${campaignId}:${candidate.id}`
      let wasAlreadyProcessed = false
      const inserted = await admin.from('notifications').insert({ user_id: candidate.id, created_by: authData.user.id, dedupe_key: dedupeKey, title: TITLE, message: MESSAGE, type: 'system', link: '/crear-perfil' }).select('id').maybeSingle()
      let notificationId = inserted.data?.id as string | undefined
      if (inserted.error) {
        const existing = await admin.from('notifications').select('id').eq('dedupe_key', dedupeKey).maybeSingle()
        notificationId = existing.data?.id
        if (!notificationId) continue
        alreadyProcessed++
        wasAlreadyProcessed = true
      } else {
        created++
      }
      const reminder = await admin.from('inactive_user_reminders').insert({ user_id: candidate.id, notification_id: notificationId, activity_snapshot: candidate.activitySnapshot, status: 'sent', sent_at: new Date().toISOString() })
      if (reminder.error && !String(reminder.error.message || '').toLowerCase().includes('duplicate')) {
        await admin.from('inactive_user_reminders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('notification_id', notificationId)
      }
      if (candidate.emailEnabled && body.send_email !== false && !wasAlreadyProcessed) {
        emailRequested++
        const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ notification_id: notificationId }) })
        if (!emailResponse.ok) emailSkipped++
      }
    }
    return json(request, { ...result, result: { created, already_processed: alreadyProcessed, email_requested: emailRequested, email_failed_or_skipped: emailSkipped } })
  } catch (error) {
    console.error('reactivation_campaign_failed', { message: error instanceof Error ? error.message : 'unknown' })
    return json(request, { error: 'campaign_unavailable' }, 502)
  }
})

