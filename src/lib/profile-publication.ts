import type { ProfileWithDetails } from '@/stores/profile-store'
import { getProfileCompletion } from '@/lib/profile-completion'

export type ProfileIntent = 'buscar' | 'ofrecer' | 'ambas'

export function normalizeProfileIntent(value: unknown): ProfileIntent | null {
  return value === 'buscar' || value === 'ofrecer' || value === 'ambas' ? value : null
}

export function hasProviderContent(profile: Pick<ProfileWithDetails, 'skills' | 'services'>) {
  return Boolean(profile.skills?.length || profile.services?.length)
}

export function isProviderProfile(profile: Pick<ProfileWithDetails, 'account_type' | 'status' | 'intent' | 'name' | 'bio' | 'provincia' | 'localidad' | 'modalidad' | 'disponibilidad' | 'photo_url' | 'resume_url' | 'skills' | 'services' | 'contact_methods'>) {
  const intent = normalizeProfileIntent(profile.intent)
  const hasProviderIntent = intent === null ? hasProviderContent(profile) : intent !== 'buscar'

  return profile.status === 'activo'
    && profile.account_type !== 'empresa'
    && hasProviderIntent
    && getProfileCompletion(profile) === 100
}
