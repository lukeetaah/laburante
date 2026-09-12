import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, ArrowRight, BadgeCheck, Building2, Check, ExternalLink, Globe, Inbox, LockKeyhole, Mail, MessageCircle, Phone, RefreshCw, Search, Send, Users } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import { isCompanyAccount } from '@/lib/account'
import { SITE_CONFIG } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { dedupeContactMethods } from '@/lib/contact-methods'
import { useNotificationStore } from '@/stores/notification-store'

type Opportunity = { id: string; title: string; description: string; status: string; created_at: string }

const getContactActionUrl = (method: any, profileName: string) => {
  const value = String(method?.value || '').trim()
  if (!value) return null
  if (method.type === 'whatsapp') {
    const cleaned = value.replace(/\D/g, '')
    if (!cleaned) return null
    const number = cleaned.startsWith('54') ? cleaned : `549${cleaned}`
    return `https://wa.me/${number}?text=Hola%20${encodeURIComponent(profileName)},%20te%20contacto%20a%20trav%C3%A9s%20de%20LABURANTE.`
  }
  if (method.type === 'telefono') return `tel:${value.replace(/\s+/g, '')}`
  if (method.type === 'email') return `mailto:${value}?subject=Contacto%20desde%20LABURANTE`
  if (method.type === 'instagram') {
    const handle = value.replace(/^@/, '').replace(/[^a-zA-Z0-9._]/g, '')
    return handle ? `https://instagram.com/${handle}` : null
  }
  if (['linkedin', 'web', 'portfolio'].includes(method.type)) {
    try {
      const normalized = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`
      const parsed = new URL(normalized)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
    } catch {
      return null
    }
  }
  return null
}

const getContactLabel = (type: string) => ({
  whatsapp: 'WhatsApp', telefono: 'Llamar', email: 'Correo electrónico', instagram: 'Instagram', linkedin: 'LinkedIn', web: 'Sitio web', portfolio: 'Portfolio',
}[type] || 'Contacto')

const getContactIcon = (type: string) => {
  if (type === 'whatsapp') return <MessageCircle size={15} />
  if (type === 'telefono') return <Phone size={15} />
  if (type === 'email') return <Mail size={15} />
  if (type === 'web' || type === 'portfolio' || type === 'linkedin') return <Globe size={15} />
  return <ExternalLink size={15} />
}

const isArchivedInquiry = (item: any) => Boolean(item?.archived_at) || item?.status === 'cerrada'

export default function CompanyWorkspace() {
  const user = useAuthStore((state) => state.user)
  const { myProfile, fetchMyProfile } = useProfileStore()
  const isCompany = isCompanyAccount(user, myProfile)
  const profileLoaded = myProfile?.id === user?.id
  const profilePlan = profileLoaded ? myProfile?.company_plan : undefined
  const isPaidCompany = profilePlan === 'pago'
  const companyName = user?.user_metadata?.name || 'Tu empresa'
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [incoming, setIncoming] = useState<any[]>([])
  const [candidateInquiries, setCandidateInquiries] = useState<any[]>([])
  const [showArchivedCandidates, setShowArchivedCandidates] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [originPlatform, setOriginPlatform] = useState('')
  const [originNote, setOriginNote] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [message, setMessage] = useState('')
  const [archiveMessage, setArchiveMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const loadOpportunities = async () => {
    if (!user) return
    const [own, shared, inquiries] = await Promise.all([
      (supabase.from('company_opportunities') as any).select('*').eq('source_company_id', user.id).order('created_at', { ascending: false }),
      (supabase.from('company_opportunity_shares') as any).select('id, source_company_id, status, match_reason, created_at, company_opportunities(title, description, budget_amount, estimated_time, origin_platform, origin_note, localidad, provincia)').eq('recipient_company_id', user.id).order('created_at', { ascending: false }),
      (supabase.from('company_candidate_inquiries') as any).select('*').eq('company_id', user.id).order('created_at', { ascending: false }),
    ])
    if (!own.error) setOpportunities(own.data || [])
    if (!shared.error) setIncoming(shared.data || [])
    if (!inquiries.error) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const staleIds = (inquiries.data || []).filter((item: any) => item.status === 'pendiente' && !isArchivedInquiry(item) && new Date(item.created_at) < today).map((item: any) => item.id)
      if (staleIds.length) await (supabase.from('company_candidate_inquiries') as any).update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', staleIds).eq('company_id', user.id)
      const normalized = (inquiries.data || []).map((item: any) => staleIds.includes(item.id) ? { ...item, archived_at: new Date().toISOString() } : item)
      const profileIds = normalized.map((item: any) => item.profile_id)
      const acceptedProfileIds = normalized.filter((item: any) => item.status === 'aceptada').map((item: any) => item.profile_id)
      const { data: profiles } = profileIds.length ? await (supabase.from('profiles') as any).select('id, name, slug, localidad, provincia').in('id', profileIds) : { data: [] }
      const { data: contactMethods } = acceptedProfileIds.length ? await (supabase.from('contact_methods') as any).select('profile_id, type, value, is_public').in('profile_id', acceptedProfileIds).eq('is_public', true) : { data: [] }
      const byId = new Map((profiles || []).map((profile: any) => [profile.id, profile]))
      const contactsByProfile = new Map<string, any[]>()
      ;(contactMethods || []).forEach((method: any) => {
        const methods = contactsByProfile.get(method.profile_id) || []
        methods.push(method)
        contactsByProfile.set(method.profile_id, dedupeContactMethods(methods))
      })
      setCandidateInquiries(normalized.map((item: any) => ({
        ...item,
        profile: { ...(byId.get(item.profile_id) || {}), contact_methods: contactsByProfile.get(item.profile_id) || [] },
      })))
    }
  }

  useEffect(() => {
    if (user) fetchMyProfile()
    loadOpportunities()
  }, [user, fetchMyProfile])

  if (!user) return <div className="container py-20 text-center space-y-4"><Building2 className="mx-auto text-[var(--color-laburante-indigo)]" size={32} /><h1 className="font-heading text-2xl font-bold">Ingresá para ver tu espacio Empresa</h1><Link to="/registrar?tipo=empresa" className="btn-dark inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">Crear cuenta Empresa <ArrowRight size={16} /></Link></div>
  if (!isCompany) return <div className="container py-20 text-center space-y-4"><h1 className="font-heading text-2xl font-bold">Esta sección es para cuentas Empresa</h1><Link to="/empresas" className="text-sm font-semibold text-[var(--color-laburante-indigo)]">Conocé las opciones para empresas</Link></div>

  const publishOpportunity = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isPaidCompany) return setMessage('Esta herramienta requiere coordinar previamente la activación. Escribinos para conocer el producto.')
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

  const archiveCandidateInquiry = async (inquiryId: string) => {
    const archivedAt = new Date().toISOString()
    const query = (supabase.from('company_candidate_inquiries') as any).update({ archived_at: archivedAt, updated_at: archivedAt }).eq('id', inquiryId).eq('company_id', user.id)
    const { data: archived, error } = await query.select('id, archived_at').maybeSingle()
    if (!error && archived) {
      setCandidateInquiries((items) => items.map((item) => item.id === inquiryId ? { ...item, archived_at: archivedAt } : item))
      setArchiveMessage('')
      return
    }
    // Compatibilidad con instalaciones que aún no aplicaron la columna archived_at.
    const fallback = await (supabase.from('company_candidate_inquiries') as any).update({ status: 'cerrada', updated_at: archivedAt }).eq('id', inquiryId).eq('company_id', user.id).select('id').maybeSingle()
    if (!fallback.error && fallback.data) {
      setCandidateInquiries((items) => items.map((item) => item.id === inquiryId ? { ...item, status: 'cerrada', archived_at: archivedAt } : item))
      setArchiveMessage('')
      return
    }
    setArchiveMessage('No se pudo archivar este proceso. Verificá que la migración de selección Empresa esté aplicada en Supabase.')
  }

  return <div className="container py-10 md:py-16 space-y-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-laburante-indigo)]"><Building2 size={15} /> Espacio Empresa</p><h1 className="mt-2 font-heading text-3xl font-extrabold text-[var(--color-laburante-text)]">Hola, {companyName}</h1><p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-laburante-text-secondary)]">Tu cuenta está lista para buscar profesionales.<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${isPaidCompany ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>{profileLoaded ? `Plan ${isPaidCompany ? 'Pago activo' : 'Gratis'}` : 'Verificando plan'}</span></p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={loadOpportunities} className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-white px-4 py-3 text-xs font-bold" title="Actualizar actividad" aria-label="Actualizar actividad"><RefreshCw size={15} /> Actualizar</button><Link to="/buscar" className="btn-dark inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"><Search size={16} /> Empezar a buscar</Link></div></div>
    <section className={`rounded-2xl border p-5 sm:p-6 ${isPaidCompany ? 'border-amber-300 bg-amber-50/70' : 'border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]'}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${isPaidCompany ? 'text-amber-800' : 'text-[var(--color-laburante-text-muted)]'}`}>
            {isPaidCompany ? <BadgeCheck size={16} /> : <LockKeyhole size={15} />}
            {isPaidCompany ? 'Activación habilitada por Administración' : 'Plan Gratis activo'}
          </p>
          <h2 className="mt-2 font-heading text-xl font-extrabold text-[var(--color-laburante-text)]">
            {isPaidCompany ? 'Tu empresa puede mover oportunidades' : 'Empezá sin costo y activá capacidad cuando la necesites'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">
            {isPaidCompany
              ? 'Tenés habilitada la publicación de oportunidades, la derivación a empresas similares y el seguimiento desde este espacio.'
              : 'La cuenta nueva siempre arranca en Gratis. Podés buscar, guardar perfiles y proponer entrevistas; las herramientas adicionales se coordinan después de una entrevista.'}
          </p>
        </div>
        <div className="grid w-full gap-2 text-xs sm:grid-cols-3 lg:max-w-xl">
          {(isPaidCompany
            ? ['Publicar oportunidades', 'Derivar a empresas similares', 'Seguimiento centralizado']
            : ['Buscar profesionales', 'Guardar perfiles', 'Proponer entrevistas']).map((feature) => (
            <div key={feature} className={`rounded-xl border px-3 py-3 font-semibold ${isPaidCompany ? 'border-amber-200 bg-white/80 text-amber-950' : 'border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-secondary)]'}`}>
              <Check size={14} className="mb-1 text-emerald-600" />{feature}
            </div>
          ))}
        </div>
      </div>
    </section>
    <div className="grid gap-5 md:grid-cols-3"><article className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6"><Search className="text-[var(--color-laburante-indigo)]" size={22} /><h2 className="mt-4 font-heading font-bold">Búsqueda real</h2><p className="mt-2 text-sm text-[var(--color-laburante-text-secondary)]">Usá la búsqueda pública y revisá también los idiomas declarados en cada perfil.</p></article><article className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6"><Users className="text-[var(--color-laburante-indigo)]" size={22} /><h2 className="mt-4 font-heading font-bold">Red de empresas</h2><p className="mt-2 text-sm text-[var(--color-laburante-text-secondary)]">Cuando una búsqueda no encuentra respuesta, podés derivarla a empresas similares.</p></article><article className="rounded-2xl border border-amber-300 bg-amber-50/50 p-6"><Check className="text-emerald-600" size={22} /><h2 className="mt-4 font-heading font-bold">Sin spam</h2><p className="mt-2 text-sm text-[var(--color-laburante-text-secondary)]">Solo se comparte el pedido entre cuentas Empresa, sin exponer contactos ni datos privados.</p></article></div>
     {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{message}</div>}
     {archiveMessage && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{archiveMessage}</div>}
     {candidateInquiries.length > 0 && <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Users size={18} className="text-indigo-700" /><div><h2 className="font-heading text-xl font-bold text-indigo-950">Procesos de selección</h2><p className="mt-1 text-xs text-indigo-900/75">Acá encontrás todas las propuestas enviadas a LABURANTEs y sus respuestas. Las pendientes de días anteriores se archivan automáticamente.</p></div></div><div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase"><span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Pendientes: {candidateInquiries.filter((item) => item.status === 'pendiente' && !isArchivedInquiry(item)).length}</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Aceptadas: {candidateInquiries.filter((item) => item.status === 'aceptada' && !isArchivedInquiry(item)).length}</span><button type="button" onClick={() => setShowArchivedCandidates((value) => !value)} className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-2 py-1 text-indigo-800"><Archive size={12} /> {showArchivedCandidates ? 'Ocultar archivadas' : 'Ver archivadas'}</button></div></div><div className="mt-4 space-y-3">{candidateInquiries.filter((item) => showArchivedCandidates || !isArchivedInquiry(item)).map((item) => { const profileName = item.profile?.name || 'LABURANTE'; const authorizedContacts = item.profile?.contact_methods || []; return <article key={item.id} className="rounded-xl border border-indigo-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold text-[var(--color-laburante-text)]">{profileName} · {item.process_type === 'entrevista' ? 'Entrevista' : 'Contratación'}</p><p className="mt-1 text-xs text-[var(--color-laburante-text-secondary)]">Enviada el {new Date(item.created_at).toLocaleDateString('es-AR')} · {item.profile?.localidad || item.profile?.provincia || 'Ubicación no informada'}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${item.status === 'pendiente' ? 'bg-amber-100 text-amber-800' : item.status === 'aceptada' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>{item.status}{isArchivedInquiry(item) ? ' · archivada' : ''}</span></div>{item.message && <p className="mt-2 text-xs text-[var(--color-laburante-text-secondary)]">{item.message}</p>}{item.status === 'aceptada' && !isArchivedInquiry(item) && <><p className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-800">La persona aceptó conversar. Ya podés coordinar la entrevista o completar el alta de proveedor y la orden de compra según tu circuito.</p><div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"><p className="text-xs font-bold text-emerald-950">Canales autorizados para coordinar</p>{authorizedContacts.length === 0 ? <p className="mt-1 text-xs text-emerald-900/80">Aceptó la propuesta, pero todavía no autorizó canales públicos de contacto.</p> : <div className="mt-2 flex flex-wrap gap-2">{authorizedContacts.map((method: any) => { const href = getContactActionUrl(method, profileName); if (!href) return null; const external = href.startsWith('http'); return <a key={`${method.type}-${method.value}`} href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-900 hover:border-emerald-500">{getContactIcon(method.type)} {getContactLabel(method.type)}{external && <ExternalLink size={12} />}</a> })}</div>}<p className="mt-2 text-[10px] text-emerald-900/70">Solo se muestran los medios que el LABURANTE autorizó públicamente.</p></div></>} {!isArchivedInquiry(item) && <button type="button" onClick={() => archiveCandidateInquiry(item.id)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700" title="Archivar proceso"><Archive size={14} /> Archivar</button>}</article> })}</div></section>}
    <section className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
      <form onSubmit={publishOpportunity} className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 space-y-4">
        <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700"><Send size={15} /> Publicar una idea o necesidad</p><h2 className="mt-2 font-heading text-xl font-bold">Que la oportunidad siga circulando</h2><p className="mt-1 text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]">Describí qué necesitás, qué podés pagar y para cuándo. LABURANTE lo ofrece a personas y empresas similares por zona.</p></div>
        {!isPaidCompany && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><strong>¿Necesitás más herramientas?</strong> La cuenta Gratis permite buscar, guardar perfiles y proponer entrevistas. <a href={`https://wa.me/${SITE_CONFIG.officialWhatsApp}?text=${encodeURIComponent(`Hola LABURANTE, quiero coordinar una entrevista para conocer el producto de Empresa.`)}`} target="_blank" rel="noopener noreferrer" className="font-bold underline">Quiero que me contacten</a></div>}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Necesitamos una fotógrafa para dos jornadas" className="w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué necesitás, para cuándo y qué experiencia buscás..." rows={4} className="w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm" />
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Presupuesto disponible (opcional)<input value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="Ej: $150.000 o a definir" className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm font-normal" /></label><label className="text-xs font-semibold">Plazo estimado (opcional)<input value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} placeholder="Ej: 2 jornadas" className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm font-normal" /></label></div>
        <label className="block text-xs font-semibold">¿Viene de otra plataforma o búsqueda que no funcionó?<input value={originPlatform} onChange={(e) => setOriginPlatform(e.target.value)} placeholder="Opcional: nombre de la plataforma" className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm font-normal" /></label>
        {originPlatform && <textarea value={originNote} onChange={(e) => setOriginNote(e.target.value)} placeholder="Qué falló o qué necesitás distinto ahora" rows={2} className="w-full rounded-xl border border-[var(--color-laburante-border)] px-3.5 py-2.5 text-sm" />}
        <button disabled={loading || !isPaidCompany} className="btn-dark inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-60">{loading ? 'Publicando...' : isPaidCompany ? 'Publicar y derivar oportunidad' : 'Disponible tras coordinar'} <ArrowRight size={15} /></button>
      </form>
    <div className="space-y-4"><div className="flex items-center gap-2"><Inbox size={18} className="text-[var(--color-laburante-indigo)]" /><h2 className="font-heading text-xl font-bold">Oportunidades recibidas</h2></div>{incoming.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--color-laburante-border)] p-8 text-center text-xs text-[var(--color-laburante-text-secondary)]">Todavía no recibiste derivaciones de otras empresas.</div> : incoming.map((item) => <article key={item.id} className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-heading font-bold">{item.company_opportunities?.title}</h3><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-indigo-700">{item.status}</span></div><p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">{item.company_opportunities?.description}</p>{(item.company_opportunities?.budget_amount || item.company_opportunities?.estimated_time) && <p className="mt-2 text-xs font-semibold text-emerald-800">{item.company_opportunities?.budget_amount ? `Presupuesto: ${item.company_opportunities.budget_amount}` : 'Presupuesto a definir'}{item.company_opportunities?.estimated_time ? ` · Plazo: ${item.company_opportunities.estimated_time}` : ''}</p>}<p className="mt-2 text-[11px] font-semibold text-indigo-800">{item.match_reason}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => updateIncoming(item.id, 'interesada')} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white">Me interesa</button><button type="button" onClick={() => updateIncoming(item.id, 'descartada')} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-900">Descartar</button></div></article>)}</div>
    </section>
    <div className="rounded-2xl bg-[var(--color-laburante-text)] p-6 text-white sm:p-8"><h2 className="font-heading text-xl font-bold">¿Querés conocer más posibilidades?</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">Escribinos por WhatsApp con el nombre de tu empresa y el volumen de búsquedas. Coordinamos una entrevista para mostrarte el producto.</p><a href={`https://wa.me/${SITE_CONFIG.officialWhatsApp}?text=${encodeURIComponent(`Hola LABURANTE, soy ${companyName} y quiero coordinar una entrevista para conocer el producto de Empresa.`)}`} target="_blank" rel="noopener noreferrer" className="btn-amber mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">Coordinar una entrevista <ArrowRight size={16} /></a></div>
  </div>
}
