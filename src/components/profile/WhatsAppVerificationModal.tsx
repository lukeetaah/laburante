import { useState, useEffect } from 'react'
import { X, CheckCircle2, ShieldCheck, MessageCircle, ExternalLink, ArrowRight, Smartphone, RefreshCw } from 'lucide-react'
import { useProfileStore } from '@/stores/profile-store'
import { useNotificationStore } from '@/stores/notification-store'

interface WhatsAppVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  profileId: string
  phone: string
  profileName: string
}

export default function WhatsAppVerificationModal({
  isOpen,
  onClose,
  profileId,
  phone,
  profileName,
}: WhatsAppVerificationModalProps) {
  const { verifyWhatsApp } = useProfileStore()
  const { addNotification } = useNotificationStore()

  const [generatedCode, setGeneratedCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [step, setStep] = useState<'send' | 'enter' | 'success'>('send')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Generate 6 digit code when modal opens
  useEffect(() => {
    if (isOpen) {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      setGeneratedCode(code)
      setInputCode('')
      setStep('send')
      setError(null)
      setCopied(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const cleanPhone = phone.replace(/[^0-9]/g, '')
  const verificationText = `Hola LABURANTE! Envío este mensaje para certificar la titularidad de mi número de WhatsApp en mi perfil ${profileName}. Código: LAB-${generatedCode}`

  const handleOpenWhatsApp = () => {
    // Open WhatsApp with prefilled message
    const url = `https://wa.me/?text=${encodeURIComponent(verificationText)}`
    window.open(url, '_blank')
    setStep('enter')
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleVerify = async () => {
    setError(null)
    const cleanInput = inputCode.replace(/[^0-9]/g, '')
    if (cleanInput.length !== 6) {
      setError('Por favor ingresá los 6 dígitos del código de verificación.')
      return
    }

    if (cleanInput !== generatedCode) {
      setError('El código ingresado no coincide con el código generado. Verificalo e intentá nuevamente.')
      return
    }

    setLoading(true)
    const res = await verifyWhatsApp(profileId, phone, cleanInput)
    setLoading(false)

    if (res.error) {
      setError(res.error)
    } else {
      setStep('success')
      // Send in-app notification
      addNotification({
        userId: profileId,
        title: '¡WhatsApp Verificado con éxito!',
        message: `Tu número ${phone} fue verificado. Ahora tu perfil tiene el sello oficial de confianza.`,
        type: 'system',
        link: `/p/${profileName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
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
          className="absolute top-5 right-5 p-2 rounded-xl text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)] transition-colors"
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
              Confirmá que la línea <strong className="text-[var(--color-laburante-text)]">{phone}</strong> te pertenece para obtener el sello oficial.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {error}
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
              Tu perfil ahora muestra el sello de autenticidad en los resultados de búsqueda y en tu página pública.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Security Explanation */}
            <div className="p-4 rounded-2xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] text-xs text-[var(--color-laburante-text-secondary)] space-y-1.5">
              <p className="font-semibold text-[var(--color-laburante-text)] flex items-center gap-1.5">
                <Smartphone size={14} className="text-emerald-600" />
                ¿Por qué es importante certificar tu número?
              </p>
              <p className="text-[11px] leading-relaxed">
                Garantiza a las personas que buscan un profesional que el número cargado es real, activo y de tu exclusiva propiedad, brindando confianza y mayor cantidad de consultas.
              </p>
            </div>

            {/* Verification Code Display */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center space-y-2">
              <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                Tu código de verificación
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-3xl font-extrabold tracking-widest text-emerald-950 px-4 py-1.5 rounded-xl bg-white border border-emerald-300 shadow-2xs">
                  {generatedCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-100 text-xs font-semibold text-emerald-900 transition-colors"
                  title="Copiar código"
                >
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Step 1: Open WhatsApp to send verification */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--color-laburante-text)]">
                Paso 1: Abrir WhatsApp para enviar mensaje de confirmación
              </label>
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <MessageCircle size={18} />
                <span>Abrir WhatsApp con mensaje de confirmación</span>
                <ExternalLink size={14} />
              </button>
            </div>

            {/* Step 2: Enter PIN */}
            <div className="space-y-2 pt-2 border-t border-[var(--color-laburante-border)]">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[var(--color-laburante-text)]">
                  Paso 2: Confirmar código de 6 dígitos
                </label>
                <button
                  type="button"
                  onClick={() => setInputCode(generatedCode)}
                  className="text-[11px] text-[var(--color-laburante-indigo)] font-semibold hover:underline"
                >
                  Autocompletar código ({generatedCode})
                </button>
              </div>
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ingresá los 6 dígitos aquí..."
                className="w-full text-center font-mono text-xl tracking-widest py-3 px-4 rounded-2xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-5 rounded-xl border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] text-center"
              >
                Hacerlo más tarde
              </button>

              <button
                type="button"
                onClick={handleVerify}
                disabled={loading || inputCode.length !== 6}
                className="flex-1 btn-dark py-3 px-6 rounded-xl font-heading font-bold text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Validar y Certificar Número</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
