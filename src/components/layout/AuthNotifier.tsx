import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { CheckCircle2, ArrowRight, X, Sparkles } from 'lucide-react'

export default function AuthNotifier() {
  const { user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [showConfirmedNotice, setShowConfirmedNotice] = useState(false)
  const [confirmedName, setConfirmedName] = useState('')

  useEffect(() => {
    // Check if the URL contains confirmation tokens from Supabase Auth email redirect
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

      // If user came from signup confirmation and is on home page, prompt or guide to /crear-perfil
      if (location.pathname === '/') {
        const intent = user?.user_metadata?.intent
        if (intent === 'ofrecer' || intent === 'ambas') {
          // Redirect them to complete their profile with context
          navigate('/crear-perfil?confirmed=true')
        }
      }
    }
  }, [user, location.pathname, navigate])

  useEffect(() => {
    if (user?.user_metadata?.name) {
      setConfirmedName(user.user_metadata.name)
    }
  }, [user])

  if (!showConfirmedNotice) return null

  return (
    <div className="bg-emerald-600 text-white py-3.5 px-4 shadow-md sticky top-16 z-40 animate-in slide-in-from-top duration-200">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={20} className="text-emerald-200 flex-shrink-0" />
          <p className="font-medium leading-tight">
            🎉 <strong>¡Cuenta confirmada con éxito{confirmedName ? `, ${confirmedName}` : ''}!</strong> Tu correo ya está verificado y tu sesión está activa.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {location.pathname !== '/crear-perfil' && (
            <Link
              to="/crear-perfil?confirmed=true"
              onClick={() => setShowConfirmedNotice(false)}
              className="py-1.5 px-4 rounded-xl bg-white text-emerald-950 font-heading font-bold text-xs hover:bg-emerald-50 transition-colors shadow-xs flex items-center gap-1.5"
            >
              Completar mi perfil de trabajo
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
