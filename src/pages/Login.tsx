import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore, getResendCooldownRemaining } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import { isCompanyAccount } from '@/lib/account'
import { getPostLoginPath } from '@/lib/contextual-navigation'
import { LogIn, ArrowRight, Mail, RefreshCw, CheckCircle2 } from 'lucide-react'

export default function Login() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  const signIn = useAuthStore((s) => s.signIn)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const resendConfirmationEmail = useAuthStore((s) => s.resendConfirmationEmail)
  const fetchMyProfile = useProfileStore((s) => s.fetchMyProfile)
  const navigate = useNavigate()

  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null)

  const handleGoogleLogin = async () => {
    setError(null)
    setOauthLoading('google')
    const res = await signInWithGoogle()
    if (res.error) {
      setError(res.error)
      setOauthLoading(null)
    }
  }

  const isConfirmedQuery = searchParams.get('confirmado') === '1'

  const isEmailNotConfirmed = Boolean(
    error && (
      error.toLowerCase().includes('email not confirmed') ||
      error.toLowerCase().includes('not confirmed') ||
      error.toLowerCase().includes('correo no confirmado') ||
      error.toLowerCase().includes('email_not_confirmed')
    )
  )

  // Sincronizar cooldown persistente ante cambios de email o error de confirmación
  useEffect(() => {
    const trimmed = email.trim()
    if (!trimmed) return
    const remaining = getResendCooldownRemaining(trimmed)
    if (remaining > 0) {
      setResendCooldown(remaining)
    }
  }, [email, isEmailNotConfirmed])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldown])

  const handleResendConfirmation = async () => {
    const trimmed = email.trim()
    if (!trimmed || resendLoading || resendCooldown > 0) return
    setResendLoading(true)
    setResendMessage(null)
    setResendError(null)

    const res = await resendConfirmationEmail(trimmed)
    setResendLoading(false)

    if (res.error) {
      setResendError(res.error)
      if (res.remainingSeconds) {
        setResendCooldown(res.remainingSeconds)
      }
    } else {
      setResendMessage('Correo de confirmación reenviado. Revisá tu bandeja de entrada y SPAM.')
      setResendCooldown(res.remainingSeconds || 60)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResendMessage(null)
    setResendError(null)

    const res = await signIn(email.trim(), password)
    setLoading(false)

    if (res.error) {
      setError(res.error)
    } else {
      const profile = await fetchMyProfile()
      const redirectTo = searchParams.get('redirect')
      const authState = useAuthStore.getState()
      const destination = redirectTo && redirectTo.startsWith('/')
        ? redirectTo
        : authState.isAdmin
          ? '/admin'
          : isCompanyAccount(authState.user, profile)
            ? '/empresa'
            : getPostLoginPath(profile?.intent)
      navigate(destination)
    }
  }

  return (
    <div className="container py-12 md:py-20 max-w-md mx-auto">
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="text-center space-y-1">
          <h1 className="font-heading text-2xl font-extrabold text-[var(--color-laburante-text)]">
            Ingresar a LABURANTE
          </h1>
          <p className="text-xs text-[var(--color-laburante-text-secondary)]">
            Accedé para administrar tu perfil o publicar tus servicios.
          </p>
        </div>

        {isConfirmedQuery && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>¡Tu correo fue confirmado con éxito! Ya podés ingresar a tu cuenta.</span>
          </div>
        )}

        {isEmailNotConfirmed ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2.5 text-xs">
            <div className="flex items-start gap-2">
              <Mail size={18} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900">Revisá tu email para activar tu cuenta</p>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  Tu cuenta todavía no fue confirmada. Buscá el correo de confirmación en tu bandeja de entrada o en la carpeta de <strong>SPAM o Correo no deseado</strong>. Puede tardar unos minutos en llegar.
                </p>
              </div>
            </div>

            {resendMessage && (
              <div className="p-2.5 rounded-xl bg-emerald-100/80 border border-emerald-300 text-xs text-emerald-900">
                {resendMessage}
              </div>
            )}

            {resendError && (
              <div className="p-2.5 rounded-xl bg-rose-100/80 border border-rose-300 text-xs text-rose-900">
                {resendError}
              </div>
            )}

            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendLoading || resendCooldown > 0}
              className="w-full py-2 px-3 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/60 font-heading font-semibold text-[11px] text-amber-950 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw size={12} className={resendLoading ? 'animate-spin' : ''} />
              <span>
                {resendCooldown > 0
                  ? `Reenviar correo en ${resendCooldown}s`
                  : 'Reenviar email de confirmación'}
              </span>
            </button>
          </div>
        ) : error ? (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        {/* Botones de OAuth */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={oauthLoading !== null || loading}
            className="w-full py-2.5 px-4 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] font-heading font-semibold text-xs text-[var(--color-laburante-text)] transition-colors inline-flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            {oauthLoading === 'google' ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            )}
            <span>Continuar con Google</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--color-laburante-border)]" />
          <span className="text-[11px] uppercase tracking-wider text-[var(--color-laburante-text-muted)] font-semibold">
            o con tu email
          </span>
          <div className="flex-1 h-px bg-[var(--color-laburante-border)]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-dark w-full py-3.5 px-4 rounded-xl font-heading font-bold text-sm transition-all hover:scale-[1.01] shadow-md disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar a mi cuenta'}
          </button>
        </form>

        <div className="text-center text-xs text-[var(--color-laburante-text-secondary)] pt-2 border-t border-[var(--color-laburante-border)]">
          ¿Todavía no tenés cuenta?{' '}
          <Link to={searchParams.get('redirect') ? `/registrar?redirect=${encodeURIComponent(searchParams.get('redirect') || '')}` : '/registrar'} className="font-semibold text-[var(--color-laburante-indigo)] hover:underline">
            Registrate gratis
          </Link>
        </div>
      </div>
    </div>
  )
}
