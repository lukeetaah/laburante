import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import { PROVINCES } from '@/data/provinces'
import { CATEGORIES } from '@/data/categories'
import { Plus, Trash2, CheckCircle2, ShieldAlert, ArrowRight, User } from 'lucide-react'

export default function CreateProfile() {
  const { user, loading: authLoading } = useAuthStore()
  const { myProfile, fetchMyProfile, createProfile } = useProfileStore()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [provincia, setProvincia] = useState('CABA')
  const [localidad, setLocalidad] = useState('')
  const [zonaTrabajo, setZonaTrabajo] = useState('')
  const [modalidad, setModalidad] = useState<'presencial' | 'remoto' | 'ambas'>('presencial')
  const [disponibilidad, setDisponibilidad] = useState<'disponible' | 'ocupado' | 'no_disponible'>('disponible')
  const [isEditing, setIsEditing] = useState(false)

  // Dynamic lists
  const [skills, setSkills] = useState<string[]>([''])
  const [services, setServices] = useState<{ title: string; description: string; precio_orientativo: string }[]>([
    { title: '', description: '', precio_orientativo: '' }
  ])
  const [contactMethods, setContactMethods] = useState<{ type: string; value: string }[]>([
    { type: 'whatsapp', value: '' }
  ])

  // Explicit voluntary consent checkbox (CRITICAL REQUIREMENT)
  const [consentGranted, setConsentGranted] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    fetchMyProfile().then((existing) => {
      if (existing) {
        setIsEditing(true)
        setName(existing.name || '')
        setBio(existing.bio || '')
        setProvincia(existing.provincia || 'CABA')
        setLocalidad(existing.localidad || '')
        setZonaTrabajo(existing.zona_trabajo || '')
        setModalidad(existing.modalidad || 'presencial')
        setDisponibilidad(existing.disponibilidad || 'disponible')
        if (existing.skills && existing.skills.length > 0) {
          setSkills(existing.skills)
        }
        if (existing.services && existing.services.length > 0) {
          setServices(
            existing.services.map((s) => ({
              title: s.title,
              description: s.description || '',
              precio_orientativo: s.precio_orientativo || '',
            }))
          )
        }
        if (existing.contact_methods && existing.contact_methods.length > 0) {
          setContactMethods(
            existing.contact_methods.map((c) => ({
              type: c.type,
              value: c.value,
            }))
          )
        }
        setConsentGranted(true)
      } else if (user.user_metadata) {
        if (user.user_metadata.name) setName(user.user_metadata.name)
        if (user.user_metadata.provincia) setProvincia(user.user_metadata.provincia)
        if (user.user_metadata.localidad) setLocalidad(user.user_metadata.localidad)
        if (user.user_metadata.phone) {
          setContactMethods([{ type: 'whatsapp', value: user.user_metadata.phone }])
        }
      }
    })
  }, [user, fetchMyProfile])

  if (authLoading) {
    return <div className="container py-20 text-center text-sm">Cargando...</div>
  }

  if (!user) {
    return (
      <div className="container py-20 text-center max-w-md mx-auto space-y-4">
        <div className="h-12 w-12 rounded-full bg-[var(--color-laburante-surface-alt)] mx-auto flex items-center justify-center text-[var(--color-laburante-accent)]">
          <User size={24} />
        </div>
        <h2 className="font-heading text-2xl font-bold text-[var(--color-laburante-text)]">
          Iniciá sesión para publicar tu perfil
        </h2>
        <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
          Para que puedas editar o dar de baja tu perfil en cualquier momento, necesitás tener una cuenta gratuita en LABURANTE.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/ingresar"
            className="py-3 px-6 rounded-xl bg-[var(--color-laburante-text)] text-white text-xs font-heading font-semibold hover:bg-black transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/registrar"
            className="py-3 px-6 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-[var(--color-laburante-text)] text-xs font-heading font-semibold hover:bg-[var(--color-laburante-surface-alt)] transition-colors"
          >
            Crear cuenta gratis
          </Link>
        </div>
      </div>
    )
  }

  // Skills handlers
  const handleAddSkill = () => setSkills([...skills, ''])
  const handleRemoveSkill = (idx: number) => setSkills(skills.filter((_, i) => i !== idx))
  const handleSkillChange = (idx: number, val: string) => {
    const updated = [...skills]
    updated[idx] = val
    setSkills(updated)
  }

  // Services handlers
  const handleAddService = () => setServices([...services, { title: '', description: '', precio_orientativo: '' }])
  const handleRemoveService = (idx: number) => setServices(services.filter((_, i) => i !== idx))
  const handleServiceChange = (idx: number, field: string, val: string) => {
    const updated = [...services]
    updated[idx] = { ...updated[idx], [field]: val }
    setServices(updated)
  }

  // Contact handlers
  const handleAddContact = () => setContactMethods([...contactMethods, { type: 'whatsapp', value: '' }])
  const handleRemoveContact = (idx: number) => setContactMethods(contactMethods.filter((_, i) => i !== idx))
  const handleContactChange = (idx: number, field: string, val: string) => {
    const updated = [...contactMethods]
    updated[idx] = { ...updated[idx], [field]: val }
    setContactMethods(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consentGranted) {
      setError('Tenés que confirmar el consentimiento para publicar tu perfil y datos de contacto.')
      return
    }

    if (!name.trim()) {
      setError('Ingresá tu nombre o nombre profesional.')
      return
    }

    if (!localidad.trim()) {
      setError('Ingresá tu localidad o barrio.')
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      name: name.trim(),
      bio: bio.trim(),
      provincia,
      localidad: localidad.trim(),
      zona_trabajo: zonaTrabajo.trim(),
      modalidad,
      disponibilidad,
      skills: skills.filter((s) => s.trim()),
      services: services.filter((s) => s.title.trim()),
      contact_methods: contactMethods.filter((c) => c.value.trim()),
    }

    const res = await createProfile(payload)
    setSubmitting(false)

    if (res.error) {
      setError(res.error)
    } else if (res.slug) {
      navigate(`/p/${res.slug}`)
    }
  }

  return (
    <div className="container py-8 md:py-12 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)] tracking-tight">
          {isEditing ? 'Editar mi perfil profesional' : 'Ofrecé tu trabajo en LABURANTE'}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] mt-1">
          {isEditing
            ? 'Actualizá tus especialidades, servicios, zona de cobertura o datos de contacto.'
            : 'Completá lo que sabés hacer para que personas de tu zona puedan encontrarte y contactarte. 100% gratuito.'}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Banner: Editing existing published profile */}
      {isEditing && myProfile && (
        <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm space-y-0.5">
            <p className="font-bold text-indigo-900 flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />
              Tu perfil está activo y publicado
            </p>
            <p className="text-indigo-700 text-xs">
              Los cambios que guardes se reflejarán inmediatamente en las búsquedas públicas.
            </p>
          </div>
          <Link
            to={`/p/${myProfile.slug}`}
            className="px-4 py-2 rounded-xl bg-white border border-indigo-200 font-heading font-bold text-xs text-indigo-700 hover:bg-indigo-100/50 shrink-0 transition-colors shadow-2xs"
          >
            Ver mi perfil público →
          </Link>
        </div>
      )}

      {/* Banner: Arrived from registration */}
      {typeof window !== 'undefined' && window.location.search.includes('from=registro') && !isEditing && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3">
          <CheckCircle2 size={22} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1">
            <p className="font-bold text-amber-900">
              ¡Cuenta creada! Paso 2 de 2: Completá tu perfil profesional
            </p>
            <p className="text-amber-800 leading-relaxed text-xs">
              Ya precargamos tus datos de contacto iniciales. Solo agregá qué tareas realizás, tu zona habitual y confirmá la publicación para empezar a recibir consultas directas.
            </p>
          </div>
        </div>
      )}

      {typeof window !== 'undefined' && (window.location.search.includes('confirmed=true') || window.location.hash.includes('access_token')) && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
          <CheckCircle2 size={22} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1">
            <p className="font-bold">
              ¡Tu correo electrónico ha sido verificado con éxito!
            </p>
            <p className="text-emerald-800 leading-relaxed">
              Ya precargamos los datos iniciales de tu cuenta. Completá tu presentación, habilidades y confirmá el consentimiento de contacto para que tu perfil quede publicado en LABURANTE.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Basic Info */}
        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-4">
          <h2 className="font-heading text-base font-bold text-[var(--color-laburante-text)] pb-2 border-b border-[var(--color-laburante-border)]">
            1. Datos de tu perfil
          </h2>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
              Nombre o nombre profesional <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Juan Pérez o Taller San Martín"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
              Presentación breve / ¿Qué sabés hacer?
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Contá brevemente tu experiencia, especialidad o forma de trabajar..."
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)] resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                Provincia <span className="text-rose-500">*</span>
              </label>
              <select
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
              >
                {PROVINCES.map((p) => (
                  <option key={p.slug} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                Localidad o barrio <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                placeholder="ej: Palermo, Rosario, Godoy Cruz..."
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
              Zona de alcance habitual (opcional)
            </label>
            <input
              type="text"
              value={zonaTrabajo}
              onChange={(e) => setZonaTrabajo(e.target.value)}
              placeholder="ej: Zona Norte y CABA, o hasta 20km a la redonda..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                Modalidad de trabajo
              </label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
              >
                <option value="presencial">Presencial en zona</option>
                <option value="remoto">100% Remoto</option>
                <option value="ambas">Ambas modalidades</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                Disponibilidad actual
              </label>
              <select
                value={disponibilidad}
                onChange={(e) => setDisponibilidad(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
              >
                <option value="disponible">Disponible de inmediato</option>
                <option value="ocupado">Con demora / agenda ocupada</option>
                <option value="no_disponible">Pausado temporalmente</option>
              </select>
            </div>
          </div>
        </section>

        {/* Section 2: Skills */}
        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-laburante-border)]">
            <h2 className="font-heading text-base font-bold text-[var(--color-laburante-text)]">
              2. Habilidades y oficios
            </h2>
            <button
              type="button"
              onClick={handleAddSkill}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-laburante-indigo)] hover:underline"
            >
              <Plus size={14} /> Agregar habilidad
            </button>
          </div>

          <div className="space-y-2">
            {skills.map((skill, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={skill}
                  onChange={(e) => handleSkillChange(idx, e.target.value)}
                  placeholder="ej: Plomería general, Termofusión, Arreglos rápidos..."
                  className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
                />
                {skills.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(idx)}
                    className="p-2 text-[var(--color-laburante-text-muted)] hover:text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Services & Prices */}
        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-laburante-border)]">
            <h2 className="font-heading text-base font-bold text-[var(--color-laburante-text)]">
              3. Servicios que ofrecés
            </h2>
            <button
              type="button"
              onClick={handleAddService}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-laburante-indigo)] hover:underline"
            >
              <Plus size={14} /> Agregar servicio
            </button>
          </div>

          <div className="space-y-4">
            {services.map((srv, idx) => (
              <div key={idx} className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/30 space-y-3 relative">
                <div className="flex items-start justify-between gap-2">
                  <input
                    type="text"
                    value={srv.title}
                    onChange={(e) => handleServiceChange(idx, 'title', e.target.value)}
                    placeholder="Título del servicio (ej: Reparación de pérdidas o canillas)"
                    className="flex-1 px-3 py-2 text-sm font-semibold rounded-xl border border-[var(--color-laburante-border)] bg-white"
                  />
                  {services.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveService(idx)}
                      className="p-2 text-[var(--color-laburante-text-muted)] hover:text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={srv.description}
                      onChange={(e) => handleServiceChange(idx, 'description', e.target.value)}
                      placeholder="Breve descripción de lo que incluye..."
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={srv.precio_orientativo}
                      onChange={(e) => handleServiceChange(idx, 'precio_orientativo', e.target.value)}
                      placeholder="Precio orientativo (opcional)"
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Voluntary Contact Methods & Consent */}
        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-laburante-border)]">
            <h2 className="font-heading text-base font-bold text-[var(--color-laburante-text)]">
              4. Medios de contacto voluntarios
            </h2>
            <button
              type="button"
              onClick={handleAddContact}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-laburante-indigo)] hover:underline"
            >
              <Plus size={14} /> Agregar otro medio
            </button>
          </div>

          <p className="text-xs text-[var(--color-laburante-text-secondary)]">
            Solo cargá aquellos canales a través de los cuales deseás que la gente te escriba o llame.
          </p>

          <div className="space-y-3">
            {contactMethods.map((c, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-center gap-2">
                <select
                  value={c.type}
                  onChange={(e) => handleContactChange(idx, 'type', e.target.value)}
                  className="w-full sm:w-40 px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-transparent capitalize"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telefono">Teléfono</option>
                  <option value="email">Email</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="portfolio">Portfolio</option>
                  <option value="web">Sitio Web</option>
                </select>

                <input
                  type="text"
                  value={c.value}
                  onChange={(e) => handleContactChange(idx, 'value', e.target.value)}
                  placeholder="ej: 11 2345-6789 o @mi.perfil o miweb.com"
                  className="flex-1 w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
                />

                {contactMethods.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveContact(idx)}
                    className="p-2 text-[var(--color-laburante-text-muted)] hover:text-rose-600 self-end sm:self-center"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* CRITICAL CONSENT CHECKBOX */}
          <div className="pt-4 mt-4 border-t border-[var(--color-laburante-border)]">
            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-2xl bg-amber-50/80 border border-amber-200">
              <input
                type="checkbox"
                checked={consentGranted}
                onChange={(e) => setConsentGranted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-amber-300 text-[var(--color-laburante-accent)] focus:ring-0 cursor-pointer"
                required
              />
              <span className="text-xs text-amber-950 leading-relaxed font-medium">
                <strong>Consentimiento expreso de publicación:</strong> Entiendo y autorizo a que los datos de contacto y servicios que he ingresado voluntariamente sean visibles en mi perfil público de LABURANTE para que potenciales clientes o colaboradores puedan comunicarse conmigo.
              </span>
            </label>
          </div>
        </section>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn-dark w-full py-4 px-6 rounded-2xl font-heading font-bold text-base transition-all shadow-md disabled:opacity-50"
          >
            {submitting
              ? 'Guardando cambios...'
              : isEditing
              ? 'Guardar y actualizar mi perfil'
              : 'Publicar mi perfil en LABURANTE'}
          </button>
        </div>
      </form>
    </div>
  )
}
