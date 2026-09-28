import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import type { ProfileIntent } from '@/lib/profile-publication'
import { Briefcase, Search, Users, Sparkles, X, RefreshCw, AlertCircle } from 'lucide-react'

const DISMISSED_SESSION_KEY = 'laburante_intent_prompt_dismissed'

export default function IntentPromptModal() {
  const { user } = useAuthStore()
  const { myProfile, updateMyIntent } = useProfileStore()
  const navigate = useNavigate()

  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED_SESSION_KEY) === '1'
    } catch {
      return false
    }
  })
  const [submitting, setSubmitting] = useState<ProfileIntent | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Visible exclusivamente si el usuario está autenticado, tiene perfil cargado,
  // el intent está vacío/null, no es cuenta empresa y no fue descartado en esta sesión.
  const isVisible = Boolean(
    user &&
    myProfile &&
    !myProfile.intent &&
    myProfile.account_type !== 'empresa' &&
    !dismissed
  )

  if (!isVisible) return null

  const handleSelectIntent = async (selected: ProfileIntent) => {
    if (submitting) return
    setSubmitting(selected)
    setError(null)

    const res = await updateMyIntent(selected)
    setSubmitting(null)

    if (res.error) {
      setError(res.error)
      return
    }

    // Redirigir según la opción elegida
    if (selected === 'ofrecer' || selected === 'ambas') {
      navigate('/crear-perfil')
    } else {
      navigate('/buscar')
    }
  }

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_SESSION_KEY, '1')
    } catch {}
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 shadow-2xl space-y-6 text-center">
        {/* Botón cerrar opcional / posponer */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)] rounded-full hover:bg-[var(--color-laburante-surface-alt)] transition-colors cursor-pointer"
          aria-label="Elegir más tarde"
        >
          <X size={18} />
        </button>

        {/* Encabezado */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-laburante-indigo)]/10 text-[var(--color-laburante-indigo)] text-[11px] font-bold uppercase tracking-wider">
            <Sparkles size={13} /> Personalizá tu experiencia
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-[var(--color-laburante-text)]">
            ¿Cómo querés usar LABURANTE?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed max-w-md mx-auto">
            Contanos si buscás contratar profesionales, ofrecer tu trabajo o ambas opciones. Así personalizamos tu espacio y tus oportunidades.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 text-left">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Tarjetas de selección con un toque */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => handleSelectIntent('ofrecer')}
            className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] hover:border-[var(--color-laburante-indigo)] transition-all cursor-pointer disabled:opacity-50 text-left flex flex-col justify-between group shadow-2xs hover:shadow-sm"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <Briefcase size={18} />
              </div>
              <p className="font-heading font-bold text-xs sm:text-sm text-[var(--color-laburante-text)]">
                Ofrecer mi trabajo
              </p>
              <p className="text-[11px] text-[var(--color-laburante-text-muted)] mt-1 leading-relaxed">
                Quiero publicar mis servicios o habilidades para que me encuentren.
              </p>
            </div>
            {submitting === 'ofrecer' && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-laburante-indigo)] font-semibold">
                <RefreshCw size={13} className="animate-spin" /> Guardando...
              </div>
            )}
          </button>

          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => handleSelectIntent('buscar')}
            className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] hover:border-[var(--color-laburante-indigo)] transition-all cursor-pointer disabled:opacity-50 text-left flex flex-col justify-between group shadow-2xs hover:shadow-sm"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <Search size={18} />
              </div>
              <p className="font-heading font-bold text-xs sm:text-sm text-[var(--color-laburante-text)]">
                Buscar profesionales
              </p>
              <p className="text-[11px] text-[var(--color-laburante-text-muted)] mt-1 leading-relaxed">
                Quiero encontrar trabajadores de confianza y pedir presupuestos.
              </p>
            </div>
            {submitting === 'buscar' && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-laburante-indigo)] font-semibold">
                <RefreshCw size={13} className="animate-spin" /> Guardando...
              </div>
            )}
          </button>

          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => handleSelectIntent('ambas')}
            className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] hover:border-[var(--color-laburante-indigo)] transition-all cursor-pointer disabled:opacity-50 text-left flex flex-col justify-between group shadow-2xs hover:shadow-sm"
          >
            <div>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[var(--color-laburante-indigo)] flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                <Users size={18} />
              </div>
              <p className="font-heading font-bold text-xs sm:text-sm text-[var(--color-laburante-text)]">
                Ambas cosas
              </p>
              <p className="text-[11px] text-[var(--color-laburante-text-muted)] mt-1 leading-relaxed">
                Quiero tanto ofrecer servicios como buscar personas para contratar.
              </p>
            </div>
            {submitting === 'ambas' && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-laburante-indigo)] font-semibold">
                <RefreshCw size={13} className="animate-spin" /> Guardando...
              </div>
            )}
          </button>
        </div>

        {/* Footer con opción no bloqueante */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={submitting !== null}
            className="text-xs text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)] transition-colors cursor-pointer"
          >
            Elegir más tarde
          </button>
        </div>
      </div>
    </div>
  )
}
