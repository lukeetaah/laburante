import { useState } from 'react'
import { X, DollarSign, Clock, FileText, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useJobStore } from '@/stores/job-store'

interface BudgetModalProps {
  requestId: string
  jobTitle: string
  clientName: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function BudgetModal({
  requestId,
  jobTitle,
  clientName,
  isOpen,
  onClose,
  onSuccess,
}: BudgetModalProps) {
  const sendBudget = useJobStore((s) => s.sendBudget)

  const [amount, setAmount] = useState('')
  const [details, setDetails] = useState('')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount.trim()) {
      setError('Por favor ingresá un monto estimado o cerrado.')
      return
    }

    setSubmitting(true)
    setError(null)

    const res = await sendBudget(requestId, {
      amount: amount.trim(),
      details: details.trim() || undefined,
      estimatedTime: estimatedTime.trim() || undefined,
    })

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
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
              Presupuesto Formal
            </span>
            <h2 className="font-heading text-xl font-extrabold text-[var(--color-laburante-text)] mt-2">
              Enviar cotización a {clientName}
            </h2>
            <p className="text-xs text-[var(--color-laburante-text-secondary)] mt-0.5">
              Trabajo solicitado: <strong className="text-[var(--color-laburante-text)]">{jobTitle}</strong>
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                Monto o valor del trabajo ($) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-bold text-[var(--color-laburante-text-muted)]">
                  $
                </span>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="ej: 25.000 o 40.000 - 50.000"
                  required
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm font-bold rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                Tiempo estimado de trabajo
              </label>
              <div className="relative">
                <Clock size={16} className="absolute left-3 top-2.5 text-[var(--color-laburante-text-muted)]" />
                <input
                  type="text"
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                  placeholder="ej: 2 a 3 horas, 1 jornada, 2 días..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                ¿Qué incluye el presupuesto? (detalle o condiciones)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Aclaraciones de materiales, mano de obra, garantía o condiciones del trabajo..."
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)] resize-none"
              />
            </div>

            {/* Zero commission banner */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 flex items-start gap-2.5 text-xs">
              <ShieldCheck size={18} className="text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed text-[11px]">
                <strong className="text-emerald-900">0% de comisión:</strong> El 100% de lo que presupuestes te pertenece. LABURANTE no descuenta dinero ni intermedia en cobros.
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[var(--color-laburante-border)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-xl btn-dark font-heading font-bold text-xs shadow-md disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Enviar presupuesto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
