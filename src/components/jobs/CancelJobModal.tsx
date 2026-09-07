import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useJobStore } from '@/stores/job-store'

interface CancelJobModalProps {
  requestId: string
  jobTitle: string
  cancelledBy: 'cliente' | 'profesional'
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const COMMON_REASONS = {
  profesional: [
    'No tengo disponibilidad en las fechas solicitadas',
    'El trabajo queda fuera de mi zona de cobertura',
    'No realizo este tipo específico de servicio',
    'Otro motivo',
  ],
  cliente: [
    'Ya lo resolví por otra vía',
    'El presupuesto no se ajusta a lo que buscaba',
    'Deseo postergar la realización del trabajo',
    'Otro motivo',
  ],
}

export default function CancelJobModal({
  requestId,
  jobTitle,
  cancelledBy,
  isOpen,
  onClose,
  onSuccess,
}: CancelJobModalProps) {
  const cancelJob = useJobStore((s) => s.cancelJob)

  const [selectedReason, setSelectedReason] = useState(COMMON_REASONS[cancelledBy][0])
  const [customReason, setCustomReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const reason = selectedReason === 'Otro motivo'
      ? customReason.trim()
      : selectedReason

    if (!reason) {
      setError('Por favor indicá un motivo de cancelación.')
      return
    }

    setSubmitting(true)
    setError(null)

    const res = await cancelJob(requestId, reason, cancelledBy)
    setSubmitting(false)

    if (res.error) {
      setError(res.error)
    } else {
      if (onSuccess) onSuccess()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-[var(--color-laburante-text-muted)] hover:bg-[var(--color-laburante-surface-alt)]"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle size={20} />
            <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
              Cancelar solicitud de trabajo
            </h2>
          </div>

          <p className="text-xs text-[var(--color-laburante-text-secondary)]">
            Trabajo: <strong className="text-[var(--color-laburante-text)]">{jobTitle}</strong>
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-2">
                Motivo de la cancelación:
              </label>
              <div className="space-y-2">
                {COMMON_REASONS[cancelledBy].map((r) => (
                  <label
                    key={r}
                    className={`block p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      selectedReason === r
                        ? 'border-rose-400 bg-rose-50/50 text-rose-950 font-medium'
                        : 'border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel_reason"
                      checked={selectedReason === r}
                      onChange={() => setSelectedReason(r)}
                      className="mr-2 text-rose-600 focus:ring-0"
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            {selectedReason === 'Otro motivo' && (
              <div>
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Detallá el motivo..."
                  rows={2}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-transparent resize-none"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[var(--color-laburante-border)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)]"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-heading font-bold text-xs shadow-md disabled:opacity-50"
              >
                {submitting ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
