import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SITE_URL = Deno.env.get('SITE_URL') || 'https://laburante.ar'

const JURISDICTIONS = [
  ['AR-B', 'Buenos Aires', ['buenos aires']],
  ['AR-C', 'CABA', ['caba', 'ciudad autonoma de buenos aires']],
  ['AR-K', 'Catamarca', ['catamarca']],
  ['AR-H', 'Chaco', ['chaco']],
  ['AR-U', 'Chubut', ['chubut']],
  ['AR-X', 'Córdoba', ['cordoba']],
  ['AR-W', 'Corrientes', ['corrientes']],
  ['AR-E', 'Entre Ríos', ['entre rios']],
  ['AR-P', 'Formosa', ['formosa']],
  ['AR-Y', 'Jujuy', ['jujuy']],
  ['AR-L', 'La Pampa', ['la pampa']],
  ['AR-F', 'La Rioja', ['la rioja']],
  ['AR-M', 'Mendoza', ['mendoza']],
  ['AR-N', 'Misiones', ['misiones']],
  ['AR-Q', 'Neuquén', ['neuquen']],
  ['AR-R', 'Río Negro', ['rio negro']],
  ['AR-A', 'Salta', ['salta']],
  ['AR-J', 'San Juan', ['san juan']],
  ['AR-D', 'San Luis', ['san luis']],
  ['AR-Z', 'Santa Cruz', ['santa cruz']],
  ['AR-S', 'Santa Fe', ['santa fe']],
  ['AR-G', 'Santiago del Estero', ['santiago del estero']],
  ['AR-V', 'Tierra del Fuego', ['tierra del fuego', 'tierra del fuego antartida e islas del atlantico sur']],
  ['AR-T', 'Tucumán', ['tucuman']],
] as const

function headers(request: Request) {
  const origin = request.headers.get('Origin') || ''
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  const isPreviewOrigin = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
  const allowedOrigin = [SITE_URL, 'https://laburante.ar', 'https://www.laburante.ar'].includes(origin) || isLocalOrigin || isPreviewOrigin ? origin : SITE_URL
  return { 'Access-Control-Allow-Origin': allowedOrigin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' }
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) })
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

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin.rpc('admin_get_profile_presence_counts')
  if (error || !Array.isArray(data) || data.length !== JURISDICTIONS.length) return json(request, { error: 'presence_data_unavailable' }, 502)
  const rows = data as Array<{ code: string; name: string; profile_count: number; total_profiles: number; unmapped_profiles: number }>
  const expectedCodes = new Set(JURISDICTIONS.map(([code]) => code))
  if (rows.some((row) => !expectedCodes.has(row.code) || !Number.isFinite(Number(row.profile_count)))) {
    return json(request, { error: 'presence_data_invalid' }, 502)
  }
  const firstTotals = rows[0]

  return json(request, {
    jurisdictions: rows.map((row) => ({ code: row.code, name: row.name, count: Number(row.profile_count) })),
    total_profiles: Number(firstTotals.total_profiles) - Number(firstTotals.unmapped_profiles),
    unmapped_profiles: Number(firstTotals.unmapped_profiles),
  })
})
