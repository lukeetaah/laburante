import { useState, useEffect } from 'react'
import { Mail, Check, AlertCircle, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { loadEmailNotificationsEnabled, saveEmailNotificationsEnabled } from '@/lib/notification-preferences'

interface EmailPreferencesToggleProps {
  variant?: 'compact' | 'card' | 'inline'
  className?: string
}

export default function EmailPreferencesToggle({
  variant = 'card',
  className = '',
}: EmailPreferencesToggleProps) {
  const { user } = useAuthStore()
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let isMounted = true
    loadEmailNotificationsEnabled(user.id)
      .then((val) => {
        if (isMounted) {
          setEnabled(val)
          setLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [user])

  if (!user) return null

  const handleToggle = async () => {
    if (saving) return
    const nextState = !enabled
    setEnabled(nextState)
    setSaving(true)
    setError(null)
    setFeedback(null)

    const result = await saveEmailNotificationsEnabled(user.id, nextState)
    setSaving(false)

    if (result.error) {
      setEnabled(!nextState) // Rollback
      setError(result.error)
    } else {
      setFeedback(nextState ? 'Avisos por email activados' : 'Avisos por email pausados')
      window.setTimeout(() => setFeedback(null), 3000)
    }
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-between gap-3 text-xs ${className}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Mail size={14} className="text-[var(--color-laburante-indigo)] shrink-0" />
          <span className="truncate text-[var(--color-laburante-text)] font-medium">
            Avisos por email
          </span>
          {saving && <Loader2 size={12} className="animate-spin text-[var(--color-laburante-indigo)] shrink-0" />}
          {feedback && <span className="text-[10px] text-emerald-600 font-semibold">{feedback}</span>}
          {error && <span className="text-[10px] text-rose-600 font-semibold">{error}</span>}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={loading || saving}
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
            enabled ? 'bg-[var(--color-laburante-indigo)]' : 'bg-slate-300'
          }`}
          title={enabled ? 'Desactivar emails' : 'Activar emails'}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/60 ${className}`}>
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-[var(--color-laburante-surface)] border border-[var(--color-laburante-border)] flex items-center justify-center shrink-0">
            <Mail size={14} className="text-[var(--color-laburante-indigo)]" />
          </div>
          <div>
            <p className="text-xs font-heading font-bold text-[var(--color-laburante-text)]">
              Notificaciones por email
            </p>
            <p className="text-[11px] text-[var(--color-laburante-text-secondary)]">
              {enabled ? 'Recibís avisos de presupuestos y pedidos' : 'Solo recibís avisos dentro de la plataforma'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saving && <Loader2 size={13} className="animate-spin text-[var(--color-laburante-indigo)]" />}
          {feedback && (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <Check size={12} /> {feedback}
            </span>
          )}
          {error && (
            <span className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle size={12} /> Error al guardar
            </span>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={loading || saving}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
              enabled ? 'bg-[var(--color-laburante-indigo)]' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    )
  }

  // Card variant (default)
  return (
    <div className={`rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-[var(--color-laburante-indigo)]" />
            <h3 className="font-heading text-sm font-bold text-[var(--color-laburante-text)]">
              Avisos por correo electrónico
            </h3>
          </div>
          <p className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed max-w-md">
            Recibí una copia por email cuando te soliciten presupuestos, te respondan un pedido o tengas novedades importantes. La campanita in-app siempre permanece activa.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={loading || saving}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 mt-1 ${
            enabled ? 'bg-[var(--color-laburante-indigo)]' : 'bg-slate-300'
          }`}
          title={enabled ? 'Desactivar emails' : 'Activar emails'}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--color-laburante-border)]/60 text-[var(--color-laburante-text-muted)]">
        <span className="flex items-center gap-1.5 font-medium">
          {enabled ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <Check size={13} className="text-emerald-600" /> Emails habilitados
            </span>
          ) : (
            <span className="text-slate-500">Emails pausados</span>
          )}
        </span>

        {saving && (
          <span className="inline-flex items-center gap-1 text-[var(--color-laburante-indigo)]">
            <Loader2 size={12} className="animate-spin" /> Guardando preferencia...
          </span>
        )}
        {feedback && (
          <span className="text-emerald-700 font-semibold">{feedback}</span>
        )}
        {error && (
          <span className="text-rose-600 font-semibold">{error}</span>
        )}
      </div>
    </div>
  )
}
