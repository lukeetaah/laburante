import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SITE_URL = Deno.env.get('SITE_URL') || 'https://laburante.ar'

function cors(request: Request) {
  const origin = request.headers.get('Origin') || ''
  const allowed = origin === SITE_URL || origin === 'https://laburante.ar' || origin === 'https://www.laburante.ar' || origin.endsWith('.vercel.app')
  return {
    'Access-Control-Allow-Origin': allowed ? origin : SITE_URL,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, max-age=0',
  }
}

function response(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(request) })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(request) })
  if (request.method !== 'POST') return response(request, { error: 'method_not_allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return response(request, { error: 'server_configuration_error' }, 503)

  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) return response(request, { error: 'unauthorized' }, 401)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return response(request, { error: 'unauthorized' }, 401)
  if ((authData.user.app_metadata as Record<string, unknown>)?.role !== 'admin') return response(request, { error: 'unauthorized_admin_access' }, 403)

  let body: { profile_ids?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return response(request, { error: 'invalid_json' }, 400)
  }
  const profileIds = Array.isArray(body.profile_ids) ? body.profile_ids : []
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (profileIds.length > 10000 || profileIds.some((value) => typeof value !== 'string' || !uuidPattern.test(value))) {
    return response(request, { error: 'invalid_profile_ids' }, 400)
  }
  if (profileIds.length === 0) return response(request, { status: 'ok', users: [], total: 0 })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: activityRows, error: activityError } = await admin.rpc('admin_get_last_sign_in_at', { target_user_ids: profileIds })
  if (activityError || !Array.isArray(activityRows)) return response(request, { error: 'auth_users_unavailable' }, 502)
  const activityById = new Map(activityRows.map((row: any) => [row.user_id, row.last_sign_in_at]))
  const users = profileIds.map((id) => {
    const rawLastSignIn = activityById.get(id) ?? null
    const validLastSignIn = typeof rawLastSignIn === 'string' && Number.isFinite(Date.parse(rawLastSignIn))
    return {
      id,
      last_sign_in_at: validLastSignIn ? rawLastSignIn : null,
      last_sign_in_status: !activityById.has(id)
        ? 'user_not_found'
        : rawLastSignIn === null
          ? 'never'
          : validLastSignIn
            ? 'available'
            : 'invalid_response',
    }
  })
  return response(request, { status: 'ok', users, total: users.length })
})

