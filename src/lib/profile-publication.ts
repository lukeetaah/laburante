import type { ProfileWithDetails } from '@/stores/profile-store'

export type ProfileIntent = 'buscar' | 'ofrecer' | 'ambas'

export function normalizeProfileIntent(value: unknown): ProfileIntent | null {
  return value === 'buscar' || value === 'ofrecer' || value === 'ambas' ? value : null
}

export function hasProviderContent(profile: Pick<ProfileWithDetails, 'skills' | 'services'>) {
  return Boolean(profile.skills?.length || profile.services?.length)
}

// Public eligibility is intentionally separate from profile completion.
// Missing/null intent preserves the legacy active-profile baseline; it is not an
// Ofrecer declaration. New Buscar accounts are kept private by authenticated flows.
export function isProviderProfile(profile: Pick<ProfileWithDetails, 'account_type' | 'status' | 'intent'>) {
  const intent = normalizeProfileIntent(profile.intent)

  return profile.status === 'activo'
    && profile.account_type !== 'empresa'
    && intent !== 'buscar'
}
