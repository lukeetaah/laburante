import { X, MessageCircle, Phone, Mail, Globe, ExternalLink, ShieldCheck } from 'lucide-react'

interface ContactMethod {
  type: 'whatsapp' | 'telefono' | 'email' | 'instagram' | 'linkedin' | 'web' | 'portfolio' | string
  value: string
  is_public: boolean
}

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
  profileName: string
  contactMethods: ContactMethod[]
}

export default function ContactModal({ isOpen, onClose, profileName, contactMethods }: ContactModalProps) {
  if (!isOpen) return null

  const publicMethods = contactMethods.filter((c) => c.is_public && c.value)

  const getIcon = (type: string) => {
    switch (type) {
      case 'whatsapp':
        return <MessageCircle size={18} className="text-emerald-600" />
      case 'telefono':
        return <Phone size={18} className="text-blue-600" />
      case 'email':
        return <Mail size={18} className="text-violet-600" />
      case 'instagram':
        return (
          <svg className="w-[18px] h-[18px] text-pink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
          </svg>
        )
      case 'linkedin':
        return (
          <svg className="w-[18px] h-[18px] text-sky-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
            <rect width="4" height="12" x="2" y="9"/>
            <circle cx="4" cy="4" r="2"/>
          </svg>
        )
      default:
        return <Globe size={18} className="text-amber-600" />
    }
  }

  const getActionUrl = (method: ContactMethod) => {
    const val = method.value.trim()
    switch (method.type) {
      case 'whatsapp': {
        const cleaned = val.replace(/\D/g, '')
        const num = cleaned.startsWith('54') ? cleaned : `549${cleaned}`
        return `https://wa.me/${num}?text=Hola%20${encodeURIComponent(profileName)},%20te%20contacto%20a%20trav%C3%A9s%20de%20LABURANTE.`
      }
      case 'telefono':
        return `tel:${val.replace(/\s+/g, '')}`
      case 'email':
        return `mailto:${val}?subject=Contacto%20desde%20LABURANTE`
      case 'instagram': {
        const handle = val.replace('@', '')
        return `https://instagram.com/${handle}`
      }
      case 'linkedin':
      case 'web':
      case 'portfolio':
        return val.startsWith('http') ? val : `https://${val}`
      default:
        return '#'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--color-laburante-text-muted)] hover:bg-[var(--color-laburante-surface-alt)]"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <h3 className="font-heading text-lg font-bold text-[var(--color-laburante-text)] mb-1">
          Contactar a {profileName}
        </h3>
        <p className="text-xs text-[var(--color-laburante-text-secondary)] mb-5">
          Elegí el medio de contacto que prefieras para coordinar directamente:
        </p>

        {publicMethods.length === 0 ? (
          <div className="py-6 text-center text-sm text-[var(--color-laburante-text-secondary)]">
            Esta persona aún no ha configurado medios de contacto públicos.
          </div>
        ) : (
          <div className="space-y-2.5 mb-6">
            {publicMethods.map((method, idx) => (
              <a
                key={idx}
                href={getActionUrl(method)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--color-laburante-border)] hover:border-[var(--color-laburante-indigo)] hover:bg-[var(--color-laburante-surface-alt)] transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getIcon(method.type)}
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-laburante-text-muted)]">
                      {method.type}
                    </p>
                    <p className="text-sm font-medium text-[var(--color-laburante-text)] truncate">
                      {method.value}
                    </p>
                  </div>
                </div>
                <ExternalLink
                  size={15}
                  className="text-[var(--color-laburante-text-muted)] group-hover:text-[var(--color-laburante-indigo)] flex-shrink-0"
                />
              </a>
            ))}
          </div>
        )}

        {/* Responsible Contact Disclaimer */}
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
          <ShieldCheck size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
          <p>
            Estos datos fueron compartidos voluntariamente por su titular con fines laborales.
            LABURANTE no es empleador ni intermediario, no cobra comisiones ni participa de los acuerdos entre partes.
          </p>
        </div>
      </div>
    </div>
  )
}
