import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resetPasswordForEmail = useAuthStore((state) => state.resetPasswordForEmail)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const result = await resetPasswordForEmail(email)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSubmitted(true)
  }

  return (
    <div className="container py-12 md:py-20 max-w-md mx-auto">
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-6 shadow-xs">
        <Link to="/ingresar" className="inline-flex items-center gap-1.5 text-xs text-[var(--color-laburante-text-muted)] hover:underline">
          <ArrowLeft size={14} /> Volver a ingresar
        </Link>
        <div className="text-center space-y-1">
          <h1 className="font-heading text-2xl font-extrabold text-[var(--color-laburante-text)]">Recuperar contraseña</h1>
          <p className="text-xs text-[var(--color-laburante-text-secondary)]">Te enviaremos un enlace para establecer una contraseña nueva.</p>
        </div>

        {submitted ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
            <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
            <span>Si existe una cuenta con ese correo, vas a recibir un enlace. Revisá también SPAM. Si usabas Google, podés seguir ingresando con Google.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}
            <div>
              <label className="block text-xs font-semibold mb-1">Correo electrónico</label>
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent" />
            </div>
            <button type="submit" disabled={loading} className="btn-dark w-full py-3.5 rounded-xl font-heading font-bold text-sm disabled:opacity-50">
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </form>
        )}
        <div className="text-center text-xs text-[var(--color-laburante-text-muted)] flex items-center justify-center gap-1.5"><Mail size={13} /> No revelamos si el correo está registrado.</div>
      </div>
    </div>
  )
}

