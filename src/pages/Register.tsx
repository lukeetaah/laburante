import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { PROVINCES } from '@/data/provinces'
import { ShieldCheck } from 'lucide-react'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [provincia, setProvincia] = useState('CABA')
  const [localidad, setLocalidad] = useState('')
  const [intent, setIntent] = useState<'ofrecer' | 'buscar' | 'ambas'>('ofrecer')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signUp = useAuthStore((s) => s.signUp)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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

    const res = await signUp(email.trim(), password, {
      name: name.trim(),
      phone: phone.trim(),
      provincia,
      localidad: localidad.trim(),
      intent,
    })

    setLoading(false)

    if (res.error) {
      setError(res.error)
    } else {
      if (intent === 'ofrecer' || intent === 'ambas') {
        navigate('/crear-perfil')
      } else {
        navigate('/buscar')
      }
    }
  }

  return (
    <div className="container py-12 md:py-16 max-w-lg mx-auto">
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="text-center space-y-1">
          <h1 className="font-heading text-2xl font-extrabold text-[var(--color-laburante-text)]">
            Crear cuenta en LABURANTE
          </h1>
          <p className="text-xs text-[var(--color-laburante-text-secondary)]">
            Registro gratuito para ofrecer servicios o buscar trabajadores en todo el país.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Google Sign-Up / Sign-In */}
        <button
          type="button"
          onClick={async () => {
            setError(null)
            const { signInWithGoogle } = useAuthStore.getState()
            const res = await signInWithGoogle()
            if (res.error) setError(res.error)
          }}
          className="w-full py-3 px-4 rounded-xl border border-[var(--color-laburante-border)] bg-white hover:bg-gray-50 text-[var(--color-laburante-text)] font-heading font-semibold text-sm transition-all hover:shadow-sm flex items-center justify-center gap-3"
        >
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Registrarme con Google
        </button>

        {/* Separator */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--color-laburante-border)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--color-laburante-surface)] px-3 text-[var(--color-laburante-text-muted)]">
              o completá el formulario
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
              Nombre completo o denominación profesional <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Martín Fernández o Reparaciones San Martín"
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

          <div>
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
                Ofrecer trabajo
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
                Buscar alguien
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
          </div>

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
            disabled={loading}
            className="btn-dark w-full py-3.5 px-4 rounded-xl font-heading font-bold text-sm transition-all hover:scale-[1.01] shadow-md disabled:opacity-50 mt-2"
          >
            {loading ? 'Registrando cuenta...' : 'Crear mi cuenta gratuita'}
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
