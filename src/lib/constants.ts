// LABURANTE — Site configuration
// Canonical production domain. VITE_SITE_URL may still override it for previews.

export const SITE_CONFIG = {
  name: 'LABURANTE',
  tagline: 'Encontrá a alguien que sepa hacerlo',
  description:
    'Una plataforma gratuita para conectar personas que ofrecen su trabajo, oficio, profesión o servicios con quienes necesitan encontrarlos.',
  url: import.meta.env.VITE_SITE_URL || 'https://laburante.ar',
  origin: 'Lukson Arts',
  originUrl: 'https://luksonarts.vercel.app',
  officialWhatsApp: import.meta.env.VITE_OFFICIAL_WHATSAPP || '5491178202409',
  officialWhatsAppFormatted: '+54 9 11 7820-2409',
  contact: {
    formspreeUrl: 'https://formspree.io/f/mkoyzjoy',
  },
} as const

export const PROFILE_SLUG_PREFIX = '/p/'
