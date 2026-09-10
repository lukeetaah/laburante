import { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'

type Props = {
  role: 'cliente' | 'profesional'
  onSubmit: (outcome: string, note: string) => Promise<void>
  onClose?: () => void
  blocking?: boolean
}

const outcomes = [
  ['completado', 'Se realizó y quedó resuelto'],
  ['en_proceso', 'Sigue en proceso'],
  ['no_realizado', 'No se realizó'],
  ['cancelado', 'Se canceló de común acuerdo'],
]

export default function OutcomeModal({ role, onSubmit, onClose, blocking = false }: Props) {
  const [outcome, setOutcome] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!outcome) return
    setSaving(true)
    await onSubmit(outcome, note)
    setSaving(false)
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Cierre del caso</p><h2 className="mt-1 text-xl font-bold">¿Qué sucedió con este trabajo?</h2><p className="mt-2 text-sm text-slate-600">Tu respuesta ayuda a ordenar el historial y mejorar las coincidencias.</p></div>
        {!blocking && onClose && <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>}
      </div>
      <div className="mt-5 grid gap-2">{outcomes.map(([value, label]) => <button key={value} type="button" onClick={() => setOutcome(value)} className={`rounded-xl border p-3 text-left text-sm ${outcome === value ? 'border-indigo-600 bg-indigo-50 font-semibold' : 'border-slate-200'}`}>{label}</button>)}</div>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={role === 'cliente' ? 'Contá brevemente cómo fue (opcional)' : 'Indicá qué se hizo o qué quedó pendiente (opcional)'} className="mt-4 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" />
      <button type="button" disabled={!outcome || saving} onClick={submit} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={16} />{saving ? 'Guardando...' : 'Guardar resultado'}</button>
    </div>
  </div>
}
