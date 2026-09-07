import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signUp = useAuthStore((s) => s.signUp)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    setError(null)

    const res = await signUp(email.trim(), password, name.trim())
    setLoading(false)

    if (res.error) {
      setError(res.error)
    } else {
      navigate('/crear-perfil')
    }
  }

  return (
    <div className="container py-12 md:py-20 max-w-md mx-auto">
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="text-center space-y-1">
          <h1 className="font-heading text-2xl font-extrabold text-[var(--color-laburante-text)]">
            Crear cuenta en LABURANTE
          </h1>
          <p className="text-xs text-[var(--color-laburante-text-secondary)]">
            Es 100% gratuita y te permite publicar y gestionar tu perfil de trabajo.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
              Nombre o nombre profesional
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Lucas Correa"
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
            />
          </div>

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
              Contraseña (mínimo 6 caracteres)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
            />
          </div>

          <p className="text-[11px] text-[var(--color-laburante-text-muted)] leading-relaxed">
            Al registrarte aceptás los{' '}
            <Link to="/terminos" className="underline hover:text-[var(--color-laburante-text)]">
              Términos de uso
            </Link>{' '}
            y la{' '}
            <Link to="/privacidad" className="underline hover:text-[var(--color-laburante-text)]">
              Política de privacidad
            </Link>.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[var(--color-laburante-text)] text-white font-heading font-semibold text-sm hover:bg-black transition-colors disabled:opacity-50"
          >
            {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
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
