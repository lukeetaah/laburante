import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import { isCompanyAccount } from '@/lib/account'
import { CheckCircle2, ArrowRight, Sparkles, UserCheck, MapPin, Phone, Building2 } from 'lucide-react'

export default function WelcomeModal() {
  const { user } = useAuthStore()
  const myProfile = useProfileStore((state) => state.myProfile)
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Check if the current URL has confirmation tokens or type=signup
    const hash = window.location.hash
    const search = window.location.search

    const isSignupConfirm =
      hash.includes('type=signup') ||
      (hash.includes('access_token=') && hash.includes('type=signup')) ||
      search.includes('confirmed=true')

    if (isSignupConfirm) {
      setIsOpen(true)

      // Clean the hash from the address bar so the user sees a clean URL
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
  }, [])

  if (!isOpen) return null

  const metadata = user?.user_metadata || {}
  const userName = metadata.name || 'Trabajador'
  const userPhone = metadata.phone || ''
  const isCompany = isCompanyAccount(user, myProfile)
  const userLocation = metadata.localidad
    ? `${metadata.localidad}, ${metadata.provincia || 'Argentina'}`
    : metadata.provincia || 'Argentina'

  const handleGoToProfile = () => {
    setIsOpen(false)
    navigate(isCompany ? '/empresa' : '/crear-perfil?confirmed=true')
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 shadow-2xl space-y-6 text-center">
        {/* Success Icon */}
        <div className="h-16 w-16 rounded-full bg-emerald-100 border border-emerald-300 mx-auto flex items-center justify-center text-emerald-600 shadow-xs">
          <CheckCircle2 size={36} />
        </div>

        {/* Title & Explanation */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
            <Sparkles size={13} /> Correo verificado con éxito
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)]">
            ¡Hola, {userName}!
          </h2>
          <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
            Tu cuenta ya está activa y confirmada en <strong>LABURANTE</strong>.
          </p>
        </div>

        {/* Next steps explanation card */}
        <div className="p-4 rounded-2xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] text-left space-y-2.5">
          <div className="flex items-center gap-2 font-heading font-bold text-xs text-[var(--color-laburante-text)]">
            {isCompany ? <Building2 size={16} className="text-[var(--color-laburante-indigo)]" /> : <UserCheck size={16} className="text-[var(--color-laburante-indigo)]" />}
            ¿Qué tenés que hacer ahora?
          </div>
          <p className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed">
            {isCompany ? <>Tu cuenta Empresa ya está activa. El próximo paso es <strong>buscar LABURANTEs, guardar perfiles y proponer entrevistas o contrataciones</strong>. La orden de compra y el alta de proveedor las gestiona tu empresa.</> : <>Para que personas de tu zona puedan encontrarte y enviarte pedidos de presupuesto, el paso siguiente es <strong>publicar tu perfil de servicios</strong>.</>}
          </p>
          <div className="pt-2 border-t border-[var(--color-laburante-border)]/70 text-[11px] text-[var(--color-laburante-text-muted)] space-y-1">
            <p className="font-semibold text-[var(--color-laburante-text-secondary)]">
              Datos ya precargados de tu registro:
            </p>
            <div className="flex items-center gap-2 text-[var(--color-laburante-text)]">
              <MapPin size={12} className="text-[var(--color-laburante-accent)] flex-shrink-0" />
              <span>{userLocation}</span>
            </div>
            {userPhone && (
              <div className="flex items-center gap-2 text-[var(--color-laburante-text)]">
                <Phone size={12} className="text-emerald-600 flex-shrink-0" />
                <span>WhatsApp: {userPhone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={handleGoToProfile}
            className="btn-dark w-full py-4 px-6 rounded-2xl font-heading font-bold text-sm shadow-md transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
          >
            {isCompany ? 'Ir a mi espacio Empresa' : 'Completar y publicar mi perfil ahora'}
            <ArrowRight size={16} />
          </button>

          <button
            onClick={handleClose}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)] transition-colors"
          >
            Explorar la plataforma primero
          </button>
        </div>
      </div>
    </div>
  )
}
