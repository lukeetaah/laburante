import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Clock3, FileImage, LifeBuoy, Loader2, LockKeyhole, Send, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS, hasSupportedImageSignature, isSupportedImageMime, validateSupportTicketInput, SUPPORT_MAX_ATTACHMENT_BYTES, supportUploadErrorMessage } from '@/lib/support'

type Ticket = Record<string, any>

const statusClass: Record<string, string> = {
  nuevo: 'bg-amber-100 text-amber-800',
  en_revision: 'bg-indigo-100 text-indigo-800',
  esperando_usuario: 'bg-violet-100 text-violet-800',
  resuelto: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-slate-100 text-slate-700',
  suspendido: 'bg-rose-100 text-rose-800',
}

export default function Support() {
  const user = useAuthStore((state) => state.user)
  const [searchParams] = useSearchParams()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Ticket[]>([])
  const [uploadRequest, setUploadRequest] = useState<Ticket | null>(null)
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadTickets = async (preferredId?: string) => {
    if (!user) return
    setLoading(true)
    const { data, error: queryError } = await supabase.from('support_tickets').select('id,case_number,title,initial_message,status,category,priority,user_unread,created_at,updated_at,last_activity_at').order('last_activity_at', { ascending: false })
    if (queryError) setError('No se pudieron cargar tus casos. El servicio de soporte puede estar actualizándose.')
    const rows = data || []
    setTickets(rows)
    const targetId = preferredId || searchParams.get('caso') || selected?.id || rows[0]?.id
    const target = rows.find((row) => row.id === targetId) || null
    setSelected(target)
    setLoading(false)
    if (target) await loadTicket(target)
  }

  const loadTicket = async (ticket: Ticket) => {
    setSelected(ticket)
    setAttachmentUrl(null)
    const [{ data: messageRows }, { data: requestRows }, { data: attachmentRows }] = await Promise.all([
      supabase.from('support_messages').select('id,content,created_at,read_at').eq('ticket_id', ticket.id).order('created_at', { ascending: true }),
      supabase.from('support_upload_requests').select('id,status,expires_at,created_at').eq('ticket_id', ticket.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('support_attachments').select('id,storage_path,original_name,mime_type,size_bytes,created_at').eq('ticket_id', ticket.id).order('created_at', { ascending: false }).limit(1),
    ])
    setMessages(messageRows || [])
    const request = requestRows?.[0] || null
    setUploadRequest(request && request.status === 'vigente' && new Date(request.expires_at).getTime() > Date.now() ? request : null)
    const attachment = attachmentRows?.[0]
    if (attachment) {
      const signed = await supabase.storage.from('support-attachments').createSignedUrl(attachment.storage_path, 300)
      if (!signed.error) setAttachmentUrl(signed.data.signedUrl)
    }
    if (ticket.user_unread) await supabase.rpc('mark_my_support_ticket_read', { p_ticket_id: ticket.id })
    setTickets((current) => current.map((row) => row.id === ticket.id ? { ...row, user_unread: false } : row))
  }

  useEffect(() => { void loadTickets() }, [user?.id])

  const activeTicket = useMemo(() => tickets.find((ticket) => ['nuevo', 'en_revision', 'esperando_usuario'].includes(ticket.status)), [tickets])

  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null); setNotice(null)
    const input = validateSupportTicketInput(title, message)
    if (!input.valid) { setError(input.errors[0]); return }
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc('create_support_ticket', { p_title: input.title, p_initial_message: input.message })
    setSaving(false)
    if (rpcError) { setError(rpcError.message.includes('activo') ? 'Ya tenés un caso activo. Podés ver su estado en esta misma pantalla.' : rpcError.message); return }
    setTitle(''); setMessage(''); setNotice('Tu caso fue creado. El equipo te responderá desde este mismo caso.')
    await loadTickets(data?.id)
  }

  const uploadAttachment = async () => {
    if (!file || !selected || !uploadRequest) return
    setError(null); setNotice(null)
    if (!isSupportedImageMime(file.type) || file.size > SUPPORT_MAX_ATTACHMENT_BYTES) { setError('Elegí una imagen PNG, JPEG o WebP de hasta 5 MB.'); return }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!hasSupportedImageSignature(bytes, file.type)) { setError('El contenido del archivo no coincide con su tipo de imagen.'); return }
    setUploading(true)
    const form = new FormData()
    form.append('ticket_id', selected.id)
    form.append('upload_request_id', uploadRequest.id)
    form.append('file', file)
    const { error: invokeError } = await supabase.functions.invoke('support-upload-attachment', { body: form })
    setUploading(false)
    if (invokeError) {
      let code: string | null = null
      const context = (invokeError as any)?.context
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json()
          code = typeof body?.error === 'string' ? body.error : null
        } catch {
          // La respuesta puede no contener JSON; se conserva un mensaje seguro.
        }
      }
      const status = typeof context?.status === 'number' ? context.status : undefined
      setError(supportUploadErrorMessage(code, status))
      return
    }
    setFile(null); setUploadRequest(null); setNotice('La imagen fue adjuntada de forma privada al caso.')
    await loadTickets(selected.id)
  }

  if (!user) {
    return <main className="container py-12"><div className="mx-auto max-w-xl rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-8 text-center shadow-sm"><LifeBuoy className="mx-auto text-indigo-600" size={36} /><h1 className="mt-4 font-heading text-2xl font-bold">Solicitar soporte</h1><p className="mt-2 text-sm text-[var(--color-laburante-text-secondary)]">Iniciá sesión para crear y consultar tus casos.</p><Link className="btn-dark mt-6 inline-flex rounded-xl px-5 py-3 text-sm font-semibold" to="/ingresar">Ingresar</Link></div></main>
  }

  return (
    <main className="container py-8 sm:py-12">
      <div className="mb-8 flex items-start gap-3"><div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700"><LifeBuoy size={24} /></div><div><h1 className="font-heading text-2xl font-bold text-[var(--color-laburante-text)] sm:text-3xl">Solicitar soporte</h1><p className="mt-1 max-w-2xl text-sm text-[var(--color-laburante-text-secondary)]">Creá un caso para que el equipo pueda ayudarte. Cada caso comienza con un único mensaje y conserva todo el historial.</p></div></div>
      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={17} />{error}</div>}
      {notice && <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={17} />{notice}</div>}
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]">
        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-heading font-bold">Mis casos</h2>{loading && <Loader2 className="animate-spin text-indigo-600" size={16} />}</div>
          {tickets.length === 0 && !loading ? <p className="rounded-2xl bg-[var(--color-laburante-surface-alt)] p-4 text-xs text-[var(--color-laburante-text-secondary)]">Todavía no tenés casos.</p> : <div className="space-y-2">{tickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => void loadTicket(ticket)} className={`w-full rounded-2xl border p-3 text-left transition-colors ${selected?.id === ticket.id ? 'border-indigo-300 bg-indigo-50' : 'border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)]'}`}><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-indigo-700">{ticket.case_number}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass[ticket.status] || statusClass.cancelado}`}>{SUPPORT_STATUS_LABELS[ticket.status as keyof typeof SUPPORT_STATUS_LABELS]}</span></div><p className="mt-1 truncate text-sm font-semibold">{ticket.title}</p>{ticket.user_unread && <span className="mt-2 inline-block text-[10px] font-bold text-rose-600">Respuesta nueva</span>}</button>)}</div>}
          {!activeTicket && <button type="button" onClick={() => document.getElementById('new-support-ticket')?.scrollIntoView({ behavior: 'smooth' })} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white"><Send size={14} />Nuevo caso</button>}
        </section>

        <section className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5 shadow-sm">
          {!selected ? <div className="py-12 text-center text-sm text-[var(--color-laburante-text-secondary)]">Seleccioná un caso o creá uno nuevo.</div> : <><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-laburante-border)] pb-4"><div><p className="text-xs font-bold text-indigo-700">{selected.case_number}</p><h2 className="mt-1 font-heading text-xl font-bold">{selected.title}</h2><p className="mt-1 text-xs text-[var(--color-laburante-text-secondary)]">{SUPPORT_CATEGORY_LABELS[selected.category as keyof typeof SUPPORT_CATEGORY_LABELS] || 'Soporte'} · creado {new Date(selected.created_at).toLocaleDateString()}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[selected.status] || statusClass.cancelado}`}>{SUPPORT_STATUS_LABELS[selected.status as keyof typeof SUPPORT_STATUS_LABELS]}</span></div><div className="space-y-4 py-5"><div className="rounded-2xl bg-[var(--color-laburante-surface-alt)] p-4"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-laburante-text-muted)]">Mensaje inicial</p><p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.initial_message}</p></div>{messages.map((item) => <div key={item.id} className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">Respuesta del equipo · {new Date(item.created_at).toLocaleString()}</p><p className="whitespace-pre-wrap text-sm leading-relaxed">{item.content}</p></div>)}{attachmentUrl && <a href={attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 hover:underline"><FileImage size={15} />Ver imagen adjunta de forma segura</a>}</div>{uploadRequest && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-sm font-bold text-amber-900"><Upload size={16} />El equipo solicitó una imagen</p><p className="mt-1 text-xs text-amber-800">La autorización es de un solo uso y vence el {new Date(uploadRequest.expires_at).toLocaleString()}.</p><div className="mt-3 flex flex-wrap items-center gap-2"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} className="max-w-full text-xs" /><button type="button" disabled={!file || uploading} onClick={() => void uploadAttachment()} className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}Adjuntar</button></div></div>}<div className="flex items-center gap-2 text-xs text-[var(--color-laburante-text-muted)]"><LockKeyhole size={14} />Este caso no admite mensajes adicionales del usuario.</div></>}
        </section>
      </div>
      {!activeTicket && <form id="new-support-ticket" onSubmit={createTicket} className="mt-5 rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Clock3 className="text-indigo-600" size={18} /><h2 className="font-heading font-bold">Crear un caso</h2><span className="ml-auto text-[11px] text-[var(--color-laburante-text-muted)]">Máximo 3 casos en 24 h</span></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2.5 text-sm" placeholder="¿Con qué necesitás ayuda?" /></label><div className="hidden sm:block" /><label className="text-xs font-semibold sm:col-span-2">Mensaje inicial<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} rows={5} className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2.5 text-sm" placeholder="Contanos qué ocurrió y qué necesitás resolver." /></label></div><div className="mt-3 flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}Crear caso</button></div></form>}
    </main>
  )
}

