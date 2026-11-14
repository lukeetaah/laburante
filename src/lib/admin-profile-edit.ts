/**
 * Helper pure functions for the administrative profile editor.
 * Extracted to ensure complete behavioral unit testing and prevent UI regressions.
 */

export interface AdminProfileLike {
  id: string
  name: string
  bio?: string | null
  provincia?: string | null
  localidad?: string | null
  zona_trabajo?: string | null
  modalidad?: string | null
  hybrid_presencial_pct?: number | null
  hybrid_remoto_pct?: number | null
  disponibilidad?: string | null
  status?: string | null
  intent?: string | null
  account_type?: string | null
  company_plan?: string | null
  skills?: any[]
  services?: any[]
  contact_methods?: any[]
  profile_languages?: any[]
  languages?: any[]
}

export interface AdminEditFormState {
  name?: string
  bio?: string | null
  provincia?: string
  localidad?: string
  zona_trabajo?: string | null
  modalidad?: string
  hybrid_presencial_pct?: number | null
  hybrid_remoto_pct?: number | null
  disponibilidad?: string
  status?: string
  intent?: string | null
  account_type?: string
  company_plan?: string
  skills?: any[]
  services?: any[]
  contact_methods?: any[]
  languages?: any[]
}

export function normalizeOptionalText(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

export function applySkillUpdate(currentSkills: any[] = [], rawValue: string): { skills: any[]; changed: boolean } {
  const name = rawValue.trim()
  if (!name) return { skills: currentSkills, changed: false }

  const skills = [...currentSkills]
  const existingIndex = skills.findIndex(
    (skill: any) => String(skill.name || '').toLowerCase() === name.toLowerCase()
  )

  if (existingIndex >= 0) {
    if (skills[existingIndex].name === name) {
      return { skills, changed: false }
    }
    return {
      skills: skills.map((skill: any, idx: number) =>
        idx === existingIndex ? { ...skill, name } : skill
      ),
      changed: true,
    }
  }

  return {
    skills: [...skills, { name }],
    changed: true,
  }
}

export function buildAdminProfilePatch(
  originalProfile: AdminProfileLike,
  form: AdminEditFormState
): Record<string, unknown> {
  const profileValues: Record<string, unknown> = {
    name: form.name?.trim() || '',
    bio: normalizeOptionalText(form.bio),
    provincia: form.provincia?.trim() || '',
    localidad: form.localidad?.trim() || '',
    zona_trabajo: normalizeOptionalText(form.zona_trabajo),
    modalidad: form.modalidad || 'presencial',
    hybrid_presencial_pct: form.modalidad === 'ambas' ? Number(form.hybrid_presencial_pct) : null,
    hybrid_remoto_pct: form.modalidad === 'ambas' ? 100 - Number(form.hybrid_presencial_pct) : null,
    disponibilidad: form.disponibilidad || 'disponible',
    intent: normalizeOptionalText(form.intent),
  }

  const originalProfileValues: Record<string, unknown> = {
    name: originalProfile.name?.trim() || '',
    bio: normalizeOptionalText(originalProfile.bio),
    provincia: originalProfile.provincia?.trim() || '',
    localidad: originalProfile.localidad?.trim() || '',
    zona_trabajo: normalizeOptionalText(originalProfile.zona_trabajo),
    modalidad: originalProfile.modalidad || 'presencial',
    hybrid_presencial_pct: originalProfile.modalidad === 'ambas' ? originalProfile.hybrid_presencial_pct : null,
    hybrid_remoto_pct: originalProfile.modalidad === 'ambas' ? originalProfile.hybrid_remoto_pct : null,
    disponibilidad: originalProfile.disponibilidad || 'disponible',
    intent: normalizeOptionalText(originalProfile.intent),
  }

  const profilePatch: Record<string, unknown> = {}
  Object.entries(profileValues).forEach(([field, value]) => {
    if (value !== originalProfileValues[field]) {
      profilePatch[field] = value
    }
  })

  return profilePatch
}

export function buildAdminRelationPatches(
  originalProfile: AdminProfileLike,
  form: AdminEditFormState
): {
  currentSkills: any[]
  skillsPatch?: any[]
  servicesPatch?: any[]
  contactsPatch?: any[]
  languagesPatch?: any[]
} {
  const currentSkills = (form.skills || [])
    .map((skill: any) => ({ ...skill, name: String(skill.name || '').trim() }))
    .filter((skill: any) => skill.name)

  const originalSkills = (originalProfile.skills || [])
    .map((skill: any) => ({
      ...(typeof skill === 'object' ? skill : {}),
      name: typeof skill === 'string' ? skill : skill.name,
    }))
    .filter((skill: any) => skill.name)

  const skillsChanged = JSON.stringify(currentSkills) !== JSON.stringify(originalSkills)
  let skillsPatch: any[] | undefined
  if (skillsChanged) {
    skillsPatch = currentSkills.map((skill: any) =>
      skill.id ? { id: skill.id, name: skill.name } : skill.name
    )
  }

  const relationPatch = (current: unknown[], original: unknown[]) =>
    JSON.stringify(current) === JSON.stringify(original) ? undefined : current

  const formattedServices = (form.services || []).map((service: any) => ({
    ...service,
    title: String(service.title || '').trim(),
    description: String(service.description || '').trim() || null,
    precio_orientativo: String(service.precio_orientativo || '').trim() || null,
  }))
  const servicesPatch = relationPatch(formattedServices, originalProfile.services || [])

  const formattedContacts = (form.contact_methods || [])
    .map((contact: any) => ({
      ...contact,
      type: String(contact.type || '').trim(),
      value: String(contact.value || '').trim(),
      is_public: contact.is_public !== false,
    }))
    .filter((contact: any) => contact.type || contact.value)
  const contactsPatch = relationPatch(formattedContacts, originalProfile.contact_methods || [])

  const formattedLanguages = (form.languages || [])
    .map((language: any) => ({
      ...language,
      language: String(language.language || '').trim(),
      level: language.level || 'intermedio',
      is_public: language.is_public !== false,
    }))
    .filter((language: any) => language.language)
  const languagesPatch = relationPatch(
    formattedLanguages,
    originalProfile.profile_languages || originalProfile.languages || []
  )

  return {
    currentSkills,
    skillsPatch,
    servicesPatch,
    contactsPatch,
    languagesPatch,
  }
}

export function validateAdminProfileEdit(
  originalProfile: AdminProfileLike | null,
  form: AdminEditFormState,
  editReason: string
): { isValid: boolean; error?: string } {
  if (!originalProfile) {
    return { isValid: false, error: 'No hay un perfil seleccionado para editar.' }
  }

  if (!form.name?.trim()) {
    return { isValid: false, error: 'Completá el nombre del perfil antes de guardar.' }
  }

  const isProfileActive = originalProfile.status === 'activo'
  const hasOriginalLocation = Boolean(
    originalProfile.provincia?.trim() && originalProfile.localidad?.trim()
  )
  const locationTouched =
    (form.provincia?.trim() || '') !== (originalProfile.provincia?.trim() || '') ||
    (form.localidad?.trim() || '') !== (originalProfile.localidad?.trim() || '')

  if (
    (isProfileActive || hasOriginalLocation || locationTouched) &&
    (!form.provincia?.trim() || !form.localidad?.trim())
  ) {
    return { isValid: false, error: 'Completá provincia y localidad antes de guardar.' }
  }

  if (editReason.trim().length < 3) {
    return {
      isValid: false,
      error: 'Ingresá un motivo de auditoría (mínimo 3 caracteres) para guardar la edición administrativa.',
    }
  }

  const profilePatch = buildAdminProfilePatch(originalProfile, form)
  const { skillsPatch, servicesPatch, contactsPatch, languagesPatch } =
    buildAdminRelationPatches(originalProfile, form)

  const hasProfileChanges = Object.keys(profilePatch).length > 0
  const hasRelationChanges =
    skillsPatch !== undefined ||
    servicesPatch !== undefined ||
    contactsPatch !== undefined ||
    languagesPatch !== undefined

  if (!hasProfileChanges && !hasRelationChanges) {
    return {
      isValid: false,
      error: 'No se detectaron modificaciones en el perfil para guardar.',
    }
  }

  return { isValid: true }
}

export function buildAdminProfileRpcPayload(
  originalProfile: AdminProfileLike,
  form: AdminEditFormState,
  editReason: string
): Record<string, unknown> {
  const profilePatch = buildAdminProfilePatch(originalProfile, form)
  const { skillsPatch, servicesPatch, contactsPatch, languagesPatch } =
    buildAdminRelationPatches(originalProfile, form)

  const payload: Record<string, unknown> = {
    target_profile_id: originalProfile.id,
    profile_patch: profilePatch,
    edit_reason: editReason.trim(),
  }

  if (skillsPatch !== undefined) payload.skills_patch = skillsPatch
  if (servicesPatch !== undefined) payload.services_patch = servicesPatch
  if (contactsPatch !== undefined) payload.contact_methods_patch = contactsPatch
  if (languagesPatch !== undefined) payload.languages_patch = languagesPatch

  return payload
}

export function formatAdminProfileSaveError(error: any): string {
  if (!error) return 'Error desconocido al guardar la edición.'

  const message = String(error.message || '')
  const code = String(error.code || '')
  const details = String(error.details || '')

  // 1. Errores de Permisos / Autorización
  if (code === '42501' || message.includes('admin_only') || message.includes('permission denied')) {
    return 'Permiso denegado: tu sesión no cuenta con rol de administrador activo para realizar modificaciones de perfil.'
  }

  // 2. Errores de tipos / operadores SQL en PostgreSQL
  if (code === '42883' || message.includes('operator does not exist')) {
    return `Error de ejecución en la base de datos (${message}). La operación fue rechazada por una incompatibilidad de tipos en la función de actualización.`
  }

  // 3. Errores de objeto/esquema faltante
  if (code === '42P01' || (message.includes('relation') && message.includes('does not exist'))) {
    return `Error de esquema en la base de datos (${message}).`
  }

  // 4. Errores de validación de negocio emitidos por la RPC
  if (message.includes('invalid_target_profile')) {
    return 'El perfil seleccionado no es válido o ya no existe en el sistema.'
  }
  if (message.includes('invalid_edit_reason') || message.includes('missing_audit_reason')) {
    return 'El motivo de auditoría ingresado no es válido (mínimo 3 caracteres requeridos).'
  }
  if (message.includes('unauthorized_field_update')) {
    return `Intento de modificar un campo no autorizado en el perfil: ${details || message}.`
  }

  // 5. Errores de red / conectividad
  if (message.includes('fetch') || message.includes('Network') || message.includes('Failed to fetch')) {
    return 'Error de conexión con el servidor. Verificá tu conexión a internet e intentá nuevamente.'
  }

  // 6. Mensaje general transparente sin sugerencias engañosas de migraciones
  return `No se pudo guardar la edición: ${message || 'Error en el servidor'}.`
}

