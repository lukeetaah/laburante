import assert from 'node:assert/strict'
import test from 'node:test'
import {
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
