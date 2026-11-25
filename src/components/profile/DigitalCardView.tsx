import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { formatModality, type WorkModality } from '@/lib/profile-format'
import { generateQrSvgString } from '@/lib/qr-service'
import { formatDigitalCardContactDisplay, getDigitalCardContactHref } from '@/lib/card-pdf'

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
      generateQrSvgString(cardUrl, { margin: 2, width: 160 })
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
  const visibleSkills = (skills || []).slice(0, 6)
  const visibleServices = (services || []).slice(0, 3)

  const getContactIcon = (type: string) => {
    switch (type) {
      case 'whatsapp':
        return <MessageCircle size={13} className="text-emerald-600 shrink-0" />
      case 'telefono':
        return <Phone size={13} className="text-sky-600 shrink-0" />
      case 'email':
        return <Mail size={13} className="text-amber-600 shrink-0" />
      case 'instagram':
        return (
          <svg
            aria-hidden="true"
            className="text-pink-600 shrink-0"
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="20" height="20" x="2" y="2" rx="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
        )
      case 'linkedin':
        return (
          <svg
            aria-hidden="true"
            className="text-blue-700 shrink-0"
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
            <rect width="4" height="12" x="2" y="9" />
            <circle cx="4" cy="4" r="2" />
          </svg>
        )
      case 'web':
      case 'portfolio':
      default:
        return <Globe size={13} className="text-[var(--color-laburante-indigo)] shrink-0" />
    }
  }

  return (
    <article className="w-full overflow-hidden rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] shadow-md">
      {/* Compact Brand Header */}
      <div className="flex items-center justify-between bg-[#121324] px-4 py-2 border-b-2 border-[var(--color-laburante-accent)]">
        <span className="font-heading text-[11px] font-black tracking-wider text-white">
          LABURANTE
        </span>
        <div className="flex items-center gap-2">
          {isOwnerPreview && (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-300/30">
              Vista previa
            </span>
          )}
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-laburante-accent)]">
            Tarjeta digital
          </span>
        </div>
      </div>

      {/* Main Compact Body */}
      <div className="p-4 space-y-3">
        {/* Identity Row */}
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-full border border-[var(--color-laburante-border)] bg-[#121324] flex items-center justify-center font-heading text-base font-extrabold text-white shrink-0">
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

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-heading text-base font-extrabold text-[var(--color-laburante-text)] leading-tight truncate">
                {name || 'Nombre del trabajador'}
              </h3>
              {whatsappVerified && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200"
                  title="WhatsApp certificado por LABURANTE"
                >
                  <ShieldCheck size={11} className="text-emerald-600" />
                  Verificado
                </span>
              )}
            </div>

            {headline && (
              <p className="font-heading text-xs font-bold text-[var(--color-laburante-accent-hover)] leading-snug truncate">
                {headline}
              </p>
            )}

            {(locationText || modalidad || disponibilidad) && (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[var(--color-laburante-text-secondary)]">
                {locationText && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} className="text-[var(--color-laburante-accent)] shrink-0" />
                    {locationText}
                  </span>
                )}
                {modalidad && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase size={11} className="text-[var(--color-laburante-text-muted)] shrink-0" />
                    {formatModality(modalidad as WorkModality, hybridPresencialPct, hybridRemotoPct)}
                  </span>
                )}
                {disponibilidad && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <Clock size={11} className="shrink-0" />
                    {disponibilidad === 'disponible' ? 'Disponible' : disponibilidad}
                  </span>
                )}
              </div>
            )}

            {zonaTrabajo && (
              <p className="text-[10px] text-[var(--color-laburante-text-muted)] truncate">
                Zona: <span className="text-[var(--color-laburante-text-secondary)]">{zonaTrabajo}</span>
              </p>
            )}
          </div>
        </div>

        {/* Brief Bio */}
        {bio && (
          <p className="rounded-xl bg-[var(--color-laburante-surface-alt)]/70 px-3 py-2 text-[11px] leading-relaxed text-[var(--color-laburante-text-secondary)] line-clamp-2 border border-[var(--color-laburante-border)]/60">
            {bio}
          </p>
        )}

        {/* Skills Chips */}
        {visibleSkills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleSkills.map((skill, idx) => (
              <span
                key={idx}
                className="rounded-md border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/50 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-laburante-text)]"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Services Compact Summary */}
        {visibleServices.length > 0 && (
          <p className="text-[11px] text-[var(--color-laburante-text-secondary)] leading-snug">
            <span className="font-bold text-[var(--color-laburante-text)]">Servicios: </span>
            {visibleServices
              .map((s) => (s.precio_orientativo ? `${s.title} (${s.precio_orientativo})` : s.title))
              .join(' · ')}
          </p>
        )}

        {/* Languages Compact */}
        {languages && languages.length > 0 && (
          <p className="text-[10px] text-[var(--color-laburante-text-muted)]">
            <span className="font-semibold text-[var(--color-laburante-text-secondary)]">Idiomas: </span>
            {languages.map((l) => `${l.language} (${l.level})`).join(', ')}
          </p>
        )}

        {/* Bottom 2-Column Zone: Direct Contacts (Selectable & Clickable) + QR */}
        <div className="border-t border-[var(--color-laburante-border)] pt-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)]">
              Contacto directo
            </p>
            {activeContacts.length === 0 ? (
              <p className="text-[11px] text-[var(--color-laburante-text-muted)]">
                Escaneá el QR o abrí el enlace para ver el perfil.
              </p>
            ) : (
              <div className="space-y-1">
                {activeContacts.map((contact, idx) => {
                  const href = getDigitalCardContactHref(contact.type, contact.value)
                  const isExternal = Boolean(href && !href.startsWith('tel:') && !href.startsWith('mailto:'))
                  const label = formatDigitalCardContactDisplay(contact.type, contact.value)
                  return (
                    <a
                      key={idx}
                      href={href || undefined}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-laburante-indigo)] hover:underline select-text break-all leading-tight"
                    >
                      {getContactIcon(contact.type)}
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {isExternal && <ExternalLink size={10} className="shrink-0 opacity-60" />}
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          {showQr && (
            <div className="shrink-0 text-center w-[92px]">
              <div className="mx-auto flex h-[84px] w-[84px] items-center justify-center rounded-lg bg-white p-1 border border-slate-200 shadow-2xs">
                {qrSvg ? (
                  <div
                    className="h-full w-full flex items-center justify-center [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                    aria-label={`Código QR para la tarjeta de ${name}`}
                  />
                ) : (
                  <QrCode size={28} className="text-slate-300 animate-pulse" />
                )}
              </div>
              <a
                href={cardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-[9px] font-semibold text-[var(--color-laburante-indigo)] hover:underline truncate select-all"
                title={cardUrl}
              >
                {cardUrl.replace(/^https?:\/\//i, '')}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Compact Footer */}
      <div className="border-t border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] px-4 py-1.5 text-center">
        <p className="text-[10px] text-[var(--color-laburante-text-muted)]">
          Tarjeta digital oficial de <strong className="text-[var(--color-laburante-text)]">LABURANTE</strong>
        </p>
      </div>
    </article>
  )
}
