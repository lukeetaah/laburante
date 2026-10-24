import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const MAX_BYTES = 5 * 1024 * 1024
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function extension(type: string) {
  return type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : null
}

function hasSignature(bytes: Uint8Array, type: string) {
  if (type === 'image/png') return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === 'image/webp') return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  return false
}

function response(request: Request, body: Record<string, unknown>, status = 200) {
  const origin = request.headers.get('Origin') || ''
  const site = Deno.env.get('SITE_URL') || 'https://laburante.ar'
  const allowedOrigin = origin === site || origin === 'https://laburante.ar' || origin === 'https://www.laburante.ar' || origin.endsWith('.vercel.app')
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin ? origin : site,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return response(request, { ok: true })
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

  let form: FormData
  try { form = await request.formData() } catch { return response(request, { error: 'invalid_form' }, 400) }
  const ticketId = form.get('ticket_id')
  const requestId = form.get('upload_request_id')
  const file = form.get('file')
  if (!validUuid(ticketId) || !validUuid(requestId) || !(file instanceof File)) return response(request, { error: 'invalid_upload' }, 400)
  if (!TYPES.has(file.type) || !extension(file.type) || file.size < 1 || file.size > MAX_BYTES) return response(request, { error: 'unsupported_image' }, 400)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!hasSignature(bytes, file.type)) return response(request, { error: 'invalid_image_content' }, 400)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: requestRow, error: requestError } = await admin
    .from('support_upload_requests')
    .select('id, ticket_id, user_id, status, expires_at')
    .eq('id', requestId)
    .eq('ticket_id', ticketId)
    .eq('user_id', authData.user.id)
    .maybeSingle()
  if (requestError || !requestRow || requestRow.status !== 'vigente' || new Date(requestRow.expires_at).getTime() <= Date.now()) return response(request, { error: 'upload_not_authorized' }, 403)

  const path = `${ticketId}/${requestId}.${extension(file.type)}`
  const uploaded = await admin.storage.from('support-attachments').upload(path, file, { contentType: file.type, upsert: false })
  if (uploaded.error) return response(request, { error: 'attachment_storage_failed' }, 502)

  const consumed = await userClient.rpc('consume_support_upload', {
    p_ticket_id: ticketId,
    p_upload_request_id: requestId,
    p_storage_path: path,
    p_original_name: file.name || 'adjunto',
    p_mime_type: file.type,
    p_size_bytes: file.size,
  })
  if (consumed.error) {
    await admin.storage.from('support-attachments').remove([path])
    return response(request, { error: 'attachment_registration_failed' }, 409)
  }
  return response(request, { attachment_id: consumed.data?.id || null, stored: true })
})

