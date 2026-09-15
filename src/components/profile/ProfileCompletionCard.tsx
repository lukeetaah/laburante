import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, ArrowRight, ShieldCheck, Edit3 } from 'lucide-react'
import type { ProfileWithDetails } from '@/stores/profile-store'

interface ProfileCompletionCardProps {
  profile: ProfileWithDetails
  onOpenWhatsAppVerify?: () => void
  className?: string
}

export default function ProfileCompletionCard({
  profile,
  onOpenWhatsAppVerify,
  className = '',
}: ProfileCompletionCardProps) {
  const hasBio = Boolean(profile.bio?.trim())
  const hasSkills = Boolean((profile.skills && profile.skills.length > 0) || (profile.services && profile.services.length > 0))
  const hasLocation = Boolean(profile.provincia?.trim() && profile.localidad?.trim())
  const hasContact = Boolean(profile.contact_methods && profile.contact_methods.length > 0)
  const isWhatsAppVerified = Boolean(profile.whatsapp_verified)

  const steps = [
    { label: 'Cuenta creada', done: true },
    { label: 'Agregá una descripción sobre vos', done: hasBio },
    { label: 'Contá qué sabés hacer (oficios y servicios)', done: hasSkills },
    { label: 'Completá tu zona y modalidad de trabajo', done: hasLocation },
    { label: 'Sumá al menos un medio de contacto', done: hasContact },
    { label: 'Verificá tu WhatsApp para tener el sello oficial', done: isWhatsAppVerified },
  ]

  const completedCount = steps.filter((s) => s.done).length
  const isFullyComplete = completedCount === steps.length

  if (isFullyComplete) {
    return (
      <div className={`rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5 text-xs text-emerald-950 ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="font-heading font-bold text-sm text-emerald-900">Tu perfil está completo</p>
              <p className="text-emerald-800 text-[11px] mt-0.5">
                Aparecés en las búsquedas y categorías para que clientes y empresas puedan encontrarte y contactarte.
              </p>
            </div>
          </div>
          <Link
            to="/crear-perfil"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-emerald-300 font-heading font-bold text-xs text-emerald-900 hover:bg-emerald-100/60 transition-colors shrink-0 shadow-2xs"
          >
            <Edit3 size={13} />
            <span>Editar perfil</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
          Paso a paso de tu perfil
        </div>
        <h3 className="font-heading text-base sm:text-lg font-extrabold text-[var(--color-laburante-text)]">
          Tu cuenta ya está creada. Completá tu perfil para que puedan encontrarte.
        </h3>
        <p className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed">
          Cuantos más datos sumes, más fácil será que clientes y empresas te descubran cuando busquen lo que sabés hacer.
        </p>
      </div>

      {/* Progress Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs transition-colors ${
              step.done
                ? 'border-emerald-200 bg-emerald-50/50 text-emerald-950 font-medium'
                : 'border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/50 text-[var(--color-laburante-text-secondary)]'
            }`}
          >
            {step.done ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <Circle size={16} className="text-slate-400 shrink-0" />
            )}
            <span className="truncate">{step.label}</span>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[var(--color-laburante-border)]/60">
        <Link
          to="/crear-perfil"
          className="btn-dark inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-heading font-bold text-xs shadow-xs"
        >
          <span>Completar mi perfil</span>
          <ArrowRight size={14} />
        </Link>

        {!isWhatsAppVerified && onOpenWhatsAppVerify && (
          <button
            type="button"
            onClick={onOpenWhatsAppVerify}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 font-heading font-bold text-xs transition-colors shadow-2xs cursor-pointer"
          >
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Verificar WhatsApp</span>
          </button>
        )}
      </div>
    </div>
  )
}
