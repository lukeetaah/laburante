// LABURANTE — Site configuration
// Domain is configurable for future custom domain

export const SITE_CONFIG = {
  name: 'LABURANTE',
  tagline: 'Encontrá a alguien que sepa hacerlo',
  description:
    'Una plataforma gratuita para conectar personas que ofrecen su trabajo, oficio, profesión o servicios con quienes necesitan encontrarlos.',
  url: import.meta.env.VITE_SITE_URL || 'https://laburante.vercel.app',
  origin: 'Lukson Arts',
  originUrl: 'https://luksonarts.vercel.app',
  officialWhatsApp: import.meta.env.VITE_OFFICIAL_WHATSAPP || '5491165464326',
  officialWhatsAppFormatted: '+54 9 11 6546-4326',
  contact: {
    formspreeUrl: 'https://formspree.io/f/mkoyzjoy',
  },
} as const

export const PROFILE_SLUG_PREFIX = '/p/'
