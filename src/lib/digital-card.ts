import { supabase } from '@/lib/supabase'
import type { ProfileWithDetails } from '@/stores/profile-store'
import { dispatchNotificationEmail } from '@/lib/notification-email'
import { resolveProfilePhotoUrl } from '@/lib/profile-assets'

export interface DigitalCardConfig {
  show_photo: boolean
  show_headline: boolean
  custom_headline?: string
  show_skills: boolean
  show_bio: boolean
  show_services: boolean
  show_location: boolean
  show_zona_trabajo: boolean
  show_modality: boolean
  show_availability: boolean
  show_whatsapp: boolean
  show_phone: boolean
  show_email: boolean
  show_web: boolean
  show_instagram: boolean
  show_linkedin: boolean
  show_portfolio: boolean
  show_languages: boolean
  show_verified_badge: boolean
}

export interface PublicDigitalCardData {
  card_key: string
  slug: string
  name: string
  headline?: string | null
  photo_url?: string | null
  bio?: string | null
  provincia?: string | null
  localidad?: string | null
  zona_trabajo?: string | null
  disponibilidad?: string | null
  modalidad?: string | null
  hybrid_presencial_pct?: number | null
  hybrid_remoto_pct?: number | null
  whatsapp_verified?: boolean
  skills?: string[]
  services?: { title: string; description: string | null; precio_orientativo?: string | null }[]
  languages?: { language: string; level: string }[]
  contacts?: { type: string; value: string }[]
}

export interface AvailableCardFields {
  hasPhoto: boolean
  hasSkills: boolean
  skillsList: string[]
  hasBio: boolean
  hasServices: boolean
  servicesCount: number
  hasLocation: boolean
  hasZonaTrabajo: boolean
  hasModality: boolean
  hasAvailability: boolean
  hasWhatsApp: boolean
  whatsAppNumber: string
  hasPhone: boolean
  phoneNumber: string
  hasEmail: boolean
  emailAddress: string
  hasWeb: boolean
  webUrl: string
  hasInstagram: boolean
  instagramHandle: string
  hasLinkedIn: boolean
  hasPortfolio: boolean
  hasLanguages: boolean
  hasVerifiedBadge: boolean
  defaultHeadline: string
}

/**
 * Inspecciona un perfil y detecta con precisión qué campos tienen datos reales.
 * Los campos vacíos NUNCA deben ofrecerse como opciones habilitadas.
 */
export function detectAvailableCardFields(profile: ProfileWithDetails | null | undefined): AvailableCardFields {
  if (!profile) {
    return {
      hasPhoto: false,
      hasSkills: false,
      skillsList: [],
      hasBio: false,
      hasServices: false,
      servicesCount: 0,
      hasLocation: false,
      hasZonaTrabajo: false,
      hasModality: false,
      hasAvailability: false,
      hasWhatsApp: false,
      whatsAppNumber: '',
      hasPhone: false,
      phoneNumber: '',
      hasEmail: false,
      emailAddress: '',
      hasWeb: false,
      webUrl: '',
      hasInstagram: false,
      instagramHandle: '',
      hasLinkedIn: false,
      hasPortfolio: false,
      hasLanguages: false,
      hasVerifiedBadge: false,
      defaultHeadline: '',
    }
  }

  const contacts = profile.contact_methods || []
  const findContact = (t: string) => contacts.find((c) => c.type === t && Boolean(c.value && c.value.trim()))

  const waContact = findContact('whatsapp')
  const phoneContact = findContact('telefono')
  const emailContact = findContact('email')
  const webContact = findContact('web')
  const igContact = findContact('instagram')
  const liContact = findContact('linkedin')
  const portfolioContact = findContact('portfolio')

  const validSkills = (profile.skills || []).map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
  const validServices = (profile.services || []).filter((s) => s.title && s.title.trim().length > 0)
  const validLanguages = (profile.languages || []).filter((l) => l.language && l.language.trim().length > 0)

  const defaultHeadline = validSkills[0] || (validServices[0]?.title) || ''

  return {
    hasPhoto: Boolean(profile.photo_url && profile.photo_url.trim()),
    hasSkills: validSkills.length > 0,
    skillsList: validSkills,
    hasBio: Boolean(profile.bio && profile.bio.trim()),
    hasServices: validServices.length > 0,
    servicesCount: validServices.length,
    hasLocation: Boolean(profile.localidad || profile.provincia),
    hasZonaTrabajo: Boolean(profile.zona_trabajo && profile.zona_trabajo.trim()),
    hasModality: Boolean(profile.modalidad),
    hasAvailability: Boolean(profile.disponibilidad),
    hasWhatsApp: Boolean(waContact),
    whatsAppNumber: waContact?.value || '',
    hasPhone: Boolean(phoneContact),
    phoneNumber: phoneContact?.value || '',
    hasEmail: Boolean(emailContact),
    emailAddress: emailContact?.value || '',
    hasWeb: Boolean(webContact),
    webUrl: webContact?.value || '',
    hasInstagram: Boolean(igContact),
    instagramHandle: igContact?.value || '',
    hasLinkedIn: Boolean(liContact),
    hasPortfolio: Boolean(portfolioContact),
    hasLanguages: validLanguages.length > 0,
    hasVerifiedBadge: Boolean(profile.whatsapp_verified),
    defaultHeadline,
  }
}

/**
 * Devuelve la configuración inicial recomendada activando los campos disponibles.
 */
export function getDefaultDigitalCardConfig(profile: ProfileWithDetails | null | undefined): DigitalCardConfig {
  const fields = detectAvailableCardFields(profile)
  return {
    show_photo: fields.hasPhoto,
    show_headline: Boolean(fields.defaultHeadline),
    custom_headline: fields.defaultHeadline,
    show_skills: fields.hasSkills,
    show_bio: fields.hasBio,
    show_services: fields.hasServices,
    show_location: fields.hasLocation,
    show_zona_trabajo: fields.hasZonaTrabajo,
    show_modality: fields.hasModality,
    show_availability: fields.hasAvailability,
    show_whatsapp: fields.hasWhatsApp,
    show_phone: fields.hasPhone,
    show_email: fields.hasEmail,
    show_web: fields.hasWeb,
    show_instagram: fields.hasInstagram,
    show_linkedin: fields.hasLinkedIn,
    show_portfolio: fields.hasPortfolio,
    show_languages: fields.hasLanguages,
    show_verified_badge: fields.hasVerifiedBadge,
  }
}

/**
 * Genera un card_key aleatorio, seguro y no predecible de 10 caracteres alfanuméricos.
 */
export function generateClientCardKey(): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz' // Base32 amigable sin caracteres ambiguos (0, o, 1, l, i)
  let key = ''
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(10)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < 10; i++) {
      key += chars[bytes[i] % chars.length]
    }
  } else {
    for (let i = 0; i < 10; i++) {
      key += chars[Math.floor(Math.random() * chars.length)]
    }
  }
  return key
}

/**
 * Obtiene la configuración de tarjeta digital persistida en Supabase.
 */
export async function fetchDigitalCardConfig(profileId: string): Promise<{ card_key: string; config: DigitalCardConfig } | null> {
  try {
    const { data, error } = await (supabase.from('profile_cards') as any)
      .select('card_key, config')
      .eq('profile_id', profileId)
      .maybeSingle()

    if (error) {
      console.warn('No se pudo leer profile_cards desde Supabase:', error.message)
      return null
    }

    if (!data) return null

    return {
      card_key: data.card_key,
      config: data.config as DigitalCardConfig,
    }
  } catch (err) {
    console.warn('Excepción al consultar profile_cards:', err)
    return null
  }
}

/**
 * Guarda la configuración de la tarjeta en Supabase como fuente única de verdad.
 */
export async function saveDigitalCardConfig(
  profileId: string,
  config: DigitalCardConfig,
  existingKey?: string
): Promise<{ card_key: string; error: string | null }> {
  try {
    const cleanExistingKey = existingKey?.trim() || ''

    if (cleanExistingKey) {
      const { data, error } = await (supabase.from('profile_cards') as any)
        .update({
          config,
        })
        .eq('profile_id', profileId)
        .select('card_key')
        .maybeSingle()

      if (error) {
        return { card_key: cleanExistingKey, error: `Error al guardar en Supabase: ${error.message}` }
      }

      if (data?.card_key) {
        return { card_key: data.card_key, error: null }
      }
    }

    const { data, error } = await (supabase.from('profile_cards') as any)
      .insert({
        profile_id: profileId,
        config,
      })
      .select('card_key')
      .single()

    if (error) {
      return { card_key: cleanExistingKey, error: `Error al guardar en Supabase: ${error.message}` }
    }

    return { card_key: data?.card_key || cleanExistingKey, error: null }
  } catch (err: any) {
    return { card_key: existingKey || '', error: err.message || 'Error inesperado al persistir en Supabase.' }
  }
}

/**
 * Obtiene los datos públicos de una tarjeta digital utilizando la RPC segura con SECURITY DEFINER.
 * Si el perfil fue pausado, desactivado o eliminado, devuelve null protegiendo la privacidad.
 */
export async function fetchPublicDigitalCard(identifier: string): Promise<PublicDigitalCardData | null> {
  if (!identifier || !identifier.trim()) return null
  const cleanId = identifier.trim().toLowerCase()

  try {
    // 1. Invocar la RPC get_public_digital_card con principio de mínimo privilegio
    const { data, error } = await (supabase.rpc as any)('get_public_digital_card', {
      p_identifier: cleanId,
    })

    if (!error && data) {
      // Resolver photo_url pública o firmada
      const resolvedPhoto = data.photo_url ? await resolveProfilePhotoUrl(data.photo_url) : null
      return {
        ...data,
        photo_url: resolvedPhoto,
      } as PublicDigitalCardData
    }

    // 2. Si la RPC devolvió null (perfil inexistente o pausado), respetamos la privacidad
    if (!error && data === null) {
      return null
    }

    // 3. Fallback de resiliencia: Si la RPC aún no fue migrada en la base de datos de prueba
    if (error && (error.code === '42883' || /function .*get_public_digital_card.* does not exist/i.test(error.message))) {
      return await fallbackFetchPublicDigitalCard(cleanId)
    }

    return null
  } catch (err) {
    console.warn('Error al obtener tarjeta digital pública:', err)
    return null
  }
}

/**
 * Fallback seguro para entornos locales/preview si la RPC get_public_digital_card todavía no fue aplicada en DB.
 * Aplica idénticos filtros de privacidad: solo perfiles activos y solo campos autorizados.
 */
async function fallbackFetchPublicDigitalCard(identifier: string): Promise<PublicDigitalCardData | null> {
  try {
    // Intentar buscar en profile_cards por card_key o buscar en public_profiles por slug
    let cardRow: any = null
    const { data: byKey } = await (supabase.from('profile_cards') as any)
      .select('profile_id, card_key, config')
      .eq('card_key', identifier)
      .maybeSingle()

    cardRow = byKey

    let profileRow: any = null
    if (cardRow) {
      const { data: p } = await (supabase.from('public_profiles') as any)
        .select('*')
        .eq('id', cardRow.profile_id)
        .maybeSingle()
      profileRow = p
    } else {
      const { data: p } = await (supabase.from('public_profiles') as any)
        .select('*')
        .eq('slug', identifier)
        .maybeSingle()
      profileRow = p
      if (profileRow) {
        const { data: c } = await (supabase.from('profile_cards') as any)
          .select('profile_id, card_key, config')
          .eq('profile_id', profileRow.id)
          .maybeSingle()
        cardRow = c
      }
    }

    if (!profileRow) return null

    const config: DigitalCardConfig = cardRow?.config || getDefaultDigitalCardConfig(profileRow)
    const cardKey = cardRow?.card_key || profileRow.slug

    // Obtener habilidades si están autorizadas
    let skills: string[] = []
    if (config.show_skills) {
      const { data: sData } = await (supabase.from('public_profile_skills') as any)
        .select('name')
        .eq('profile_id', profileRow.id)
      skills = (sData || []).map((s: any) => s.name)
    }

    // Obtener servicios si están autorizados
    let services: any[] = []
    if (config.show_services) {
      const { data: svData } = await (supabase.from('public_profile_services') as any)
        .select('title, description, precio_orientativo')
        .eq('profile_id', profileRow.id)
      services = svData || []
    }

    // Obtener contactos públicos autorizados
    let contacts: any[] = []
    const { data: cData } = await (supabase.from('contact_methods') as any)
      .select('type, value')
      .eq('profile_id', profileRow.id)

    contacts = (cData || []).filter((c: any) => {
      if (c.type === 'whatsapp') return config.show_whatsapp
      if (c.type === 'telefono') return config.show_phone
      if (c.type === 'email') return config.show_email
      if (c.type === 'web') return config.show_web
      if (c.type === 'instagram') return config.show_instagram
      if (c.type === 'linkedin') return config.show_linkedin
      if (c.type === 'portfolio') return config.show_portfolio
      return false
    })

    const resolvedPhoto = config.show_photo && profileRow.photo_url
      ? await resolveProfilePhotoUrl(profileRow.photo_url)
      : null

    return {
      card_key: cardKey,
      slug: profileRow.slug,
      name: profileRow.name,
      photo_url: resolvedPhoto,
      headline: config.show_headline ? config.custom_headline || skills[0] : null,
      bio: config.show_bio ? profileRow.bio : null,
      provincia: config.show_location ? profileRow.provincia : null,
      localidad: config.show_location ? profileRow.localidad : null,
      zona_trabajo: config.show_zona_trabajo ? profileRow.zona_trabajo : null,
      disponibilidad: config.show_availability ? profileRow.disponibilidad : null,
      modalidad: config.show_modality ? profileRow.modalidad : null,
      hybrid_presencial_pct: config.show_modality ? profileRow.hybrid_presencial_pct : null,
      hybrid_remoto_pct: config.show_modality ? profileRow.hybrid_remoto_pct : null,
      whatsapp_verified: config.show_verified_badge ? Boolean(profileRow.whatsapp_verified) : false,
      skills,
      services,
      contacts,
    }
  } catch (e) {
    console.warn('Fallback public card fetch failed:', e)
    return null
  }
}

/**
 * Devuelve la URL canónica y permanente de la tarjeta digital.
 */
export function getCanonicalCardUrl(cardKey: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://laburante.ar'
  return `${origin}/tarjeta/${encodeURIComponent(cardKey)}`
}

/**
 * Construye el enlace oficial de WhatsApp para compartir la tarjeta según la especificación:
 * https://wa.me/?text=...
 */
export function getCardWhatsAppShareUrl(name: string, profession: string | null | undefined, cardUrl: string): string {
  const lines: string[] = [
    '¡Hola! Te comparto mi tarjeta de LABURANTE, donde podés conocer mi trabajo y encontrar mis datos de contacto.',
    '',
    name,
  ]

  if (profession && profession.trim()) {
    lines.push(profession.trim())
  }

  lines.push('')
  lines.push('Conocé mi tarjeta acá:')
  lines.push(cardUrl)

  const message = lines.join('\n')
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

/**
 * Envía el enlace permanente y el código QR de la tarjeta al correo del propio usuario
 * utilizando la infraestructura de notificaciones y emails existente.
 */
export async function sendCardEmailToSelf(
  _userId: string,
  _userEmail: string,
  cardKey: string,
  _name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!cardKey || !cardKey.trim()) {
      return {
        success: false,
        error: 'Primero guardá tu tarjeta para generar tu enlace permanente y poder enviártela por correo.',
      }
    }

    // 1. Crear la notificación vía RPC segura (valida email confirmado, rate limit y URL en servidor)
    const { data: notificationId, error: rpcErr } = await (supabase.rpc as any)('request_digital_card_email')

    if (rpcErr) {
      return { success: false, error: rpcErr.message || 'No se pudo preparar el envío por correo.' }
    }

    if (!notificationId) {
      return { success: false, error: 'No se pudo registrar el envío de la tarjeta.' }
    }

    // 2. Disparar el envío por correo utilizando la función existente send-notification-email
    const dispatchResult = await dispatchNotificationEmail(String(notificationId))
    if (!dispatchResult.ok) {
      return {
        success: false,
        error: dispatchResult.error || dispatchResult.reason || 'No se pudo enviar el correo en este momento.',
      }
    }

    if (dispatchResult.status === 'skipped') {
      const reasonMap: Record<string, string> = {
        preference_disabled: 'Tenés desactivadas las notificaciones por email en tu perfil.',
        recipient_email_unavailable: 'No encontramos un correo válido en tu cuenta.',
        invalid_context: 'El contexto del correo no pudo validarse en el servidor.',
      }
      return {
        success: false,
        error: reasonMap[dispatchResult.reason || ''] || 'El envío por correo fue omitido por las reglas de notificación.',
      }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error inesperado al enviar el correo.' }
  }
}
