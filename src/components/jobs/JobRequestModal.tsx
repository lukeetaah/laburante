import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { X, Upload, Image as ImageIcon, Trash2, Clock, Calendar, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { useJobStore, type JobRequestWithDetails } from '@/stores/job-store'
import { useAuthStore } from '@/stores/auth-store'
import type { JobRequestUrgency } from '@/lib/database.types'

interface JobRequestModalProps {
  profileId: string
  profileName: string
  profileSlug: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: (request: JobRequestWithDetails) => void
}

const URGENCY_OPTIONS: { id: JobRequestUrgency; label: string; badge: string; desc: string }[] = [
  {
    id: 'urgente',
    label: 'Urgente (hoy o mañana)',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    desc: 'Necesito resolverlo lo antes posible',
  },
  {
    id: 'esta_semana',
    label: 'Esta semana',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    desc: 'En el transcurso de los próximos 5-7 días',
  },
  {
    id: 'proximos_dias',
    label: 'Próximos 15 días',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    desc: 'Tengo flexibilidad para coordinar',
  },
  {
    id: 'a_coordinar',
    label: 'Fecha específica',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    desc: 'Indicar una fecha puntual en el calendario',
  },
]

export default function JobRequestModal({
  profileId,
  profileName,
  profileSlug,
  isOpen,
  onClose,
  onSuccess,
}: JobRequestModalProps) {
  const { user } = useAuthStore()
  const createJobRequest = useJobStore((s) => s.createJobRequest)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState<JobRequestUrgency>('esta_semana')
  const [preferredDate, setPreferredDate] = useState('')
  const [clientName, setClientName] = useState(user?.user_metadata?.name || '')
  const [clientContact, setClientContact] = useState(user?.user_metadata?.phone || '')
  const [clientLocation, setClientLocation] = useState(user?.user_metadata?.localidad || '')
  const [photos, setPhotos] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [createdRequest, setCreatedRequest] = useState<JobRequestWithDetails | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (!isOpen) return null

  const isOwnProfile = Boolean(user?.id && user.id === profileId)

  if (isOwnProfile) {
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 shrink-0 text-amber-600" /><div><h2 className="text-lg font-bold">No podés contratarte a vos mismo</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">Este perfil pertenece a tu propia cuenta. Para probar el flujo, usá otra cuenta o buscá a otra persona.</p></div></div>
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Entendido</button>
      </div>
    </div>
  }

  // Image handling with compression to Base64
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (photos.length + files.length > 5) {
      setError('Podés adjuntar hasta 5 fotos como máximo.')
      return
    }

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          // Max dimension 1024px to keep size low
          const maxDim = 1024
          let width = img.width
          let height = img.height

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          const compressed = canvas.toDataURL('image/jpeg', 0.75)
          setPhotos((prev) => [...prev, compressed].slice(0, 5))
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    })

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Por favor indicá el trabajo que necesitás.')
      return
    }
    if (!description.trim()) {
      setError('Por favor describí brevemente el trabajo o problema a resolver.')
      return
    }
    if (!clientName.trim()) {
      setError('Por favor ingresá tu nombre o apodo de contacto.')
      return
    }
    if (!clientContact.trim()) {
      setError('Por favor ingresá tu teléfono o WhatsApp para que te respondan.')
      return
    }

    setSubmitting(true)
    setError(null)

    const res = await createJobRequest({
      profile_id: profileId,
      pro_name: profileName,
      pro_slug: profileSlug,
      title: title.trim(),
      description: description.trim(),
      urgency,
      preferred_date: urgency === 'a_coordinar' ? preferredDate : undefined,
      photos,
      client_name: clientName.trim(),
      client_contact: clientContact.trim(),
      client_location: clientLocation.trim() || undefined,
    })

    setSubmitting(false)

    if (res.error) {
      setError(res.error)
    } else if (res.request) {
      setCreatedRequest(res.request)
      if (onSuccess) onSuccess(res.request)
    }
  }

  const handleReset = () => {
    setCreatedRequest(null)
    setTitle('')
    setDescription('')
    setPhotos([])
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
        <button
          onClick={handleReset}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-[var(--color-laburante-text-muted)] hover:bg-[var(--color-laburante-surface-alt)] transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        {createdRequest ? (
          <div className="text-center py-6 space-y-5">
            <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-emerald-200 shadow-md">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <h3 className="font-heading text-2xl font-extrabold text-[var(--color-laburante-text)]">
                ¡Solicitud enviada a {profileName}!
              </h3>
              <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed max-w-md mx-auto">
                Tu pedido de presupuesto quedó registrado en la plataforma. Podés seguir su estado en tiempo real paso a paso (estilo PedidosYa).
              </p>
            </div>

            {/* Stepper Preview */}
            <div className="p-4 rounded-2xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] text-left text-xs space-y-2">
              <p className="font-bold text-[var(--color-laburante-text)]">
                Estado actual:
              </p>
              <div className="flex items-center gap-2 text-amber-800 font-semibold bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                <Clock size={16} className="text-amber-600 shrink-0" />
                <span>Paso 1: Solicitud enviada — Esperando cotización del profesional</span>
              </div>
              <p className="text-[11px] text-[var(--color-laburante-text-muted)]">
                En cuanto {profileName} revise la información y las fotos adjuntas, te enviará el presupuesto con el monto y tiempo estimado.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Link
                to="/mis-trabajos"
                onClick={handleReset}
                className="btn-dark flex-1 py-3 px-6 rounded-xl font-heading font-bold text-xs inline-flex items-center justify-center gap-2"
              >
                Ver seguimiento en Mis Pedidos <ArrowRight size={14} />
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="py-3 px-5 rounded-xl border border-[var(--color-laburante-border)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)]"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                Presupuesto sin compromiso
              </span>
              <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-[var(--color-laburante-text)] mt-2">
                Pedir presupuesto a {profileName}
              </h2>
              <p className="text-xs text-[var(--color-laburante-text-secondary)] mt-1">
                Ahorrá pasos adjuntando fotos del problema e indicando cuándo te gustaría que se resuelva. 100% directo, 0% comisiones.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Job Title */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                  ¿Qué trabajo necesitás realizar? <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ej: Arreglo de cortina de enrollar, Pintura de living, Pérdida de agua..."
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                  Descripción y detalles del problema <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explicá lo que ocurre, medidas orientativas, acceso al lugar o cualquier detalle relevante..."
                  rows={3}
                  required
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-[var(--color-laburante-indigo)] resize-none"
                />
              </div>

              {/* Photos of the problem */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[var(--color-laburante-text)] flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-[var(--color-laburante-indigo)]" />
                    Fotos del problema o lugar (opcional, hasta 5)
                  </label>
                  <span className="text-[10px] text-[var(--color-laburante-text-muted)]">
                    {photos.length}/5 fotos
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {photos.map((src, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-[var(--color-laburante-border)] group">
                      <img src={src} alt={`Adjunto ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-lg transition-colors"
                        title="Eliminar foto"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}

                  {photos.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-[var(--color-laburante-border)] hover:border-[var(--color-laburante-indigo)] hover:bg-[var(--color-laburante-surface-alt)] flex flex-col items-center justify-center gap-1 text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)] transition-all cursor-pointer"
                    >
                      <Upload size={18} />
                      <span className="text-[10px] font-semibold">Subir foto</span>
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {/* Urgency / Timeframe */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-2 flex items-center gap-1.5">
                  <Clock size={14} className="text-[var(--color-laburante-indigo)]" />
                  ¿Cuándo te gustaría que se resuelva? <span className="text-rose-500">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {URGENCY_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                        urgency === opt.id
                          ? 'border-[var(--color-laburante-indigo)] bg-indigo-50/50 shadow-2xs'
                          : 'border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="urgency"
                        checked={urgency === opt.id}
                        onChange={() => setUrgency(opt.id)}
                        className="mt-0.5 text-[var(--color-laburante-indigo)] focus:ring-0 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <p className="font-bold text-[var(--color-laburante-text)]">{opt.label}</p>
                        <p className="text-[11px] text-[var(--color-laburante-text-muted)]">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {urgency === 'a_coordinar' && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <Calendar size={16} className="text-[var(--color-laburante-text-muted)] shrink-0" />
                    <input
                      type="date"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Client Contact Details */}
              <div className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/40 space-y-3">
                <p className="text-xs font-bold text-[var(--color-laburante-text)]">
                  Tus datos para recibir la respuesta
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--color-laburante-text)] mb-1">
                      Tu nombre o apodo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="ej: Martín o Mariana"
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--color-laburante-text)] mb-1">
                      Teléfono o WhatsApp <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={clientContact}
                      onChange={(e) => setClientContact(e.target.value)}
                      placeholder="ej: 11 4567-8901"
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-laburante-text)] mb-1">
                    Tu localidad o barrio (opcional)
                  </label>
                  <input
                    type="text"
                    value={clientLocation}
                    onChange={(e) => setClientLocation(e.target.value)}
                    placeholder="ej: Almagro, CABA o Lanús Oeste"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-white"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-3 px-4 rounded-xl border border-[var(--color-laburante-border)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-2 py-3 px-6 rounded-xl btn-dark font-heading font-bold text-xs transition-all shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Enviando solicitud...' : 'Enviar pedido de presupuesto'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
