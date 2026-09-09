import { useState, useEffect } from 'react'
import {
  X,
  CheckCircle2,
  ShieldCheck,
  MessageCircle,
  ExternalLink,
  Smartphone,
  RefreshCw,
  Send,
  AlertCircle,
} from 'lucide-react'
import { useProfileStore } from '@/stores/profile-store'
import { useAuthStore } from '@/stores/auth-store'
import { useNotificationStore } from '@/stores/notification-store'
import { SITE_CONFIG } from '@/lib/constants'

interface WhatsAppVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  profileId: string
  phone: string
  profileName: string
  profileSlug?: string
}

export default function WhatsAppVerificationModal({
  isOpen,
  onClose,
  profileId,
  phone,
  profileName,
  profileSlug,
}: WhatsAppVerificationModalProps) {
  const { requestWhatsAppVerification, verifyWhatsApp, adminApproveWhatsAppVerification } = useProfileStore()
  const { isAdmin } = useAuthStore()
  const { addNotification } = useNotificationStore()

  const [verificationCode, setVerificationCode] = useState('')
  const [requestId, setRequestId] = useState('')
  const [inputPin, setInputPin] = useState('')
  const [step, setStep] = useState<'send' | 'waiting' | 'success'>('send')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Initialize or request verification code when opened
  useEffect(() => {
    if (isOpen) {
      setError(null)
      setInputPin('')
      setStep('send')

      const slug = profileSlug || profileName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      requestWhatsAppVerification(profileId, profileName, slug, phone).then((res) => {
        if (res.code) {
          setVerificationCode(res.code)
        }
        if (res.requestId) {
          setRequestId(res.requestId)
        }
      })
    }
  }, [isOpen, profileId, profileName, profileSlug, phone])

  // Polling check while in 'waiting' step
  useEffect(() => {
    if (!isOpen || step !== 'waiting') return

    const interval = setInterval(async () => {
      const { fetchPendingWhatsAppVerifications, myProfile } = useProfileStore.getState()
      if (myProfile?.whatsapp_verified) {
        setStep('success')
        return
      }

      const all = await fetchPendingWhatsAppVerifications()
      const req = all.find((r) => r.id === requestId || r.profile_id === profileId)
      if (req?.status === 'aprobado') {
        setStep('success')
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [isOpen, step, requestId, profileId])

  if (!isOpen) return null

  const cleanPhone = phone.replace(/[^0-9]/g, '')
  const verificationText = `Hola LABURANTE! Envío este mensaje desde mi WhatsApp para certificar la titularidad de mi número (+${cleanPhone}) en mi perfil "${profileName}". Código de verificación: ${verificationCode}`

  const handleOpenWhatsApp = () => {
    const url = `https://wa.me/${SITE_CONFIG.officialWhatsApp}?text=${encodeURIComponent(verificationText)}`
    window.open(url, '_blank')
    setStep('waiting')
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(verificationCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleCheckStatus = async () => {
    setChecking(true)
    setError(null)
    const { fetchPendingWhatsAppVerifications, myProfile } = useProfileStore.getState()

    if (myProfile?.whatsapp_verified) {
      setChecking(false)
      setStep('success')
      return
    }

    const all = await fetchPendingWhatsAppVerifications()
    const req = all.find((r) => r.id === requestId || r.profile_id === profileId)

    setChecking(false)
    if (req?.status === 'aprobado') {
      setStep('success')
    } else {
      setError('Aún no se registró la aprobación. Si ya enviaste el mensaje, podés ingresar tu código abajo para activarlo.')
    }
  }

  const handleAdminDirectApprove = async () => {
    setLoading(true)
    setError(null)
    const res = await adminApproveWhatsAppVerification(requestId, profileId, phone)
    setLoading(false)
    if (res.error) {
      setError(res.error)
    } else {
      setStep('success')
      setTimeout(() => {
        onClose()
      }, 1800)
    }
  }

  const handleManualPinVerify = async () => {
    setError(null)
    const cleanInput = inputPin.replace(/[^0-9]/g, '')
    const expectedDigits = verificationCode.replace(/[^0-9]/g, '')

    if (cleanInput.length !== 6) {
      setError('Por favor ingresá los 6 dígitos numéricos del código.')
      return
    }

    if (cleanInput !== expectedDigits) {
      setError('El código ingresado no coincide con el asignado a tu perfil.')
      return
    }

    setLoading(true)
    const res = await verifyWhatsApp(profileId, phone, cleanInput)
    setLoading(false)

    if (res.error) {
      setError(res.error)
    } else {
      setStep('success')
      addNotification({
        userId: profileId,
        title: '¡WhatsApp Verificado con éxito!',
        message: `Tu número ${phone} fue certificado con éxito. Tu perfil ahora cuenta con el sello oficial.`,
        type: 'system',
        link: `/p/${profileSlug || profileName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      })
      setTimeout(() => {
        onClose()
      }, 1800)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)] transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>

        {/* Encabezado */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-[var(--color-laburante-text)]">
              Verificar número de WhatsApp
            </h2>
            <p className="text-xs text-[var(--color-laburante-text-secondary)] mt-0.5">
              Certificá la titularidad de tu línea para obtener el sello oficial de confianza.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {step === 'success' ? (
          <div className="py-8 text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="font-heading text-xl font-bold text-emerald-950">
              ¡WhatsApp Verificado con éxito!
            </h3>
            <p className="text-xs text-emerald-800 max-w-sm mx-auto">
              Tu número <strong className="font-semibold">{phone}</strong> fue certificado. Tu perfil ya luce el sello oficial en las búsquedas.
            </p>
            <div className="pt-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-dark py-2.5 px-6 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Continuar
              </button>
            </div>
          </div>
        ) : step === 'waiting' ? (
          /* PASO 2: Confirmación */
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
              <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                <MessageCircle size={15} className="text-emerald-700" />
                Mensaje preparado para enviar
              </p>
              <p className="text-[11px] leading-relaxed text-emerald-800">
                Se abrió WhatsApp con tu código asignado hacia la Línea Oficial de LABURANTE. Al enviarlo desde tu teléfono, se comprueba que el remitente coincida con tu número ({phone}).
              </p>
            </div>

            {/* Tarjeta exclusiva para administrador */}
            {isAdmin && (
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-bold flex items-center gap-1 text-indigo-900">
                    <ShieldCheck size={15} className="text-indigo-600" />
                    Sesión de Administrador activa
                  </p>
                  <p className="text-[11px] text-indigo-800">
                    Podés certificar esta cuenta en 1 clic:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAdminDirectApprove}
                  disabled={loading}
                  className="btn-dark py-2 px-4 rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-xs"
                >
                  {loading ? <RefreshCw size={13} className="animate-spin" /> : 'Aprobar como Administrador ✓'}
                </button>
              </div>
            )}

            {/* Confirmación con código asignado */}
            <div className="p-4 rounded-2xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-laburante-text)]">
                  ¿Ya enviaste el mensaje? Confirmá tu código:
                </span>
                <button
                  type="button"
                  onClick={() => setInputPin(verificationCode.replace(/[^0-9]/g, ''))}
                  className="text-[11px] text-[var(--color-laburante-indigo)] font-semibold hover:underline cursor-pointer"
                >
                  Autocompletar ({verificationCode.replace(/[^0-9]/g, '')})
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={verificationCode.replace(/[^0-9]/g, '') || '000000'}
                  className="w-36 text-center font-mono text-base font-bold py-2.5 px-3 rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
                />
                <button
                  type="button"
                  onClick={handleManualPinVerify}
                  disabled={loading || inputPin.length !== 6}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-xs transition-colors"
                >
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  <span>Activar Sello Oficial</span>
                </button>
              </div>
            </div>

            {/* Botones secundarios */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="flex-1 py-2.5 px-3 rounded-xl border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-secondary)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageCircle size={14} />
                <span>Reabrir WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={checking}
                className="flex-1 py-2.5 px-3 rounded-xl border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-secondary)] text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
                <span>Comprobar estado</span>
              </button>
            </div>
          </div>
        ) : (
          /* PASO 1: Envío inicial */
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] text-xs text-[var(--color-laburante-text-secondary)] space-y-1.5">
              <p className="font-semibold text-[var(--color-laburante-text)] flex items-center gap-1.5">
                <Smartphone size={15} className="text-emerald-600 shrink-0" />
                Comprobación directa de titularidad
              </p>
              <p className="text-[11px] leading-relaxed">
                Al presionar el botón, se abrirá WhatsApp con un mensaje oficial y tu código único. Al enviarlo desde tu dispositivo, se confirma que el número <strong className="text-[var(--color-laburante-text)]">{phone}</strong> te pertenece exclusivamente.
              </p>
            </div>

            {/* Código generado */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center space-y-2">
              <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                Tu código asignado
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-emerald-950 px-4 py-1.5 rounded-xl bg-white border border-emerald-300 shadow-2xs">
                  {verificationCode || 'Generando...'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-100 text-xs font-semibold text-emerald-900 transition-colors cursor-pointer"
                  title="Copiar código"
                >
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Botón principal */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                disabled={!verificationCode}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send size={16} />
                <span>Abrir WhatsApp y enviar mensaje</span>
                <ExternalLink size={14} />
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 rounded-xl border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] cursor-pointer"
              >
                Hacerlo más tarde
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
