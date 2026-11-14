import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applySkillUpdate,
  buildAdminProfilePatch,
  buildAdminProfileRpcPayload,
  buildAdminRelationPatches,
  formatAdminProfileSaveError,
  validateAdminProfileEdit,
  type AdminProfileLike,
  type AdminEditFormState,
} from '../src/lib/admin-profile-edit.ts'

test('detecta cambios exclusivos de mayúsculas/minúsculas en campos de texto principales', () => {
  const originalProfile: AdminProfileLike = {
    id: 'usr-1',
    name: 'JUAN PEREZ',
    bio: 'carpintero y techista profesional',
    provincia: 'buenos aires',
    localidad: 'la plata',
    zona_trabajo: 'casco urbano',
    modalidad: 'presencial',
    disponibilidad: 'disponible',
    intent: 'ofrecer',
  }

  const editForm: AdminEditFormState = {
    name: 'Juan Perez',
    bio: 'Carpintero y Techista Profesional',
    provincia: 'Buenos Aires',
    localidad: 'La Plata',
    zona_trabajo: 'Casco Urbano',
    modalidad: 'presencial',
    disponibilidad: 'disponible',
    intent: 'ofrecer',
  }

  const patch = buildAdminProfilePatch(originalProfile, editForm)

  assert.equal(patch.name, 'Juan Perez')
  assert.equal(patch.bio, 'Carpintero y Techista Profesional')
  assert.equal(patch.provincia, 'Buenos Aires')
  assert.equal(patch.localidad, 'La Plata')
  assert.equal(patch.zona_trabajo, 'Casco Urbano')
  // Campos sin modificación no deben incluirse en el patch
  assert.equal(patch.modalidad, undefined)
  assert.equal(patch.disponibilidad, undefined)
  assert.equal(patch.intent, undefined)
  assert.equal(Object.keys(patch).length, 5)
})

test('detecta cambios de mayúsculas/minúsculas en relaciones: servicios, medios de contacto e idiomas', () => {
  const originalProfile: AdminProfileLike = {
    id: 'usr-2',
    name: 'Ana Gomez',
    services: [
      { id: 'srv-1', title: 'instalaciones electricas', description: 'monofasica y trifasica', precio_orientativo: 'a convenir' },
    ],
    contact_methods: [
      { id: 'cnt-1', type: 'linkedin', value: 'https://linkedin.com/in/anagomez', is_public: true },
    ],
    profile_languages: [
      { language: 'ingles', level: 'avanzado', is_public: true },
    ],
  }

  const editForm: AdminEditFormState = {
    name: 'Ana Gomez',
    services: [
      { id: 'srv-1', title: 'Instalaciones Eléctricas', description: 'Monofásica y Trifásica', precio_orientativo: 'A Convenir' },
    ],
    contact_methods: [
      { id: 'cnt-1', type: 'linkedin', value: 'https://linkedin.com/in/AnaGomez', is_public: true },
    ],
    languages: [
      { language: 'Inglés', level: 'avanzado', is_public: true },
    ],
  }

  const { servicesPatch, contactsPatch, languagesPatch } = buildAdminRelationPatches(originalProfile, editForm)

  assert.ok(servicesPatch, 'Debe generar servicesPatch ante cambio de mayúsculas')
  assert.equal(servicesPatch[0].title, 'Instalaciones Eléctricas')

  assert.ok(contactsPatch, 'Debe generar contactsPatch ante cambio de mayúsculas en la URL')
  assert.equal(contactsPatch[0].value, 'https://linkedin.com/in/AnaGomez')

  assert.ok(languagesPatch, 'Debe generar languagesPatch ante cambio de mayúsculas en el idioma')
  assert.equal(languagesPatch[0].language, 'Inglés')
})

test('applySkillUpdate actualiza la mayúscula preservando id y estructura existente', () => {
  const initialSkills = [
    { id: 'sk-1', name: 'plomero matriculado' },
    { id: 'sk-2', name: 'gasista' },
  ]

  const { skills, changed } = applySkillUpdate(initialSkills, 'Plomero Matriculado')

  assert.equal(changed, true)
  assert.equal(skills.length, 2)
  assert.equal(skills[0].id, 'sk-1')
  assert.equal(skills[0].name, 'Plomero Matriculado')
  assert.equal(skills[1].name, 'gasista')
})

test('applySkillUpdate no duplica ni modifica si la habilidad coincide exactamente', () => {
  const initialSkills = [{ id: 'sk-1', name: 'Gasista' }]
  const { skills, changed } = applySkillUpdate(initialSkills, 'Gasista')

  assert.equal(changed, false)
  assert.deepEqual(skills, initialSkills)
})

test('applySkillUpdate agrega una nueva habilidad si no existía previamente', () => {
  const initialSkills = [{ id: 'sk-1', name: 'Gasista' }]
  const { skills, changed } = applySkillUpdate(initialSkills, 'Electricista')

  assert.equal(changed, true)
  assert.equal(skills.length, 2)
  assert.equal(skills[1].name, 'Electricista')
})

test('validación: rechaza guardar si no se ingresó motivo de auditoría o tiene menos de 3 caracteres', () => {
  const profile: AdminProfileLike = { id: 'usr-3', name: 'Pedro' }
  const form: AdminEditFormState = { name: 'Pedro Luis' }

  assert.equal(validateAdminProfileEdit(profile, form, '').isValid, false)
  assert.match(validateAdminProfileEdit(profile, form, '').error || '', /motivo de auditoría/i)

  assert.equal(validateAdminProfileEdit(profile, form, '  ok  ').isValid, false)
  assert.equal(validateAdminProfileEdit(profile, form, 'Corrección ortográfica').isValid, true)
})

test('validación: rechaza guardar si el nombre queda vacío', () => {
  const profile: AdminProfileLike = { id: 'usr-4', name: 'Pedro' }
  const form: AdminEditFormState = { name: '   ' }

  const res = validateAdminProfileEdit(profile, form, 'Corrección de datos')
  assert.equal(res.isValid, false)
  assert.match(res.error || '', /nombre del perfil/i)
})

test('validación: perfiles históricos incompletos se pueden editar sin exigir provincia/localidad ajenas', () => {
  const historicalIncompleteProfile: AdminProfileLike = {
    id: 'usr-5',
    name: 'Carlos Antiguo',
    status: 'incompleto',
    provincia: null,
    localidad: null,
    bio: 'bio previa',
  }

  // Modifica únicamente la bio, manteniendo provincia y localidad vacías
  const form: AdminEditFormState = {
    name: 'Carlos Antiguo',
    bio: 'Bio corregida por administración',
    provincia: '',
    localidad: '',
  }

  const validation = validateAdminProfileEdit(historicalIncompleteProfile, form, 'Actualización de bio histórica')
  assert.equal(validation.isValid, true, 'No debe exigir provincia/localidad a perfiles históricos inactivos que no la tenían')

  const payload = buildAdminProfileRpcPayload(historicalIncompleteProfile, form, 'Actualización de bio histórica')
  assert.equal(payload.target_profile_id, 'usr-5')
  assert.equal(payload.edit_reason, 'Actualización de bio histórica')
  assert.deepEqual(payload.profile_patch, { bio: 'Bio corregida por administración' })
})

test('validación: exige ubicación si el perfil está activo o si el administrador editó la ubicación', () => {
  const activeProfile: AdminProfileLike = {
    id: 'usr-6',
    name: 'María Activa',
    status: 'activo',
    provincia: 'Buenos Aires',
    localidad: 'Quilmes',
  }

  // Si intenta vaciar la localidad en un perfil activo
  const form1: AdminEditFormState = {
    name: 'María Activa',
    provincia: 'Buenos Aires',
    localidad: '',
  }
  const val1 = validateAdminProfileEdit(activeProfile, form1, 'Motivo válido')
  assert.equal(val1.isValid, false)
  assert.match(val1.error || '', /provincia y localidad/i)

  // Si en un perfil inactivo el admin toca la provincia pero deja vacía la localidad
  const inactiveProfile: AdminProfileLike = {
    id: 'usr-7',
    name: 'Lucas Inactivo',
    status: 'incompleto',
    provincia: null,
    localidad: null,
  }
  const form2: AdminEditFormState = {
    name: 'Lucas Inactivo',
    provincia: 'Córdoba',
    localidad: '',
  }
  const val2 = validateAdminProfileEdit(inactiveProfile, form2, 'Motivo válido')
  assert.equal(val2.isValid, false)
  assert.match(val2.error || '', /provincia y localidad/i)
})

test('validación: detecta ausencia de cambios y evita invocar Supabase RPC innecesariamente', () => {
  const profile: AdminProfileLike = {
    id: 'usr-8',
    name: 'Roberto',
    bio: 'Pintor de obra',
    provincia: 'Santa Fe',
    localidad: 'Rosario',
    skills: [{ id: 's-1', name: 'Pintor' }],
  }

  const form: AdminEditFormState = {
    name: 'Roberto',
    bio: 'Pintor de obra',
    provincia: 'Santa Fe',
    localidad: 'Rosario',
    skills: [{ id: 's-1', name: 'Pintor' }],
  }

  const validation = validateAdminProfileEdit(profile, form, 'Sin cambios reales')
  assert.equal(validation.isValid, false)
  assert.match(validation.error || '', /no se detectaron modificaciones/i)
})

test('construcción de RPC payload incluye edit_reason y patches exactos', () => {
  const profile: AdminProfileLike = {
    id: 'usr-9',
    name: 'valeria lopez',
    skills: [{ id: 's-10', name: 'carpinteria' }],
  }

  const form: AdminEditFormState = {
    name: 'Valeria Lopez',
    skills: [{ id: 's-10', name: 'Carpintería' }],
  }

  const payload = buildAdminProfileRpcPayload(profile, form, 'Normalización de mayúsculas')
  assert.deepEqual(payload, {
    target_profile_id: 'usr-9',
    profile_patch: { name: 'Valeria Lopez' },
    skills_patch: [{ id: 's-10', name: 'Carpintería' }],
    edit_reason: 'Normalización de mayúsculas',
  })
})

test('formateo de errores de guardado: no sugiere migraciones genéricas y clasifica errores SQL', () => {
  // Error de operador/tipo SQL
  const typeError = formatAdminProfileSaveError({
    code: '42883',
    message: 'operator does not exist: text ->> unknown',
  })
  assert.match(typeError, /incompatibilidad de tipos/)
  assert.match(typeError, /operator does not exist: text ->> unknown/)
  assert.doesNotMatch(typeError, /migración de guardrails/i)

  // Error de permisos
  const permError = formatAdminProfileSaveError({
    code: '42501',
    message: 'admin_only',
  })
  assert.match(permError, /permiso denegado/i)
  assert.doesNotMatch(permError, /guardrails/i)

  // Error de validación de motivo
  const reasonError = formatAdminProfileSaveError({
    message: 'invalid_edit_reason',
  })
  assert.match(reasonError, /motivo de auditoría/i)

  // Error de red
  const netError = formatAdminProfileSaveError({
    message: 'Failed to fetch',
  })
  assert.match(netError, /conexión/i)
})

