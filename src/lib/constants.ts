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
  contact: {
    email: 'contacto@laburante.com.ar',
  },
} as const

export const PROFILE_SLUG_PREFIX = '/p/'
