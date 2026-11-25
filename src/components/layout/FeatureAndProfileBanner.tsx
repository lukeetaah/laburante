import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, QrCode, Sparkles, UserCheck, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore, type ProfileWithDetails } from '@/stores/profile-store'
import { isCompanyAccount } from '@/lib/account'
import { fetchDigitalCardConfig } from '@/lib/digital-card'
import { normalizeProfileIntent } from '@/lib/profile-publication'

const HIDDEN_ROUTES = ['/crear-perfil', '/mi-tarjeta', '/ingresar', '/registrar', '/admin', '/empresa']

function isProfileIncomplete(profile: ProfileWithDetails): boolean {
  const intent = normalizeProfileIntent(profile.intent)
  const isSeeker = intent === 'buscar'

  const hasBio = Boolean(profile.bio?.trim())
  const hasSkills = Boolean(
    (profile.skills && profile.skills.length > 0) || (profile.services && profile.services.length > 0)
  )
  const hasLocation = Boolean(profile.provincia?.trim() && profile.localidad?.trim())
  const hasContact = Boolean(
    profile.contact_methods &&
      profile.contact_methods.some((c) => Boolean(c && c.value && String(c.value).trim().length > 0))
  )

  return !hasBio || (!isSeeker && !hasSkills) || !hasLocation || !hasContact
}

function getDismissKey(userId: string): string {
  return `laburante:feature-banner-dismissed:v1:${userId}`
}

export default function FeatureAndProfileBanner() {
  const { user, loading: authLoading, isAdmin } = useAuthStore()
  const { myProfile, fetchMyProfile } = useProfileStore()
  const location = useLocation()

  const [ready, setReady] = useState(false)
  const [hasCard, setHasCard] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let active = true

    if (authLoading) return
    if (!user || isAdmin) {
      setReady(false)
      return
    }

    try {
      if (window.localStorage.getItem(getDismissKey(user.id)) === '1') {
        setDismissed(true)
        setReady(false)
        return
      }
    } catch {
      // Ignorar errores de almacenamiento
    }

    setDismissed(false)

    const loadState = async () => {
      const profile = myProfile || (await fetchMyProfile())
      if (!active) return

      if (isCompanyAccount(user, profile)) {
        setReady(false)
        return
      }

      if (profile?.id) {
        const card = await fetchDigitalCardConfig(profile.id)
        if (!active) return
        setHasCard(Boolean(card))
      } else {
        setHasCard(false)
      }

      setReady(true)
    }

    void loadState()

    return () => {
      active = false
    }
  }, [authLoading, user, isAdmin, myProfile, fetchMyProfile])

  if (!ready || dismissed || !user) return null
  if (HIDDEN_ROUTES.some((prefix) => location.pathname.startsWith(prefix))) return null

  const incomplete = myProfile ? isProfileIncomplete(myProfile) : true

  // Si el perfil ya está completo y ya configuró su tarjeta, no hace falta mostrar el aviso
  if (myProfile && !incomplete && hasCard) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(getDismissKey(user.id), '1')
    } catch {
      // Ignorar errores de almacenamiento
    }
  }

  // Caso 1: Cuenta creada sin perfil publicado todavía
  if (!myProfile) {
    return (
      <div className="border-b border-amber-200 bg-amber-50/90 text-amber-950">
        <div className="container py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <UserCheck size={18} className="text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <p className="leading-relaxed">
              <strong>¡Completá tu perfil en LABURANTE!</strong> Todavía no publicaste tu perfil. Completalo en 2 minutos para aparecer en las búsquedas y activar gratis tu nueva <strong>Tarjeta Digital con QR</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/crear-perfil"
              className="btn-dark inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-heading font-bold text-xs whitespace-nowrap"
            >
              <span>Completar mi perfil</span>
              <ArrowRight size={13} />
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Cerrar aviso"
              className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-200/50 transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Caso 2: Perfil incompleto (invitación a completarlo + novedad de Tarjeta Digital)
  if (incomplete) {
    return (
      <div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 via-amber-50/80 to-indigo-50/70 text-[var(--color-laburante-text)]">
        <div className="container py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <Sparkles size={18} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <p className="leading-relaxed">
              <strong>Tu perfil todavía está incompleto</strong> — completalo para mejorar tu visibilidad. Además, sumamos la nueva <strong>Tarjeta Digital con QR</strong> para que compartas tu trabajo si querés.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              to="/crear-perfil"
              className="btn-dark inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-heading font-bold text-xs whitespace-nowrap"
            >
              <span>Completar mi perfil</span>
              <ArrowRight size={13} />
            </Link>
            {!hasCard && (
              <Link
                to="/mi-tarjeta"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-900 font-heading font-bold text-xs whitespace-nowrap transition-colors"
              >
                <QrCode size={13} className="text-indigo-600" />
                <span>Configurar tarjeta</span>
              </Link>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Cerrar aviso"
              className="p-1.5 rounded-lg text-[var(--color-laburante-text-muted)] hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Caso 3: Perfil completo, pero todavía no configuró su Tarjeta Digital (opt-in)
  return (
    <div className="border-b border-indigo-200 bg-indigo-50/80 text-indigo-950">
      <div className="container py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <QrCode size={18} className="text-indigo-600 shrink-0 mt-0.5 sm:mt-0" />
          <p className="leading-relaxed">
            <strong>¡Novedad en LABURANTE!</strong> Ya podés activar gratis tu <strong>Tarjeta Digital con QR</strong> (<span className="font-semibold">laburante.ar/t/{myProfile.slug}</span>) y descargarla en PDF. Vos elegís si querés usarla y qué datos mostrar.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/mi-tarjeta"
            className="btn-dark inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-heading font-bold text-xs whitespace-nowrap"
          >
            <span>Configurar mi tarjeta</span>
            <ArrowRight size={13} />
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
