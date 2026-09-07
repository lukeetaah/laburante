import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { MapPin, Briefcase, Share2, AlertTriangle, ShieldCheck, Check, Clock, Globe, ArrowLeft, Star, MessageSquare, MessageSquarePlus, FileText } from 'lucide-react'
import { useProfileStore, type ProfileWithDetails } from '@/stores/profile-store'
import ContactModal from '@/components/profile/ContactModal'
import ReportModal from '@/components/profile/ReportModal'
import RecommendationModal from '@/components/profile/RecommendationModal'
import JobRequestModal from '@/components/jobs/JobRequestModal'
import { SITE_CONFIG } from '@/lib/constants'

export default function ProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const [rawProfile, setRawProfile] = useState<ProfileWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [contactOpen, setContactOpen] = useState(searchParams.get('contacto') === '1' || searchParams.get('contacto') === 'true')
  const [reportOpen, setReportOpen] = useState(false)
  const [recommendationOpen, setRecommendationOpen] = useState(false)
  const [jobRequestOpen, setJobRequestOpen] = useState(false)

  const fetchProfileBySlug = useProfileStore((s) => s.fetchProfileBySlug)
  const currentProfile = useProfileStore((s) => s.currentProfile)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    fetchProfileBySlug(slug).then((res) => {
      setRawProfile(res)
      setLoading(false)
    })
  }, [slug, fetchProfileBySlug])

  // Prefer store's currentProfile so newly added recommendations reflect immediately
  const profile = (currentProfile && currentProfile.slug === slug) ? currentProfile : rawProfile

  const handleShare = () => {
    const url = `${window.location.origin}/p/${profile?.slug}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleWhatsAppShare = () => {
    const url = `${window.location.origin}/p/${profile?.slug}`
    const text = `Te comparto el perfil de ${profile?.name} en LABURANTE: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
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

      {/* Main Profile Header Card */}
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 md:p-10 shadow-xs relative">
        {profile.isMock && (
          <div className="absolute top-6 right-6 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
            MOCK DEV (Prueba)
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-[var(--color-laburante-surface-alt)] border-2 border-[var(--color-laburante-border)] flex items-center justify-center font-heading font-extrabold text-2xl sm:text-3xl text-[var(--color-laburante-text)] flex-shrink-0">
            {profile.name.charAt(0)}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)] tracking-tight">
              {profile.name}
            </h1>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-[var(--color-laburante-text-secondary)]">
              <span className="flex items-center gap-1">
                <MapPin size={14} className="text-[var(--color-laburante-accent)]" />
                {profile.localidad}, {profile.provincia}
              </span>
              <span className="flex items-center gap-1 capitalize">
                <Briefcase size={14} className="text-[var(--color-laburante-text-muted)]" />
                {profile.modalidad}
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
          <button
            onClick={() => setJobRequestOpen(true)}
            className="btn-dark flex-1 sm:flex-initial py-3.5 px-7 rounded-2xl font-heading font-bold text-sm transition-transform hover:scale-[1.02] shadow-md text-center flex items-center justify-center gap-2"
            title="Aportá fotos, urgencia y recibí un presupuesto guardado en la app"
          >
            <FileText size={16} />
            Pedir presupuesto directo
          </button>

          <button
            onClick={() => setContactOpen(true)}
            className="py-3.5 px-6 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)] font-heading font-semibold text-xs sm:text-sm transition-colors text-center"
          >
            Contactar ahora
          </button>

          <button
            onClick={() => setRecommendationOpen(true)}
            className="py-3.5 px-4 rounded-2xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-900 font-heading font-semibold text-xs transition-colors flex items-center gap-1.5"
            title="Dejar una reseña o recomendación tras finalizar un trabajo"
          >
            <Star size={15} className="text-amber-500 fill-amber-500" />
            Dejar reseña
          </button>

          <button
            onClick={handleShare}
            className="py-3.5 px-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)] font-heading font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
            {copied ? 'Copiado' : 'Compartir'}
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="py-3.5 px-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-emerald-50 text-emerald-700 font-heading font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            WhatsApp
          </button>
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
      <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--color-laburante-border)]">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-[var(--color-laburante-indigo)]" />
            <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
              Referencias y experiencias de trabajo
            </h2>
            {profile.recommendations && profile.recommendations.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-laburante-surface-alt)] font-semibold text-[var(--color-laburante-text-secondary)]">
                {profile.recommendations.length}
              </span>
            )}
          </div>

          <button
            onClick={() => setRecommendationOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-amber-50 text-amber-900 text-xs font-heading font-semibold transition-colors self-start sm:self-auto"
          >
            <MessageSquarePlus size={14} className="text-amber-600" />
            Escribir reseña del trabajo
          </button>
        </div>

        {profile.recommendations && profile.recommendations.length > 0 ? (
          <div className="space-y-3 pt-2">
            {profile.recommendations.map((rec, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/30 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--color-laburante-text)]">{rec.from_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                      Cliente
                    </span>
                  </div>
                  {rec.date && <span className="text-[var(--color-laburante-text-muted)]">{rec.date}</span>}
                </div>
                {rec.context && (
                  <p className="text-[11px] text-[var(--color-laburante-indigo)] font-medium">
                    Trabajo realizado: {rec.context}
                  </p>
                )}
                <p className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed pt-1">
                  "{rec.text}"
                </p>
              </div>
            ))}
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
                ¿Contrataste o trabajaste con <strong>{profile.name}</strong>? Contá cómo fue la experiencia para que otros vecinos contraten con seguridad y el buen trabajo se reconozca.
              </p>
            </div>
            <button
              onClick={() => setRecommendationOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl btn-dark text-xs font-heading font-semibold shadow-xs"
            >
              <Star size={14} className="fill-amber-400 text-amber-400" />
              Dejar la primera reseña del trabajo
            </button>
          </div>
        )}
      </section>

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
      <ContactModal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
        profileName={profile.name}
        contactMethods={profile.contact_methods || []}
      />

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        profileId={profile.id}
        profileName={profile.name}
      />

      <RecommendationModal
        isOpen={recommendationOpen}
        onClose={() => setRecommendationOpen(false)}
        profileId={profile.id}
        profileName={profile.name}
      />

      <JobRequestModal
        isOpen={jobRequestOpen}
        onClose={() => setJobRequestOpen(false)}
        profileId={profile.id}
        profileName={profile.name}
        profileSlug={profile.slug}
      />
    </div>
  )
}
