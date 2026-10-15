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
  account_type?: string | null
}

export function getProfileCompletion(profile: ProfileCompletionInput): number {
  if (profile.account_type === 'empresa') {
    // Las cuentas empresa tienen ciclo de información corporativa
    const companyChecks: boolean[] = [
      Boolean(profile.name?.trim()),
      Boolean(profile.provincia?.trim() && profile.localidad?.trim()),
      Boolean(profile.contact_methods?.length),
      Boolean(profile.bio?.trim()),
      Boolean(profile.photo_url),
    ]
    return Math.round((companyChecks.filter(Boolean).length / companyChecks.length) * 100)
  }

  const intent = normalizeProfileIntent(profile.intent)

  // Base checks obligatorios para toda cuenta de persona
  const checks: boolean[] = [
    Boolean(profile.name?.trim()),
    Boolean(profile.bio?.trim()),
    Boolean(profile.provincia?.trim() && profile.localidad?.trim()),
    Boolean(profile.contact_methods?.length),
  ]

  if (intent === 'buscar') {
    // Quienes sólo buscan trabajo necesitan identidad, ubicación y contacto; habilidades/foto son opcionales
    checks.push(Boolean(profile.modalidad))
  } else {
    // Prestadores ('ofrecer', 'ambas' o por defecto)
    checks.push(
      Boolean(profile.modalidad),
      Boolean(profile.disponibilidad),
      Boolean(profile.skills?.length || profile.services?.length),
      Boolean(profile.photo_url || profile.resume_url),
    )
  }

  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

/**
 * Determina si el perfil cuenta con todos los campos indispensables
 * para estar operativo y ser contactable (independientemente de que
 * tenga campos opcionales como foto o CV pendientes de carga).
 */
export function isProfileOperationallyComplete(profile: ProfileCompletionInput): boolean {
  const hasBase = Boolean(
    profile.name?.trim() &&
    profile.provincia?.trim() &&
    profile.localidad?.trim() &&
    Boolean(profile.contact_methods?.length)
  )
  if (!hasBase) return false

  if (profile.account_type === 'empresa') {
    return true
  }

  const intent = normalizeProfileIntent(profile.intent)
  if (intent === 'buscar') {
    return Boolean(profile.modalidad)
  }

  // Prestadores individuales requieren además definir modalidad y al menos 1 habilidad o servicio
  return Boolean(
    profile.modalidad &&
    (Boolean(profile.skills?.length) || Boolean(profile.services?.length))
  )
}
