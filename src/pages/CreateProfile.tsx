import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { useProfileStore } from '@/stores/profile-store'
import { PROVINCES } from '@/data/provinces'
import { CATEGORIES } from '@/data/categories'
import { Plus, Trash2, CheckCircle2, ShieldAlert, ShieldCheck, ArrowRight, User, Eye, EyeOff, MessageCircle, AlertTriangle, Upload, FileText, Languages } from 'lucide-react'
import WhatsAppVerificationModal from '@/components/profile/WhatsAppVerificationModal'
import DeleteAccountModal from '@/components/profile/DeleteAccountModal'

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
  const [status, setStatus] = useState<'activo' | 'oculto'>('activo')
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('')
  const [existingResumeUrl, setExistingResumeUrl] = useState('')
  const [existingResumeName, setExistingResumeName] = useState('')

  // Modals state
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  // Dynamic lists
  const [skills, setSkills] = useState<string[]>([''])
  const [services, setServices] = useState<{ title: string; description: string; precio_orientativo: string }[]>([
    { title: '', description: '', precio_orientativo: '' }
  ])
  const [contactMethods, setContactMethods] = useState<{ type: string; value: string }[]>([
    { type: 'whatsapp', value: '' }
  ])
  const [languages, setLanguages] = useState<{ language: string; level: 'basico' | 'intermedio' | 'avanzado' | 'bilingue' | 'nativo'; is_public: boolean }[]>([])

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
        setStatus(existing.status === 'oculto' ? 'oculto' : 'activo')
        setExistingPhotoUrl(existing.photo_url || '')
        setExistingResumeUrl(existing.resume_url || '')
        setExistingResumeName(existing.resume_name || '')
        if (existing.notify_whatsapp !== undefined) {
          setNotifyWhatsapp(existing.notify_whatsapp)
        }
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
        if (existing.languages && existing.languages.length > 0) setLanguages(existing.languages)
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

  const handleAddLanguage = () => setLanguages([...languages, { language: '', level: 'intermedio', is_public: true }])
  const handleRemoveLanguage = (idx: number) => setLanguages(languages.filter((_, i) => i !== idx))
  const handleLanguageChange = (idx: number, field: 'language' | 'level' | 'is_public', value: string | boolean) => {
    const updated = [...languages]
    updated[idx] = { ...updated[idx], [field]: value } as typeof updated[number]
    setLanguages(updated)
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

    const uploadAsset = async (file: File | null, kind: 'photo' | 'resume') => {
      if (!file || !user) return kind === 'photo' ? existingPhotoUrl : existingResumeUrl
      const allowed = kind === 'photo'
        ? ['image/jpeg', 'image/png', 'image/webp']
        : ['application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowed.includes(file.type)) throw new Error(kind === 'photo' ? 'La foto debe ser JPG, PNG o WebP.' : 'El CV debe ser PDF, DOC, DOCX, CSV o TXT.')
      if (file.size > 10 * 1024 * 1024) throw new Error('El archivo no puede superar los 10 MB.')
      const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
      const path = `${user.id}/${kind}-${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('profile-assets').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw new Error('No se pudo subir el archivo. Verificá que la migración de archivos esté aplicada en Supabase.')
      return supabase.storage.from('profile-assets').getPublicUrl(path).data.publicUrl
    }

    try {
      const photoUrl = await uploadAsset(photoFile, 'photo')
      const resumeUrl = await uploadAsset(resumeFile, 'resume')
      const payload = {
      name: name.trim(),
      bio: bio.trim(),
      provincia,
      localidad: localidad.trim(),
      zona_trabajo: zonaTrabajo.trim(),
      modalidad,
      disponibilidad,
      status,
      notify_whatsapp: notifyWhatsapp,
      skills: skills.filter((s) => s.trim()),
      services: services.filter((s) => s.title.trim()),
      contact_methods: contactMethods.filter((c) => c.value.trim()),
        languages: languages.filter((entry) => entry.language.trim()),
        photo_url: photoUrl || null,
        resume_url: resumeUrl || null,
        resume_name: resumeFile?.name || existingResumeName || null,
      }

      const res = await createProfile(payload)
      setSubmitting(false)

      if (res.error) setError(res.error)
      else if (res.slug) navigate(`/p/${res.slug}`)
    } catch (uploadError: any) {
      setSubmitting(false)
      setError(uploadError.message || 'No se pudo procesar el archivo.')
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

          {/* Visibility: Public vs Private */}
          <div className="pt-3 mt-2 border-t border-[var(--color-laburante-border)]">
            <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-2">
              Visibilidad de tu perfil en LABURANTE
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('activo')}
                className={`p-3.5 rounded-2xl border text-left transition-colors flex items-start gap-3 cursor-pointer ${
                  status === 'activo'
                    ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20 shadow-2xs'
                    : 'border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-secondary)]'
                }`}
              >
                <Eye size={18} className={status === 'activo' ? 'text-emerald-600 mt-0.5 shrink-0' : 'text-gray-400 mt-0.5 shrink-0'} />
                <div>
                  <p className="font-heading font-bold text-xs">🟢 Público (Activo)</p>
                  <p className="text-[11px] leading-relaxed mt-0.5 opacity-80">
                    Aparece en búsquedas y categorías. Nuevos clientes pueden encontrarte y pedirte presupuestos.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatus('oculto')}
                className={`p-3.5 rounded-2xl border text-left transition-colors flex items-start gap-3 cursor-pointer ${
                  status === 'oculto'
                    ? 'border-amber-300 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20 shadow-2xs'
                    : 'border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-secondary)]'
                }`}
              >
                <EyeOff size={18} className={status === 'oculto' ? 'text-amber-600 mt-0.5 shrink-0' : 'text-gray-400 mt-0.5 shrink-0'} />
                <div>
                  <p className="font-heading font-bold text-xs">🔒 Privado / Pausado</p>
                  <p className="text-[11px] leading-relaxed mt-0.5 opacity-80">
                    Dejás de aparecer en el buscador. Ideal si tenés la agenda llena o estás de vacaciones sin borrar tu cuenta.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--color-laburante-border)] pb-2"><Upload size={17} className="text-[var(--color-laburante-indigo)]" /><h2 className="font-heading text-base font-bold">Foto y CV</h2></div>
          <p className="text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]">Mejorá tu presentación con una foto y un CV opcional. Sólo se muestran públicamente los archivos que subas a tu perfil.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="cursor-pointer rounded-2xl border border-dashed border-[var(--color-laburante-border)] p-4 text-xs hover:bg-[var(--color-laburante-surface-alt)]"><span className="font-semibold">Foto de perfil</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} className="mt-2 block w-full text-[11px]" />{photoFile?.name || existingPhotoUrl ? <span className="mt-2 block text-emerald-700">{photoFile?.name || 'Foto cargada'}</span> : null}</label>
            <label className="cursor-pointer rounded-2xl border border-dashed border-[var(--color-laburante-border)] p-4 text-xs hover:bg-[var(--color-laburante-surface-alt)]"><span className="font-semibold">CV o presentación</span><input type="file" accept=".pdf,.doc,.docx,.csv,.txt,application/pdf,text/plain,text/csv" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} className="mt-2 block w-full text-[11px]" />{resumeFile?.name || existingResumeUrl ? <span className="mt-2 flex items-center gap-1 text-emerald-700"><FileText size={13} />{resumeFile?.name || existingResumeName || 'CV cargado'}</span> : null}</label>
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

        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-laburante-border)] pb-2">
            <div className="flex items-center gap-2"><Languages size={17} className="text-[var(--color-laburante-indigo)]" /><h2 className="font-heading text-base font-bold">Idiomas</h2></div>
            <button type="button" onClick={handleAddLanguage} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-laburante-indigo)] hover:underline"><Plus size={14} /> Agregar idioma</button>
          </div>
          <p className="text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]">Mostrá los idiomas que podés usar en trabajos y elegí el nivel real de dominio.</p>
          {languages.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--color-laburante-border)] p-4 text-xs text-[var(--color-laburante-text-muted)]">Todavía no agregaste idiomas.</p> : <div className="space-y-2">
            {languages.map((entry, idx) => <div key={idx} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
              <input value={entry.language} onChange={(e) => handleLanguageChange(idx, 'language', e.target.value)} placeholder="Ej: Inglés" className="min-w-0 rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2 text-sm" />
              <select value={entry.level} onChange={(e) => handleLanguageChange(idx, 'level', e.target.value)} className="rounded-xl border border-[var(--color-laburante-border)] px-2.5 py-2 text-xs"><option value="basico">Básico</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option><option value="bilingue">Bilingüe</option><option value="nativo">Nativo</option></select>
              <button type="button" onClick={() => handleRemoveLanguage(idx)} className="p-2 text-[var(--color-laburante-text-muted)] hover:text-rose-600" aria-label="Quitar idioma"><Trash2 size={16} /></button>
            </div>)}
          </div>}
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

                {/* WhatsApp Verification Status / Action */}
                {c.type === 'whatsapp' && c.value.trim() && (
                  <div className="self-end sm:self-center shrink-0">
                    {myProfile?.whatsapp_verified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>Verificado</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setWhatsappModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors shadow-2xs cursor-pointer"
                        title="Certificar que este número te pertenece"
                      >
                        <ShieldAlert size={14} className="text-amber-600" />
                        <span>Verificar WhatsApp</span>
                      </button>
                    )}
                  </div>
                )}

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

          {/* WhatsApp Notification Preference */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-2.5 text-xs text-emerald-950">
              <MessageCircle size={18} className="text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold">Avisarme pedidos de trabajo por WhatsApp</p>
                <p className="text-[11px] text-emerald-800">
                  Recibí avisos en tu teléfono cuando una persona te envíe una solicitud o pedido de presupuesto.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={notifyWhatsapp}
                onChange={(e) => setNotifyWhatsapp(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
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

        {/* Danger Zone: Delete Account / Profile */}
        {isEditing && (
          <div className="pt-6 border-t border-[var(--color-laburante-border)]">
            <div className="p-5 sm:p-6 rounded-3xl border border-rose-200 bg-rose-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-sm text-rose-950 flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-rose-600" />
                  Dar de baja mi perfil y cuenta
                </h3>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Si no vas a ofrecer más servicios en LABURANTE, podés eliminar tu perfil indicando el motivo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className="py-2.5 px-4 rounded-xl border border-rose-300 bg-white hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors shrink-0 shadow-2xs cursor-pointer"
              >
                Dar de baja mi perfil
              </button>
            </div>
          </div>
        )}
      </form>

      {/* WhatsApp Verification Modal */}
      <WhatsAppVerificationModal
        isOpen={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        profileId={myProfile?.id || user.id}
        phone={contactMethods.find((c) => c.type === 'whatsapp')?.value || ''}
        profileName={name || myProfile?.name || 'Mi Perfil'}
        profileSlug={myProfile?.slug || (name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '')}
      />

      {/* Delete Account Modal */}
      {myProfile && (
        <DeleteAccountModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          profileId={myProfile.id}
          profileName={myProfile.name}
        />
      )}
    </div>
  )
}
