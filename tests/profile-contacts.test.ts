import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPublicProfileContactHref,
  getPublicProfileContacts,
  toEditableContactMethod,
} from '../src/lib/contact-methods.ts'

test('public profiles expose portfolio and LinkedIn when both are public', () => {
  const contacts = getPublicProfileContacts([
    { type: 'portfolio', value: 'luksonarts.vercel.app', is_public: true },
    { type: 'linkedin', value: 'https://www.linkedin.com/in/lucas-correa/', is_public: true },
  ])

  assert.deepEqual(contacts.map((contact) => contact.type), ['portfolio', 'linkedin'])
  assert.equal(getPublicProfileContactHref('portfolio', contacts[0].value), 'https://luksonarts.vercel.app/')
  assert.equal(getPublicProfileContactHref('linkedin', contacts[1].value), 'https://www.linkedin.com/in/lucas-correa/')
})

test('private and direct contact channels stay out of public profile links', () => {
  const contacts = getPublicProfileContacts([
    { type: 'portfolio', value: 'miweb.com', is_public: true },
    { type: 'linkedin', value: 'linkedin.com/in/mi-perfil', is_public: false },
    { type: 'email', value: 'persona@example.com', is_public: true },
    { type: 'telefono', value: '11 1234 5678', is_public: true },
  ])

  assert.deepEqual(contacts.map((contact) => contact.type), ['portfolio'])
})

test('Instagram handles and additional public links normalize without empty buttons', () => {
  const contacts = getPublicProfileContacts([
    { type: 'instagram', value: '@mi.perfil', is_public: true },
    { type: 'web', value: 'https://ejemplo.com', is_public: true },
    { type: 'portfolio', value: '   ', is_public: true },
    { type: 'instagram', value: '@mi.perfil', is_public: true },
  ])

  assert.deepEqual(contacts.map((contact) => contact.type), ['instagram', 'web'])
  assert.equal(getPublicProfileContactHref('instagram', contacts[0].value), 'https://instagram.com/mi.perfil')
  assert.equal(getPublicProfileContactHref('web', contacts[1].value), 'https://ejemplo.com/')
  assert.equal(getPublicProfileContactHref('web', 'not a valid url'), null)
})

test('editing a profile preserves the existing public visibility decision', () => {
  assert.deepEqual(
    toEditableContactMethod({ type: 'linkedin', value: 'linkedin.com/in/perfil', is_public: false }),
    { type: 'linkedin', value: 'linkedin.com/in/perfil', is_public: false },
  )
  assert.deepEqual(
    toEditableContactMethod({ type: 'portfolio', value: 'miweb.com' }),
    { type: 'portfolio', value: 'miweb.com', is_public: true },
  )
})
