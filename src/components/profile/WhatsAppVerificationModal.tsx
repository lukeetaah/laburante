import { useState, useEffect } from 'react'
import {
  X,
  CheckCircle2,
  ShieldCheck,
  MessageCircle,
  ExternalLink,
  Smartphone,
  RefreshCw,
  Clock,
  Send,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useProfileStore } from '@/stores/profile-store'
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
  const { requestWhatsAppVerification, verifyWhatsApp } = useProfileStore()
  const { addNotification } = useNotificationStore()

  const [verificationCode, setVerificationCode] = useState('')
  const [requestId, setRequestId] = useState('')
  const [inputPin, setInputPin] = useState('')
  const [step, setStep] = useState<'send' | 'waiting' | 'success'>('send')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showManualPin, setShowManualPin] = useState(false)

  // Initialize or request verification code when opened
  useEffect(() => {
    if (isOpen) {
      setError(null)
      setInputPin('')
      setShowManualPin(false)
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
    // Open WhatsApp directed STRICTLY to Lucas's official WhatsApp number
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
      setError('Aún no se ha completado la aprobación. Asegurate de haber presionado "Enviar" en el chat de WhatsApp con nuestra línea oficial.')
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
      setError('El PIN ingresado no coincide con el código generado para tu perfil.')
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
        message: `Tu número ${phone} fue certificado. Ahora tu perfil tiene el sello oficial de autenticidad.`,
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
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)] transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-[var(--color-laburante-text)]">
              Certificar titularidad de WhatsApp
            </h2>
            <p className="text-xs text-[var(--color-laburante-text-secondary)] mt-0.5">
              Comprobación auténtica contra la línea oficial de administración de LABURANTE.
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
              ¡WhatsApp Certificado y Verificado!
            </h3>
            <p className="text-xs text-emerald-800 max-w-sm mx-auto">
              Tu número <strong className="font-semibold">{phone}</strong> ha sido comprobado exitosamente. Ahora tu perfil cuenta con el sello oficial de confianza.
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
          /* Step WAITING: user clicked send and is waiting for review/confirmation */
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <Clock size={16} className="text-amber-700 animate-pulse" />
                <span>Solicitud enviada a la línea oficial</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900">
                Se abrió tu WhatsApp con el mensaje preformateado hacia nuestra línea oficial{' '}
                <strong className="font-bold text-amber-950">{SITE_CONFIG.officialWhatsAppFormatted}</strong>.
              </p>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Asegurate de presionar <strong>Enviar</strong> en WhatsApp. Al recibirlo, nuestro administrador verificará que el remitente coincida con tu número ({phone}) y activará tu sello.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] space-y-2 text-xs">
              <div className="flex justify-between items-center text-[11px] text-[var(--color-laburante-text-secondary)]">
                <span>Línea oficial destinataria:</span>
                <strong className="text-[var(--color-laburante-text)]">{SITE_CONFIG.officialWhatsAppFormatted}</strong>
              </div>
              <div className="flex justify-between items-center text-[11px] text-[var(--color-laburante-text-secondary)]">
                <span>Tu número declarado:</span>
                <strong className="text-[var(--color-laburante-text)]">{phone}</strong>
              </div>
              <div className="flex justify-between items-center text-[11px] text-[var(--color-laburante-text-secondary)]">
                <span>Código asignado:</span>
                <strong className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {verificationCode}
                </strong>
              </div>
            </div>

            {/* Re-open WA button if needed */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="flex-1 py-3 px-4 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <MessageCircle size={15} />
                <span>Reabrir chat de WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={checking}
                className="flex-1 btn-dark py-3 px-4 rounded-xl font-heading font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
                <span>Comprobar aprobación</span>
              </button>
            </div>

            {/* Collapsible Manual PIN validation */}
            <div className="pt-2 border-t border-[var(--color-laburante-border)]">
              <button
                type="button"
                onClick={() => setShowManualPin(!showManualPin)}
                className="text-xs text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)] flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <span>¿Querés ingresar el código PIN manualmente?</span>
                {showManualPin ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showManualPin && (
                <div className="mt-3 p-3.5 rounded-2xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] space-y-2.5 animate-in fade-in">
                  <p className="text-[11px] text-[var(--color-laburante-text-secondary)]">
                    Ingresá los 6 dígitos del código ({verificationCode.replace(/[^0-9]/g, '')}):
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={inputPin}
                      onChange={(e) => setInputPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="000000"
                      className="w-36 text-center font-mono text-base font-bold py-2 px-3 rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleManualPinVerify}
                      disabled={loading || inputPin.length !== 6}
                      className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                    >
                      {loading ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                      <span>Validar PIN</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Step SEND: Initial view */
          <div className="space-y-5">
            {/* Explanation of genuine ownership check */}
            <div className="p-4 rounded-2xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] text-xs text-[var(--color-laburante-text-secondary)] space-y-2">
              <p className="font-semibold text-[var(--color-laburante-text)] flex items-center gap-1.5">
                <Smartphone size={15} className="text-emerald-600 shrink-0" />
                Comprobación auténtica de titularidad
              </p>
              <p className="text-[11px] leading-relaxed">
                Para garantizar que el número <strong className="text-[var(--color-laburante-text)]">{phone}</strong> realmente te pertenece, el sistema enviará un mensaje directo a nuestra línea oficial de administración (<strong>{SITE_CONFIG.officialWhatsAppFormatted}</strong>).
              </p>
              <p className="text-[11px] leading-relaxed text-[var(--color-laburante-text-muted)]">
                Al recibir el mensaje emitido desde tu dispositivo con tu código único, se certifica tu número y se activa el sello oficial de verificación en tu perfil.
              </p>
            </div>

            {/* Verification Code Box */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center space-y-2">
              <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                Código de certificación generado
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
              <p className="text-[11px] text-emerald-800">
                Destino del mensaje: <strong className="font-bold">{SITE_CONFIG.officialWhatsAppFormatted}</strong>
              </p>
            </div>

            {/* Action button */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                disabled={!verificationCode}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send size={16} />
                <span>Enviar mensaje a la línea oficial por WhatsApp</span>
                <ExternalLink size={14} />
              </button>
              <p className="text-[10px] text-center text-[var(--color-laburante-text-muted)]">
                Se abrirá WhatsApp directamente con la línea oficial {SITE_CONFIG.officialWhatsAppFormatted} y el mensaje listo para enviar.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-5 rounded-xl border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] cursor-pointer"
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

