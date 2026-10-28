import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, Link, useSearchParams, useLocation } from 'react-router-dom'
import { MapPin, Briefcase, Share2, AlertTriangle, ShieldCheck, Check, Clock, Globe, ArrowLeft, Star, MessageSquare, MessageSquarePlus, FileText, EyeOff, Eye, Copy, ExternalLink, MessageCircle, Link2, Languages, Edit3 } from 'lucide-react'
import { useProfileStore, type ProfileWithDetails } from '@/stores/profile-store'
import { useAuthStore } from '@/stores/auth-store'
import ReportModal from '@/components/profile/ReportModal'
import RecommendationModal from '@/components/profile/RecommendationModal'
import JobRequestModal from '@/components/jobs/JobRequestModal'
import CompanyProfileActions from '@/components/profile/CompanyProfileActions'
import EmailPreferencesToggle from '@/components/notifications/EmailPreferencesToggle'
import ProfileCompletionCard from '@/components/profile/ProfileCompletionCard'
import WhatsAppVerificationModal from '@/components/profile/WhatsAppVerificationModal'
import ReviewStars from '@/components/profile/ReviewStars'
import { formatRating } from '@/lib/rating-format'
import { isCompanyAccount } from '@/lib/account'
import { formatModality } from '@/lib/profile-format'
import { formatProfileLocation } from '@/lib/profile-location'
import { isProviderProfile } from '@/lib/profile-publication'
import { focusContextualElement } from '@/lib/contextual-navigation'
import { getAuthorizedResumeUrl } from '@/lib/profile-assets'
import { getPublicProfileContactHref, getPublicProfileContactLabel, getPublicProfileContacts } from '@/lib/contact-methods'
import { trackProductEvent } from '@/lib/product-analytics'

function PublicContactIcon({ type }: { type: string }) {
  if (type === 'linkedin') {
    return (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-sky-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect width="4" height="12" x="2" y="9" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    )
  }

  if (type === 'instagram') {
    return (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-pink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    )
  }

  return <Globe aria-hidden="true" size={15} className="shrink-0 text-[var(--color-laburante-indigo)]" />
}

function getFriendlyResumeName(name?: string | null) {
  return name && !/^https?:\/\//i.test(name) ? name : null
}

export default function ProfilePage() {
  const { user, isAdmin } = useAuthStore()
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const targetReviewId = searchParams.get('resena')
  const requestIntent = searchParams.get('solicitar') === '1'
  const [rawProfile, setRawProfile] = useState<ProfileWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [recommendationOpen, setRecommendationOpen] = useState(false)
  const [jobRequestOpen, setJobRequestOpen] = useState(false)
  const [whatsAppVerifyOpen, setWhatsAppVerifyOpen] = useState(false)
  const [copiedContact, setCopiedContact] = useState('')
  const [imageFailed, setImageFailed] = useState(false)
  const [editingRecommendationId, setEditingRecommendationId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [editingContext, setEditingContext] = useState('')
  const [recommendationMessage, setRecommendationMessage] = useState('')
  const [resumeAccessUrl, setResumeAccessUrl] = useState<string | null>(null)
  const [resumeLoading, setResumeLoading] = useState(false)
  const trackedProfileId = useRef<string | null>(null)
  const requestIntentHandled = useRef(false)

  const fetchProfileBySlug = useProfileStore((s) => s.fetchProfileBySlug)
  const fetchMyProfile = useProfileStore((s) => s.fetchMyProfile)
  const updateProfileVisibility = useProfileStore((s) => s.updateProfileVisibility)
  const currentProfile = useProfileStore((s) => s.currentProfile)
  const myProfile = useProfileStore((s) => s.myProfile)
  const updateRecommendation = useProfileStore((s) => s.updateRecommendation)
  const moderateRecommendation = useProfileStore((s) => s.moderateRecommendation)
  const deleteRecommendation = useProfileStore((s) => s.deleteRecommendation)

  useEffect(() => {
    if (!slug) return
    requestIntentHandled.current = false
    trackedProfileId.current = null
    const normalizedSlug = decodeURIComponent(slug).trim()
    setLoading(true)
    let active = true
    setImageFailed(false)
    fetchProfileBySlug(normalizedSlug).then((res) => {
      if (!active) return
      setRawProfile(res)
      setLoading(false)
    })
    return () => { active = false }
  }, [slug, fetchProfileBySlug, user?.id])

  useEffect(() => {
    if (user?.id && !myProfile) {
      void fetchMyProfile()
    }
  }, [user?.id, myProfile, fetchMyProfile])

  // Prefer store's currentProfile so newly added recommendations reflect immediately
  const normalizedRouteSlug = slug ? decodeURIComponent(slug).trim() : ''
  const baseProfile = (currentProfile && currentProfile.slug === normalizedRouteSlug) ? currentProfile : rawProfile

  const isOwnerSession = Boolean(user && baseProfile && baseProfile.id === user.id)

  // When viewing own profile, enrich with owner's complete contact_methods and all received recommendations from myProfile
  const profile = useMemo(() => {
    if (!baseProfile) return null
    if (isOwnerSession && myProfile && myProfile.id === baseProfile.id) {
      const mergedContacts = (myProfile.contact_methods && myProfile.contact_methods.length > 0)
        ? myProfile.contact_methods
        : baseProfile.contact_methods
      const mergedRecs = (myProfile.recommendations && myProfile.recommendations.length > 0)
        ? myProfile.recommendations
        : (baseProfile.recommendations || [])
      return {
        ...baseProfile,
        contact_methods: mergedContacts,
        recommendations: mergedRecs,
        review_average: myProfile.review_average ?? baseProfile.review_average,
        review_count: myProfile.review_count ?? baseProfile.review_count,
        whatsapp_verified: myProfile.whatsapp_verified ?? baseProfile.whatsapp_verified,
        whatsapp_verified_at: myProfile.whatsapp_verified_at ?? baseProfile.whatsapp_verified_at,
      }
    }
    return baseProfile
  }, [baseProfile, isOwnerSession, myProfile])

  useEffect(() => {
    if (loading || !profile) return
    if (targetReviewId) {
      return focusContextualElement({ id: `resena-${targetReviewId}` })
    }
    if (location.hash === '#resenas') {
      return focusContextualElement({ id: 'resenas' })
    }
  }, [loading, profile?.slug, location.hash, targetReviewId])

  useEffect(() => {
    let active = true
    setResumeAccessUrl(null)
    if (!user?.id || !profile?.id || (!profile.has_resume && !profile.resume_url)) {
      setResumeLoading(false)
      return () => { active = false }
    }
    setResumeLoading(true)
    getAuthorizedResumeUrl(profile.id).then((result) => {
      if (active) {
        setResumeAccessUrl(result.url)
        setResumeLoading(false)
      }
    }).catch(() => {
      if (active) setResumeLoading(false)
    })
    return () => { active = false }
  }, [profile?.id, profile?.has_resume, profile?.resume_url, user?.id])

  const isCompanyViewer = isCompanyAccount(user, myProfile)
  const isPublicProvider = profile ? isProviderProfile(profile) : false
  const openJobRequest = () => {
    trackProductEvent('request_started', { auth_required: !user })
    setJobRequestOpen(true)
  }

  useEffect(() => {
    if (loading || !profile || !requestIntent || requestIntentHandled.current) return
    requestIntentHandled.current = true
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('solicitar')
      return next
    }, { replace: true })

    if (isPublicProvider && !isOwnerSession && !isCompanyViewer) {
      trackProductEvent('request_resumed')
      setJobRequestOpen(true)
    }
  }, [loading, profile?.id, requestIntent, isPublicProvider, isOwnerSession, isCompanyViewer, setSearchParams])

  useEffect(() => {
    if (loading || !profile || trackedProfileId.current === profile.id) return
    trackedProfileId.current = profile.id
    trackProductEvent('profile_viewed', { provider: isPublicProvider })
  }, [loading, profile?.id, isPublicProvider])

  const handleShare = () => {
    const url = `${window.location.origin}/p/${profile?.slug}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const copyContact = async (value: string, type: string) => {
    await navigator.clipboard?.writeText(value)
    setCopiedContact(type)
    window.setTimeout(() => setCopiedContact(''), 1800)
  }

  if (loading) {
    return (
      <div className="container py-20 text-center text-sm text-[var(--color-laburante-text-muted)]">
        Cargando perfil...
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container py-20 text-center max-w-md mx-auto space-y-4">
        <h2 className="font-heading text-2xl font-bold text-[var(--color-laburante-text)]">
          Perfil no encontrado
        </h2>
        <p className="text-sm text-[var(--color-laburante-text-secondary)]">
          El perfil solicitado no existe, fue dado de baja o el enlace es incorrecto.
        </p>
        <Link
          to="/buscar"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-laburante-text)] text-white font-heading text-xs font-semibold"
        >
          <ArrowLeft size={14} />
          Volver a buscar
        </Link>
      </div>
    )
  }

  const isOwnProfile = user?.id === profile.id
  const publicContacts = getPublicProfileContacts(profile.contact_methods || [])
    .map((method) => ({
      ...method,
      label: getPublicProfileContactLabel(method.type),
      href: getPublicProfileContactHref(method.type, method.value),
    }))
    .filter((method) => method.href)

  return (
    <div className="container py-8 md:py-12 max-w-4xl mx-auto space-y-8">
      {/* Back button */}
      <Link
        to="/buscar"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)] transition-colors"
      >
        <ArrowLeft size={14} />
        Volver a la búsqueda
      </Link>

      {/* Private Profile Banner */}
      {profile.status === 'oculto' && (
        user?.id === profile.id ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-3 text-xs sm:text-sm">
              <EyeOff size={20} className="text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="font-bold text-amber-900">Tu perfil está en modo PRIVADO / PAUSADO</p>
                <p className="text-amber-800 text-xs mt-0.5">
                  No aparecés en las búsquedas ni categorías de LABURANTE. Podés reactivarlo cuando quieras para volver a recibir consultas.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await updateProfileVisibility(profile.id, 'activo')
                fetchProfileBySlug(profile.slug)
              }}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs shrink-0 transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Eye size={14} />
              <span>Hacer público ahora</span>
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-5 rounded-2xl bg-gray-50 border border-gray-200 text-gray-800 flex items-center gap-3 text-xs sm:text-sm">
            <EyeOff size={20} className="text-gray-500 shrink-0" />
            <p>
              Este profesional ha <strong>pausado temporalmente su perfil</strong> y no está recibiendo nuevas solicitudes o consultas por el momento.
            </p>
          </div>
        )
      )}

      {/* Main Profile Header Card */}
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 md:p-10 shadow-xs relative">
        <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
          <div className="h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-full bg-[var(--color-laburante-surface-alt)] border-2 border-[var(--color-laburante-border)] flex items-center justify-center font-heading font-extrabold text-2xl sm:text-3xl text-[var(--color-laburante-text)] flex-shrink-0">
            {profile.photo_url && !imageFailed ? (
              <img src={profile.photo_url} alt={`Foto de ${profile.name}`} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
            ) : profile.name.charAt(0)}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)] tracking-tight">
                {profile.name}
              </h1>

              {profile.whatsapp_verified && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                  title="Titularidad de número de WhatsApp certificada por LABURANTE"
                >
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Número verificado</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-[var(--color-laburante-text-secondary)]">
              <span className="flex items-center gap-1">
                <MapPin size={14} className="text-[var(--color-laburante-accent)]" />
                {formatProfileLocation(profile)}
              </span>
              <span className="flex items-center gap-1">
                <Briefcase size={14} className="text-[var(--color-laburante-text-muted)]" />
                {formatModality(profile.modalidad, profile.hybrid_presencial_pct, profile.hybrid_remoto_pct)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={14} className="text-emerald-600" />
                {profile.disponibilidad === 'disponible' ? 'Disponible' : profile.disponibilidad}
              </span>
            </div>

            {profile.zona_trabajo && (
              <p className="text-xs text-[var(--color-laburante-text-muted)]">
                Zona habitual: <span className="text-[var(--color-laburante-text-secondary)]">{profile.zona_trabajo}</span>
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons: Request Budget + Contact + Review + Share */}
        <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-[var(--color-laburante-border)]">
          {isOwnProfile && (
            <div className="w-full space-y-4">
              <ProfileCompletionCard
                profile={profile}
                onOpenWhatsAppVerify={() => setWhatsAppVerifyOpen(true)}
              />
              <EmailPreferencesToggle variant="inline" />
            </div>
          )}
          {!isPublicProvider && !isOwnProfile && (
            <p className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
              Este perfil todavía no ofrece servicios públicamente en LABURANTE.
            </p>
          )}
          {isPublicProvider && !isOwnProfile && !isCompanyViewer && (
            <>
              <button
                onClick={openJobRequest}
                className="btn-dark flex-1 sm:flex-initial py-3.5 px-7 rounded-2xl font-heading font-bold text-sm transition-transform hover:scale-[1.02] shadow-md text-center flex items-center justify-center gap-2"
                title="Aportá fotos, urgencia y recibí un presupuesto guardado en la app"
              >
                <FileText size={16} />
                Pedir presupuesto directo
              </button>

              <button
                onClick={openJobRequest}
                className="inline-flex flex-1 items-center justify-center gap-2 py-3.5 px-6 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)] font-heading font-semibold text-xs sm:text-sm transition-colors sm:flex-initial"
              >
                <MessageCircle size={16} className="text-emerald-600" /> Pedir presupuesto para contactar
              </button>
            </>
          )}

          {isPublicProvider && !isOwnProfile && isCompanyViewer && (
            <div className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs leading-relaxed text-indigo-950">
              <strong>Selección para Empresas:</strong> no necesitás pedir un presupuesto para entrevistar a esta persona. Guardala en un proyecto y enviá una propuesta de entrevista o contratación desde las herramientas de Empresa.
            </div>
          )}

          {isPublicProvider && !isOwnProfile && (
          <button
            onClick={() => setRecommendationOpen(true)}
            className="py-3.5 px-4 rounded-2xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-900 font-heading font-semibold text-xs transition-colors flex items-center gap-1.5"
            title="Dejar una reseña o recomendación tras finalizar un trabajo"
          >
            <Star size={15} className="text-amber-500 fill-amber-500" />
            Dejar reseña
          </button>
          )}

          <button
            onClick={handleShare}
            className="py-3.5 px-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)] font-heading font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
            {copied ? 'Copiado' : 'Compartir'}
          </button>

        </div>
        {isPublicProvider && <CompanyProfileActions profileId={profile.id} profileName={profile.name} />}
        {publicContacts.length > 0 && (
            <div className="mt-4 min-w-0 border-t border-[var(--color-laburante-border)] pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)]"><Link2 size={13} /> Enlaces públicos</p>
              <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap">
                {publicContacts.map((method) => (
                  <div key={`${method.type}-${method.value}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] px-3 py-2 text-xs">
                    <PublicContactIcon type={method.type} />
                    <a
                      href={method.href || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Abrir ${method.label} de ${profile.name} en una nueva pestaña`}
                      className="min-w-0 flex-1 truncate font-semibold text-[var(--color-laburante-indigo)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-laburante-indigo)] focus-visible:ring-offset-2"
                    >
                      <span className="mr-1 text-[var(--color-laburante-text-muted)]">{method.label}:</span>{method.type === 'linkedin' ? 'Ver perfil' : method.value}
                    </a>
                    <button type="button" onClick={() => copyContact(method.value, method.type)} aria-label={`Copiar ${method.label}`} className="rounded p-1 outline-none hover:bg-[var(--color-laburante-surface-alt)] focus-visible:ring-2 focus-visible:ring-[var(--color-laburante-indigo)]">
                      {copiedContact === method.type ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                    <ExternalLink aria-hidden="true" size={12} className="shrink-0 text-[var(--color-laburante-text-muted)]" />
                  </div>
                ))}
              </div>
            </div>
        )}
        <div className="pt-3 text-xs">
          {profile.has_resume || profile.resume_url ? (
            user ? (
              resumeAccessUrl ? (
                <a
                  href={resumeAccessUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-semibold text-[var(--color-laburante-indigo)] hover:underline"
                >
                  <FileText size={14} /> Ver CV{getFriendlyResumeName(profile.resume_name) ? `: ${getFriendlyResumeName(profile.resume_name)}` : ''}
                </a>
              ) : resumeLoading ? (
                <span className="inline-flex items-center gap-2 text-[var(--color-laburante-text-secondary)]">
                  <FileText size={14} className="animate-pulse" /> Obteniendo acceso al CV...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-[var(--color-laburante-text-muted)]">
                  <FileText size={14} /> CV no disponible temporalmente
                </span>
              )
            ) : (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
                  <FileText size={14} /> CV cargado
                </span>
                <span className="text-[var(--color-laburante-text-secondary)]">
                  Iniciá sesión o registrate para verlo.
                </span>
                <Link to="/ingresar" className="font-semibold text-[var(--color-laburante-indigo)] hover:underline">
                  Ingresar
                </Link>
              </div>
            )
          ) : (
            <span className="inline-flex items-center gap-2 text-[var(--color-laburante-text-muted)]">
              <FileText size={14} /> No tiene CV cargado
            </span>
          )}
        </div>
      </div>

      {/* Profile Bio */}
      {profile.bio && (
        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)] mb-3">
            Presentación
          </h2>
          <p className="text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed whitespace-pre-line">
            {profile.bio}
          </p>
        </section>
      )}

      {/* Skills / Habilidades */}
      {profile.skills && profile.skills.length > 0 && (
        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)] mb-3">
            Habilidades y especialidades
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-lg bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] text-xs font-semibold text-[var(--color-laburante-text)]"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {profile.languages && profile.languages.filter((entry) => entry.is_public).length > 0 && (
        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-[var(--color-laburante-text)]"><Languages size={18} className="text-[var(--color-laburante-indigo)]" /> Idiomas</h2>
          <div className="flex flex-wrap gap-2">
            {profile.languages.filter((entry) => entry.is_public).map((entry) => (
              <span key={entry.language} className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] px-3 py-2 text-xs font-semibold text-[var(--color-laburante-text)]">
                {entry.language}<span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-laburante-indigo)]">{entry.level === 'basico' ? 'Básico' : entry.level === 'intermedio' ? 'Intermedio' : entry.level === 'avanzado' ? 'Avanzado' : entry.level === 'nativo' ? 'Nativo' : 'Bilingüe'}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Services / Trabajos ofrecidos */}
      {profile.services && profile.services.length > 0 && (
        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)] mb-4">
            Servicios que ofrece
          </h2>
          <div className="space-y-4">
            {profile.services.map((srv, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/40 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading text-sm font-bold text-[var(--color-laburante-text)]">
                    {srv.title}
                  </h3>
                  {srv.precio_orientativo && (
                    <span className="text-xs px-2.5 py-1 rounded-md bg-white border border-[var(--color-laburante-border)] font-semibold text-[var(--color-laburante-indigo)] flex-shrink-0">
                      {srv.precio_orientativo}
                    </span>
                  )}
                </div>
                {srv.description && (
                  <p className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed">
                    {srv.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations / Reseñas de trabajo */}
      {isPublicProvider && <section id="resenas" className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--color-laburante-border)]">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-[var(--color-laburante-indigo)]" />
            <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
              Referencias y experiencias de trabajo
            </h2>
            {profile.review_count ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-laburante-text-secondary)]" aria-label={`${formatRating(profile.review_average)} de 5, ${profile.review_count} calificaciones`}>
                <ReviewStars value={profile.review_average || 0} />
                <strong className="text-[var(--color-laburante-text)]">{formatRating(profile.review_average)}/5</strong>
                <span>· {profile.review_count} {profile.review_count === 1 ? 'calificación' : 'calificaciones'}</span>
              </div>
            ) : (
              <span className="text-xs text-[var(--color-laburante-text-muted)]">Todavía no tiene calificaciones</span>
            )}
          </div>

          {!isOwnProfile && (
            <button
              onClick={() => setRecommendationOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-amber-50 text-amber-900 text-xs font-heading font-semibold transition-colors self-start sm:self-auto"
            >
              <MessageSquarePlus size={14} className="text-amber-600" />
              Escribir reseña del trabajo
            </button>
          )}
        </div>

        {profile.recommendations && profile.recommendations.length > 0 ? (
          <div className="space-y-3 pt-2">
            {profile.recommendations.map((rec) => {
              const canEdit = !!user?.id && user.id === rec.from_user_id
              const canModerate = isOwnProfile || isAdmin
              const isEditing = editingRecommendationId === rec.id
                const isTargetReview = targetReviewId === rec.id
                const statusMeta = {
                  visible: { label: 'Publicada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  pendiente: { label: 'Pendiente de tu decisión', className: 'bg-amber-50 text-amber-800 border-amber-300 font-bold' },
                  oculto: { label: 'Oculta en tu perfil', className: 'bg-slate-100 text-slate-700 border-slate-300' },
                  caducada: { label: 'Caducada (+30 días)', className: 'bg-rose-50 text-rose-700 border-rose-200' },
                }[rec.status as string] || { label: rec.status, className: 'bg-slate-50 text-slate-600 border-slate-200' }

                return (
                  <div
                    key={rec.id}
                    id={`resena-${rec.id}`}
                    data-review-id={rec.id}
                    className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                      isTargetReview
                        ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-400'
                        : rec.status === 'pendiente'
                        ? 'border-amber-300 bg-amber-50/30'
                        : 'border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--color-laburante-text)]">{rec.from_name || 'Usuario de LABURANTE'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                          Reseña
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                        {(rec.created_at || rec.date) && (
                          <span className="text-[11px] text-[var(--color-laburante-text-muted)]">
                            {new Date(rec.created_at || rec.date!).toLocaleDateString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>

                    {isOwnProfile && rec.status === 'pendiente' && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-900 leading-snug">
                        Esta reseña está pendiente de tu aprobación. Podés publicarla para que se vea en las búsquedas o descartarla.
                      </div>
                    )}

                    {rec.context && (
                      <p className="text-[11px] text-[var(--color-laburante-indigo)] font-medium">
                        Trabajo realizado: {rec.context}
                      </p>
                    )}

                    {typeof rec.rating === 'number' && (
                      <div className="flex items-center gap-2 text-xs text-[var(--color-laburante-text-secondary)]">
                        <ReviewStars value={rec.rating} size={14} label={`${rec.rating} de 5 estrellas`} />
                        <span>{rec.rating}/5</span>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-[var(--color-laburante-border)] px-3 py-2 text-xs"
                        />
                        <input
                          value={editingContext}
                          onChange={(e) => setEditingContext(e.target.value)}
                          placeholder="Trabajo realizado (opcional)"
                          className="w-full rounded-lg border border-[var(--color-laburante-border)] px-3 py-2 text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const result = await updateRecommendation(rec.id, { text: editingText, context: editingContext })
                              setRecommendationMessage(result.error || 'Reseña actualizada.')
                              if (!result.error) setEditingRecommendationId(null)
                            }}
                            className="rounded-lg bg-indigo-700 px-3 py-2 text-[11px] font-bold text-white cursor-pointer"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRecommendationId(null)}
                            className="rounded-lg border px-3 py-2 text-[11px] cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed pt-1">"{rec.text}"</p>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {canModerate && rec.status === 'pendiente' && (
                        <button
                          type="button"
                          onClick={() => moderateRecommendation(rec.id, 'visible')}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white transition-colors cursor-pointer"
                        >
                          Publicar en mi perfil ✓
                        </button>
                      )}
                      {canModerate && rec.status === 'oculto' && (
                        <button
                          type="button"
                          onClick={() => moderateRecommendation(rec.id, 'visible')}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white transition-colors cursor-pointer"
                        >
                          Volver a publicar
                        </button>
                      )}
                      {canModerate && rec.status === 'visible' && (
                        <button
                          type="button"
                          onClick={() => moderateRecommendation(rec.id, 'oculto')}
                          className="rounded-lg border border-amber-300 hover:bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition-colors cursor-pointer"
                        >
                          Ocultar
                        </button>
                      )}
                      {canEdit && !isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRecommendationId(rec.id)
                            setEditingText(rec.text)
                            setEditingContext(rec.context || '')
                          }}
                          className="rounded-lg border border-indigo-200 px-3 py-1.5 text-[11px] font-semibold text-indigo-800 cursor-pointer"
                        >
                          Editar
                        </button>
                      )}
                      {(canEdit || canModerate) && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm('¿Querés eliminar esta reseña definitivamente?')) return
                            const result = await deleteRecommendation(rec.id)
                            if (!result.error) {
                              setRawProfile((prev) => prev ? { ...prev, recommendations: (prev.recommendations || []).filter((r) => r.id !== rec.id) } : null)
                              setRecommendationMessage('Reseña eliminada.')
                            } else {
                              setRecommendationMessage(result.error)
                            }
                          }}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                )
            })}
          </div>
        ) : (
          <div className="p-8 rounded-2xl border border-dashed border-[var(--color-laburante-border)] text-center space-y-3 bg-[var(--color-laburante-surface-alt)]/20">
            <div className="h-12 w-12 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Star size={22} className="fill-amber-400" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading text-sm font-bold text-[var(--color-laburante-text)]">
                Aún no hay reseñas registradas
              </h3>
              <p className="text-xs text-[var(--color-laburante-text-secondary)] max-w-md mx-auto leading-relaxed">
                {isOwnProfile
                  ? 'Las referencias y recomendaciones que tus clientes dejen sobre tus trabajos aparecerán acá para que puedas revisarlas y publicarlas.'
                  : <>¿Contrataste o trabajaste con <strong>{profile.name}</strong>? Contá cómo fue la experiencia para que otros vecinos contraten con seguridad y el buen trabajo se reconozca.</>}
              </p>
            </div>
            {!isOwnProfile && (
              <button
                onClick={() => setRecommendationOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl btn-dark text-xs font-heading font-semibold shadow-xs"
              >
                <Star size={14} className="fill-amber-400 text-amber-400" />
                Dejar la primera reseña del trabajo
              </button>
            )}
          </div>
        )}
        {recommendationMessage && <p className="text-xs font-semibold text-indigo-800">{recommendationMessage}</p>}
      </section>}

      {/* Signals of Trust (Honest, not fabricated) */}
      <section className="p-5 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] text-xs text-[var(--color-laburante-text-secondary)] space-y-2">
        <div className="flex items-center gap-2 font-heading font-semibold text-sm text-[var(--color-laburante-text)]">
          <ShieldCheck size={16} className="text-[var(--color-laburante-teal)]" />
          Señales de transparencia
        </div>
        <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
          <li>Perfil creado por el propio titular mediante registro.</li>
          <li>Los canales de contacto fueron autorizados expresamente para su visualización.</li>
          <li>LABURANTE no cobra comisión ni intermedia en pagos o contrataciones.</li>
        </ul>
      </section>

      {/* Footer Actions: Report Profile */}
      <div className="pt-4 flex items-center justify-between text-xs text-[var(--color-laburante-text-muted)]">
        <span>Publicado en LABURANTE</span>
        <button
          onClick={() => setReportOpen(true)}
          className="flex items-center gap-1.5 text-rose-600 hover:underline font-medium"
        >
          <AlertTriangle size={13} />
          Reportar este perfil
        </button>
      </div>

      {/* Modals */}
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        profileId={profile.id}
        profileName={profile.name}
      />

      {isPublicProvider && !isOwnProfile && <RecommendationModal
        isOpen={recommendationOpen}
        onClose={() => setRecommendationOpen(false)}
        profileId={profile.id}
        profileName={profile.name}
      />}

      {isPublicProvider && <JobRequestModal
        isOpen={jobRequestOpen}
        onClose={() => setJobRequestOpen(false)}
        profileId={profile.id}
        profileName={profile.name}
        profileSlug={profile.slug}
      />}

      {isOwnProfile && profile && (
        <WhatsAppVerificationModal
          isOpen={whatsAppVerifyOpen}
          onClose={() => {
            setWhatsAppVerifyOpen(false)
            if (slug) void fetchProfileBySlug(decodeURIComponent(slug).trim())
            void fetchMyProfile()
          }}
          profileId={profile.id}
          phone={
            (profile.contact_methods || []).find((c: any) => c.type === 'whatsapp')?.value ||
            (profile.contact_methods || []).find((c: any) => c.type === 'telefono')?.value ||
            (myProfile?.contact_methods || []).find((c: any) => c.type === 'whatsapp')?.value ||
            (myProfile?.contact_methods || []).find((c: any) => c.type === 'telefono')?.value ||
            ''
          }
          profileName={profile.name}
          profileSlug={profile.slug}
        />
      )}
    </div>
  )
}
