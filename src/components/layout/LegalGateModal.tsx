import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { CURRENT_TERMS_VERSION } from '@/lib/constants'
import { checkUserTermsAcceptance, recordLegalAcceptance } from '@/lib/legal-acceptance'
import { ShieldAlert, AlertTriangle, LogOut, CheckCircle2 } from 'lucide-react'

// Rutas públicas que no deben ser bloqueadas por el modal legal
const PUBLIC_PATHS = [
  '/terminos',
  '/privacidad',
  '/como-funciona',
  '/ingresar',
  '/registrar',
]

export default function LegalGateModal() {
  const { user, loading, signOut } = useAuthStore()
  const location = useLocation()

  const [checking, setChecking] = useState(true)
  const [needsAcceptance, setNeedsAcceptance] = useState(false)
  const [isLegalAge, setIsLegalAge] = useState(false)
  const [acceptsTerms, setAcceptsTerms] = useState(false)
  const [underageRefused, setUnderageRefused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function evaluateAcceptance() {
      if (loading) return
      if (!user) {
        if (isMounted) {
          setChecking(false)
          setNeedsAcceptance(false)
        }
        return
      }

      // 1. Si el usuario acaba de venir de un flujo de OAuth con consentimiento en sesión:
      try {
        const oauthConsentStr = sessionStorage.getItem('laburante_oauth_legal_consent')
        if (oauthConsentStr) {
          const consent = JSON.parse(oauthConsentStr)
          if (consent.terms_version === CURRENT_TERMS_VERSION && consent.is_of_legal_age) {
            sessionStorage.removeItem('laburante_oauth_legal_consent')
            await recordLegalAcceptance(user.id, CURRENT_TERMS_VERSION)
            if (isMounted) {
              setChecking(false)
              setNeedsAcceptance(false)
            }
            return
          }
        }
      } catch {}

      // 2. Verificar si el usuario ya cuenta con evidencia persistente de la versión vigente
      const { accepted } = await checkUserTermsAcceptance(user.id, user.user_metadata)
      if (isMounted) {
        setNeedsAcceptance(!accepted)
        setChecking(false)
      }
    }

    evaluateAcceptance()

    return () => {
      isMounted = false
    }
  }, [user, loading])

  // No bloquear si no hay sesión, aún está comprobando, ya aceptó, o se encuentra en una ruta legal pública
  if (loading || checking || !needsAcceptance || !user) {
    return null
  }

  const isCurrentPublicPath = PUBLIC_PATHS.some((p) => location.pathname.startsWith(p))
  // Si está en /terminos o /privacidad, no tapamos la pantalla completa con un backdrop bloqueante,
  // mostramos un banner persistente para permitirle leer el texto legal.
  if (isCurrentPublicPath) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-50 bg-amber-500 text-slate-950 px-4 py-3 shadow-lg border-t border-amber-600 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-medium">
          <ShieldAlert size={18} className="shrink-0" />
          <span>
            Estás consultando los documentos legales. Para acceder a tus funciones privadas, debés confirmar que sos mayor de 18 años y aceptar la versión vigente.
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            // Forzar volver a evaluar fuera de ruta pública
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="bg-slate-950 text-white font-bold px-3 py-1.5 rounded-lg shrink-0"
        >
          Confirmar aceptación
        </button>
      </div>
    )
  }

  const handleConfirmAcceptance = async () => {
    if (!isLegalAge || !acceptsTerms) return
    setSaving(true)
    setSaveError(null)

    const res = await recordLegalAcceptance(user.id, CURRENT_TERMS_VERSION)
    setSaving(false)

    if (res.success) {
      setNeedsAcceptance(false)
    } else {
      setSaveError(res.error || 'Ocurrió un error al registrar la aceptación. Intentá nuevamente.')
    }
  }

  const handleRefuseAge = () => {
    setUnderageRefused(true)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100 text-slate-800">
        {!underageRefused ? (
          <>
            <div className="space-y-2 text-center sm:text-left">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 mx-auto sm:mx-0">
                <ShieldAlert size={26} />
              </div>
              <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900">
                Actualización de Términos y Mayoría de Edad
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                LABURANTE admite exclusivamente a personas de 18 años o más. Para continuar utilizando tu cuenta y las funciones de la plataforma, es necesario que confirmes tu mayoría de edad y aceptes los términos vigentes.
              </p>
            </div>

            {saveError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLegalAge}
                  onChange={(e) => setIsLegalAge(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-0"
                />
                <span className="font-semibold text-slate-900 leading-relaxed">
                  Declaro que tengo 18 años cumplidos o más.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptsTerms}
                  onChange={(e) => setAcceptsTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-0"
                />
                <span className="text-slate-600 leading-relaxed">
                  Acepto los{' '}
                  <Link to="/terminos" target="_blank" className="underline font-semibold text-slate-900">
                    Términos de uso
                  </Link>{' '}
                  y la{' '}
                  <Link to="/privacidad" target="_blank" className="underline font-semibold text-slate-900">
                    Política de privacidad
                  </Link>{' '}
                  de LABURANTE (versión {CURRENT_TERMS_VERSION}).
                </span>
              </label>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmAcceptance}
                disabled={!isLegalAge || !acceptsTerms || saving}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-heading font-bold text-xs sm:text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <span>Guardando aceptación...</span>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Confirmar y continuar</span>
                  </>
                )}
              </button>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={handleRefuseAge}
                  className="text-rose-600 hover:underline font-medium"
                >
                  No cumplo con la edad mínima (menos de 18 años)
                </button>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                >
                  <LogOut size={13} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Pantalla para usuarios que indican no tener 18 años */
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto sm:mx-0">
              <AlertTriangle size={26} />
            </div>
            <div className="space-y-2">
              <h2 className="font-heading text-xl font-bold text-slate-900">
                Acceso restringido por edad mínima
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                De acuerdo con nuestras políticas, LABURANTE admite exclusivamente a personas de 18 años o más. No es posible continuar utilizando esta cuenta.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <p className="font-semibold">Baja de la cuenta:</p>
              <p className="leading-relaxed">
                Podés solicitar la baja definitiva de tu cuenta y la supresión de tus datos enviando un mensaje a través del{' '}
                <Link to="/privacidad" className="underline font-bold">
                  formulario de contacto
                </Link>{' '}
                o cerrando tu sesión ahora.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUnderageRefused(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Volver a la declaración
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
              >
                <LogOut size={14} />
                <span>Cerrar sesión ahora</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
