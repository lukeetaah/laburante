import { useState } from 'react'
import { Send, CheckCircle2, AlertCircle, UserX, Mail } from 'lucide-react'
import { SITE_CONFIG } from '@/lib/constants'

export default function ContactForm() {
  const [email, setEmail] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!message.trim()) return

    setSending(true)
    setError(false)

    const formData = new FormData()
    formData.append('_subject', 'Mensaje de contacto desde LABURANTE')
    formData.append('message', message.trim())
    if (isAnonymous || !email.trim()) {
      formData.append('email', 'anonimo@laburante.app')
      formData.append('remitente', 'Anónimo (sin correo especificado)')
    } else {
      formData.append('email', email.trim())
      formData.append('remitente', email.trim())
    }

    try {
      const res = await fetch(SITE_CONFIG.contact.formspreeUrl, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      })

      if (res.ok) {
        setSent(true)
        setMessage('')
        setEmail('')
        setIsAnonymous(false)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50/50 p-4 sm:p-5 text-emerald-950 space-y-3">
        <div className="flex items-center gap-2 font-heading font-bold text-sm text-emerald-800">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          Mensaje enviado correctamente
        </div>
        <p className="text-xs text-emerald-900/80 leading-relaxed">
          Gracias por escribirnos. Leemos cada sugerencia, reporte o consulta para mejorar la plataforma.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
        >
          Enviar otro mensaje
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="font-heading text-sm font-semibold text-[var(--color-laburante-text)]">
          Contacto y sugerencias
        </h4>
        <p className="text-xs text-[var(--color-laburante-text-secondary)] mt-0.5">
          Escribinos tu consulta o sugerencia. Podés dejar tu email si deseás respuesta o enviarlo anónimo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* Email input with Anonymous toggle */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="contact-email"
              className="text-[11px] font-semibold text-[var(--color-laburante-text-secondary)]"
            >
              {isAnonymous ? 'Modo de envío' : 'Tu correo (opcional)'}
            </label>

            <button
              type="button"
              onClick={() => {
                setIsAnonymous(!isAnonymous)
                if (!isAnonymous) setEmail('')
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-laburante-indigo)] hover:underline"
            >
              <UserX size={12} />
              {isAnonymous ? 'Ingresar mi correo' : 'Prefiero enviar anónimo'}
            </button>
          </div>

          {isAnonymous ? (
            <div className="px-3 py-2 rounded-xl border border-dashed border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] text-[11px] text-[var(--color-laburante-text-muted)] flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              Se enviará de forma 100% anónima sin solicitar ni guardar tu dirección de email.
            </div>
          ) : (
            <div className="relative">
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)] placeholder:text-[var(--color-laburante-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-laburante-indigo)]"
              />
            </div>
          )}
        </div>

        {/* Message textarea */}
        <div>
          <textarea
            required
            rows={3}
            maxLength={1200}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="¿Qué te gustaría decirnos, consultar o sugerir sobre LABURANTE?"
            className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)] placeholder:text-[var(--color-laburante-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-laburante-indigo)] resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-[11px] text-rose-600">
            <AlertCircle size={13} className="flex-shrink-0" />
            No se pudo enviar el mensaje. Por favor intentá nuevamente.
          </div>
        )}

        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="w-full py-2 px-4 rounded-xl bg-[var(--color-laburante-text)] text-white font-heading text-xs font-semibold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-xs"
        >
          {sending ? (
            'Enviando...'
          ) : (
            <>
              <Send size={13} />
              {isAnonymous ? 'Enviar mensaje anónimo' : 'Enviar mensaje'}
            </>
          )}
        </button>
      </form>
    </div>
  )
}
