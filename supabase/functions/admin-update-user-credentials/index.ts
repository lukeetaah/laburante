import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateCredentialUpdate } from './validation.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SITE_URL = Deno.env.get('SITE_URL') || 'https://laburante.ar'

function headers(request: Request) {
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

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: headers(request) })
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(request, { error: 'server_configuration_error' }, 503)
  }

  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) return json(request, { error: 'unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json(request, { error: 'unauthorized' }, 401)
  if ((authData.user.app_metadata as Record<string, unknown>)?.role !== 'admin') {
    return json(request, { error: 'unauthorized_admin_access' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json(request, { error: 'invalid_json' }, 400)
  }

  const update = validateCredentialUpdate(body)
  if (update.error === 'invalid_target_user') return json(request, { error: update.error }, 400)
  if (update.error === 'missing_credential_change') return json(request, { error: update.error }, 400)
  if (update.error === 'weak_password') return json(request, { error: update.error }, 400)

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const attributes: Record<string, unknown> = {}
  if (update.email) {
    attributes.email = update.email
    // Preserve the existing administrative behavior: an administrator
    // explicitly changing access confirms the replacement email.
    attributes.email_confirm = true
  }
  if (update.password) attributes.password = update.password

  const { error } = await adminClient.auth.admin.updateUserById(update.targetUserId, attributes)
  if (error) {
    // Do not return provider details, email addresses, or credential data.
    console.error('admin_update_user_credentials_failed', { code: error.code || 'auth_admin_error' })
    return json(request, { error: 'credential_update_failed' }, 502)
  }

  return json(request, {
    success: true,
    email_updated: Boolean(update.email),
    password_updated: Boolean(update.password),
  })
})
