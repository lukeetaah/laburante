export const CANDIDATE_PROFILE_SELECT = 'id, name, slug, localidad, provincia'
export const CANDIDATE_NAME_FALLBACK = 'Nombre no disponible'
export const COMPANY_PROCESS_STATUSES = ['abierto', 'en_evaluacion', 'contratado', 'no_seleccionado', 'cancelado'] as const
export type CompanyProcessStatus = typeof COMPANY_PROCESS_STATUSES[number]

export type CandidateIdentity = {
  id: string
  name?: string | null
  slug?: string | null
  localidad?: string | null
  provincia?: string | null
  contact_methods?: unknown[]
}

export const getCandidateDisplayName = (profile?: Pick<CandidateIdentity, 'name'> | null) => {
  const name = typeof profile?.name === 'string' ? profile.name.trim() : ''
  return name || CANDIDATE_NAME_FALLBACK
}

const hasName = (profile: CandidateIdentity | undefined) => Boolean(profile && getCandidateDisplayName(profile) !== CANDIDATE_NAME_FALLBACK)

/**
 * Keeps the interaction's profile_id as the only identity key. The secondary
 * read model is only used for missing rows or incomplete names and never
 * broadens the set of requested profile IDs.
 */
export const mergeCandidateIdentities = (
  profileIds: string[],
  primaryProfiles: CandidateIdentity[] = [],
  fallbackProfiles: CandidateIdentity[] = [],
) => {
  const byId = new Map<string, CandidateIdentity>()

  for (const profile of primaryProfiles) {
    if (profile?.id && profileIds.includes(profile.id)) byId.set(profile.id, profile)
  }

  for (const profile of fallbackProfiles) {
    if (!profile?.id || !profileIds.includes(profile.id)) continue
    const current = byId.get(profile.id)
    if (!current || !hasName(current)) byId.set(profile.id, { ...current, ...profile })
  }

  return byId
}

export const inquiryStatusLabel = (status: string | null | undefined) => ({
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  cerrada: 'Cerrada',
}[status || ''] || status || 'Estado no disponible')

export const inquiryStatusClass = (status: string | null | undefined) => ({
  pendiente: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  aceptada: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  rechazada: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200',
  cerrada: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
}[status || ''] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-200')

export const opportunityStatusLabel = (status: string | null | undefined) => ({
  abierta: 'Abierta',
  pausada: 'Pausada',
  cerrada: 'Cerrada',
  nueva: 'Nueva',
  vista: 'Vista',
  interesada: 'Interesada',
  descartada: 'Descartada',
}[status || ''] || status || 'Estado no disponible')

export const opportunityStatusClass = (status: string | null | undefined) => ({
  abierta: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  pausada: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  cerrada: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  nueva: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200',
  vista: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  interesada: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  descartada: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200',
}[status || ''] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-200')

export const processStatusLabel = (status: string | null | undefined) => ({
  abierto: 'Selección abierta',
  en_evaluacion: 'En evaluación',
  contratado: 'Contratado',
  no_seleccionado: 'No seleccionado',
  cancelado: 'Cancelado',
}[status || ''] || status || 'Proceso no disponible')

export const processStatusClass = (status: string | null | undefined) => ({
  abierto: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200',
  en_evaluacion: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  contratado: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  no_seleccionado: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  cancelado: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200',
}[status || ''] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-200')
