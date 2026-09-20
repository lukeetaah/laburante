import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, Star, CheckCircle, MessageSquare, Lock } from 'lucide-react'
import { useProfileStore } from '@/stores/profile-store'
import { useAuthStore } from '@/stores/auth-store'

interface RecommendationModalProps {
  profileId: string
  profileName: string
  isOpen: boolean
  onClose: () => void
}

export default function RecommendationModal({
  profileId,
  profileName,
  isOpen,
  onClose,
}: RecommendationModalProps) {
  const user = useAuthStore((s) => s.user)
  const [fromName, setFromName] = useState(user?.user_metadata?.name || '')
  const [context, setContext] = useState('')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitRecommendation = useProfileStore((s) => s.submitRecommendation)

  useEffect(() => {
    if (user?.user_metadata?.name && !fromName) {
      setFromName(user.user_metadata.name)
    }
  }, [user])

  if (!isOpen || (user?.id && user.id === profileId)) return null

  const handleReset = () => {
    setSuccess(false)
    setFromName(user?.user_metadata?.name || '')
    setContext('')
    setText('')
    setError(null)
    onClose()
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
        <div className="relative w-full max-w-md rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-center space-y-4">
          <button
            onClick={handleReset}
            className="absolute top-5 right-5 p-1.5 rounded-lg text-[var(--color-laburante-text-muted)] hover:bg-[var(--color-laburante-surface-alt)]"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
          <div className="h-14 w-14 mx-auto rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[var(--color-laburante-indigo)]">
            <Lock size={26} />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
              Iniciá sesión para dejar una reseña
            </h3>
            <p className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed">
              En LABURANTE cuidamos la transparencia: solo usuarios con cuenta pueden recomendar a un trabajador para evitar opiniones falsas o anónimas.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              to="/login"
              className="w-full py-2.5 px-4 rounded-xl btn-dark font-heading font-bold text-xs flex items-center justify-center gap-2"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/registro"
              className="w-full py-2.5 px-4 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] text-xs font-semibold text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface)] flex items-center justify-center"
            >
              Crear cuenta gratuita
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (user?.id && user.id === profileId) {
      setError('No podés escribir una reseña sobre tu propio perfil.')
      return
    }

    if (!fromName.trim()) {
      setError('Por favor ingresá tu nombre o iniciales.')
      return
    }

    if (text.trim().length < 10) {
      setError('Por favor escribí una reseña de al menos 10 caracteres contando cómo fue el trabajo.')
      return
    }

    setSubmitting(true)
    setError(null)

    const res = await submitRecommendation(profileId, {
      from_name: fromName.trim(),
      context: context.trim() || undefined,
      text: text.trim(),
    })

    setSubmitting(false)

    if (res.error) {
      setError(res.error)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={handleReset}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-[var(--color-laburante-text-muted)] hover:bg-[var(--color-laburante-surface-alt)]"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        {success ? (
          <div className="text-center py-6 space-y-4">
            <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle size={36} />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading text-xl font-bold text-[var(--color-laburante-text)]">
                ¡Reseña enviada para revisión!
              </h3>
              <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed max-w-sm mx-auto">
                Gracias por compartir tu experiencia real de trabajo con <strong className="text-[var(--color-laburante-text)]">{profileName}</strong>. La persona recibirá un aviso y decidirá si quiere publicarla.
              </p>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-3 px-6 rounded-xl btn-dark font-heading font-bold text-sm"
            >
              Cerrar y volver al perfil
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--color-laburante-indigo)]">
              <Star size={20} className="fill-[var(--color-laburante-accent)] text-[var(--color-laburante-accent)]" />
              <h3 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
                Dejar una reseña del trabajo realizado
              </h3>
            </div>
            <p className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed">
              Compartí tu experiencia con <strong className="text-[var(--color-laburante-text)]">{profileName}</strong>. Destacá el cumplimiento, puntualidad, prolijidad y trato.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                  Tu nombre o apodo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="ej: Valeria R. o Carlos Gómez"
                  required
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                  ¿Qué trabajo te realizó? (opcional)
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="ej: Reparación de cañería en cocina, Pintura, Flete..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                  Tu reseña / recomendación <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Contá cómo fue la experiencia: ¿llegó a horario? ¿cumplió con lo acordado? ¿quedó bien el trabajo terminado?"
                  rows={4}
                  required
                  minLength={10}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)] resize-none"
                />
                <span className="text-[10px] text-[var(--color-laburante-text-muted)]">
                  Mínimo 10 caracteres.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] text-[11px] text-[var(--color-laburante-text-secondary)] leading-relaxed">
                🛡️ <strong>Transparencia real:</strong> En LABURANTE no cobramos comisiones ni intermediamos en los pagos. Las reseñas son públicas y permiten que el buen trabajo hable por sí mismo.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-[var(--color-laburante-border)] text-xs font-medium text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-xl btn-dark font-heading font-bold text-xs disabled:opacity-50"
                >
                  {submitting ? 'Enviando...' : 'Enviar reseña'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
