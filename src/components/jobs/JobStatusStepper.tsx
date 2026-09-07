import { Check, Clock, FileText, DollarSign, Wrench, CheckCircle2, XCircle } from 'lucide-react'
import type { JobRequestStatus } from '@/lib/database.types'

interface JobStatusStepperProps {
  status: JobRequestStatus
  cancelReason?: string | null
  cancelledBy?: 'cliente' | 'profesional' | null
}

const STEPS = [
  {
    id: 'solicitado',
    title: 'Solicitud enviada',
    desc: 'Esperando respuesta del profesional',
    icon: FileText,
  },
  {
    id: 'presupuestado',
    title: 'Presupuesto recibido',
    desc: 'Cotización disponible para revisar',
    icon: DollarSign,
  },
  {
    id: 'en_progreso',
    title: 'Trabajo en curso',
    desc: 'Coordinado y en ejecución directa',
    icon: Wrench,
  },
  {
    id: 'completado',
    title: 'Finalizado',
    desc: 'Trabajo concluido satisfactoriamente',
    icon: CheckCircle2,
  },
]

function getStepIndex(status: JobRequestStatus): number {
  switch (status) {
    case 'solicitado':
      return 0
    case 'presupuestado':
      return 1
    case 'aceptado':
    case 'en_progreso':
      return 2
    case 'completado':
      return 3
    case 'cancelado':
      return -1
    default:
      return 0
  }
}

export default function JobStatusStepper({
  status,
  cancelReason,
  cancelledBy,
}: JobStatusStepperProps) {
  if (status === 'cancelado') {
    return (
      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
        <XCircle size={22} className="text-rose-600 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm space-y-1">
          <p className="font-bold">
            Trabajo cancelado {cancelledBy ? `por el ${cancelledBy}` : ''}
          </p>
          {cancelReason && (
            <p className="text-rose-700 leading-relaxed">
              Motivo: "{cancelReason}"
            </p>
          )}
        </div>
      </div>
    )
  }

  const currentIndex = getStepIndex(status)

  return (
    <div className="space-y-4 py-2">
      {/* Stepper Bar */}
      <div className="relative flex items-center justify-between">
        {/* Progress line behind icons */}
        <div className="absolute top-5 left-6 right-6 h-1 bg-gray-200 -z-0">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{
              width: `${(Math.min(currentIndex, STEPS.length - 1) / (STEPS.length - 1)) * 100}%`,
            }}
          />
        </div>

        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex || (idx === 3 && status === 'completado')
          const isCurrent = idx === currentIndex && status !== 'completado'
          const Icon = step.icon

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center text-center max-w-[80px] sm:max-w-[110px]">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 shadow-xs ${
                  isDone
                    ? 'bg-emerald-600 text-white shadow-emerald-200'
                    : isCurrent
                    ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse'
                    : 'bg-white border-2 border-gray-300 text-gray-400'
                }`}
              >
                {isDone ? <Check size={18} /> : <Icon size={18} />}
              </div>

              <span
                className={`mt-2 text-[11px] sm:text-xs font-heading font-semibold leading-tight ${
                  isDone
                    ? 'text-emerald-800'
                    : isCurrent
                    ? 'text-[var(--color-laburante-text)] font-bold'
                    : 'text-gray-400'
                }`}
              >
                {step.title}
              </span>

              <span className="hidden sm:block text-[10px] text-[var(--color-laburante-text-muted)] mt-0.5 leading-tight">
                {step.desc}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
