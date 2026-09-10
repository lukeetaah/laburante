import { CATEGORIES } from '@/data/categories'

const STOP_WORDS = new Set('a al algo alguien algun alguna con de del el en es la las lo los me mi para por que se su te un una y necesito necesito busco quiero contratar encontrar ayuda trabajo servicio persona'.split(' '))
const ALIASES: Record<string, string[]> = {
  pc: ['tecnico pc', 'soporte tecnico'],
  computadora: ['tecnico pc', 'soporte tecnico'],
  notebook: ['tecnico pc', 'soporte tecnico'],
  programador: ['desarrollo de apps', 'programador'],
  pagina: ['diseñador web', 'desarrollo de apps'],
  web: ['diseñador web', 'desarrollo de apps'],
  redes: ['redes', 'soporte tecnico'],
  'redes sociales': ['community manager', 'diseño grafico'],
  contabilidad: ['contador', 'administracion'],
  impuestos: ['contador', 'administracion'],
  mudanza: ['flete', 'mudanza'],
  evento: ['fotografo', 'catering', 'dj'],
  'cumpleaños': ['catering', 'fotografo', 'animador'],
}

export const normalizeSearchText = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

export interface SearchInterpretation {
  terms: string[]
  expandedTerms: string[]
  intent: 'contratar' | 'ofrecer' | 'explorar'
  label: string
}

export function interpretSearch(input: string): SearchInterpretation {
  const normalized = normalizeSearchText(input)
  const terms = normalized.split(/[^a-z0-9]+/).filter((term) => term.length > 2 && !STOP_WORDS.has(term))
  const expanded = new Set(terms)
  Object.entries(ALIASES).forEach(([key, values]) => {
    if (normalized.includes(normalizeSearchText(key))) values.forEach((value) => expanded.add(normalizeSearchText(value)))
  })

  const intent = /ofrezco|ofrecer|busco trabajo|quiero trabajar|estoy disponible/.test(normalized)
    ? 'ofrecer'
    : /necesito|busco|contratar|encontrar|ayuda|quiero alguien/.test(normalized)
      ? 'contratar'
      : 'explorar'

  const label = intent === 'contratar'
    ? 'Necesidad de contratación'
    : intent === 'ofrecer'
      ? 'Oferta de trabajo'
      : 'Búsqueda abierta'

  return { terms, expandedTerms: Array.from(expanded), intent, label }
}

export function inferCategory(input: string): string | undefined {
  const normalized = normalizeSearchText(input)
  return CATEGORIES.find((category) => {
    const values = [category.name, ...(category.subcategories || [])].map(normalizeSearchText)
    return values.some((value) => value.length > 3 && normalized.includes(value))
  })?.name
}
