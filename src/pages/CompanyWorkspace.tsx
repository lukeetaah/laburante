import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Check, Inbox, Search, Send, Users } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { SITE_CONFIG } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { useNotificationStore } from '@/stores/notification-store'

type Opportunity = { id: string; title: string; description: string; status: string; created_at: string }

export default function CompanyWorkspace() {
  const user = useAuthStore((state) => state.user)
  const isCompany = user?.user_metadata?.account_type === 'empresa'
  const companyName = user?.user_metadata?.name || 'Tu empresa'
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [incoming, setIncoming] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [originPlatform, setOriginPlatform] = useState('')
  const [originNote, setOriginNote] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const loadOpportunities = async () => {
    if (!user) return
    const [own, shared] = await Promise.all([
      (supabase.from('company_opportunities') as any).select('*').eq('source_company_id', user.id).order('created_at', { ascending: false }),
      (supabase.from('company_opportunity_shares') as any).select('id, source_company_id, status, match_reason, created_at, company_opportunities(title, description, budget_amount, estimated_time, origin_platform, origin_note, localidad, provincia)').eq('recipient_company_id', user.id).order('created_at', { ascending: false }),
    ])
    if (!own.error) setOpportunities(own.data || [])
    if (!shared.error) setIncoming(shared.data || [])
  }

  useEffect(() => { loadOpportunities() }, [user])

  if (!user) return <div className="container py-20 text-center space-y-4"><Building2 className="mx-auto text-[var(--color-laburante-indigo)]" size={32} /><h1 className="font-heading text-2xl font-bold">Ingresá para ver tu espacio Empresa</h1><Link to="/registrar?tipo=empresa" className="btn-dark inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">Crear cuenta Empresa <ArrowRight size={16} /></Link></div>
  if (!isCompany) return <div className="container py-20 text-center space-y-4"><h1 className="font-heading text-2xl font-bold">Esta sección es para cuentas Empresa</h1><Link to="/empresas" className="text-sm font-semibold text-[var(--color-laburante-indigo)]">Conocé las opciones para empresas</Link></div>

  const publishOpportunity = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim() || description.trim().length < 10) return setMessage('Completá un título y una descripción de al menos 10 caracteres.')
    setLoading(true); setMessage('')
    const { data: created, error } = await (supabase.from('company_opportunities') as any).insert({
      source_company_id: user.id, title: title.trim(), description: description.trim(),
      provincia: user.user_metadata?.provincia || null, localidad: user.user_metadata?.localidad || null,
      origin_platform: originPlatform.trim() || null, origin_note: originNote.trim() || null,
      budget_amount: budgetAmount.trim() || null, estimated_time: estimatedTime.trim() || null,
    }).select('id').single()
    if (error || !created) { setLoading(false); setMessage(error?.message || 'No se pudo publicar. Aplicá la migración de oportunidades.'); return }
    const { data: companies } = await (supabase.from('profiles') as any).select('id, provincia').eq('account_type', 'empresa').neq('id', user.id).eq('status', 'oculto')
    const recipients = (companies || []).map((company: any) => ({
      opportunity_id: created.id, source_company_id: user.id, recipient_company_id: company.id,
      match_reason: company.provincia === user.user_metadata?.provincia ? 'Empresa de la misma provincia' : 'Empresa dentro de la red LABURANTE',
    }))
    if (recipients.length) await (supabase.from('company_opportunity_shares') as any).upsert(recipients, { onConflict: 'opportunity_id,recipient_company_id' })
    await Promise.all(recipients.map((recipient: any) => useNotificationStore.getState().addNotification({
      userId: recipient.recipient_company_id,
      title: 'Nueva oportunidad en tu red',
      message: `${title.trim()} fue derivada a tu empresa porque puede ser relevante para tu zona o actividad.${budgetAmount.trim() ? ` Presupuesto informado: ${budgetAmount.trim()}.` : ''}`,
      type: 'job',
      link: '/empresa',
    })))
    setTitle(''); setDescription(''); setOriginPlatform(''); setOriginNote(''); setBudgetAmount(''); setEstimatedTime(''); setLoading(false)
    setMessage(recipients.length ? `Oportunidad publicada y enviada a ${recipients.length} empresas similares.` : 'Oportunidad publicada. Se ofrecerá a nuevas empresas similares cuando entren a la red.')
    loadOpportunities()
  }

  const updateIncoming = async (id: string, status: 'vista' | 'interesada' | 'descartada') => {
    const item = incoming.find((candidate) => candidate.id === id)
    const { error } = await (supabase.from('company_opportunity_shares') as any).update({ status }).eq('id', id)
    if (error) return setMessage('No se pudo actualizar la oportunidad. Intentá nuevamente.')
    setIncoming((items) => items.map((item) => item.id === id ? { ...item, status } : item))
    if (item?.source_company_id && item.source_company_id !== user.id && status !== 'vista') {
      await useNotificationStore.getState().addNotification({
        userId: item.source_company_id,
        title: status === 'interesada' ? 'Una empresa mostró interés' : 'Una empresa descartó tu oportunidad',
        message: status === 'interesada'
          ? `La empresa recibió “${item.company_opportunities?.title || 'tu oportunidad'}” y quiere evaluarla.`
          : `La empresa no avanzó con “${item.company_opportunities?.title || 'tu oportunidad'}”. La red puede seguir encontrando empresas similares.`,
        type: 'status',
        link: '/empresa',
      })
    }
  }

  return <div className="container py-10 md:py-16 space-y-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-laburante-indigo)]"><Building2 size={15} /> Espacio Empresa</p><h1 className="mt-2 font-heading text-3xl font-extrabold text-[var(--color-laburante-text)]">Hola, {companyName}</h1><p className="mt-1 text-sm text-[var(--color-laburante-text-secondary)]">Tu cuenta está lista para buscar profesionales.</p></div><Link to="/buscar" className="btn-dark inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"><Search size={16} /> Empezar a buscar</Link></div>
    <div className="grid gap-5 md:grid-cols-3"><article className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6"><Search className="text-[var(--color-laburante-indigo)]" size={22} /><h2 className="mt-4 font-heading font-bold">Búsqueda real</h2><p className="mt-2 text-sm text-[var(--color-laburante-text-secondary)]">Usá la búsqueda pública y revisá también los idiomas declarados en cada perfil.</p></article><article className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6"><Users className="text-[var(--color-laburante-indigo)]" size={22} /><h2 className="mt-4 font-heading font-bold">Red de empresas</h2><p className="mt-2 text-sm text-[var(--color-laburante-text-secondary)]">Cuando una búsqueda no encuentra respuesta, podés derivarla a empresas similares.</p></article><article className="rounded-2xl border border-amber-300 bg-amber-50/50 p-6"><Check className="text-emerald-600" size={22} /><h2 className="mt-4 font-heading font-bold">Sin spam</h2><p className="mt-2 text-sm text-[var(--color-laburante-text-secondary)]">Solo se comparte el pedido entre cuentas Empresa, sin exponer contactos ni datos privados.</p></article></div>
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{message}</div>}
    <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
      <form onSubmit={publishOpportunity} className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 space-y-4">
        <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700"><Send size={15} /> Publicar una idea o necesidad</p><h2 className="mt-2 font-heading text-xl font-bold">Que la oportunidad siga circulando</h2><p className="mt-1 text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]">Describí qué necesitás, qué podés pagar y para cuándo. LABURANTE lo ofrece a personas y empresas similares por zona.</p></div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Necesitamos una fotógrafa para dos jornadas" className="w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué necesitás, para cuándo y qué experiencia buscás..." rows={4} className="w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm" />
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Presupuesto disponible (opcional)<input value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="Ej: $150.000 o a definir" className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm font-normal" /></label><label className="text-xs font-semibold">Plazo estimado (opcional)<input value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} placeholder="Ej: 2 jornadas" className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm font-normal" /></label></div>
        <label className="block text-xs font-semibold">¿Viene de otra plataforma o búsqueda que no funcionó?<input value={originPlatform} onChange={(e) => setOriginPlatform(e.target.value)} placeholder="Opcional: nombre de la plataforma" className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm font-normal" /></label>
        {originPlatform && <textarea value={originNote} onChange={(e) => setOriginNote(e.target.value)} placeholder="Qué falló o qué necesitás distinto ahora" rows={2} className="w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm" />}
        <button disabled={loading} className="btn-dark inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-60">{loading ? 'Publicando...' : 'Publicar y derivar oportunidad'} <ArrowRight size={15} /></button>
      </form>
    <div className="space-y-4"><div className="flex items-center gap-2"><Inbox size={18} className="text-[var(--color-laburante-indigo)]" /><h2 className="font-heading text-xl font-bold">Oportunidades recibidas</h2></div>{incoming.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--color-laburante-border)] p-8 text-center text-xs text-[var(--color-laburante-text-secondary)]">Todavía no recibiste derivaciones de otras empresas.</div> : incoming.map((item) => <article key={item.id} className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-heading font-bold">{item.company_opportunities?.title}</h3><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-indigo-700">{item.status}</span></div><p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">{item.company_opportunities?.description}</p>{(item.company_opportunities?.budget_amount || item.company_opportunities?.estimated_time) && <p className="mt-2 text-xs font-semibold text-emerald-800">{item.company_opportunities?.budget_amount ? `Presupuesto: ${item.company_opportunities.budget_amount}` : 'Presupuesto a definir'}{item.company_opportunities?.estimated_time ? ` · Plazo: ${item.company_opportunities.estimated_time}` : ''}</p>}<p className="mt-2 text-[11px] font-semibold text-indigo-800">{item.match_reason}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => updateIncoming(item.id, 'interesada')} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white">Me interesa</button><button type="button" onClick={() => updateIncoming(item.id, 'descartada')} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-900">Descartar</button></div></article>)}</div>
    </section>
    <div className="rounded-2xl bg-[var(--color-laburante-text)] p-6 text-white sm:p-8"><h2 className="font-heading text-xl font-bold">¿Querés activar capacidad empresarial?</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">Escribinos por WhatsApp con el nombre de tu empresa y el volumen de búsquedas. Te ayudamos a elegir el plan.</p><a href={`https://wa.me/${SITE_CONFIG.officialWhatsApp}?text=${encodeURIComponent(`Hola LABURANTE, soy ${companyName} y quiero activar un plan Empresa.`)}`} target="_blank" rel="noopener noreferrer" className="btn-amber mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">Solicitar activación <ArrowRight size={16} /></a></div>
  </div>
}
