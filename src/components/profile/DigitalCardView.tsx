import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin,
  Briefcase,
  Clock,
  ShieldCheck,
  Phone,
  Mail,
  Globe,
  MessageCircle,
  ExternalLink,
  QrCode,
  Layers,
  Sparkles,
} from 'lucide-react'
import { formatModality, type WorkModality } from '@/lib/profile-format'
import { generateQrSvgString } from '@/lib/qr-service'

export interface DigitalCardDisplayProps {
  name: string
  photoUrl?: string | null
  headline?: string | null
  bio?: string | null
  provincia?: string | null
  localidad?: string | null
  zonaTrabajo?: string | null
  disponibilidad?: string | null
  modalidad?: string | null
  hybridPresencialPct?: number | null
  hybridRemotoPct?: number | null
  whatsappVerified?: boolean
  skills?: string[]
  services?: { title: string; description: string | null; precio_orientativo?: string | null }[]
  languages?: { language: string; level: string }[]
  contacts?: { type: string; value: string }[]
  cardUrl: string
  isOwnerPreview?: boolean
  showQr?: boolean
}

export default function DigitalCardView({
  name,
  photoUrl,
  headline,
  bio,
  provincia,
  localidad,
  zonaTrabajo,
  disponibilidad,
  modalidad,
  hybridPresencialPct,
  hybridRemotoPct,
  whatsappVerified,
  skills,
  services,
  languages,
  contacts,
  cardUrl,
  isOwnerPreview = false,
  showQr = true,
}: DigitalCardDisplayProps) {
  const [qrSvg, setQrSvg] = useState<string>('')
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    let active = true
    if (cardUrl) {
      generateQrSvgString(cardUrl, { margin: 2, width: 220 })
        .then((svg) => {
          if (active) setQrSvg(svg)
        })
        .catch((err) => console.warn('Error generando QR SVG:', err))
    }
    return () => {
      active = false
    }
  }, [cardUrl])

  const locationText = [localidad, provincia].filter(Boolean).join(', ')
  const activeContacts = contacts || []

  const getContactHref = (type: string, value: string) => {
    const clean = value.trim()
    switch (type) {
      case 'whatsapp': {
        const digits = clean.replace(/\D/g, '')
        return digits ? `https://wa.me/${digits}` : undefined
      }
      case 'telefono':
        return `tel:${clean.replace(/[^\d+]/g, '')}`
      case 'email':
        return `mailto:${clean}`
      case 'web':
      case 'portfolio':
        return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
      case 'instagram': {
        const handle = clean.replace(/^@/, '').trim()
        return `https://instagram.com/${handle}`
      }
      case 'linkedin':
        return /^https?:\/\//i.test(clean) ? clean : `https://linkedin.com/in/${clean}`
      default:
        return undefined
    }
  }

  const getContactIcon = (type: string) => {
    switch (type) {
      case 'whatsapp':
        return <MessageCircle size={15} className="text-emerald-600" />
      case 'telefono':
        return <Phone size={15} className="text-sky-600" />
      case 'email':
        return <Mail size={15} className="text-amber-600" />
      case 'instagram':
        return <svg aria-hidden="true" className="text-pink-600" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
      case 'linkedin':
        return <svg aria-hidden="true" className="text-blue-700" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>
      case 'web':
      case 'portfolio':
      default:
        return <Globe size={15} className="text-[var(--color-laburante-indigo)]" />
    }
  }

  const getContactLabel = (type: string, value: string) => {
    switch (type) {
      case 'whatsapp':
        return 'WhatsApp'
      case 'telefono':
        return 'Llamar'
      case 'email':
        return 'Email'
      case 'instagram':
        return value.startsWith('@') ? value : `@${value}`
      case 'linkedin':
        return 'LinkedIn'
      case 'web':
        return 'Sitio web'
      case 'portfolio':
        return 'Portafolio'
      default:
        return value
    }
  }

  return (
    <article className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] shadow-lg transition-all">
      {/* Decorative Brand Top Banner */}
      <div className="relative h-20 bg-gradient-to-r from-[#121324] via-[#1f2038] to-[#121324] p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-heading text-xs font-black tracking-wider text-[var(--color-laburante-accent)]">
              LABURANTE
            </span>
            <span className="text-[10px] uppercase tracking-widest text-slate-400">· Tarjeta</span>
          </div>
          {isOwnerPreview && (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-300/30">
              Vista previa
            </span>
          )}
        </div>
      </div>

      {/* Main Card Content */}
      <div className="relative px-6 pb-6 pt-0">
        {/* Avatar / Photo overlapping the header */}
        <div className="-mt-10 mb-4 flex items-end justify-between">
          <div className="relative h-20 w-20 overflow-hidden rounded-2xl border-4 border-white bg-[var(--color-laburante-surface-alt)] shadow-md flex items-center justify-center font-heading text-2xl font-black text-[var(--color-laburante-text)] shrink-0">
            {photoUrl && !imageFailed ? (
              <img
                src={photoUrl}
                alt={name}
                className="h-full w-full object-cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span>{name ? name.charAt(0).toUpperCase() : 'L'}</span>
            )}
          </div>

          {whatsappVerified && (
            <div
              className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200 shadow-2xs"
              title="Número de WhatsApp certificado por LABURANTE"
            >
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Verificado</span>
            </div>
          )}
        </div>

        {/* Identity & Headline */}
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-extrabold text-[var(--color-laburante-text)] leading-tight">
            {name || 'Nombre del trabajador'}
          </h2>

          {headline && (
            <p className="font-heading text-sm font-semibold text-[var(--color-laburante-accent-hover)] leading-snug">
              {headline}
            </p>
          )}
        </div>

        {/* Badges: Location, Modality, Availability */}
        {(locationText || modalidad || disponibilidad) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--color-laburante-text-secondary)]">
            {locationText && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-laburante-surface-alt)] px-2.5 py-1 text-[11px] font-medium">
                <MapPin size={12} className="text-[var(--color-laburante-accent)] shrink-0" />
                {locationText}
              </span>
            )}
            {modalidad && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-laburante-surface-alt)] px-2.5 py-1 text-[11px] font-medium">
                <Briefcase size={12} className="text-[var(--color-laburante-text-muted)] shrink-0" />
                {formatModality(modalidad as WorkModality, hybridPresencialPct, hybridRemotoPct)}
              </span>
            )}
            {disponibilidad && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 border border-emerald-100">
                <Clock size={12} className="text-emerald-600 shrink-0" />
                {disponibilidad === 'disponible' ? 'Disponible' : disponibilidad}
              </span>
            )}
          </div>
        )}

        {zonaTrabajo && (
          <p className="mt-2 text-[11px] text-[var(--color-laburante-text-muted)]">
            Zona de cobertura: <strong className="text-[var(--color-laburante-text-secondary)]">{zonaTrabajo}</strong>
          </p>
        )}

        {/* Bio / Presentation */}
        {bio && (
          <div className="mt-4 rounded-2xl bg-[var(--color-laburante-surface-alt)]/60 p-3.5 border border-[var(--color-laburante-border)]/60">
            <p className="text-xs leading-relaxed text-[var(--color-laburante-text-secondary)] whitespace-pre-line line-clamp-4">
              {bio}
            </p>
          </div>
        )}

        {/* Skills / Specialties */}
        {skills && skills.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)] mb-1.5 flex items-center gap-1">
              <Sparkles size={11} className="text-amber-500" /> Especialidades
            </p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="rounded-lg border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-laburante-text)]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Services */}
        {services && services.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)] mb-1 flex items-center gap-1">
              <Layers size={11} /> Servicios destacados
            </p>
            <div className="divide-y divide-[var(--color-laburante-border)]/60 rounded-xl border border-[var(--color-laburante-border)]/60 bg-[var(--color-laburante-surface-alt)]/30 px-3">
              {services.slice(0, 3).map((service, idx) => (
                <div key={idx} className="py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--color-laburante-text)]">{service.title}</span>
                    {service.precio_orientativo && (
                      <span className="font-mono text-[11px] font-bold text-emerald-700">
                        {service.precio_orientativo}
                      </span>
                    )}
                  </div>
                  {service.description && (
                    <p className="mt-0.5 text-[11px] text-[var(--color-laburante-text-muted)] line-clamp-1">
                      {service.description}
                    </p>
                  )}
                </div>
              ))}
              {services.length > 3 && (
                <p className="py-1 text-center text-[10px] text-[var(--color-laburante-text-muted)]">
                  +{services.length - 3} servicios más en el perfil completo
                </p>
              )}
            </div>
          </div>
        )}

        {/* Languages */}
        {languages && languages.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 items-center text-[11px] text-[var(--color-laburante-text-muted)]">
            <span className="font-semibold text-[var(--color-laburante-text-secondary)]">Idiomas:</span>
            {languages.map((l, idx) => (
              <span key={idx} className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                {l.language} ({l.level})
              </span>
            ))}
          </div>
        )}

        {/* Contact Methods (Only those selected and approved) */}
        {activeContacts.length > 0 && (
          <div className="mt-5 border-t border-[var(--color-laburante-border)] pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)] mb-2">
              Canales de contacto directo
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeContacts.map((contact, idx) => {
                const href = getContactHref(contact.type, contact.value)
                const isExternal = Boolean(href && !href.startsWith('tel:') && !href.startsWith('mailto:'))
                return (
                  <a
                    key={idx}
                    href={href || undefined}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-laburante-text)] hover:border-[var(--color-laburante-indigo)] hover:bg-[var(--color-laburante-surface-alt)] transition-colors group"
                  >
                    <span className="shrink-0">{getContactIcon(contact.type)}</span>
                    <span className="min-w-0 flex-1 truncate">{getContactLabel(contact.type, contact.value)}</span>
                    {isExternal && (
                      <ExternalLink size={12} className="text-gray-400 group-hover:text-indigo-600 shrink-0" />
                    )}
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* QR Code Section */}
        {showQr && (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/40 p-4 text-center">
            <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-xl bg-white p-2 shadow-2xs border border-slate-200">
              {qrSvg ? (
                <div
                  className="h-full w-full flex items-center justify-center [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                  aria-label={`Código QR para la tarjeta de ${name}`}
                />
              ) : (
                <QrCode size={48} className="text-slate-300 animate-pulse" />
              )}
            </div>
            <p className="mt-2 text-xs font-bold text-[var(--color-laburante-text)]">
              Escaneá para ver o guardar esta tarjeta
            </p>
            <p className="text-[10px] text-[var(--color-laburante-text-muted)] truncate max-w-xs mx-auto mt-0.5">
              {cardUrl}
            </p>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="border-t border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] px-6 py-3 text-center">
        <p className="text-[11px] text-[var(--color-laburante-text-muted)]">
          Tarjeta digital oficial de{' '}
          <strong className="text-[var(--color-laburante-text)]">LABURANTE</strong> · Conexión laboral argentina
        </p>
      </div>
    </article>
  )
}
