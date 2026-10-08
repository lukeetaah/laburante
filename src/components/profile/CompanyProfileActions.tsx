import { useEffect, useState } from 'react'
import { Bookmark, Check, FolderPlus, Heart, Plus, Send, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { useNotificationStore } from '@/stores/notification-store'
import { useProfileStore } from '@/stores/profile-store'
import { isCompanyAccount } from '@/lib/account'

interface Props { profileId: string; profileName: string }

export default function CompanyProfileActions({ profileId, profileName }: Props) {
  const user = useAuthStore((state) => state.user)
  const myProfile = useProfileStore((state) => state.myProfile)
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<string[]>([])
  const [newProject, setNewProject] = useState('')
  const [process, setProcess] = useState<'entrevista' | 'contratacion'>('entrevista')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [existingInquiry, setExistingInquiry] = useState<any | null>(null)
  const [refreshAvailable, setRefreshAvailable] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isCompany = isCompanyAccount(user, myProfile)

  useEffect(() => {
    if (!isCompany || !user || !profileId) return
    // Consultar el estado canónico real desde company_shortlists
    ;(supabase.from('company_shortlists') as any)
      .select('id, status, project_id')
      .eq('company_id', user.id)
      .eq('candidate_profile_id', profileId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setSaved(true)
        } else {
          setSaved(false)
        }
      })

    // Cargar proyectos de la empresa desde la base de datos
    ;(supabase.from('company_projects') as any)
      .select('id, name')
      .eq('company_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }: any) => {
        if (data && Array.isArray(data)) {
          setProjects(data.map((p: any) => p.name))
        }
      })
  }, [isCompany, profileId, user])

  useEffect(() => {
    if (!isCompany || !user || !profileId) return
    ;(supabase.from('company_candidate_inquiries') as any)
      .select('id, status, archived_at, process_type, message')
      .eq('company_id', user.id)
      .eq('profile_id', profileId)
      .in('status', ['pendiente', 'aceptada'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        setExistingInquiry(data || null)
        if (data?.process_type) setProcess(data.process_type)
        if (data?.message) setMessage(data.message)
      })
  }, [isCompany, profileId, user])

  if (!isCompany || !user) return null

  const toggleFavorite = async () => {
    if (!user || !profileId) return
    const next = !saved
    setSaved(next)
    try {
      if (next) {
        await (supabase.from('company_shortlists') as any).upsert({
          company_id: user.id,
          candidate_profile_id: profileId,
          status: 'interesante',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id,candidate_profile_id' })
      } else {
        await (supabase.from('company_shortlists') as any)
          .delete()
          .eq('company_id', user.id)
          .eq('candidate_profile_id', profileId)
      }
    } catch (e) {
      console.warn('Error syncing company shortlist:', e)
      setSaved(!next) // revertir si hay error de red
    }
  }

  const addProject = async () => {
    const name = newProject.trim()
    if (!name || !user) return
    try {
      const { data } = await (supabase.from('company_projects') as any)
        .insert({ company_id: user.id, name })
        .select('id, name')
        .single()

      if (data) {
        setProjects((prev) => Array.from(new Set([...prev, data.name])))
        setNewProject('')
        // Asignar al shortlist canónico con project_id
        await (supabase.from('company_shortlists') as any).upsert({
          company_id: user.id,
          candidate_profile_id: profileId,
          project_id: data.id,
          status: 'interesante',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id,candidate_profile_id' })
        setSaved(true)
      }
    } catch (e) {
      console.warn('Error creating company project:', e)
    }
  }

  const proposeNextStep = async () => {
    if (!user || !profileId || isSubmitting) return
    setIsSubmitting(true)
    setFeedback('')
    setRefreshAvailable(false)
    try {
      if (existingInquiry) {
        if (existingInquiry.status === 'aceptada') {
          setFeedback('Ya existe un proceso aceptado con esta persona. Continuá desde el Espacio Empresa para no duplicar el contacto.')
          return
        }
        setFeedback('Ya tenés una propuesta pendiente para esta persona. Podés refrescarla con un nuevo mensaje si todavía sigue vigente.')
        setRefreshAvailable(true)
        return
      }
      const note = message.trim()
      const { data, error } = await (supabase.from('company_candidate_inquiries') as any).insert({
        company_id: user.id,
        profile_id: profileId,
        process_type: process,
        message: note || null,
      }).select('id, created_at, updated_at, process_type, message').single()
      if (error) {
        setFeedback(error.message?.includes('company_candidate_inquiries') ? 'Falta aplicar la migración de selección Empresa en Supabase.' : 'No se pudo enviar la propuesta. Intentá nuevamente.')
        return
      }
      await useNotificationStore.getState().addNotification({
        kind: 'company_candidate_inquiry',
        inquiryId: data.id,
        event: 'created',
        operationAt: data.created_at,
      })
      setFeedback('Propuesta enviada. La persona recibirá el aviso y podrá responderte desde su cuenta.')
      setMessage('')
      setExistingInquiry({ id: data?.id, status: 'pendiente', archived_at: null, process_type: data.process_type, message: data.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const refreshProposal = async () => {
    if (!user || !existingInquiry || existingInquiry.status !== 'pendiente' || isSubmitting) return
    const note = message.trim()
    const prevNote = (existingInquiry.message || '').trim()
    if (process === existingInquiry.process_type && note === prevNote) {
      setFeedback('No se detectaron cambios en la propuesta. Modificá el mensaje o el tipo de proceso para refrescarla.')
      return
    }

    setIsSubmitting(true)
    setFeedback('')
    try {
      const operationAt = new Date().toISOString()
      const { error } = await (supabase.from('company_candidate_inquiries') as any)
        .update({ process_type: process, message: note || null, status: 'pendiente', archived_at: null, updated_at: operationAt })
        .eq('id', existingInquiry.id)
        .eq('company_id', user.id)
      if (error) {
        if (error.message?.includes('content_unchanged')) {
          setFeedback('No hubo modificaciones en el contenido de la propuesta.')
        } else {
          setFeedback('No se pudo refrescar la propuesta. Intentá nuevamente.')
        }
        return
      }
      await useNotificationStore.getState().addNotification({
        kind: 'company_candidate_inquiry',
        inquiryId: existingInquiry.id,
        event: 'refreshed',
        operationAt,
      })
      setFeedback('Propuesta actualizada. La persona recibirá el aviso con los cambios.')
      setExistingInquiry((prev: any) => prev ? { ...prev, process_type: process, message: note || null } : prev)
      setRefreshAvailable(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-indigo-950">Herramientas para tu empresa</p><p className="mt-1 text-[11px] leading-relaxed text-indigo-900/75">Guardá a {profileName} para un proyecto o marcá que te interesa.</p></div><button type="button" onClick={() => setOpen(false)} className="p-1 text-indigo-700" aria-label="Cerrar" hidden={!open}><X size={15} /></button></div>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={toggleFavorite} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-900">{saved ? <Check size={14} /> : <Heart size={14} />} {saved ? 'Guardado' : 'Me interesa'}</button><button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-900"><FolderPlus size={14} /> Agregar a proyecto</button></div>
    <div className="space-y-2 rounded-xl border border-indigo-200 bg-white p-3"><p className="flex items-center gap-1.5 text-xs font-bold text-indigo-950"><Send size={14} /> Iniciar selección directa</p><p className="text-[11px] leading-relaxed text-indigo-900/75">La empresa coordina entrevistas y altas de proveedor por sus propios canales. LABURANTE no emite órdenes de compra ni reemplaza la aprobación interna.</p><div className="grid gap-2 sm:grid-cols-2"><select value={process} onChange={(e) => setProcess(e.target.value as 'entrevista' | 'contratacion')} disabled={isSubmitting} className="rounded-lg border border-[var(--color-laburante-border)] px-2.5 py-2 text-xs disabled:opacity-50"><option value="entrevista">Proponer entrevista</option><option value="contratacion">Conversar contratación</option></select><button type="button" onClick={proposeNextStep} disabled={isSubmitting} className="rounded-lg bg-indigo-700 disabled:opacity-50 px-3 py-2 text-xs font-bold text-white transition-opacity">{isSubmitting ? 'Enviando...' : 'Enviar propuesta'}</button></div><textarea value={message} onChange={(e) => setMessage(e.target.value)} disabled={isSubmitting} placeholder="Mensaje opcional: proyecto, rol y próximos pasos" rows={2} className="w-full rounded-lg border border-[var(--color-laburante-border)] px-2.5 py-2 text-xs disabled:opacity-50" />{refreshAvailable && <button type="button" onClick={refreshProposal} disabled={isSubmitting} className="w-full rounded-lg border border-indigo-200 bg-indigo-50 disabled:opacity-50 px-3 py-2 text-xs font-bold text-indigo-800 transition-opacity">{isSubmitting ? 'Actualizando...' : 'Refrescar propuesta pendiente'}</button>}{feedback && <p className="text-[11px] font-semibold text-indigo-800">{feedback}</p>}</div>
    {open && <div className="space-y-2 rounded-xl border border-indigo-200 bg-white p-3"><div className="flex gap-2"><input value={newProject} onChange={(e) => setNewProject(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addProject()} placeholder="Nombre del proyecto" className="min-w-0 flex-1 rounded-lg border border-[var(--color-laburante-border)] px-2.5 py-2 text-xs" /><button type="button" onClick={addProject} className="rounded-lg bg-indigo-700 px-3 text-white" aria-label="Crear proyecto"><Plus size={15} /></button></div>{projects.length > 0 && <p className="flex items-center gap-1 text-[10px] text-indigo-800"><Bookmark size={12} /> Proyectos: {projects.join(', ')}</p>}</div>}
  </div>
}
