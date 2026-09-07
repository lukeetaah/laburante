import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { LogIn, ArrowRight } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await signIn(email.trim(), password)
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
            Ingresar a LABURANTE
          </h1>
          <p className="text-xs text-[var(--color-laburante-text-secondary)]">
            Accedé para administrar tu perfil o publicar tus servicios.
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
            className="w-full py-3 px-4 rounded-xl bg-[var(--color-laburante-text)] text-white font-heading font-semibold text-sm hover:bg-black transition-colors disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="text-center text-xs text-[var(--color-laburante-text-secondary)] pt-2 border-t border-[var(--color-laburante-border)]">
          ¿Todavía no tenés cuenta?{' '}
          <Link to="/registrar" className="font-semibold text-[var(--color-laburante-indigo)] hover:underline">
            Registrate gratis
          </Link>
        </div>
      </div>
    </div>
  )
}
