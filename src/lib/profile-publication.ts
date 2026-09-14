import type { ProfileWithDetails } from '@/stores/profile-store'
import { getProfileCompletion } from '@/lib/profile-completion'

export type ProfileIntent = 'buscar' | 'ofrecer' | 'ambas'

// Profiles created before the intent publication rollout need the legacy visibility rule.
const PROFILE_INTENT_ROLLOUT_AT = Date.parse('2026-09-14T20:53:10.000Z')

export function normalizeProfileIntent(value: unknown): ProfileIntent | null {
  return value === 'buscar' || value === 'ofrecer' || value === 'ambas' ? value : null
}

export function hasProviderContent(profile: Pick<ProfileWithDetails, 'skills' | 'services'>) {
  return Boolean(profile.skills?.length || profile.services?.length)
}

function isHistoricalProfile(profile: Pick<ProfileWithDetails, 'created_at'>) {
  const createdAt = Date.parse(profile.created_at)
  return Number.isFinite(createdAt) && createdAt < PROFILE_INTENT_ROLLOUT_AT
}

export function isProviderProfile(profile: Pick<ProfileWithDetails, 'account_type' | 'status' | 'intent' | 'name' | 'bio' | 'provincia' | 'localidad' | 'modalidad' | 'disponibilidad' | 'photo_url' | 'resume_url' | 'skills' | 'services' | 'contact_methods' | 'created_at'>) {
  const intent = normalizeProfileIntent(profile.intent)
  if (intent === 'buscar') return false

  const isHistorical = isHistoricalProfile(profile)
  const hasProfessionalContent = hasProviderContent(profile)

  return profile.status === 'activo'
    && profile.account_type !== 'empresa'
    && hasProfessionalContent
    && (isHistorical || getProfileCompletion(profile) === 100)
}
