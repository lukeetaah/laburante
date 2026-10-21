import assert from 'node:assert/strict'
import test from 'node:test'
import {
  expandCategorySearchTerms,
  matchesCategoryDocument,
  matchesSearchDocument,
  normalizeSearchText,
  scoreSearchDocument,
} from '../src/lib/search-matching.ts'

const catalogTerms = ['Contador']

test('Contador finds a public profile containing Contadora in public text', () => {
  const document = { publicText: 'Contadora con experiencia', workText: '' }
  assert.equal(matchesSearchDocument('Contador', document, catalogTerms, ['contador', 'contadora']), true)
  assert.equal(matchesSearchDocument('Contadora', document, catalogTerms, ['contadora', 'contador']), true)
  assert.equal(matchesSearchDocument('Contadoras', document, catalogTerms, ['contadoras']), true)
})

test('matching is case and accent insensitive', () => {
  const document = { publicText: 'Diseñadora gráfica', workText: 'Ilustración' }
  assert.equal(matchesSearchDocument('DISENADORA', document, [], ['disenadora']), true)
  assert.equal(normalizeSearchText('Árboles   Públicos'), 'arboles publicos')
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
  const constructionTerms = ['Construcción', 'Arquitectura', 'Techado']
  assert.equal(matchesCategoryDocument({ publicText: '', workText: 'Arquitectura y techado' }, constructionTerms), true)
  assert.equal(matchesCategoryDocument({ publicText: 'Construcción de viviendas', workText: '' }, constructionTerms), true)
  assert.equal(matchesCategoryDocument({ publicText: 'Gestión administrativa', workText: '' }, constructionTerms), false)
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
