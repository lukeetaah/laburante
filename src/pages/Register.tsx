import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { PROVINCES } from '@/data/provinces'
import { Mail, CheckCircle2, ArrowRight, Building2 } from 'lucide-react'

export default function Register() {
  const [searchParams] = useSearchParams()
  const isCompany = searchParams.get('tipo') === 'empresa'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [provincia, setProvincia] = useState('CABA')
  const [localidad, setLocalidad] = useState('')
  const [intent, setIntent] = useState<'ofrecer' | 'buscar' | 'ambas'>(isCompany ? 'buscar' : 'ofrecer')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successEmail, setSuccessEmail] = useState<string | null>(null)

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
      accountType: isCompany ? 'empresa' : 'persona',
    })

    setLoading(false)

    if (res.error) {
      setError(res.error)
    } else if (res.needsEmailConfirmation) {
      setSuccessEmail(email.trim())
    } else {
      if (intent === 'ofrecer' || intent === 'ambas') {
        navigate('/crear-perfil?from=registro')
      } else {
        navigate('/buscar')
      }
    }
  }

  if (successEmail) {
    return (
      <div className="container py-12 md:py-20 max-w-md mx-auto">
        <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-6 shadow-xs text-center">
          <div className="h-16 w-16 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Mail size={32} />
          </div>

          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-extrabold text-[var(--color-laburante-text)]">
              ¡Cuenta creada!
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
              Te enviamos un correo de verificación a <strong className="text-[var(--color-laburante-text)]">{successEmail}</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] text-left space-y-2 text-xs text-[var(--color-laburante-text-secondary)]">
            <p className="font-semibold text-[var(--color-laburante-text)] flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
              Siguientes pasos:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed text-[11px]">
              <li>Abrí el enlace de confirmación que te enviamos a tu email.</li>
              <li>Completá los datos de tu perfil profesional (oficios, fotos y contacto).</li>
              <li>Tu perfil quedará publicado de inmediato para que te contacten.</li>
            </ol>
          </div>

          <div className="space-y-2 pt-2">
            <Link
              to="/ingresar"
              className="btn-dark w-full py-3.5 px-4 rounded-xl font-heading font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              Ir a Iniciar Sesión <ArrowRight size={16} />
            </Link>
            <Link
              to="/crear-perfil"
              className="w-full py-2.5 px-4 rounded-xl border border-[var(--color-laburante-border)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)] inline-block"
            >
              Ya lo confirmé, completar mi perfil
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
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

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
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
              <Building2 size={18} className="mt-0.5 shrink-0" />
              <p>Tu cuenta empieza con búsquedas avanzadas y un espacio preparado para sumar integrantes y beneficios pagos más adelante.</p>
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
