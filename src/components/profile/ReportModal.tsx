import { useState } from 'react'
import { X, AlertTriangle, CheckCircle } from 'lucide-react'
import { useProfileStore } from '@/stores/profile-store'

interface ReportModalProps {
  profileId: string
  profileName: string
  isOpen: boolean
  onClose: () => void
}

const REPORT_REASONS = [
  { id: 'datos_falsos', label: 'Datos falsos o engañosos' },
  { id: 'spam', label: 'Spam o publicidad no deseada' },
  { id: 'fraude', label: 'Intento de estafa o fraude' },
  { id: 'datos_sin_autorizacion', label: 'Publicación de datos personales sin autorización' },
  { id: 'suplantacion', label: 'Suplantación de identidad' },
  { id: 'ofensivo', label: 'Contenido inapropiado u ofensivo' },
  { id: 'acoso', label: 'Acoso o conducta abusiva' },
  { id: 'otro', label: 'Otro motivo' },
]

export default function ReportModal({ profileId, profileName, isOpen, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitReport = useProfileStore((s) => s.submitReport)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) {
      setError('Por favor seleccioná un motivo.')
      return
    }

    setSubmitting(true)
    setError(null)

    const res = await submitReport(profileId, reason, description)
    setSubmitting(false)

    if (res.error) {
      setError(res.error)
    } else {
      setSuccess(true)
    }
  }

  const handleReset = () => {
    setSuccess(false)
    setReason('')
    setDescription('')
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={handleReset}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--color-laburante-text-muted)] hover:bg-[var(--color-laburante-surface-alt)]"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        {success ? (
          <div className="text-center py-6">
            <CheckCircle size={44} className="mx-auto text-emerald-600 mb-3" />
            <h3 className="font-heading text-xl font-bold text-[var(--color-laburante-text)] mb-2">
              Reporte recibido
            </h3>
            <p className="text-sm text-[var(--color-laburante-text-secondary)] mb-6">
              Gracias por ayudarnos a cuidar la comunidad. El reporte quedará registrado para su revisión.
            </p>
            <button
              onClick={handleReset}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] font-heading font-semibold text-sm hover:bg-[var(--color-laburante-border)] transition-colors"
            >
              Entendido
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 text-rose-600 mb-2">
              <AlertTriangle size={20} />
              <h3 className="font-heading text-lg font-bold">Reportar perfil</h3>
            </div>
            <p className="text-xs text-[var(--color-laburante-text-secondary)] mb-4">
              Perfil: <strong className="text-[var(--color-laburante-text)]">{profileName}</strong>
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1.5">
                  Motivo del reporte <span className="text-rose-500">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
                  required
                >
                  <option value="">Seleccioná un motivo...</option>
                  {REPORT_REASONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1.5">
                  Detalle adicional (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Aportá más contexto para que podamos revisar el caso con precisión..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] focus:ring-2 focus:ring-[var(--color-laburante-indigo)] resize-none"
                />
              </div>

              <p className="text-[11px] text-[var(--color-laburante-text-muted)] leading-relaxed">
                Los reportes son confidenciales y se investigan para prevenir abusos, datos falsos o infracciones a las reglas comunitarias.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-[var(--color-laburante-border)] text-sm font-medium text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Enviando...' : 'Enviar reporte'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
