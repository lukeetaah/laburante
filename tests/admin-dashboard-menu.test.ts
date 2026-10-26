import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/pages/Admin.tsx', import.meta.url), 'utf8')

test('el menú compacto conserva el acceso a todos los módulos administrativos vigentes', () => {
  for (const tab of ['legal', 'analytics', 'jobs', 'verifications', 'confirmations', 'support', 'companies', 'company_ops', 'reports', 'profiles', 'deletions', 'reviews', 'settings']) {
    assert.match(source, new RegExp(`setActiveTab\\('${tab}'\\)`), `falta el módulo ${tab}`)
  }
  assert.match(source, /setActiveTab\('support'\)/)
})

test('el módulo Mensajes privado fue retirado y no acepta navegación directa', () => {
  assert.doesNotMatch(source, /['"]messages['"]|Mensajería con usuarios|Mensajes y soporte/)
  assert.doesNotMatch(source, /from\('conversations'\)|from\('messages'\)|send_conversation_message|conversacion/)
})

test('el dashboard usa una cuadrícula responsive compacta con badges visibles', () => {
  assert.match(source, /grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3/)
  assert.match(source, /p-3 sm:p-4 min-h-\[124px\] sm:min-h-\[146px\]/)
  assert.match(source, /\[&>button>div:last-child>p\]:hidden sm:\[&>button>div:last-child>p\]:block/)
})

test('el soporte identifica al solicitante y el autor de cada mensaje', () => {
  assert.match(source, /from\('profiles'\).*select\('id,name,account_type'\)/)
  assert.match(source, /author_id,author_role/)
  assert.match(source, /Solicitante:/)
  assert.match(source, /Respuesta del equipo LABURANTE/)
  assert.match(source, /Mensaje inicial · \{supportUserProfile\?\.name/)
})

