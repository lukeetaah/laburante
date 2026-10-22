export interface ContactMethodLike {
  type: string
  value: string
}

export interface PublicProfileContactMethod extends ContactMethodLike {
  is_public?: boolean | null
}

// Direct contact channels stay behind the existing contact/request flow.
// These are the only contact types that the public profile view is allowed to
// expose as immediately usable external links.
export const PUBLIC_PROFILE_LINK_TYPES = ['web', 'portfolio', 'linkedin', 'instagram'] as const

export type PublicProfileLinkType = typeof PUBLIC_PROFILE_LINK_TYPES[number]

export function toEditableContactMethod(method: PublicProfileContactMethod) {
  return {
    type: method.type,
    value: method.value,
    is_public: method.is_public !== false,
  }
}

function normalizedContactValue(method: ContactMethodLike) {
  const value = method.value.trim()
  if (method.type === 'whatsapp' || method.type === 'telefono') return value.replace(/\D/g, '')
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function dedupeContactMethods<T extends ContactMethodLike>(methods: T[] = []) {
  const seen = new Set<string>()
  return methods.filter((method) => {
    if (!method.value?.trim()) return false
    const key = `${method.type}:${normalizedContactValue(method)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getPublicProfileContacts<T extends PublicProfileContactMethod>(methods: T[] = []) {
  const allowedTypes = new Set<string>(PUBLIC_PROFILE_LINK_TYPES)
  return dedupeContactMethods(methods.filter((method) => (
    method.is_public === true &&
    allowedTypes.has(method.type) &&
    Boolean(method.value?.trim())
  )))
}

export function getPublicProfileContactLabel(type: string) {
  return ({
    web: 'Sitio web',
    portfolio: 'Portfolio',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
  } as Record<string, string>)[type] || 'Enlace'
}

export function getPublicProfileContactHref(type: string, rawValue: string) {
  const value = rawValue.trim()
  if (!value || !PUBLIC_PROFILE_LINK_TYPES.includes(type as PublicProfileLinkType)) return null
  if (/\s/.test(value)) return null

  if (type === 'instagram' && !/^https?:\/\//i.test(value)) {
    const handle = value.replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '')
    return handle ? `https://instagram.com/${handle}` : null
  }

  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`
    const parsed = new URL(normalized)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}
