import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Mail,
  MessageCircle,
  QrCode,
  Share2,
  Sparkles,
  Layers,
  MapPin,
  Briefcase,
  Clock,
  Phone,
  Globe,
  ShieldCheck,
  AlertCircle,
  Eye,
  Sliders,
  ExternalLink,
  Send,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import DigitalCardView from '@/components/profile/DigitalCardView'
import {
  detectAvailableCardFields,
  getDefaultDigitalCardConfig,
  fetchDigitalCardConfig,
  saveDigitalCardConfig,
  getCanonicalCardUrl,
  getCardWhatsAppShareUrl,
  sendCardEmailToSelf,
  type DigitalCardConfig,
} from '@/lib/digital-card'
import { downloadQrAsPng, downloadQrAsSvg } from '@/lib/qr-service'
import { downloadDigitalCardAsPdf } from '@/lib/card-pdf'
import { downloadVCard } from '@/lib/vcard'
import { resolveProfilePhotoUrl } from '@/lib/profile-assets'

export default function CardConfigPage() {
  const { user, loading: authLoading } = useAuthStore()
  const { myProfile, fetchMyProfile } = useProfileStore()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [cardKey, setCardKey] = useState<string>('')
  const [config, setConfig] = useState<DigitalCardConfig | null>(null)
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string | null>(null)

  // Feedback states
  const [copiedLink, setCopiedLink] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; message: string } | null>(null)

  // Mobile layout state: 'preview' or 'config'
  const [mobileTab, setMobileTab] = useState<'preview' | 'config'>('preview')

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/ingresar?next=/mi-tarjeta')
    }
  }, [authLoading, user, navigate])

  // Cargar perfil y configuración de tarjeta
  useEffect(() => {
    let active = true
    if (!user) return

    setLoading(true)

    const loadData = async () => {
      let currentProf = myProfile
      if (!currentProf) {
        currentProf = await fetchMyProfile()
      }

      if (!active) return

      if (currentProf) {
        // Resolver foto pública o privada
        if (currentProf.photo_url) {
          const photo = await resolveProfilePhotoUrl(currentProf.photo_url)
          if (active) setResolvedPhotoUrl(photo)
        }

        // Consultar configuración persistida en Supabase
        const existingCard = await fetchDigitalCardConfig(currentProf.id)
        if (!active) return

        if (existingCard) {
          setCardKey(existingCard.card_key)
          setConfig(existingCard.config)
        } else {
          // Si nunca guardó, generar configuración por defecto sin asignar slug como card_key
          const defaultConfig = getDefaultDigitalCardConfig(currentProf)
          setCardKey('')
          setConfig(defaultConfig)
        }
      }

      setLoading(false)
    }

    void loadData()

    return () => {
      active = false
    }
  }, [user, myProfile, fetchMyProfile])

  // Campos disponibles detectados en tiempo real desde el perfil del usuario
  const availableFields = useMemo(() => {
    return detectAvailableCardFields(myProfile)
  }, [myProfile])

  // URL canónica permanente
  const canonicalUrl = useMemo(() => {
    const keyToUse = cardKey || myProfile?.slug || 'usuario'
    return getCanonicalCardUrl(keyToUse)
  }, [cardKey, myProfile?.slug])

  // Modificar toggle
  const toggleField = (fieldKey: keyof DigitalCardConfig) => {
    if (!config) return
    setConfig((prev) => (prev ? { ...prev, [fieldKey]: !prev[fieldKey] } : prev))
    setSaveSuccess(false)
    setSaveError(null)
  }

  // Guardar en Supabase
  const handleSave = async () => {
    if (!myProfile || !config) return

    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    const result = await saveDigitalCardConfig(myProfile.id, config, cardKey)

    setSaving(false)
    if (result.error) {
      setSaveError(result.error)
    } else {
      setCardKey(result.card_key)
      setSaveSuccess(true)
    }
  }

  // Compartir por WhatsApp
  const handleShareWhatsApp = () => {
    const professionOrHeadline = config?.show_headline
      ? config.custom_headline || availableFields.defaultHeadline
      : undefined
    const waUrl = getCardWhatsAppShareUrl(myProfile?.name || 'Profesional', professionOrHeadline, canonicalUrl)
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  // Compartir mediante menú nativo
  const handleNativeShare = async () => {
    const shareData = {
      title: `Tarjeta de ${myProfile?.name || 'Profesional'} · LABURANTE`,
      text: `Te comparto mi tarjeta digital de LABURANTE: ${myProfile?.name}. Conocé mis servicios y datos de contacto acá:`,
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
    try {
      await navigator.clipboard.writeText(canonicalUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      // Fallback manual
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
    if (!myProfile || !config) return
    await downloadDigitalCardAsPdf(
      {
        card_key: cardKey || myProfile.slug,
        slug: myProfile.slug,
        name: myProfile.name,
        photo_url: config.show_photo ? resolvedPhotoUrl : null,
        headline: config.show_headline ? config.custom_headline || availableFields.defaultHeadline : null,
        bio: config.show_bio ? myProfile.bio : null,
        provincia: config.show_location ? myProfile.provincia : null,
        localidad: config.show_location ? myProfile.localidad : null,
        zona_trabajo: config.show_zona_trabajo ? myProfile.zona_trabajo : null,
        disponibilidad: config.show_availability ? myProfile.disponibilidad : null,
        modalidad: config.show_modality ? myProfile.modalidad : null,
        hybrid_presencial_pct: config.show_modality ? myProfile.hybrid_presencial_pct : null,
        hybrid_remoto_pct: config.show_modality ? myProfile.hybrid_remoto_pct : null,
        whatsapp_verified: config.show_verified_badge ? Boolean(myProfile.whatsapp_verified) : false,
        skills: config.show_skills ? availableFields.skillsList : [],
        services: config.show_services ? myProfile.services : [],
        languages: config.show_languages ? myProfile.languages : [],
        contacts: previewContacts,
      },
      canonicalUrl,
      myProfile.slug
    )
  }

  // Descargar QR como PNG de 1024x1024
  const handleDownloadQrPng = async () => {
    const safeName = (myProfile?.name || 'tarjeta')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    await downloadQrAsPng(canonicalUrl, `qr-laburante-${safeName}.png`, 1024)
  }

  // Descargar QR como SVG vectorial
  const handleDownloadQrSvg = async () => {
    const safeName = (myProfile?.name || 'tarjeta')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    await downloadQrAsSvg(canonicalUrl, `qr-laburante-${safeName}.svg`)
  }

  // Enviarme mi QR por correo
  const handleSendEmailToSelf = async () => {
    if (!user?.id || !user.email || !myProfile) return
    if (!cardKey) {
      setEmailStatus({
        ok: false,
        message: 'Primero guardá tu tarjeta para generar tu enlace permanente y enviártela por correo.',
      })
      return
    }
    setEmailSending(true)
    setEmailStatus(null)

    const res = await sendCardEmailToSelf(user.id, user.email, cardKey, myProfile.name)
    setEmailSending(false)

    if (res.success) {
      setEmailStatus({
        ok: true,
        message: `¡Listo! Te enviamos tu enlace permanente y datos a ${user.email}.`,
      })
    } else {
      setEmailStatus({
        ok: false,
        message: res.error || 'No se pudo enviar el correo en este momento.',
      })
    }
  }

  // Descargar vCard .vcf con solo los datos autorizados
  const handleDownloadVCard = () => {
    if (!myProfile || !config) return

    const contacts = myProfile.contact_methods || []
    const wa = contacts.find((c) => c.type === 'whatsapp')?.value
    const tel = contacts.find((c) => c.type === 'telefono')?.value
    const em = contacts.find((c) => c.type === 'email')?.value
    const wb = contacts.find((c) => c.type === 'web')?.value

    downloadVCard(
      {
        name: myProfile.name,
        title: config.show_headline ? config.custom_headline || availableFields.defaultHeadline : undefined,
        org: 'LABURANTE',
        phone: config.show_phone ? tel : undefined,
        whatsapp: config.show_whatsapp ? wa : undefined,
        email: config.show_email ? em : undefined,
        url: config.show_web ? wb : canonicalUrl,
        city: config.show_location ? myProfile.localidad : undefined,
        region: config.show_location ? myProfile.provincia : undefined,
        note: `Tarjeta digital LABURANTE: ${canonicalUrl}`,
      },
      `contacto-${myProfile.slug}.vcf`
    )
  }

  // Preparar datos filtrados en tiempo real para la vista previa
  const previewContacts = useMemo(() => {
    if (!config || !myProfile?.contact_methods) return []
    return myProfile.contact_methods.filter((c) => {
      if (c.type === 'whatsapp') return config.show_whatsapp
      if (c.type === 'telefono') return config.show_phone
      if (c.type === 'email') return config.show_email
      if (c.type === 'web') return config.show_web
      if (c.type === 'instagram') return config.show_instagram
      if (c.type === 'linkedin') return config.show_linkedin
      if (c.type === 'portfolio') return config.show_portfolio
      return false
    })
  }, [config, myProfile?.contact_methods])

  if (loading || !config) {
    return (
      <div className="container mx-auto py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-laburante-indigo)] border-t-transparent" />
        <p className="mt-3 text-xs text-[var(--color-laburante-text-secondary)]">Cargando tu tarjeta LABURANTE...</p>
      </div>
    )
  }

  if (!myProfile) {
    return (
      <div className="container mx-auto max-w-xl py-12 text-center space-y-4">
        <AlertCircle size={40} className="mx-auto text-amber-500" />
        <h1 className="font-heading text-xl font-bold">Primero necesitás crear tu perfil</h1>
        <p className="text-xs text-[var(--color-laburante-text-secondary)]">
          Para armar tu tarjeta digital, primero completá tus datos en tu perfil profesional de LABURANTE.
        </p>
        <Link to="/crear-perfil" className="btn-dark inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold">
          Completar mi perfil ahora
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl py-6 md:py-10 space-y-6">
      {/* Top Header / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-laburante-border)] pb-4">
        <div className="space-y-1">
          <Link
            to="/crear-perfil"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)]"
          >
            <ArrowLeft size={14} /> Volver a edición de perfil
          </Link>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)]">
            Mi tarjeta LABURANTE
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)]">
            Elegí qué información querés mostrar en tu tarjeta digital pública y compartí tu QR único.
          </p>
        </div>

        {/* Quick View Public Card Button */}
        <div className="flex items-center gap-2">
          <a
            href={canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-laburante-border)] bg-white px-3.5 py-2 text-xs font-bold text-[var(--color-laburante-text)] shadow-2xs hover:bg-[var(--color-laburante-surface-alt)]"
          >
            <ExternalLink size={14} className="text-indigo-600" />
            <span>Ver página pública</span>
          </a>
        </div>
      </div>

      {/* Profile Paused / Inactive Notice */}
      {myProfile.status !== 'activo' && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Tu perfil está actualmente en modo privado / pausado.</p>
            <p className="text-[11px] text-amber-800">
              La tarjeta digital no divulgará información a visitantes anónimos hasta que actives tu perfil en{' '}
              <Link to="/crear-perfil" className="underline font-semibold">
                Mi perfil
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="flex rounded-2xl bg-[var(--color-laburante-surface-alt)] p-1 md:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'preview'
              ? 'bg-white text-[var(--color-laburante-text)] shadow-2xs'
              : 'text-[var(--color-laburante-text-secondary)]'
          }`}
        >
          <Eye size={14} /> Vista previa
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('config')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'config'
              ? 'bg-white text-[var(--color-laburante-text)] shadow-2xs'
              : 'text-[var(--color-laburante-text-secondary)]'
          }`}
        >
          <Sliders size={14} /> Configurar campos
        </button>
      </div>

      {/* Main Grid: 2 columns in Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Toggles Configuration */}
        <div className={`lg:col-span-6 space-y-6 ${mobileTab === 'preview' ? 'hidden md:block' : 'block'}`}>
          <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--color-laburante-border)] pb-3">
              <h2 className="font-heading text-base font-bold flex items-center gap-2 text-[var(--color-laburante-text)]">
                <Sliders size={18} className="text-[var(--color-laburante-indigo)]" />
                <span>Campos visibles en tu tarjeta</span>
              </h2>
              <span className="text-[11px] text-[var(--color-laburante-text-muted)]">Actualización en vivo</span>
            </div>

            {/* Mandatory Identification */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Nombre completo o profesional</p>
                <p className="text-[11px] text-slate-500">{myProfile.name}</p>
              </div>
              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                Obligatorio
              </span>
            </div>

            {/* 1. Datos Personales y de Identidad */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)]">
                Presentación personal
              </p>

              {/* Foto de perfil */}
              {availableFields.hasPhoto && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      {resolvedPhotoUrl ? (
                        <img src={resolvedPhotoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-bold">
                          {myProfile.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Foto de perfil</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)]">Muestra tu fotografía</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_photo}
                      onChange={() => toggleField('show_photo')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Oficio / Profesión / Titular */}
              {availableFields.defaultHeadline && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Oficio o profesión</p>
                    <p className="text-[11px] text-[var(--color-laburante-text-muted)] truncate max-w-xs">
                      {config.custom_headline || availableFields.defaultHeadline}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_headline}
                      onChange={() => toggleField('show_headline')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Insignia de verificación */}
              {availableFields.hasVerifiedBadge && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Insignia de verificación</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)]">WhatsApp certificado</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_verified_badge}
                      onChange={() => toggleField('show_verified_badge')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Descripción personal / bio */}
              {availableFields.hasBio && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Descripción personal</p>
                    <p className="text-[11px] text-[var(--color-laburante-text-muted)] line-clamp-1 max-w-xs">
                      {myProfile.bio}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_bio}
                      onChange={() => toggleField('show_bio')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}
            </div>

            {/* 2. Actividad y Servicios */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)]">
                Labor y cobertura
              </p>

              {/* Habilidades y especialidades */}
              {availableFields.hasSkills && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-500" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Habilidades y especialidades</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)]">
                        {availableFields.skillsList.length} especialidades declaradas
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_skills}
                      onChange={() => toggleField('show_skills')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Servicios que ofrece */}
              {availableFields.hasServices && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-indigo-600" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Servicios que ofrezco</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)]">
                        {availableFields.servicesCount} servicios cargados
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_services}
                      onChange={() => toggleField('show_services')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Ubicación (Localidad y Provincia) */}
              {availableFields.hasLocation && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-[var(--color-laburante-accent)]" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Ubicación</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)]">
                        {[myProfile.localidad, myProfile.provincia].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_location}
                      onChange={() => toggleField('show_location')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Zona de trabajo */}
              {availableFields.hasZonaTrabajo && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Zona de trabajo</p>
                    <p className="text-[11px] text-[var(--color-laburante-text-muted)]">{myProfile.zona_trabajo}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_zona_trabajo}
                      onChange={() => toggleField('show_zona_trabajo')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Modalidad de trabajo */}
              {availableFields.hasModality && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-slate-500" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Modalidad de trabajo</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)] capitalize">{myProfile.modalidad}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_modality}
                      onChange={() => toggleField('show_modality')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Disponibilidad */}
              {availableFields.hasAvailability && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-emerald-600" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Disponibilidad</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)] capitalize">{myProfile.disponibilidad}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_availability}
                      onChange={() => toggleField('show_availability')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}
            </div>

            {/* 3. Canales de Contacto Directos */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)]">
                Canales de contacto directo
              </p>

              {/* WhatsApp */}
              {availableFields.hasWhatsApp && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <MessageCircle size={16} className="text-emerald-600" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">WhatsApp</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)] font-mono">{availableFields.whatsAppNumber}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_whatsapp}
                      onChange={() => toggleField('show_whatsapp')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Teléfono */}
              {availableFields.hasPhone && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Phone size={16} className="text-sky-600" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Llamada telefónica</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)] font-mono">{availableFields.phoneNumber}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_phone}
                      onChange={() => toggleField('show_phone')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Correo electrónico */}
              {availableFields.hasEmail && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Mail size={16} className="text-amber-600" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Correo electrónico</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)]">{availableFields.emailAddress}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_email}
                      onChange={() => toggleField('show_email')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Sitio web */}
              {availableFields.hasWeb && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Globe size={16} className="text-[var(--color-laburante-indigo)]" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Sitio web</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)] truncate max-w-xs">{availableFields.webUrl}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_web}
                      onChange={() => toggleField('show_web')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* Instagram */}
              {availableFields.hasInstagram && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <svg aria-hidden="true" className="text-pink-600" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">Instagram</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)]">{availableFields.instagramHandle}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_instagram}
                      onChange={() => toggleField('show_instagram')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}

              {/* LinkedIn */}
              {availableFields.hasLinkedIn && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--color-laburante-border)] p-3 hover:bg-[var(--color-laburante-surface-alt)]/50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <svg aria-hidden="true" className="text-blue-700" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-laburante-text)]">LinkedIn</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)]">Perfil profesional</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.show_linkedin}
                      onChange={() => toggleField('show_linkedin')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-laburante-indigo)]" />
                  </label>
                </div>
              )}
            </div>

            {/* Action Save Button */}
            <div className="pt-4 border-t border-[var(--color-laburante-border)] space-y-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full btn-dark py-3.5 px-6 rounded-2xl font-heading font-bold text-sm shadow-md flex items-center justify-center gap-2 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Guardando en Supabase...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Guardar mi tarjeta</span>
                  </>
                )}
              </button>

              {saveSuccess && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center font-semibold">
                  ✓ Configuración guardada exitosamente en Supabase.
                </p>
              )}

              {saveError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1">
                  <p className="font-bold">No se pudo guardar la configuración</p>
                  <p>{saveError}</p>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="mt-1 font-bold underline hover:text-rose-900"
                  >
                    Reintentar ahora
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Real-Time Preview & Sharing Actions */}
        <div className={`lg:col-span-6 space-y-6 ${mobileTab === 'config' ? 'hidden md:block' : 'block'}`}>
          <div className="sticky top-20 space-y-5">
            {/* Real-time Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)] flex items-center gap-1.5">
                  <Eye size={14} /> Vista previa en tiempo real
                </span>
                <span className="text-[11px] text-[var(--color-laburante-text-muted)]">
                  URL permanente asignada
                </span>
              </div>

              <DigitalCardView
                name={myProfile.name}
                photoUrl={config.show_photo ? resolvedPhotoUrl : null}
                headline={config.show_headline ? config.custom_headline || availableFields.defaultHeadline : null}
                bio={config.show_bio ? myProfile.bio : null}
                provincia={config.show_location ? myProfile.provincia : null}
                localidad={config.show_location ? myProfile.localidad : null}
                zonaTrabajo={config.show_zona_trabajo ? myProfile.zona_trabajo : null}
                disponibilidad={config.show_availability ? myProfile.disponibilidad : null}
                modalidad={config.show_modality ? myProfile.modalidad : null}
                hybridPresencialPct={config.show_modality ? myProfile.hybrid_presencial_pct : null}
                hybridRemotoPct={config.show_modality ? myProfile.hybrid_remoto_pct : null}
                whatsappVerified={config.show_verified_badge ? myProfile.whatsapp_verified : false}
                skills={config.show_skills ? availableFields.skillsList : []}
                services={config.show_services ? myProfile.services : []}
                languages={config.show_languages ? myProfile.languages : []}
                contacts={previewContacts}
                cardUrl={canonicalUrl}
                isOwnerPreview={true}
                showQr={true}
              />
            </div>

            {/* Sharing & QR Download Hub */}
            <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5 shadow-xs space-y-4">
              <h3 className="font-heading text-sm font-bold text-[var(--color-laburante-text)] flex items-center gap-1.5">
                <Share2 size={16} className="text-[var(--color-laburante-accent)]" />
                <span>Compartir y descargar mi tarjeta</span>
              </h3>

              {/* Main Sharing Actions (WhatsApp is Primary) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Compartir por WhatsApp (Principal) */}
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 px-4 font-heading font-bold text-xs shadow-xs transition-transform hover:scale-[1.01] cursor-pointer sm:col-span-2"
                >
                  <MessageCircle size={18} />
                  <span>Compartir por WhatsApp</span>
                </button>

                {/* 2. Compartir mediante menú nativo */}
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] py-2.5 px-3 font-semibold text-xs text-[var(--color-laburante-text)] transition-colors cursor-pointer"
                >
                  <Share2 size={15} />
                  <span>Compartir tarjeta</span>
                </button>

                {/* 3. Copiar enlace canónico */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] py-2.5 px-3 font-semibold text-xs text-[var(--color-laburante-text)] transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  <span>{copiedLink ? '¡Enlace copiado!' : 'Copiar enlace'}</span>
                </button>
              </div>

              {/* Card PDF & QR Downloads */}
              <div className="pt-3 border-t border-[var(--color-laburante-border)] space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)] flex items-center gap-1.5">
                  <QrCode size={13} /> Descargar tarjeta o código QR
                </p>
                <button
                  type="button"
                  onClick={handleDownloadCardPdf}
                  className="w-full flex items-center justify-center gap-2 rounded-xl btn-dark py-2.5 px-3 text-xs font-bold transition-colors cursor-pointer"
                  title="PDF con texto seleccionable, links clicables y código QR integrado"
                >
                  <Download size={14} />
                  <span>Descargar tarjeta (PDF)</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadQrPng}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-laburante-border)] bg-white hover:bg-[var(--color-laburante-surface-alt)] py-2 px-3 text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
                    title="PNG de 1024x1024 px apto para pantallas y redes"
                  >
                    <Download size={14} className="text-slate-600" />
                    <span>QR en PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadQrSvg}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/50 py-2 px-3 text-xs font-semibold text-indigo-900 transition-colors cursor-pointer"
                    title="SVG vectorial de alta fidelidad para imprenta, folletos y carteles"
                  >
                    <Download size={14} className="text-indigo-600" />
                    <span>QR en SVG</span>
                  </button>
                </div>
              </div>

              {/* Extra Tools: Email QR to Self + vCard */}
              {!cardKey && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
                  Tocá <strong>Guardar mi tarjeta</strong> para activar tu enlace permanente y código QR definitivo.
                </p>
              )}
              <div className="pt-3 border-t border-[var(--color-laburante-border)] flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleSendEmailToSelf}
                  disabled={emailSending}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-laburante-indigo)] hover:underline disabled:opacity-50 cursor-pointer"
                >
                  <Send size={13} />
                  <span>{emailSending ? 'Enviando...' : 'Enviarme mi QR por correo'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadVCard}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]"
                >
                  <Download size={13} />
                  <span>Guardar contacto (.vcf)</span>
                </button>
              </div>

              {emailStatus && (
                <div
                  className={`rounded-xl p-2.5 text-xs font-medium text-center ${
                    emailStatus.ok
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {emailStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
