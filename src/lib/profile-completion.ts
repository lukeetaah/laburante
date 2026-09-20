import { normalizeProfileIntent } from '@/lib/profile-publication'

export interface ProfileCompletionInput {
  name?: string | null
  bio?: string | null
  provincia?: string | null
  localidad?: string | null
  modalidad?: string | null
  disponibilidad?: string | null
  photo_url?: string | null
  resume_url?: string | null
  skills?: unknown[] | null
  services?: unknown[] | null
  contact_methods?: unknown[] | null
  intent?: unknown
}

export function getProfileCompletion(profile: ProfileCompletionInput) {
  const intent = normalizeProfileIntent(profile.intent)

  // Base checks everyone needs
  const checks: boolean[] = [
    Boolean(profile.name?.trim()),
    Boolean(profile.bio?.trim()),
    Boolean(profile.provincia?.trim() && profile.localidad?.trim()),
    Boolean(profile.contact_methods?.length),
  ]

  if (intent === 'buscar') {
    // Seekers only need basic identity + contact; skills/services/photo are irrelevant
    checks.push(Boolean(profile.modalidad))
  } else {
    // Providers ('ofrecer', 'ambas', or legacy null) keep all original checks
    checks.push(
      Boolean(profile.modalidad),
      Boolean(profile.disponibilidad),
      Boolean(profile.skills?.length || profile.services?.length),
      Boolean(profile.photo_url || profile.resume_url),
    )
  }

  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
