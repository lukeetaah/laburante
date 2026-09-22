import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore, getResendCooldownRemaining } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import { PROVINCES } from '@/data/provinces'
import { CheckCircle2, ArrowRight, Building2, Mail, RefreshCw } from 'lucide-react'
import { getPostLoginPath } from '@/lib/contextual-navigation'

export default function Register() {
  const [searchParams] = useSearchParams()
  const isCompany = searchParams.get('tipo') === 'empresa'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [provincia, setProvincia] = useState('CABA')
  const [localidad, setLocalidad] = useState('')
  const [companySector, setCompanySector] = useState('')
  const [teamSize, setTeamSize] = useState('1-5')
  const [companyPlan, setCompanyPlan] = useState<'gratis' | 'pago'>('gratis')
  const [intent, setIntent] = useState<'ofrecer' | 'buscar' | 'ambas'>(isCompany ? 'buscar' : 'ofrecer')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountCreatedEmail, setAccountCreatedEmail] = useState<string | null>(null)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [retryAt, setRetryAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const signUp = useAuthStore((s) => s.signUp)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const resendConfirmationEmail = useAuthStore((s) => s.resendConfirmationEmail)
  const fetchMyProfile = useProfileStore((s) => s.fetchMyProfile)
  const navigate = useNavigate()
  const retryStorageKey = email.trim() ? `laburante_signup_retry:${email.trim().toLowerCase()}` : ''
  const signupLockKey = 'laburante_signup_request_lock'

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

  useEffect(() => {
    if (!accountCreatedEmail) return
    const remaining = getResendCooldownRemaining(accountCreatedEmail)
    if (remaining > 0) {
      setResendCooldown(remaining)
    }
  }, [accountCreatedEmail])

  useEffect(() => {
    if (!retryStorageKey) { setRetryAt(null); return }
    const stored = Number(localStorage.getItem(retryStorageKey) || 0)
    setRetryAt(stored > Date.now() ? stored : null)
  }, [retryStorageKey])

  useEffect(() => {
    if (!retryAt) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= retryAt) {
        setRetryAt(null)
        if (retryStorageKey) localStorage.removeItem(retryStorageKey)
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [retryAt, retryStorageKey])

  const isRateLimitError = (message: string) => /rate|limit|too many|demasiad|esperá|espera|seconds|segundos|429/i.test(message)
  const secondsFromError = (message: string) => {
    const match = message.match(/(\d+)\s*(?:seconds?|segundos?)/i)
    return match ? Math.max(10, Number(match[1])) : 60
  }
  const remainingSeconds = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0
  const formattedWait = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldown])

  const handleResendConfirmation = async () => {
    if (!accountCreatedEmail || resendLoading || resendCooldown > 0) return
    setResendLoading(true)
    setResendMessage(null)
    setResendError(null)

    const res = await resendConfirmationEmail(accountCreatedEmail)
    setResendLoading(false)

    if (res.error) {
      setResendError(res.error)
      if (res.remainingSeconds) {
        setResendCooldown(res.remainingSeconds)
      }
    } else {
      setResendMessage('Correo de confirmación reenviado con éxito. Por favor revisá tu bandeja de entrada y la carpeta de SPAM.')
      setResendCooldown(res.remainingSeconds || 60)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (retryAt && Date.now() < retryAt) {
      setError(`La creación está temporalmente limitada por Supabase. Esperá ${formattedWait} antes de intentar de nuevo.`)
      return
    }

    if (!name.trim()) {
      setError('Por favor ingresá tu nombre completo o profesional.')
      return
    }

    if (!email.trim()) {
      setError('Por favor ingresá un correo electrónico válido.')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (!termsAccepted) {
      setError('Debés aceptar los términos de uso y la política de privacidad.')
      return
    }

    setLoading(true)
    setError(null)

    // Evita dobles envíos desde pestañas abiertas o clicks repetidos mientras
    // Supabase todavía está respondiendo. El lock expira solo y no bloquea
    // nuevos usuarios desde otros dispositivos.
    const currentLock = Number(localStorage.getItem(signupLockKey) || 0)
    if (currentLock > Date.now()) {
      setLoading(false)
      setError('Ya hay una creación de cuenta en curso. Esperá unos segundos para evitar solicitudes duplicadas.')
      return
    }
    const lockValue = String(Date.now() + 15000)
    localStorage.setItem(signupLockKey, lockValue)

    let res
    try {
      res = await signUp(email.trim(), password, {
        name: name.trim(),
        phone: phone.trim(),
        provincia,
        localidad: localidad.trim(),
        intent,
        accountType: isCompany ? 'empresa' : 'persona',
        companyPlan: isCompany ? companyPlan : undefined,
        companySector: isCompany ? companySector.trim() : undefined,
        teamSize: isCompany ? teamSize : undefined,
      })
    } finally {
      if (localStorage.getItem(signupLockKey) === lockValue) localStorage.removeItem(signupLockKey)
    }

    setLoading(false)

    if (res.error) {
      setError(res.error)
      if (isRateLimitError(res.error)) {
        const nextRetryAt = Date.now() + secondsFromError(res.error) * 1000
        setRetryAt(nextRetryAt)
        if (retryStorageKey) localStorage.setItem(retryStorageKey, String(nextRetryAt))
      }
    } else if (res.needsSignIn) {
      if (retryStorageKey) localStorage.removeItem(retryStorageKey)
      setAccountCreatedEmail(email.trim())
    } else {
      if (retryStorageKey) localStorage.removeItem(retryStorageKey)
      const redirectTo = searchParams.get('redirect')
      if (redirectTo && redirectTo.startsWith('/')) {
        navigate(redirectTo)
      } else if (isCompany) {
        navigate('/empresa')
      } else {
        const persistedProfile = await fetchMyProfile()
        navigate(getPostLoginPath(persistedProfile?.intent))
      }
    }
  }

  if (accountCreatedEmail) {
    return (
      <div className="container py-12 md:py-20 max-w-md mx-auto">
        <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-6 shadow-xs text-center">
          <div className="h-16 w-16 mx-auto rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[var(--color-laburante-indigo)]">
            <Mail size={32} />
          </div>

          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-extrabold text-[var(--color-laburante-text)]">
              Revisá tu email para confirmar tu cuenta
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
              Te enviamos un enlace de activación a <strong className="text-[var(--color-laburante-text)]">{accountCreatedEmail}</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-left space-y-2 text-xs text-amber-950">
            <p className="font-bold text-amber-900 flex items-center gap-1.5">
              <span>Importante:</span>
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-amber-900 text-[11px] leading-relaxed">
              <li>El correo puede tardar unos minutos en llegar.</li>
              <li>Si no lo encontrás en tu bandeja principal, <strong>revisá también SPAM o Correo no deseado</strong>.</li>
              <li>Hacé clic en el enlace del correo para activar tu cuenta antes de ingresar.</li>
            </ul>
          </div>

          {resendMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              {resendMessage}
            </div>
          )}

          {resendError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {resendError}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendLoading || resendCooldown > 0}
              className="w-full py-2.5 px-4 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] hover:bg-[var(--color-laburante-surface)] font-heading font-semibold text-xs text-[var(--color-laburante-text)] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={resendLoading ? 'animate-spin' : ''} />
              <span>
                {resendCooldown > 0
                  ? `Reenviar correo en ${resendCooldown}s`
                  : '¿No te llegó el correo? Reenviar confirmación'}
              </span>
            </button>

            <Link
              to="/ingresar"
              className="btn-dark w-full py-3.5 px-4 rounded-xl font-heading font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              <span>Ya confirmé mi cuenta · Iniciar sesión</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-12 md:py-16 max-w-lg mx-auto">
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="text-center space-y-1">
          <h1 className="font-heading text-2xl font-extrabold text-[var(--color-laburante-text)]">
            {isCompany ? 'Crear cuenta para mi empresa' : 'Crear cuenta en LABURANTE'}
          </h1>
          <p className="text-xs text-[var(--color-laburante-text-secondary)]">
            {isCompany
              ? 'Empezá a encontrar profesionales con herramientas pensadas para equipos.'
              : 'Registro gratuito para ofrecer servicios o buscar trabajadores en todo el país.'}
          </p>
          <div className="mx-auto mt-3 max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-[11px] leading-relaxed text-emerald-900">
            <strong>Crear tu cuenta es gratis.</strong> En algunos momentos puede haber una breve espera para completar el registro. Gracias por tu paciencia.
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        {retryAt && remainingSeconds > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center text-amber-950">
            <p className="text-[10px] font-bold uppercase tracking-widest">Estamos preparando tu cuenta</p>
            <p className="mt-1 font-heading text-3xl font-extrabold tabular-nums">{formattedWait}</p>
            <p className="mt-1 text-[11px] leading-relaxed">El registro sigue siendo gratuito. Cuando termine la espera, podés continuar con la creación de tu cuenta.</p>
          </div>
        )}

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
            <span>Registrarse con Google</span>
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
              {isCompany ? 'Nombre de la empresa' : 'Nombre completo o denominación profesional'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isCompany ? 'ej: Constructora del Sur' : 'ej: Martín Fernández o Reparaciones San Martín'}
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
              Correo electrónico <span className="text-rose-500">*</span>
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
              Teléfono de contacto / WhatsApp (opcional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="ej: 11 2345-6789"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
            />
            <p className="text-[10px] text-[var(--color-laburante-text-muted)] mt-1">
              No se mostrará públicamente salvo que lo confirmes explícitamente en tu perfil.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                Provincia <span className="text-rose-500">*</span>
              </label>
              <select
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
              >
                {PROVINCES.map((p) => (
                  <option key={p.slug} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                Localidad o barrio
              </label>
              <input
                type="text"
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                placeholder="ej: Belgrano, Rosario, Tandil..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
              />
            </div>
          </div>

          {isCompany && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">Rubro de la empresa</label>
                  <input value={companySector} onChange={(e) => setCompanySector(e.target.value)} placeholder="ej: Construcción, comercio, tecnología" className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">Tamaño del equipo</label>
                  <select value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent">
                    <option>1-5</option><option>6-20</option><option>21-50</option><option>51+</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Elegí cómo querés empezar</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                   {([
                     ['gratis', 'Gratis', 'Búsqueda, perfiles y selección básica'],
                     ['pago', 'Quiero que me contacten', 'Coordinamos una entrevista para mostrarte el producto y conversar la activación'],
                   ] as const).map(([value, title, detail]) => (
                    <button key={value} type="button" onClick={() => setCompanyPlan(value)} className={`rounded-xl border p-3 text-left transition-colors ${companyPlan === value ? 'border-[var(--color-laburante-indigo)] bg-indigo-50/60' : 'border-[var(--color-laburante-border)]'}`}>
                      <span className="block text-xs font-bold text-[var(--color-laburante-text)]">{title}</span>
                      <span className="mt-1 block text-[10px] leading-relaxed text-[var(--color-laburante-text-secondary)]">{detail}</span>
                    </button>
                  ))}
                </div>
                 <p className="text-[10px] text-[var(--color-laburante-text-muted)]">Elegir Pago sólo envía una solicitud. La cuenta se crea en Gratis, no realiza cobros y ninguna capacidad Pago se habilita hasta la aprobación desde Admin.</p>
              </div>
            </>
          )}

          {isCompany && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
              <Building2 size={18} className="mt-0.5 shrink-0" />
               <p>{companyPlan === 'pago' ? 'Tu solicitud de contacto quedó registrada. Te escribiremos para coordinar una entrevista y mostrarte el producto.' : 'Tu cuenta Gratis permite buscar, revisar perfiles y gestionar selecciones básicas sin costo.'}</p>
            </div>
          )}

          {!isCompany && <div>
            <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1.5">
              ¿Cuál es tu intención principal?
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setIntent('ofrecer')}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                  intent === 'ofrecer'
                    ? 'border-[var(--color-laburante-indigo)] bg-indigo-50/50 text-[var(--color-laburante-indigo)] font-bold'
                    : 'border-[var(--color-laburante-border)] text-[var(--color-laburante-text-secondary)]'
                }`}
              >
                Ofrecer mi trabajo
              </button>
              <button
                type="button"
                onClick={() => setIntent('buscar')}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                  intent === 'buscar'
                    ? 'border-[var(--color-laburante-indigo)] bg-indigo-50/50 text-[var(--color-laburante-indigo)] font-bold'
                    : 'border-[var(--color-laburante-border)] text-[var(--color-laburante-text-secondary)]'
                }`}
              >
                Buscar a alguien
              </button>
              <button
                type="button"
                onClick={() => setIntent('ambas')}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                  intent === 'ambas'
                    ? 'border-[var(--color-laburante-indigo)] bg-indigo-50/50 text-[var(--color-laburante-indigo)] font-bold'
                    : 'border-[var(--color-laburante-border)] text-[var(--color-laburante-text-secondary)]'
                }`}
              >
                Ambas cosas
              </button>
            </div>
          </div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                Contraseña <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                Confirmar contraseña <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetí la contraseña"
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--color-laburante-border)] text-[var(--color-laburante-indigo)] focus:ring-0"
                required
              />
              <span className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed">
                Acepto los{' '}
                <Link to="/terminos" target="_blank" className="underline font-semibold text-[var(--color-laburante-text)]">
                  Términos de uso
                </Link>{' '}
                y la{' '}
                <Link to="/privacidad" target="_blank" className="underline font-semibold text-[var(--color-laburante-text)]">
                  Política de privacidad
                </Link>{' '}
                de LABURANTE.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || Boolean(retryAt && remainingSeconds > 0)}
            className="btn-dark w-full py-3.5 px-4 rounded-xl font-heading font-bold text-sm transition-all hover:scale-[1.01] shadow-md disabled:opacity-50 mt-2"
          >
            {loading ? 'Registrando cuenta...' : retryAt && remainingSeconds > 0 ? `Esperar ${formattedWait}` : 'Crear mi cuenta gratuita'}
          </button>
        </form>

        <div className="text-center text-xs text-[var(--color-laburante-text-secondary)] pt-2 border-t border-[var(--color-laburante-border)]">
          ¿Ya tenés una cuenta?{' '}
          <Link to="/ingresar" className="font-semibold text-[var(--color-laburante-indigo)] hover:underline">
            Iniciá sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
