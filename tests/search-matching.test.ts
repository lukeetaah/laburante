import assert from 'node:assert/strict'
import test from 'node:test'
import {
  categoryWorkTerms,
  categorySearchTerms,
  expandCategorySearchTerms,
  matchesCategoryDocument,
  matchesSearchDocument,
  normalizeSearchText,
  searchTermVariants,
  scoreSearchDocument,
} from '../src/lib/search-matching.ts'

const catalogTerms = ['Contador']

test('Contador requires declared work evidence and matches feminine variants', () => {
  const document = { publicText: 'Perfil profesional', workText: 'Contadora con experiencia' }
  assert.equal(matchesSearchDocument('Contador', document, catalogTerms, ['contador', 'contadora']), true)
  assert.equal(matchesSearchDocument('Contadora', document, catalogTerms, ['contadora', 'contador']), true)
  assert.equal(matchesSearchDocument('Contadoras', document, catalogTerms, ['contadoras']), true)
})

test('matching is case and accent insensitive', () => {
  const document = { publicText: 'Diseñadora gráfica', workText: 'Ilustración' }
  assert.equal(matchesSearchDocument('DISENADORA', document, [], ['disenadora']), true)
  assert.equal(normalizeSearchText('Árboles   Públicos'), 'arboles publicos')
})

test('the database prefilter keeps accented and unaccented catalog spellings', () => {
  const catalog = ['Carpintería']
  const accentedVariants = searchTermVariants('Carpintería', catalog)
  const unaccentedVariants = searchTermVariants('Carpinteria', catalog)

  assert.ok(accentedVariants.includes('carpintería'))
  assert.ok(accentedVariants.includes('carpinteria'))
  assert.ok(unaccentedVariants.includes('carpintería'))
  assert.ok(unaccentedVariants.includes('carpinteria'))
  assert.equal(accentedVariants.some((term) => 'carpintería'.toLowerCase().includes(term)), true)
  assert.equal(unaccentedVariants.some((term) => 'carpintería'.toLowerCase().includes(term)), true)
})

test('exact and partial skill/service searches use declared work evidence', () => {
  const skill = { publicText: 'Perfil profesional', workText: 'Carpintería' }
  const service = { publicText: 'Perfil profesional', workText: 'Carpintería a medida' }

  for (const query of ['Carpintería', 'Carpinteria', 'Carpinter']) {
    assert.equal(matchesSearchDocument(query, skill, ['Carpintería'], [query]), true)
    assert.equal(matchesSearchDocument(query, service, ['Carpintería'], [query]), true)
  }

  assert.equal(matchesSearchDocument('Carpinter', { publicText: 'Busco carpintería', workText: '' }, ['Carpintería'], ['carpinter']), false)
})

test('work fields and public fields both participate without leaking private fields', () => {
  const skillDocument = { publicText: 'Perfil profesional', workText: 'Contadora independiente' }
  const privateOnlyDocument = { publicText: 'Perfil profesional', workText: '' }
  assert.equal(matchesSearchDocument('contador', skillDocument, catalogTerms, ['contador']), true)
  assert.equal(matchesSearchDocument('contador', privateOnlyDocument, catalogTerms, ['contador']), false)
})

test('specific searches score matching profiles and ignore empty input', () => {
  const document = { publicText: 'Contadora', workText: 'Impuestos' }
  assert.ok(scoreSearchDocument('contador', document, ['contador']) > 0)
  assert.equal(matchesSearchDocument('   ', document, catalogTerms, ['contador']), false)
})

test('category matching uses declared taxonomy terms as whole words', () => {
  const constructionTerms = categoryWorkTerms({ subcategories: ['Albañil', 'Albañilería', 'Arquitectura', 'Techado', 'Refacciones'] })
  assert.equal(matchesCategoryDocument({ publicText: '', workText: 'Arquitectura y techado' }, constructionTerms), true)
  assert.equal(matchesCategoryDocument({ publicText: 'Construcción de viviendas', workText: '' }, constructionTerms), false)
  assert.equal(matchesCategoryDocument({ publicText: 'Gestión administrativa', workText: '' }, constructionTerms), false)
})

test('Construcción requires work evidence and rejects descriptive false positives', () => {
  const constructionTerms = categoryWorkTerms({
    subcategories: ['Albañil', 'Albañilería', 'Arquitectura', 'Techado', 'Refacciones'],
  })

  assert.equal(matchesCategoryDocument({ publicText: '', workText: 'Albañilería y refacción de viviendas' }, constructionTerms), true)
  assert.equal(matchesCategoryDocument({ publicText: '', workText: 'Arquitectura y dirección de obra' }, constructionTerms), true)
  assert.equal(matchesCategoryDocument({ publicText: 'Acompañante terapéutica en Construcción', workText: '' }, constructionTerms), false)
  assert.equal(matchesCategoryDocument({ publicText: 'Desarrollador de software e infraestructura', workText: '' }, constructionTerms), false)
  assert.equal(matchesCategoryDocument({ publicText: '', workText: 'Construcción de software e infraestructura' }, constructionTerms), false)
  assert.equal(matchesCategoryDocument({ publicText: 'Busco construir un proyecto', workText: '' }, constructionTerms), false)
})

test('shared specialties remain valid across categories', () => {
  const architecture = { publicText: '', workText: 'Arquitectura y diseño de planos' }
  const care = { publicText: '', workText: 'Enfermería y cuidado domiciliario' }
  const technology = { publicText: '', workText: 'Desarrollo de software e infraestructura' }

  assert.equal(matchesCategoryDocument(architecture, categoryWorkTerms({ subcategories: ['Arquitectura'] })), true)
  assert.equal(matchesCategoryDocument(care, categoryWorkTerms({ subcategories: ['Enfermería', 'Cuidado de personas'] })), true)
  assert.equal(matchesCategoryDocument(technology, categoryWorkTerms({ subcategories: ['Desarrollo de software', 'Infraestructura'] })), true)
  assert.equal(matchesCategoryDocument(technology, categoryWorkTerms({ subcategories: ['Albañil', 'Techado'] })), false)
})

test('Cuidado accepts declared care work and rejects unrelated construction work', () => {
  const careTerms = ['Cuidado', 'Niñera', 'Cuidado de mascotas', 'Paseo de perros', 'Enfermería']
  assert.equal(matchesCategoryDocument({ publicText: '', workText: 'Paseo de perros' }, careTerms), true)
  assert.equal(matchesCategoryDocument({ publicText: '', workText: 'Albañilería y techado' }, careTerms), false)
  assert.equal(matchesCategoryDocument({ publicText: '', workText: 'Enfermería y acompañante terapéutico' }, careTerms), true)
})

test('Finanzas expands through the existing category taxonomy', () => {
  const expandedTerms = expandCategorySearchTerms('FINANZAS', [{
    name: 'Negocios, administración y finanzas',
    subcategories: ['Administración', 'Ventas'],
  }])
  assert.ok(expandedTerms.includes('administracion'))
  assert.equal(
    matchesSearchDocument('Finanzas', { publicText: '', workText: 'Administración y ventas' }, ['Administración', 'Finanzas'], expandedTerms),
    true,
  )
})

test('Oficios keeps its parent behavior and accepts a subcategory filter', () => {
  const categories = [
    { name: 'Oficios', subcategories: ['Plomería', 'Carpintería'] },
    { name: 'Construcción', subcategories: ['Albañilería'] },
  ]

  assert.deepEqual(categorySearchTerms('Oficios', categories), ['Plomería', 'Carpintería'])
  assert.deepEqual(categorySearchTerms('Carpinteria', categories), ['Carpintería'])
  assert.equal(matchesCategoryDocument({ publicText: '', workText: 'Carpintería' }, categorySearchTerms('Carpinteria', categories).map((term) => normalizeSearchText(term))), true)
})
