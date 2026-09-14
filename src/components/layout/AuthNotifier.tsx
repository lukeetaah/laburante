import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import { isCompanyAccount } from '@/lib/account'
import { getPostLoginPath } from '@/lib/contextual-navigation'
import { CheckCircle2, ArrowRight, X, Sparkles } from 'lucide-react'

export default function AuthNotifier() {
  const { user, isAdmin } = useAuthStore()
  const { myProfile, fetchMyProfile } = useProfileStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [showConfirmedNotice, setShowConfirmedNotice] = useState(false)
  const [confirmedName, setConfirmedName] = useState('')
  const handledConfirmation = useRef(false)

  useEffect(() => {
    // Keep compatibility with older Supabase redirect links while using the
    // current immediate-access signup flow.
    const hash = window.location.hash
    const search = window.location.search

    const isSignupConfirm =
      hash.includes('type=signup') ||
      hash.includes('access_token=') ||
      search.includes('confirmed=true')

    if (isSignupConfirm) {
      setShowConfirmedNotice(true)

      // Clean the ugly hash from URL without reloading
      if (hash && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }

      // If user came from an older signup redirect and is on home page, use the persisted profile intent.
      if (location.pathname === '/' && !handledConfirmation.current) {
        handledConfirmation.current = true
        const redirectTo = new URLSearchParams(window.location.search).get('redirect')
        fetchMyProfile().then((profile) => {
          const currentUser = useAuthStore.getState().user
          const destination = redirectTo && redirectTo.startsWith('/')
            ? redirectTo
            : useAuthStore.getState().isAdmin
              ? '/admin'
              : isCompanyAccount(currentUser, profile)
              ? '/empresa'
              : getPostLoginPath(profile?.intent)
          navigate(destination)
        })
      }
    }
  }, [user, myProfile, location.pathname, navigate, fetchMyProfile])

  useEffect(() => {
    if (user?.user_metadata?.name) {
      setConfirmedName(user.user_metadata.name)
    }
  }, [user])

  if (!showConfirmedNotice) return null

  const destination = isAdmin ? '/admin' : isCompanyAccount(user, myProfile) ? '/empresa' : getPostLoginPath(myProfile?.intent)

  return (
    <div className="bg-emerald-600 text-white py-3.5 px-4 shadow-md sticky top-16 z-40 animate-in slide-in-from-top duration-200">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={20} className="text-emerald-200 flex-shrink-0" />
          <p className="font-medium leading-tight">
            <strong>¡Cuenta activa{confirmedName ? `, ${confirmedName}` : ''}!</strong> Tu sesión está lista para continuar en LABURANTE.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {location.pathname !== '/crear-perfil' && location.pathname !== '/empresa' && (
            <Link
              to={destination}
              onClick={() => setShowConfirmedNotice(false)}
              className="py-1.5 px-4 rounded-xl bg-white text-emerald-950 font-heading font-bold text-xs hover:bg-emerald-50 transition-colors shadow-xs flex items-center gap-1.5"
            >
              {destination === '/admin' ? 'Ir a Administración' : destination === '/empresa' ? 'Ir a mi espacio Empresa' : destination === '/buscar' ? 'Ir a buscar profesionales' : destination === '/mis-trabajos' ? 'Ir a mis trabajos' : 'Completar mi perfil de trabajo'}
              <ArrowRight size={13} />
            </Link>
          )}

          <button
            onClick={() => setShowConfirmedNotice(false)}
            className="p-1 text-emerald-200 hover:text-white rounded-md"
            aria-label="Cerrar aviso"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
