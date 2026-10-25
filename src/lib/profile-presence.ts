export type PresenceJurisdiction = {
  code: string
  name: string
  aliases: string[]
}
export const ARGENTINA_JURISDICTIONS: PresenceJurisdiction[] = [
  { code: 'AR-B', name: 'Buenos Aires', aliases: ['buenos aires'] },
  { code: 'AR-C', name: 'CABA', aliases: ['caba', 'ciudad autonoma de buenos aires'] },
  { code: 'AR-K', name: 'Catamarca', aliases: ['catamarca'] },
  { code: 'AR-H', name: 'Chaco', aliases: ['chaco'] },
  { code: 'AR-U', name: 'Chubut', aliases: ['chubut'] },
  { code: 'AR-X', name: 'Córdoba', aliases: ['cordoba'] },
  { code: 'AR-W', name: 'Corrientes', aliases: ['corrientes'] },
  { code: 'AR-E', name: 'Entre Ríos', aliases: ['entre rios'] },
  { code: 'AR-P', name: 'Formosa', aliases: ['formosa'] },
  { code: 'AR-Y', name: 'Jujuy', aliases: ['jujuy'] },
  { code: 'AR-L', name: 'La Pampa', aliases: ['la pampa'] },
  { code: 'AR-F', name: 'La Rioja', aliases: ['la rioja'] },
  { code: 'AR-M', name: 'Mendoza', aliases: ['mendoza'] },
  { code: 'AR-N', name: 'Misiones', aliases: ['misiones'] },
  { code: 'AR-Q', name: 'Neuquén', aliases: ['neuquen'] },
  { code: 'AR-R', name: 'Río Negro', aliases: ['rio negro'] },
  { code: 'AR-A', name: 'Salta', aliases: ['salta'] },
  { code: 'AR-J', name: 'San Juan', aliases: ['san juan'] },
  { code: 'AR-D', name: 'San Luis', aliases: ['san luis'] },
  { code: 'AR-Z', name: 'Santa Cruz', aliases: ['santa cruz'] },
  { code: 'AR-S', name: 'Santa Fe', aliases: ['santa fe'] },
  { code: 'AR-G', name: 'Santiago del Estero', aliases: ['santiago del estero'] },
  { code: 'AR-V', name: 'Tierra del Fuego', aliases: ['tierra del fuego', 'tierra del fuego antartida e islas del atlantico sur'] },
  { code: 'AR-T', name: 'Tucumán', aliases: ['tucuman'] },
]

export function normalizeProvinceName(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    : ''
}

const JURISDICTION_BY_ALIAS = new Map(
  ARGENTINA_JURISDICTIONS.flatMap((jurisdiction) => jurisdiction.aliases.map((alias) => [alias, jurisdiction.code] as const)),
)

export function canonicalProvinceCode(value: unknown) {
  return JURISDICTION_BY_ALIAS.get(normalizeProvinceName(value)) || null
}

export function isEligiblePresenceProfile(profile: { status?: unknown; account_type?: unknown; intent?: unknown }) {
  // Companies are intentionally excluded: the map measures professional
  // directory presence and must not mix company accounts with providers.
  return profile.status === 'activo'
    && profile.account_type !== 'empresa'
    && (profile.intent === 'ofrecer' || profile.intent === 'ambas')
}
