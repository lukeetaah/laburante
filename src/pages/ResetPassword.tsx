import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, LockKeyhole } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'

export default function ResetPassword() {
  const user = useAuthStore((state) => state.user)
  const authLoading = useAuthStore((state) => state.loading)
  const updatePassword = useAuthStore((state) => state.updatePassword)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handleRecovery = () => setError(null)
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') handleRecovery()
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (password !== confirmation) return setError('Las contraseñas no coinciden.')
    setLoading(true)
    setError(null)
    const result = await updatePassword(password)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setUpdated(true)
    window.setTimeout(() => navigate('/ingresar', { replace: true }), 1200)
  }

  return (
    <div className="container py-12 md:py-20 max-w-md mx-auto">
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-6 shadow-xs">
        <Link to="/ingresar" className="inline-flex items-center gap-1.5 text-xs text-[var(--color-laburante-text-muted)] hover:underline"><ArrowLeft size={14} /> Volver a ingresar</Link>
        <div className="text-center space-y-1"><LockKeyhole size={28} className="mx-auto text-[var(--color-laburante-indigo)]" /><h1 className="font-heading text-2xl font-extrabold">Establecer contraseña</h1><p className="text-xs text-[var(--color-laburante-text-secondary)]">También sirve para cuentas que comenzaron con Google.</p></div>
        {updated ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-600" /> Contraseña actualizada. Redirigiendo al ingreso…</div>
        ) : authLoading ? (
          <p className="text-center text-xs text-[var(--color-laburante-text-secondary)]">Validando el enlace…</p>
        ) : !user ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">El enlace expiró o no es válido. Solicitá uno nuevo desde <Link to="/recuperar-contrasena" className="font-bold underline">recuperación de contraseña</Link>.</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}
            <input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nueva contraseña" className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent" />
            <input type="password" required minLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Repetir contraseña" className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent" />
            <button type="submit" disabled={loading} className="btn-dark w-full py-3.5 rounded-xl font-heading font-bold text-sm disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar contraseña'}</button>
          </form>
        )}
      </div>
    </div>
  )
}

