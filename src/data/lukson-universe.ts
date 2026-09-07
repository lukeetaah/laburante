// Lukson Arts Universe — Verified projects data
// Source: luksonarts.vercel.app (audited 2026-09-07)
// This file is the single source of truth for the ecosystem.
// To add a new project, add an entry here. All components that render the universe read from this file.

export interface LuksonProject {
  id: string
  name: string
  category: string
  summary: string
  url: string
  accent: string // CSS color for card accent
}

export const LUKSON_PROJECTS: LuksonProject[] = [
  {
    id: 'mi-mandato',
    name: 'MI MANDATO',
    category: 'Simulación política',
    summary: 'Goberná el caos antes de que la historia decida olvidarte.',
    url: 'https://mi-mandato.vercel.app/',
    accent: '#6366f1',
  },
  {
    id: 'corpority',
    name: 'CORPORITY',
    category: 'Sátira laboral',
    summary: 'Sobreviví al absurdo corporativo antes de agotar tu cordura.',
    url: 'https://corpority.vercel.app/',
    accent: '#eab308',
  },
  {
    id: 'rastro',
    name: 'RASTRO',
    category: 'Trivia online · 1v1',
    summary: 'Duelo en vivo para descifrar momentos de fotografías reales.',
    url: 'https://rastro-sigma.vercel.app/',
    accent: '#e05638',
  },
  {
    id: 'mandibula',
    name: 'MANDÍBULA',
    category: 'Estrategia biológica',
    summary: 'Comandá un hormiguero en la estepa hostil de la Patagonia.',
    url: 'https://mandibula-six.vercel.app/',
    accent: '#84cc16',
  },
  {
    id: 'el-origen',
    name: 'EL ORIGEN',
    category: 'Horror deductivo',
    summary: 'Tasá un departamento antiguo y descubrí lo que oculta.',
    url: 'https://origin-game.vercel.app/',
    accent: '#c8b89a',
  },
  {
    id: 'sendero',
    name: 'SENDERO',
    category: 'Diseño de hábitos',
    summary: '12 semanas para ordenar tu vida con lucidez y foco real.',
    url: 'https://planet-club.vercel.app/sendero',
    accent: '#38bdf8',
  },
  {
    id: 'aman',
    name: 'AMAN',
    category: 'Lenguaje experimental',
    summary: '67 conceptos primitivos que se combinan para expresar cualquier idea.',
    url: 'https://aman.free.je/?i=1',
    accent: '#a855f7',
  },
  {
    id: 'umbral',
    name: 'UMBRAL',
    category: 'Lab cognitivo',
    summary: 'Escuchá estímulos y descubrí tus patrones de sinestesia.',
    url: 'https://umbral-gules.vercel.app/en',
    accent: '#7dd3fc',
  },
  {
    id: 'el-bucle',
    name: 'EL BUCLE',
    category: 'Cómic interactivo',
    summary: 'El tiempo se repite hasta que elijas distinto.',
    url: 'https://ruptura.free.nf/?i=1',
    accent: '#e879f9',
  },
]

export const LUKSON_ARTS_URL = 'https://luksonarts.vercel.app'
export const LUKSON_ARTS_GITHUB = 'https://github.com/lukeetaah/lukson.arts'
export const LUKSON_LINKEDIN = 'https://www.linkedin.com/in/lucas-correa-3300211a6/'
