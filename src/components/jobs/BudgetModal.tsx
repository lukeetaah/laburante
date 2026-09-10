import { useMemo, useState } from 'react'
import { X, DollarSign, Clock, FileText, CheckCircle2, ShieldCheck, HelpCircle, Calculator } from 'lucide-react'
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
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [hourlyRate, setHourlyRate] = useState('')
  const [hours, setHours] = useState('')
  const [materials, setMaterials] = useState('')
  const [travel, setTravel] = useState('')
  const [otherCosts, setOtherCosts] = useState('')
  const [floatPercent, setFloatPercent] = useState('10')

  const calculation = useMemo(() => {
    const number = (value: string) => Number(value.replace(',', '.')) || 0
    const labor = number(hourlyRate) * number(hours)
    const base = labor + number(materials) + number(travel) + number(otherCosts)
    const floatAmount = base * (number(floatPercent) / 100)
    return { labor, base, floatAmount, minimum: base + floatAmount }
  }, [hourlyRate, hours, materials, travel, otherCosts, floatPercent])

  const money = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.round(value))
  const calculatorFields: { key: string; label: string; value: string; set: (value: string) => void }[] = [
    { key: 'hourlyRate', label: 'Valor por hora', value: hourlyRate, set: setHourlyRate },
    { key: 'hours', label: 'Horas estimadas', value: hours, set: setHours },
    { key: 'materials', label: 'Materiales', value: materials, set: setMaterials },
    { key: 'travel', label: 'Traslado', value: travel, set: setTravel },
    { key: 'otherCosts', label: 'Otros costos', value: otherCosts, set: setOtherCosts },
    { key: 'floatPercent', label: 'Flotación %', value: floatPercent, set: setFloatPercent },
  ]

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
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-[var(--color-laburante-text)]">
                  Monto o valor del trabajo ($) <span className="text-rose-500">*</span>
                </label>
                <button type="button" onClick={() => setCalculatorOpen(true)} className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:underline" title="Abrir calculadora de presupuesto">
                  <HelpCircle size={14} /> Ayuda para calcular
                </button>
              </div>
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

            {calculatorOpen && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-indigo-950">
                <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-1.5 text-xs font-bold"><Calculator size={15} /> Calculadora orientativa</p><p className="mt-1 text-[11px] leading-relaxed">Calculá un piso para no olvidarte de costos. No fija el precio ni reemplaza tu criterio.</p></div><button type="button" onClick={() => setCalculatorOpen(false)} aria-label="Cerrar calculadora"><X size={15} /></button></div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {calculatorFields.map((field) => <label key={field.key} className="text-[10px] font-semibold">{field.label}<input type="number" min="0" step="any" value={field.value} onChange={(event) => field.set(event.target.value)} className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-2.5 py-2 text-xs" /></label>)}
                </div>
                <div className="mt-3 space-y-1 rounded-xl bg-white/80 p-3 text-xs"><p>Mano de obra: <strong>${money(calculation.labor)}</strong></p><p>Costos base: <strong>${money(calculation.base)}</strong></p><p className="text-indigo-800">Flotación sugerida: <strong>${money(calculation.floatAmount)}</strong></p><p className="border-t border-indigo-100 pt-2 text-sm font-extrabold">Piso orientativo: ${money(calculation.minimum)}</p></div>
                <button type="button" disabled={calculation.minimum <= 0} onClick={() => { setAmount(money(calculation.minimum)); setCalculatorOpen(false) }} className="mt-3 w-full rounded-xl bg-indigo-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">Usar este piso como presupuesto</button>
              </div>
            )}

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
