import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, AlertTriangle, Trash2, RefreshCw } from 'lucide-react'
import { useProfileStore } from '@/stores/profile-store'
import { useAuthStore } from '@/stores/auth-store'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
  profileId: string
  profileName: string
}

const DELETION_REASONS = [
  { id: 'trabajo_suficiente', label: 'Ya conseguí suficiente trabajo y no necesito nuevos contactos' },
  { id: 'sin_consultas', label: 'No recibí las consultas o solicitudes que esperaba' },
  { id: 'mala_experiencia', label: 'Tuve un problema o desacuerdo con un contacto/cliente' },
  { id: 'problemas_tecnicos', label: 'Dificultades técnicas o me resultó poco clara la plataforma' },
  { id: 'cambio_datos', label: 'Voy a crear otro perfil con un rubro o datos diferentes' },
  { id: 'otro', label: 'Otro motivo (especificar debajo)' },
]

export default function DeleteAccountModal({
  isOpen,
  onClose,
  profileId,
  profileName,
}: DeleteAccountModalProps) {
  const navigate = useNavigate()
  const { deleteAccount } = useProfileStore()
  const { user, signOut } = useAuthStore()

  const [selectedReason, setSelectedReason] = useState(DELETION_REASONS[0].id)
  const [explanation, setExplanation] = useState('')
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedReason) {
      setError('Por favor seleccioná el motivo principal de tu baja.')
      return
    }

    if (!explanation.trim() || explanation.trim().length < 5) {
      setError('Por favor ingresá una breve explicación o comentario (mínimo 5 caracteres). Nos ayuda a mejorar el servicio.')
      return
    }

    if (!confirmChecked) {
      setError('Por favor marcá la casilla confirmando que deseás eliminar tu perfil.')
      return
    }

    setLoading(true)
    const res = await deleteAccount(profileId, {
      reason: selectedReason,
      explanation: explanation.trim(),
      userEmail: user?.email || undefined,
    })

    if (res.error) {
      setLoading(false)
      setError(res.error)
      return
    }

    // Sign out and redirect
    await signOut()
    setLoading(false)
    onClose()
    navigate('/?cuenta_eliminada=1')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-rose-200 bg-[var(--color-laburante-surface)] p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)] transition-colors"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
            <Trash2 size={24} />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-rose-950">
              Dar de baja perfil y cuenta
            </h2>
            <p className="text-xs text-[var(--color-laburante-text-secondary)] mt-0.5">
              Perfil: <strong className="text-[var(--color-laburante-text)]">{profileName}</strong>
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {error}
          </div>
        )}

        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-amber-900">
            <AlertTriangle size={14} className="text-amber-700 shrink-0" />
            Esta acción dará de baja tu perfil público
          </p>
          <p className="text-[11px] leading-relaxed text-amber-800">
            Dejarás de aparecer en los resultados de búsqueda y tus datos de contacto serán retirados. Si solo querés descansar o tenés mucho trabajo, recordá que podés configurar tu perfil en modo <strong>Privado / Pausado</strong> en lugar de darlo de baja.
          </p>
        </div>

        <form onSubmit={handleDelete} className="space-y-4">
          {/* Radio Reasons */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[var(--color-laburante-text)]">
              ¿Por qué decidís darte de baja? <span className="text-rose-600">*</span>
            </label>
            <div className="space-y-1.5">
              {DELETION_REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                    selectedReason === r.id
                      ? 'border-rose-300 bg-rose-50/50 font-semibold text-rose-950'
                      : 'border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-secondary)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="deletionReason"
                    value={r.id}
                    checked={selectedReason === r.id}
                    onChange={() => setSelectedReason(r.id)}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Detailed explanation textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[var(--color-laburante-text)]">
              Detalle / Explicación adicional <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Contanos un poco más para ayudarnos a entender qué podríamos haber hecho mejor o qué te faltó..."
              required
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-transparent focus:ring-2 focus:ring-rose-500 resize-none leading-relaxed"
            />
            <p className="text-[10px] text-[var(--color-laburante-text-muted)]">
              Tu respuesta queda guardada en el panel del equipo para auditoría interna y mejora de la plataforma.
            </p>
          </div>

          {/* Confirmation Checkbox */}
          <div className="pt-2 border-t border-[var(--color-laburante-border)]">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[var(--color-laburante-text)]">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                required
              />
              <span className="leading-snug">
                Confirmo que deseo dar de baja definitiva mi perfil en LABURANTE y cerrar mi sesión.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-3 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="py-3 px-5 rounded-xl border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] text-center order-2 sm:order-1"
            >
              Cancelar y volver
            </button>

            <button
              type="submit"
              disabled={loading || !confirmChecked || explanation.trim().length < 5}
              className="flex-1 py-3 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-heading font-bold text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-40 order-1 sm:order-2 shadow-xs transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Procesando baja...</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>Confirmar baja definitiva</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
