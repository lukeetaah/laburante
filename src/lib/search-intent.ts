import { CATEGORIES } from '@/data/categories'
import { expandCategorySearchTerms, expandSearchTermVariants, normalizeSearchText } from './search-matching'

export { normalizeSearchText } from './search-matching'

const STOP_WORDS = new Set('a al algo alguien algun alguna con de del el en es la las lo los me mi para por que se su te un una y necesito necesito busco quiero contratar encontrar ayuda trabajo servicio persona'.split(' '))
const ALIASES: Record<string, string[]> = {
  pc: ['tecnico pc', 'soporte tecnico'],
  computadora: ['tecnico pc', 'soporte tecnico'],
  notebook: ['tecnico pc', 'soporte tecnico'],
  pagina: ['diseñador web', 'desarrollo de apps'],
  web: ['diseñador web', 'desarrollo de apps'],
  redes: ['redes', 'soporte tecnico'],
  'redes sociales': ['community manager', 'diseño grafico'],
  contabilidad: ['contador', 'administracion'],
  impuestos: ['contador', 'administracion'],
  mudanza: ['flete', 'mudanza'],
  evento: ['fotografo', 'catering', 'dj'],
  'cumpleaños': ['catering', 'fotografo', 'animador'],
  medico: ['medicina', 'medicina general', 'clinica medica'],
  médica: ['medicina', 'medicina general', 'clinica medica'],
  cardiologo: ['cardiologia'],
  cardiologa: ['cardiologia'],
  neurologo: ['neurologia'],
  neurologa: ['neurologia'],
  psiquiatra: ['psiquiatria'],
  pediatra: ['pediatria'],
  neonatologo: ['neonatologia'],
  ginecologo: ['ginecologia'],
  ginecologa: ['ginecologia'],
  obstetra: ['obstetricia'],
  urologo: ['urologia'],
  urologa: ['urologia'],
  nefrologo: ['nefrologia'],
  endocrinologo: ['endocrinologia'],
  gastroenterologo: ['gastroenterologia'],
  dermatologo: ['dermatologia'],
  oftalmologo: ['oftalmologia'],
  traumatologo: ['traumatologia'],
  oncologo: ['oncologia'],
  hematologo: ['hematologia'],
  radiologo: ['radiologia', 'diagnostico por imagenes'],
  odontologo: ['odontologia'],
  odontologa: ['odontologia'],
  dentista: ['odontologia'],
  nutricionista: ['nutricion'],
  enfermero: ['enfermeria'],
  enfermera: ['enfermeria'],
  kinesiologo: ['kinesiologia', 'fisioterapia'],
  fisioterapeuta: ['fisioterapia'],
  bioquimico: ['bioquimica'],
  biologo: ['biologia'],
  quimico: ['quimica'],
  fisico: ['fisica'],
  matematico: ['matematicas'],
  investigador: ['investigacion', 'investigacion cientifica'],
  investigadora: ['investigacion', 'investigacion cientifica'],
  fotografo: ['fotografia'],
  fotografa: ['fotografia'],
  actor: ['actuacion'],
  actriz: ['actuacion'],
  bailarín: ['danza'],
  bailarina: ['danza'],
  escritor: ['escritura'],
  periodista: ['periodismo'],
  locutor: ['locucion'],
  programador: ['desarrollo de apps', 'programacion', 'desarrollo de software'],
  desarrollador: ['desarrollo de software', 'programacion'],
  'desarrollador web': ['desarrollo web'],
  'desarrolladora web': ['desarrollo web'],
  devops: ['devops'],
  albañil: ['albañileria'],
  albañila: ['albañileria'],
  plomero: ['plomeria'],
  plomera: ['plomeria'],
  electricista: ['electricidad'],
  gasista: ['gas'],
  carpintero: ['carpinteria'],
  herrero: ['herrería', 'soldadura'],
  soldador: ['soldadura'],
  peluquero: ['peluqueria'],
  peluquera: ['peluqueria'],
  barbero: ['barberia'],
  maquillador: ['maquillaje'],
  cocinero: ['cocina', 'gastronomia'],
  chef: ['cocina profesional', 'gastronomia'],
  panadero: ['panaderia'],
  pastelero: ['pasteleria'],
  barista: ['barista'],
  chofer: ['transporte', 'conductor profesional'],
  camionero: ['chofer de camion', 'conductor profesional'],
  camionera: ['chofer de camion', 'conductor profesional'],
  colectivero: ['transporte de pasajeros', 'colectivero'],
  colectivera: ['transporte de pasajeros', 'colectivero'],
  remisero: ['remisero', 'chofer'],
  remisera: ['remisero', 'chofer'],
  maquinista: ['conductor ferroviario', 'maquinista'],
  ferroviario: ['conductor ferroviario', 'guarda ferroviario'],
  clarkista: ['operador de autoelevador', 'clarkista', 'autoelevador'],
  autoelevadorista: ['operador de autoelevador', 'autoelevador'],
  'maquinaria pesada': ['operador de maquinaria pesada'],
  repartidor: ['reparto', 'mensajeria'],
  jardinero: ['jardineria'],
  entrenador: ['entrenamiento', 'preparacion fisica'],
  coach: ['coach', 'coach ontologico'],
  tcp: ['tripulante de cabina de pasajeros', 'auxiliar de vuelo'],
  azafata: ['tripulante de cabina de pasajeros', 'auxiliar de vuelo'],
  azafato: ['tripulante de cabina de pasajeros', 'auxiliar de vuelo'],
  'tripulante de cabina': ['tripulante de cabina de pasajeros', 'auxiliar de vuelo'],
  'auxiliar de vuelo': ['tripulante de cabina de pasajeros', 'auxiliar de vuelo'],
  'comisario de a bordo': ['tripulante de cabina de pasajeros', 'auxiliar de vuelo'],
  tma: ['tecnico en mantenimiento de aeronaves', 'mecanico aeronautico'],
  'mecanico aeronautico': ['mecanico aeronautico', 'tecnico en mantenimiento de aeronaves'],
  piloto: ['piloto comercial', 'piloto privado', 'piloto de linea aerea'],
  pilota: ['piloto comercial', 'piloto privado', 'piloto de linea aerea'],
  'despachante de aeronaves': ['despachante de aeronaves'],
  'controlador aereo': ['controlador de transito aereo'],
  rampa: ['personal de rampa', 'operaciones aeroportuarias'],
  marinero: ['marinero', 'marina mercante'],
  marinera: ['marinero', 'marina mercante'],
  timonel: ['timonel', 'patron de embarcacion'],
  estibador: ['estibador', 'personal portuario'],
  buzo: ['buzo profesional'],
  tornero: ['torneria', 'tornero', 'operador cnc'],
  tornera: ['torneria', 'tornero', 'operador cnc'],
  cnc: ['operador cnc', 'torneria'],
  matricero: ['matricero', 'mecanica industrial'],
  fresador: ['fresador', 'torneria'],
  electromecanico: ['electromecanica'],
  electromecanica: ['electromecanica'],
  mozo: ['mozo', 'camarero', 'gastronomia'],
  moza: ['mozo', 'camarero', 'gastronomia'],
  camarero: ['camarero', 'mozo', 'gastronomia'],
  camarera: ['camarero', 'mozo', 'gastronomia'],
  'recepcionista de hotel': ['recepcion de hotel', 'personal hotelero'],
  'instrumentador quirurgico': ['instrumentacion quirurgica'],
  'instrumentadora quirurgica': ['instrumentacion quirurgica'],
  'tecnico radiologo': ['tecnico radiologo', 'diagnostico por imagenes'],
  fonoaudiologo: ['fonoaudiologia'],
  fonoaudiologa: ['fonoaudiologia'],
  'instalador electrico': ['electricista matriculado', 'electricidad'],
  'gasista matriculado': ['gasista matriculado', 'gas'],
  durlockero: ['durlock', 'construccion en seco'],
  techista: ['techista', 'techos'],
  pescador: ['pesca', 'acuicultura'],
  tractorista: ['tractorista', 'maquinaria agricola'],
  minero: ['mineria', 'operaciones mineras'],
  vigilador: ['vigilador', 'seguridad privada'],
  bombero: ['bomberos', 'seguridad y emergencias'],
  paramedico: ['paramedico', 'emergencias medicas'],
  funeraria: ['servicios funerarios', 'cocheria'],
  cocheria: ['cocheria', 'servicios funerarios'],
}

export interface SearchInterpretation {
  terms: string[]
  expandedTerms: string[]
  intent: 'contratar' | 'ofrecer' | 'explorar'
  label: string
}

export function interpretSearch(input: string): SearchInterpretation {
  const normalized = normalizeSearchText(input)
  const terms = normalized.split(/[^a-z0-9]+/).filter((term) => term.length > 2 && !STOP_WORDS.has(term))
  const expanded = new Set(terms.flatMap((term) => [term, ...expandSearchTermVariants(term)]))
  Object.entries(ALIASES).forEach(([key, values]) => {
    if (normalized.includes(normalizeSearchText(key))) {
      values.forEach((value) => {
        const normalizedValue = normalizeSearchText(value)
        expanded.add(normalizedValue)
        expandSearchTermVariants(normalizedValue).forEach((variant) => expanded.add(variant))
      })
    }
  })

  // A parent category can be searched by one of its words, e.g. Finanzas
  // belongs to "Negocios, administración y finanzas". Expand only taxonomy
  // terms, never arbitrary synonyms or unrelated profile data.
  expandCategorySearchTerms(normalized, CATEGORIES).forEach((term) => expanded.add(term))

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
