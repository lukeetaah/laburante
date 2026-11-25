import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  QrCode,
  Share2,
  User,
  ShieldOff,
  Sliders,
  Send,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import DigitalCardView from '@/components/profile/DigitalCardView'
import {
  fetchPublicDigitalCard,
  getCanonicalCardUrl,
  getCardWhatsAppShareUrl,
  type PublicDigitalCardData,
} from '@/lib/digital-card'
import { downloadDigitalCardAsPdf } from '@/lib/card-pdf'
import { downloadVCard } from '@/lib/vcard'

export default function DigitalCardPage() {
  const { identifier } = useParams<{ identifier: string }>()
  const { user } = useAuthStore()

  const [cardData, setCardData] = useState<PublicDigitalCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    let active = true
    if (!identifier) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setNotFound(false)

    fetchPublicDigitalCard(identifier)
      .then((data) => {
        if (!active) return
        if (!data) {
          setNotFound(true)
        } else {
          setCardData(data)
        }
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        console.warn('Error fetching digital card:', err)
        setNotFound(true)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [identifier, user?.id])

  // URL permanente canónica (/t/:slug)
  const canonicalUrl = cardData ? getCanonicalCardUrl(cardData.slug || cardData.card_key) : ''

  // Compartir por WhatsApp
  const handleShareWhatsApp = () => {
    if (!cardData) return
    const professionOrHeadline = cardData.headline || (cardData.skills && cardData.skills[0]) || ''
    const waUrl = getCardWhatsAppShareUrl(cardData.name, professionOrHeadline, canonicalUrl)
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  // Compartir mediante menú nativo
  const handleNativeShare = async () => {
    if (!cardData) return
    const shareData = {
      title: `Tarjeta de ${cardData.name} · LABURANTE`,
      text: `Te comparto la tarjeta digital de ${cardData.name} en LABURANTE. Conocé sus datos de contacto y servicios:`,
      url: canonicalUrl,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink()
        }
      }
    } else {
      handleCopyLink()
    }
  }

  // Copiar enlace canónico
  const handleCopyLink = async () => {
    if (!canonicalUrl) return
    try {
      await navigator.clipboard.writeText(canonicalUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = canonicalUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  // Descargar tarjeta completa como PDF con links clicables y QR
  const handleDownloadCardPdf = async () => {
    if (!cardData || !canonicalUrl) return
    await downloadDigitalCardAsPdf(cardData, canonicalUrl, cardData.slug, {
      contactsLocked: !user,
    })
  }

  // Guardar contacto vCard (.vcf) con los datos autorizados
  const handleDownloadVCard = () => {
    if (!cardData) return
    const contacts = cardData.contacts || []
    const wa = contacts.find((c) => c.type === 'whatsapp')?.value
    const tel = contacts.find((c) => c.type === 'telefono')?.value
    const em = contacts.find((c) => c.type === 'email')?.value
    const wb = contacts.find((c) => c.type === 'web')?.value

    downloadVCard(
      {
        name: cardData.name,
        title: cardData.headline || (cardData.skills && cardData.skills[0]) || undefined,
        org: 'LABURANTE',
        phone: tel,
        whatsapp: wa,
        email: em,
        url: wb || canonicalUrl,
        city: cardData.localidad || undefined,
        region: cardData.provincia || undefined,
        note: `Tarjeta digital LABURANTE: ${canonicalUrl}`,
      },
      `contacto-${cardData.slug}.vcf`
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto py-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-laburante-indigo)] border-t-transparent" />
        <p className="mt-3 text-xs text-[var(--color-laburante-text-secondary)]">Cargando tarjeta digital...</p>
      </div>
    )
  }

  if (notFound || !cardData) {
    return (
      <div className="container mx-auto max-w-lg py-16 px-4 text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-600 border border-amber-200">
          <ShieldOff size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold text-[var(--color-laburante-text)]">
            Tarjeta no disponible
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
            Esta tarjeta digital no existe o el trabajador ha pausado temporalmente la visibilidad de su perfil en
            LABURANTE para cuidar su privacidad.
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/buscar"
            className="btn-dark inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-xs font-bold shadow-xs hover:opacity-95"
          >
            <span>Explorar profesionales en LABURANTE</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-xl py-6 md:py-10 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between text-xs">
        <Link
          to={`/p/${cardData.slug}`}
          className="inline-flex items-center gap-1.5 font-medium text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)]"
        >
          <ArrowLeft size={14} /> Ver perfil completo
        </Link>

        {user && (
          <Link
            to="/mi-tarjeta"
            className="inline-flex items-center gap-1 font-semibold text-[var(--color-laburante-indigo)] hover:underline"
          >
            <Sliders size={13} /> Mi tarjeta
          </Link>
        )}
      </div>

      {/* The Digital Card */}
      <DigitalCardView
        name={cardData.name}
        photoUrl={cardData.photo_url}
        headline={cardData.headline || (cardData.skills && cardData.skills[0]) || null}
        bio={cardData.bio}
        provincia={cardData.provincia}
        localidad={cardData.localidad}
        zonaTrabajo={cardData.zona_trabajo}
        disponibilidad={cardData.disponibilidad}
        modalidad={cardData.modalidad}
        hybridPresencialPct={cardData.hybrid_presencial_pct}
        hybridRemotoPct={cardData.hybrid_remoto_pct}
        whatsappVerified={cardData.whatsapp_verified}
        skills={cardData.skills}
        services={cardData.services}
        languages={cardData.languages}
        contacts={cardData.contacts}
        contactsLocked={!user}
        hasLockedContacts={Boolean(cardData.has_contacts)}
        cardUrl={canonicalUrl}
        isOwnerPreview={false}
        showQr={true}
      />

      {/* Primary Actions Hub */}
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 shadow-xs space-y-4">
        {/* WhatsApp Share Button (Main Requirement) */}
        <button
          type="button"
          onClick={handleShareWhatsApp}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white py-3.5 px-4 font-heading font-bold text-xs shadow-xs transition-transform hover:scale-[1.01] cursor-pointer"
        >
          <MessageCircle size={18} />
          <span>Compartir por WhatsApp</span>
        </button>

        {/* Action Row: Save Contact + Share + Copy Link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {user ? (
            <button
              type="button"
              onClick={handleDownloadVCard}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white hover:bg-black py-2.5 px-3 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Download size={15} />
              <span>Guardar en contactos (.vcf)</span>
            </button>
          ) : (
            <Link
              to="/ingresar"
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white hover:bg-black py-2.5 px-3 font-semibold text-xs transition-colors"
            >
              <User size={15} />
              <span>Ingresá para ver contactos</span>
            </Link>
          )}

          <button
            type="button"
            onClick={handleNativeShare}
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] py-2.5 px-3 font-semibold text-xs text-[var(--color-laburante-text)] transition-colors cursor-pointer"
          >
            <Share2 size={15} />
            <span>Compartir tarjeta</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] py-2.5 px-3 font-semibold text-xs text-[var(--color-laburante-text)] transition-colors cursor-pointer sm:col-span-2"
          >
            {copiedLink ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
            <span>{copiedLink ? '¡Enlace copiado al portapapeles!' : 'Copiar enlace público'}</span>
          </button>
        </div>

        {/* Descargar tarjeta completa en PDF */}
        <div className="pt-3 border-t border-[var(--color-laburante-border)]">
          <button
            type="button"
            onClick={handleDownloadCardPdf}
            className="w-full flex items-center justify-center gap-2 rounded-xl btn-dark py-3 px-4 text-xs font-bold transition-colors cursor-pointer"
          >
            <Download size={15} />
            <span>Descargar tarjeta (PDF)</span>
          </button>
        </div>

        {/* Full Profile CTA Button */}
        <div className="pt-3 border-t border-[var(--color-laburante-border)]">
          <Link
            to={`/p/${cardData.slug}`}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100/70 text-amber-950 py-3 px-4 font-heading font-bold text-xs transition-colors"
          >
            <User size={15} className="text-amber-700" />
            <span>Visitar perfil completo en LABURANTE</span>
            <ExternalLink size={13} className="text-amber-700" />
          </Link>
        </div>
      </div>
    </div>
  )
}
