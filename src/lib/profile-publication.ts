import type { ProfileWithDetails } from '@/stores/profile-store'

export type ProfileIntent = 'buscar' | 'ofrecer' | 'ambas'

export function normalizeProfileIntent(value: unknown): ProfileIntent | null {
  return value === 'buscar' || value === 'ofrecer' || value === 'ambas' ? value : null
}

export function hasProviderContent(profile: Pick<ProfileWithDetails, 'skills' | 'services'>) {
  return Boolean(profile.skills?.length || profile.services?.length)
}

// Public eligibility is intentionally separate from profile completion.
// A missing or NULL intent is not an Ofrecer declaration and remains pending
// review until an explicit intent is persisted.
export function isProviderProfile(profile: Pick<ProfileWithDetails, 'account_type' | 'status' | 'intent'>) {
  if (profile.status !== 'activo' || profile.account_type === 'empresa') return false

  const intent = normalizeProfileIntent(profile.intent)
  return intent === 'ofrecer' || intent === 'ambas'
}
