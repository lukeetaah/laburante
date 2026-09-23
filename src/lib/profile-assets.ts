import { supabase } from '@/lib/supabase'

const LEGACY_PUBLIC_PROFILE_ASSETS_MARKER = '/storage/v1/object/public/profile-assets/'

function getLegacyProfileAssetPath(value: string) {
  const markerIndex = value.indexOf(LEGACY_PUBLIC_PROFILE_ASSETS_MARKER)
  if (markerIndex < 0) return null
  const path = value.slice(markerIndex + LEGACY_PUBLIC_PROFILE_ASSETS_MARKER.length).split('?')[0]
  return path || null
}
/**
 * Legacy profile-assets contains old photos and old CVs. The bucket is now
 * private, so old photos need a short-lived signed URL to keep existing
 * profiles visible without making legacy CVs public again.
 */
export async function resolveProfilePhotoUrl(value?: string | null) {
  if (!value) return null
  const legacyPath = getLegacyProfileAssetPath(value)
  if (!legacyPath) return value

  const { data, error } = await supabase.storage
    .from('profile-assets')
    .createSignedUrl(legacyPath, 60 * 60)

  return error ? null : data?.signedUrl || null
}

export async function getAuthorizedResumeUrl(profileId: string) {
  const { data, error } = await (supabase.rpc as any)('get_profile_resume_access', {
    target_profile_id: profileId,
  })
  if (error) return { url: null, fileName: null, error: error.message }

  const access = Array.isArray(data) ? data[0] : data
  if (!access?.bucket_id || !access?.object_path) {
    return { url: null, fileName: access?.file_name || null, error: null }
  }

  const signed = await supabase.storage
    .from(access.bucket_id)
    .createSignedUrl(access.object_path, 5 * 60)
  if (signed.error) return { url: null, fileName: access.file_name || null, error: signed.error.message }
  return { url: signed.data?.signedUrl || null, fileName: access.file_name || null, error: null }
}
