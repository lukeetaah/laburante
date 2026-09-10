import { useEffect, useState } from 'react'
import { Bookmark, Check, FolderPlus, Heart, Plus, Send, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { useNotificationStore } from '@/stores/notification-store'

interface Props { profileId: string; profileName: string }

export default function CompanyProfileActions({ profileId, profileName }: Props) {
  const user = useAuthStore((state) => state.user)
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<string[]>([])
  const [newProject, setNewProject] = useState('')
  const [process, setProcess] = useState<'entrevista' | 'contratacion'>('entrevista')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const isCompany = user?.user_metadata?.account_type === 'empresa'

  useEffect(() => {
    if (!isCompany || !user) return
    try {
      const raw = localStorage.getItem(`laburante-company-favorites:${user.id}`)
      setSaved(raw ? JSON.parse(raw).includes(profileId) : false)
      const projectRaw = localStorage.getItem(`laburante-company-projects:${user.id}`)
      setProjects(projectRaw ? JSON.parse(projectRaw) : [])
    } catch { setSaved(false) }
  }, [isCompany, profileId, user])

  if (!isCompany || !user) return null

  const toggleFavorite = async () => {
    const next = !saved
    setSaved(next)
    try {
      const key = `laburante-company-favorites:${user.id}`
      const raw = localStorage.getItem(key)
      const list: string[] = raw ? JSON.parse(raw) : []
      const nextList = next ? Array.from(new Set([...list, profileId])) : list.filter((id) => id !== profileId)
      localStorage.setItem(key, JSON.stringify(nextList))
      if (next) await (supabase.from('company_saved_profiles') as any).upsert({ company_id: user.id, profile_id: profileId }, { onConflict: 'company_id,profile_id,project_id' })
    } catch { /* Local fallback keeps the interaction usable before migration. */ }
  }

  const addProject = async () => {
    const name = newProject.trim()
    if (!name) return
    const next = Array.from(new Set([...projects, name]))
    setProjects(next)
    setNewProject('')
    localStorage.setItem(`laburante-company-projects:${user.id}`, JSON.stringify(next))
    try {
      const { data } = await (supabase.from('company_projects') as any).insert({ company_id: user.id, name }).select('id').single()
      if (data) await (supabase.from('company_saved_profiles') as any).upsert({ company_id: user.id, profile_id: profileId, project_id: data.id }, { onConflict: 'company_id,profile_id,project_id' })
    } catch { /* The local list remains available if the migration is pending. */ }
  }

  const proposeNextStep = async () => {
    if (!user || !profileId) return
    setFeedback('')
    const note = message.trim()
    const { error } = await (supabase.from('company_candidate_inquiries') as any).insert({
      company_id: user.id,
      profile_id: profileId,
      process_type: process,
      message: note || null,
    })
    if (error) {
      setFeedback(error.message?.includes('company_candidate_inquiries') ? 'Falta aplicar la migración de selección Empresa en Supabase.' : 'No se pudo enviar la propuesta. Intentá nuevamente.')
      return
    }
    await useNotificationStore.getState().addNotification({
      userId: profileId,
      title: process === 'entrevista' ? 'Una empresa quiere entrevistarte' : 'Una empresa quiere contratarte',
      message: `${user.user_metadata?.name || 'Una empresa'} ${process === 'entrevista' ? 'quiere coordinar una entrevista' : 'quiere conversar sobre una contratación directa'} para conocerte mejor.${note ? ` Mensaje: ${note}` : ''}`,
      type: 'job',
      link: '/pedidos',
    })
    setFeedback('Propuesta enviada. La persona recibirá el aviso y podrá responderte desde su cuenta.')
    setMessage('')
  }

  return <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-indigo-950">Herramientas para tu empresa</p><p className="mt-1 text-[11px] leading-relaxed text-indigo-900/75">Guardá a {profileName} para un proyecto o marcá que te interesa.</p></div><button type="button" onClick={() => setOpen(false)} className="p-1 text-indigo-700" aria-label="Cerrar" hidden={!open}><X size={15} /></button></div>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={toggleFavorite} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-900">{saved ? <Check size={14} /> : <Heart size={14} />} {saved ? 'Guardado' : 'Me interesa'}</button><button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-900"><FolderPlus size={14} /> Agregar a proyecto</button></div>
    <div className="space-y-2 rounded-xl border border-indigo-200 bg-white p-3"><p className="flex items-center gap-1.5 text-xs font-bold text-indigo-950"><Send size={14} /> Iniciar selección directa</p><p className="text-[11px] leading-relaxed text-indigo-900/75">La empresa coordina entrevistas y altas de proveedor por sus propios canales. LABURANTE no emite órdenes de compra ni reemplaza la aprobación interna.</p><div className="grid gap-2 sm:grid-cols-2"><select value={process} onChange={(e) => setProcess(e.target.value as 'entrevista' | 'contratacion')} className="rounded-lg border border-[var(--color-laburante-border)] px-2.5 py-2 text-xs"><option value="entrevista">Proponer entrevista</option><option value="contratacion">Conversar contratación</option></select><button type="button" onClick={proposeNextStep} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white">Enviar propuesta</button></div><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensaje opcional: proyecto, rol y próximos pasos" rows={2} className="w-full rounded-lg border border-[var(--color-laburante-border)] px-2.5 py-2 text-xs" />{feedback && <p className="text-[11px] font-semibold text-indigo-800">{feedback}</p>}</div>
    {open && <div className="space-y-2 rounded-xl border border-indigo-200 bg-white p-3"><div className="flex gap-2"><input value={newProject} onChange={(e) => setNewProject(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addProject()} placeholder="Nombre del proyecto" className="min-w-0 flex-1 rounded-lg border border-[var(--color-laburante-border)] px-2.5 py-2 text-xs" /><button type="button" onClick={addProject} className="rounded-lg bg-indigo-700 px-3 text-white" aria-label="Crear proyecto"><Plus size={15} /></button></div>{projects.length > 0 && <p className="flex items-center gap-1 text-[10px] text-indigo-800"><Bookmark size={12} /> Proyectos: {projects.join(', ')}</p>}</div>}
  </div>
}
