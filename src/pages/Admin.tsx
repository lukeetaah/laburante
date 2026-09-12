import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore, type AccountDeletionRecord } from '@/stores/profile-store'
import type { WhatsAppVerificationRequest } from '@/lib/database.types'
import { SITE_CONFIG } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { formatModality } from '@/lib/profile-format'
import { getProfileCompletion } from '@/lib/profile-completion'
import {
  ShieldAlert,
  Users,
  AlertTriangle,
  CheckCircle,
  Eye,
  Slash,
  RefreshCw,
  Lock,
  ShieldCheck,
  EyeOff,
  Trash2,
  Filter,
  MessageCircle,
  ExternalLink,
  Check,
  XCircle,
  Clock,
  Building2,
  Pencil,
  Save,
  BarChart3,
  TrendingUp,
} from 'lucide-react'

const REASON_LABELS: Record<string, string> = {
  trabajo_suficiente: 'Ya consiguió suficiente trabajo',
  sin_consultas: 'No recibió consultas o solicitudes',
  mala_experiencia: 'Problema o desacuerdo con cliente',
  problemas_tecnicos: 'Dificultad técnica con la app',
  cambio_datos: 'Creará otro perfil con otros datos',
  otro: 'Otro motivo',
}

const HYBRID_COLUMN_MISSING_RE = /hybrid_(presencial|remoto)_pct|column .* does not exist|Could not find .*hybrid_/i

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuthStore()
  const {
    fetchAccountDeletions,
    updateProfileVisibility,
    fetchPendingWhatsAppVerifications,
    adminApproveWhatsAppVerification,
    adminRejectWhatsAppVerification,
  } = useProfileStore()

  const [activeTab, setActiveTab] = useState<'analytics' | 'verifications' | 'reports' | 'profiles' | 'companies' | 'deletions'>('analytics')
  const [profileFilter, setProfileFilter] = useState<'todos' | 'activos' | 'privados' | 'verificados' | 'suspendidos' | 'incompletos'>('todos')
  const [reports, setReports] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [deletions, setDeletions] = useState<AccountDeletionRecord[]>([])
  const [waRequests, setWaRequests] = useState<WhatsAppVerificationRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [jobRequests, setJobRequests] = useState<any[]>([])

  const loadData = async () => {
    setLoading(true)
    setActionMessage(null)
    try {
      // 1. Fetch Reports
      const { data: reportsData } = await (supabase.from('reports') as any)
        .select(`
          id, reason, description, status, created_at, profile_id,
          profiles ( name, slug, status, localidad, provincia )
        `)
        .order('created_at', { ascending: false })

      if (reportsData) setReports(reportsData)

      // 2. Fetch all Profiles
      let profilesData: any[] | null = null
      const resProfiles = await (supabase.from('profiles') as any)
        .select('id, name, slug, bio, provincia, localidad, modalidad, hybrid_presencial_pct, hybrid_remoto_pct, status, disponibilidad, account_type, company_plan, photo_url, resume_url, profile_completion_reminder_sent_at, created_at, whatsapp_verified, whatsapp_verified_at, skills(name), services(title), contact_methods(type,value,is_public)')
        .order('created_at', { ascending: false })

      if (resProfiles.error) {
        const resFallback = await (supabase.from('profiles') as any)
          .select('id, name, slug, bio, provincia, localidad, modalidad, status, disponibilidad, account_type, photo_url, resume_url, created_at, skills(name), services(title), contact_methods(type,value,is_public)')
          .order('created_at', { ascending: false })
        profilesData = resFallback.data
      } else {
        profilesData = resProfiles.data
      }

      // 3. Fetch WhatsApp verification requests
      await (supabase.rpc as any)('admin_cleanup_orphan_verifications')
      const waReqs = await fetchPendingWhatsAppVerifications()
      setWaRequests(waReqs)

      // Local WhatsApp cache hydration
      let localWA: Record<string, any> = {}
      try {
        const raw = localStorage.getItem('laburante_v2_verified_wa')
        if (raw) localWA = JSON.parse(raw)
      } catch {}

      // Verification requests are audit records, never a source of profiles.
      // Recreating a profile from a stale local request made deleted accounts reappear.
      const allCombined = [...(profilesData || [])]
      const hydrated = allCombined.map((p: any) => ({
        ...p,
        completion_percent: getProfileCompletion({ ...p, skills: p.skills || [], services: p.services || [], contact_methods: p.contact_methods || [] }),
        whatsapp_verified: Boolean(p.whatsapp_verified || (localWA[p.id] !== undefined)),
      }))
      setProfiles(hydrated)

      await Promise.all(hydrated
        .filter((p: any) => Object.prototype.hasOwnProperty.call(p, 'profile_completion_reminder_sent_at') && p.completion_percent < 70 && !p.profile_completion_reminder_sent_at)
        .map(async (p: any) => {
          const { error: notificationError } = await (supabase.from('notifications') as any).insert({
            user_id: p.id,
            title: 'Completá tu perfil y hacé que te encuentren',
            message: `Tu perfil está completo en un ${p.completion_percent}%. Sumá qué sabés hacer, una breve presentación y un medio de contacto para aparecer mejor en las búsquedas y recibir oportunidades más acordes a vos.`,
            type: 'system',
            link: '/crear-perfil',
            read: false,
          })
          if (!notificationError) {
            await (supabase.from('profiles') as any)
              .update({ profile_completion_reminder_sent_at: new Date().toISOString() })
              .eq('id', p.id)
          }
        }))

      const { data: jobsData } = await (supabase.from('job_requests') as any)
        .select('id, status, created_at, budget_amount, client_outcome, professional_outcome')
        .order('created_at', { ascending: false })
      setJobRequests(jobsData || [])

      // 4. Fetch Deletions
      const delList = await fetchAccountDeletions()
      setDeletions(delList)
    } catch (err) {
      console.warn('Error loading admin data:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) {
      loadData()
    }
  }, [isAdmin])

  if (authLoading) {
    return <div className="container py-20 text-center text-sm">Verificando credenciales...</div>
  }

  // Not logged in or not admin
  if (!user || !isAdmin) {
    return (
      <div className="container py-20 max-w-lg mx-auto text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-amber-50 border border-amber-200 mx-auto flex items-center justify-center text-amber-700">
          <Lock size={28} />
        </div>
        <h1 className="font-heading text-2xl font-bold text-[var(--color-laburante-text)]">
          Panel de Administración
        </h1>
        <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
          Esta sección es exclusiva para administradores de LABURANTE.
        </p>
        <div className="p-4 rounded-2xl bg-[var(--color-laburante-surface)] border border-[var(--color-laburante-border)] text-left text-xs text-[var(--color-laburante-text-secondary)] space-y-2">
          <p className="font-semibold text-[var(--color-laburante-text)]">
            ℹ️ ¿Cómo habilitar tu cuenta como Administrador?
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
            <li>Registrate o iniciá sesión con tu email.</li>
            <li>En la consola de Supabase, andá a <strong>Authentication → Users</strong>.</li>
            <li>Buscá tu usuario y en <strong>User Metadata</strong> agregá <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-700">"role": "admin"</code>.</li>
            <li>Volvé a iniciar sesión y tendrás acceso completo a este panel.</li>
          </ol>
        </div>
        {!user && (
          <div className="pt-2">
            <Link to="/ingresar" className="btn-dark inline-block py-2.5 px-6 rounded-xl font-heading text-xs font-semibold">
              Iniciar sesión
            </Link>
          </div>
        )}
      </div>
    )
  }

  const handleUpdateReportStatus = async (reportId: string, newStatus: 'revisado' | 'resuelto') => {
    const { error } = await (supabase.from('reports') as any)
      .update({ status: newStatus })
      .eq('id', reportId)

    if (!error) {
      setActionMessage(`Reporte marcado como ${newStatus}.`)
      loadData()
    }
  }

  const handleToggleProfileStatus = async (profileId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'suspendido' ? 'activo' : 'suspendido'
    const { error } = await (supabase.from('profiles') as any)
      .update({ status: nextStatus })
      .eq('id', profileId)

    if (!error) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, status: nextStatus } : p))
      )
      setActionMessage(`Estado del perfil actualizado a: ${nextStatus.toUpperCase()}.`)
    }
  }

  const handleSetCompanyPlan = async (profile: any, plan: 'gratis' | 'pago') => {
    if (profile.account_type !== 'empresa') return
    setActionMessage(null)
    let { error } = await (supabase.rpc as any)('admin_set_company_plan', {
      target_user_id: profile.id,
      target_plan: plan,
    })

    // Permite operar con la política de admin si la función todavía no fue
    // creada, sin abrir el update a cuentas no administrativas.
    if (error) {
      const fallback = await (supabase.from('profiles') as any)
        .update({ company_plan: plan, updated_at: new Date().toISOString() })
        .eq('id', profile.id)
        .eq('account_type', 'empresa')
        .select('id, company_plan')
        .maybeSingle()
      error = fallback.error || (!fallback.data ? { message: 'No se actualizó ninguna cuenta Empresa.' } : null)
    }

    if (error) {
      setActionMessage(`No se pudo cambiar el plan de ${profile.name}: ${error.message}. Aplicá migration_company_plans.sql en Supabase.`)
      return
    }
    setProfiles((prev) => prev.map((item) => item.id === profile.id ? { ...item, company_plan: plan } : item))
    setActionMessage(`${profile.name} quedó en plan ${plan === 'pago' ? 'Pago' : 'Gratis'}.`)
  }

  const handleToggleProfileVisibility = async (profileId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'oculto' ? 'activo' : 'oculto'
    await updateProfileVisibility(profileId, nextStatus)
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, status: nextStatus } : p))
    )
    setActionMessage(
      nextStatus === 'oculto'
        ? 'El perfil fue configurado como PRIVADO / PAUSADO.'
        : 'El perfil fue activado y ya es visible en búsquedas.'
    )
  }

  const handleToggleWhatsAppVerified = async (profileId: string, currentVerified: boolean) => {
    const nextVal = !currentVerified
    const now = new Date().toISOString()
    try {
      await (supabase.from('profiles') as any)
        .update({
          whatsapp_verified: nextVal,
          whatsapp_verified_at: nextVal ? now : null,
        })
        .eq('id', profileId)
    } catch (e) {
      console.warn('Supabase update error:', e)
    }

    try {
      const raw = localStorage.getItem('laburante_v2_verified_wa')
      const parsed = raw ? JSON.parse(raw) : {}
      if (nextVal) {
        parsed[profileId] = { phone: 'admin-override', at: now }
      } else {
        delete parsed[profileId]
      }
      localStorage.setItem('laburante_v2_verified_wa', JSON.stringify(parsed))
    } catch {}

    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, whatsapp_verified: nextVal } : p))
    )
    setActionMessage(
      nextVal
        ? 'Número de WhatsApp certificado como verificado.'
        : 'Certificación de WhatsApp removida.'
    )
  }

  const openProfileEditor = (profile: any) => {
    setEditingProfile(profile)
    setEditForm({
      name: profile.name || '',
      bio: profile.bio || '',
      provincia: profile.provincia || '',
      localidad: profile.localidad || '',
      modalidad: profile.modalidad || 'presencial',
      hybrid_presencial_pct: typeof profile.hybrid_presencial_pct === 'number' ? profile.hybrid_presencial_pct : 50,
      hybrid_remoto_pct: typeof profile.hybrid_remoto_pct === 'number' ? profile.hybrid_remoto_pct : 50,
      disponibilidad: profile.disponibilidad || 'disponible',
      account_type: profile.account_type || 'persona',
    })
  }

  const handleSaveProfile = async () => {
    if (!editingProfile || !editForm.name.trim() || !editForm.provincia.trim() || !editForm.localidad.trim()) {
      setActionMessage('Completá nombre, provincia y localidad antes de guardar.')
      return
    }
    const updatePayload = {
      name: editForm.name.trim(),
      bio: editForm.bio.trim() || null,
      provincia: editForm.provincia.trim(),
      localidad: editForm.localidad.trim(),
      modalidad: editForm.modalidad,
      hybrid_presencial_pct: editForm.modalidad === 'ambas' ? Number(editForm.hybrid_presencial_pct) : null,
      hybrid_remoto_pct: editForm.modalidad === 'ambas' ? 100 - Number(editForm.hybrid_presencial_pct) : null,
      disponibilidad: editForm.disponibilidad,
      account_type: editForm.account_type,
      updated_at: new Date().toISOString(),
    }

    let { error } = await (supabase.from('profiles') as any)
      .update({
        ...updatePayload,
      })
      .eq('id', editingProfile.id)

    if (error && HYBRID_COLUMN_MISSING_RE.test(error.message || '')) {
      const { hybrid_presencial_pct, hybrid_remoto_pct, ...legacyPayload } = updatePayload
      const retry = await (supabase.from('profiles') as any)
        .update(legacyPayload)
        .eq('id', editingProfile.id)
      error = retry.error
    }

    if (error) {
      setActionMessage(`No se pudo guardar: ${error.message}`)
      return
    }
    setProfiles((prev) => prev.map((p) => p.id === editingProfile.id ? { ...p, ...editForm, hybrid_remoto_pct: editForm.modalidad === 'ambas' ? 100 - Number(editForm.hybrid_presencial_pct) : null } : p))
    setEditingProfile(null)
    setActionMessage('Perfil actualizado desde Administración.')
  }

  const handleDeleteAccount = async (profile: any) => {
    if (profile.id === user?.id) {
      setActionMessage('La cuenta administradora activa no se puede eliminar desde este panel.')
      return
    }
    if (!window.confirm(`¿Eliminar definitivamente la cuenta de ${profile.name}? También se quitará su acceso y sus datos asociados.`)) return
    const { error } = await (supabase.rpc as any)('admin_delete_account', { target_user_id: profile.id })
    if (error) {
      setActionMessage(`No se pudo eliminar la cuenta: ${error.message}. Aplicá migration_admin_controls.sql en Supabase.`)
      return
    }
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id))
    setWaRequests((prev) => prev.filter((request) => request.profile_id !== profile.id))
    try {
      const raw = localStorage.getItem('laburante_v2_verified_wa')
      const verified = raw ? JSON.parse(raw) : {}
      delete verified[profile.id]
      localStorage.setItem('laburante_v2_verified_wa', JSON.stringify(verified))
      const requestsRaw = localStorage.getItem('laburante_v2_wa_verification_requests')
      const requests = requestsRaw ? JSON.parse(requestsRaw) : []
      localStorage.setItem('laburante_v2_wa_verification_requests', JSON.stringify(requests.filter((request: any) => request.profile_id !== profile.id)))
    } catch {}
    setActionMessage(`Cuenta de ${profile.name} eliminada definitivamente.`)
    await loadData()
  }

  const pendingReportsCount = reports.filter((r) => r.status === 'pendiente').length
  const pendingWaCount = waRequests.filter((r) => r.status === 'pendiente').length
  const jobStatusCounts = jobRequests.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1
    return acc
  }, {})
  const budgetedJobs = jobRequests.filter((job) => job.budget_amount !== null && job.budget_amount !== '').length
  const closedJobs = jobRequests.filter((job) => ['completado', 'cancelado'].includes(job.status)).length
  const unresolvedCases = jobRequests.filter((job) => job.status === 'completado' && (!job.client_outcome || !job.professional_outcome)).length
  const completionRate = jobRequests.length ? Math.round((closedJobs / jobRequests.length) * 100) : 0
  const averageProfileCompletion = profiles.length ? Math.round(profiles.reduce((sum, profile) => sum + (profile.completion_percent || 0), 0) / profiles.length) : 0

  const filteredProfiles = profiles.filter((p) => {
    if (profileFilter === 'activos') return p.status === 'activo'
    if (profileFilter === 'privados') return p.status === 'oculto'
    if (profileFilter === 'verificados') return p.whatsapp_verified === true
    if (profileFilter === 'suspendidos') return p.status === 'suspendido'
    if (profileFilter === 'incompletos') return p.completion_percent < 100
    return true
  })

  const handleApproveWA = async (req: WhatsAppVerificationRequest) => {
    const res = await adminApproveWhatsAppVerification(req.id, req.profile_id, req.phone_declared)
    if (!res.error) {
      setWaRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: 'aprobado' as const, reviewed_at: new Date().toISOString() } : r))
      setProfiles((prev) => prev.map((p) => p.id === req.profile_id ? { ...p, whatsapp_verified: true } : p))
      setActionMessage(`✅ WhatsApp de ${req.profile_name} (${req.phone_declared}) certificado y aprobado.`)
    }
  }

  const handleRejectWA = async (req: WhatsAppVerificationRequest) => {
    const res = await adminRejectWhatsAppVerification(req.id)
    if (!res.error) {
      setWaRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: 'rechazado' as const, reviewed_at: new Date().toISOString() } : r))
      setActionMessage(`Solicitud de ${req.profile_name} rechazada.`)
    }
  }

  return (
    <div className="container py-8 md:py-12 max-w-5xl mx-auto space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-laburante-border)]">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <ShieldAlert size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Panel de Moderación y Auditoría</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)]">
            Administración de LABURANTE
          </h1>
          <p className="text-xs text-[var(--color-laburante-text-secondary)] mt-0.5">
            Sesión de administrador activa: <strong className="text-[var(--color-laburante-text)]">{user.email}</strong>
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="py-2 px-4 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refrescar datos
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle size={16} />
          {actionMessage}
        </div>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
          <p className="text-xs text-[var(--color-laburante-text-muted)] font-medium">Perfiles registrados</p>
          <p className="font-heading text-2xl font-bold text-[var(--color-laburante-text)] mt-1">
            {profiles.length}
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/60">
          <p className="text-xs text-indigo-700 font-medium">Cuentas Empresa</p>
          <p className="font-heading text-2xl font-bold text-indigo-900 mt-1">{profiles.filter((p) => p.account_type === 'empresa').length}</p>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
          <p className="text-xs text-[var(--color-laburante-text-muted)] font-medium">Perfiles activos</p>
          <p className="font-heading text-2xl font-bold text-emerald-600 mt-1">
            {profiles.filter((p) => p.status === 'activo').length}
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
          <p className="text-xs text-[var(--color-laburante-text-muted)] font-medium">Privados / Pausados</p>
          <p className="font-heading text-2xl font-bold text-amber-600 mt-1">
            {profiles.filter((p) => p.status === 'oculto').length}
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
          <p className="text-xs text-[var(--color-laburante-text-muted)] font-medium">WhatsApp Verificados</p>
          <p className="font-heading text-2xl font-bold text-emerald-700 mt-1">
            {profiles.filter((p) => p.whatsapp_verified).length}
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
          <p className="text-xs text-[var(--color-laburante-text-muted)] font-medium">Verificaciones pendientes</p>
          <p className="font-heading text-2xl font-bold text-indigo-600 mt-1">
            {pendingWaCount}
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/60">
          <p className="text-xs text-amber-800 font-medium">Completitud promedio</p>
          <p className="font-heading text-2xl font-bold text-amber-900 mt-1">{averageProfileCompletion}%</p>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
          <p className="text-xs text-[var(--color-laburante-text-muted)] font-medium">Bajas registradas</p>
          <p className="font-heading text-2xl font-bold text-rose-600 mt-1">
            {deletions.length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-laburante-border)] overflow-x-auto">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 px-4 font-heading font-semibold text-xs sm:text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 cursor-pointer ${activeTab === 'analytics' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'}`}
        >
          <BarChart3 size={16} /> Métricas
        </button>
        <button
          onClick={() => setActiveTab('verifications')}
          className={`pb-3 px-4 font-heading font-semibold text-xs sm:text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'verifications'
              ? 'border-[var(--color-laburante-indigo)] text-[var(--color-laburante-indigo)]'
              : 'border-transparent text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'
          }`}
        >
          <ShieldCheck size={16} />
          Verificaciones WA
          {pendingWaCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
              {pendingWaCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('companies')}
          className={`pb-3 px-4 font-heading font-semibold text-xs sm:text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 cursor-pointer ${activeTab === 'companies' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'}`}
        >
          <Building2 size={16} /> Empresas ({profiles.filter((p) => p.account_type === 'empresa').length})
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-4 font-heading font-semibold text-xs sm:text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'reports'
              ? 'border-[var(--color-laburante-indigo)] text-[var(--color-laburante-indigo)]'
              : 'border-transparent text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'
          }`}
        >
          <AlertTriangle size={16} />
          Reportes ({reports.length})
          {pendingReportsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
              {pendingReportsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('profiles')}
          className={`pb-3 px-4 font-heading font-semibold text-xs sm:text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'profiles'
              ? 'border-[var(--color-laburante-indigo)] text-[var(--color-laburante-indigo)]'
              : 'border-transparent text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'
          }`}
        >
          <Users size={16} />
          Perfiles ({profiles.length})
        </button>

        <button
          onClick={() => setActiveTab('deletions')}
          className={`pb-3 px-4 font-heading font-semibold text-xs sm:text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'deletions'
              ? 'border-[var(--color-laburante-indigo)] text-[var(--color-laburante-indigo)]'
              : 'border-transparent text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'
          }`}
        >
          <Trash2 size={16} />
          Bajas y Motivos ({deletions.length})
        </button>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
            <div className="flex items-center gap-2 text-indigo-800"><TrendingUp size={18} /><h2 className="font-heading text-lg font-bold">Vista operativa de LABURANTE</h2></div>
            <p className="mt-1 text-xs leading-relaxed text-indigo-950/75">Indicadores reales para entender dónde se generan pedidos, presupuestos y casos sin cierre. Se actualiza junto con “Refrescar datos”.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[['Pedidos de presupuesto', jobRequests.length, 'bg-white'], ['Con presupuesto', budgetedJobs, 'bg-amber-50'], ['Casos cerrados', closedJobs, 'bg-emerald-50'], ['Cierres pendientes', unresolvedCases, 'bg-rose-50']].map(([label, value, tone]) => <article key={String(label)} className={`rounded-2xl border border-[var(--color-laburante-border)] ${tone} p-5`}><p className="text-xs font-semibold text-[var(--color-laburante-text-muted)]">{label}</p><p className="mt-2 font-heading text-3xl font-extrabold text-[var(--color-laburante-text)]">{value}</p></article>)}
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5">
              <div className="flex items-center justify-between gap-3"><h3 className="font-heading font-bold">Embudo de solicitudes</h3><span className="text-xs font-bold text-indigo-700">{completionRate}% cerradas</span></div>
              <div className="mt-5 space-y-3">{[['solicitado', 'Solicitadas', 'bg-indigo-500'], ['presupuestado', 'Presupuestadas', 'bg-amber-500'], ['aceptado', 'Aceptadas', 'bg-cyan-500'], ['en_progreso', 'En progreso', 'bg-violet-500'], ['completado', 'Completadas', 'bg-emerald-500'], ['cancelado', 'Canceladas', 'bg-rose-500']].map(([key, label, color]) => { const count = jobStatusCounts[key] || 0; const width = jobRequests.length ? Math.max(4, Math.round((count / jobRequests.length) * 100)) : 4; return <div key={key}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{label}</span><span className="text-[var(--color-laburante-text-muted)]">{count}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${color}`} style={{ width: `${width}%` }} /></div></div> })}</div>
            </section>
            <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5"><h3 className="font-heading font-bold">Lectura rápida</h3><div className="mt-4 space-y-3 text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]"><p><strong className="text-[var(--color-laburante-text)]">Presupuestos:</strong> {budgetedJobs} de {jobRequests.length} pedidos recibieron una propuesta.</p><p><strong className="text-[var(--color-laburante-text)]">Cierre:</strong> {unresolvedCases} casos completados todavía necesitan respuesta de una de las partes.</p><p><strong className="text-[var(--color-laburante-text)]">Empresas:</strong> {profiles.filter((p) => p.account_type === 'empresa').length} cuentas registradas para búsquedas y proyectos.</p></div></section>
          </div>
        </div>
      )}

      {/* Tab: WhatsApp Verification Requests */}
      {activeTab === 'verifications' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 text-xs text-indigo-950 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-indigo-900">
              <ShieldCheck size={15} className="text-indigo-600" />
              Solicitudes de verificación de WhatsApp
            </p>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              Los profesionales envían un mensaje con su código único a la Línea Oficial de WhatsApp. Comprobá que el remitente coincida con el número declarado y aprobá.
            </p>
          </div>

          {waRequests.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-xs text-[var(--color-laburante-text-secondary)]">
              No hay solicitudes de verificación por el momento.
            </div>
          ) : (
            <div className="space-y-3">
              {waRequests.map((req) => (
                <div
                  key={req.id}
                  className={`p-5 rounded-2xl border bg-[var(--color-laburante-surface)] space-y-3 ${
                    req.status === 'pendiente' ? 'border-indigo-300' : 'border-[var(--color-laburante-border)]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--color-laburante-border)]/60">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          req.status === 'pendiente'
                            ? 'bg-amber-100 text-amber-800'
                            : req.status === 'aprobado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {req.status === 'pendiente' ? '⏳ Pendiente' : req.status === 'aprobado' ? '✅ Aprobada' : '❌ Rechazada'}
                      </span>
                      <h4 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                        {req.profile_name}
                      </h4>
                      {req.profile_slug && (
                        <Link to={`/p/${req.profile_slug}`} target="_blank" className="text-[11px] text-[var(--color-laburante-indigo)] hover:underline">
                          @{req.profile_slug}
                        </Link>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-laburante-text-muted)]">
                      {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[var(--color-laburante-text-muted)]">Número declarado:</span>
                      <p className="font-bold text-[var(--color-laburante-text)]">{req.phone_declared}</p>
                    </div>
                    <div>
                      <span className="text-[var(--color-laburante-text-muted)]">Código:</span>
                      <p className="font-mono font-bold text-indigo-800">{req.code}</p>
                    </div>
                    <div className="flex items-end">
                      <a
                        href={`https://wa.me/${req.phone_declared.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 transition-colors"
                      >
                        <MessageCircle size={13} />
                        Abrir chat con el profesional
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  {req.status === 'pendiente' && (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button
                        onClick={() => handleApproveWA(req)}
                        className="py-1.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check size={14} />
                        Aprobar y Certificar ✓
                      </button>
                      <button
                        onClick={() => handleRejectWA(req)}
                        className="py-1.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle size={14} />
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-sm text-[var(--color-laburante-text-secondary)]">
              No hay reportes registrados por el momento.
            </div>
          ) : (
            reports.map((rep) => (
              <div
                key={rep.id}
                className="p-5 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--color-laburante-border)]/60">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        rep.status === 'pendiente'
                          ? 'bg-rose-100 text-rose-800'
                          : rep.status === 'revisado'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {rep.status}
                    </span>
                    <span className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                      Motivo: {rep.reason.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--color-laburante-text-muted)]">
                    {new Date(rep.created_at).toLocaleDateString()} {new Date(rep.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div className="text-xs text-[var(--color-laburante-text-secondary)] space-y-1">
                  <p>
                    <strong>Perfil reportado:</strong>{' '}
                    {rep.profiles?.name ? (
                      <Link to={`/p/${rep.profiles.slug}`} target="_blank" className="text-[var(--color-laburante-indigo)] underline font-semibold">
                        {rep.profiles.name} ({rep.profiles.localidad}, {rep.profiles.provincia})
                      </Link>
                    ) : (
                      <span>ID: {rep.profile_id}</span>
                    )}
                  </p>
                  {rep.description && (
                    <p className="bg-[var(--color-laburante-surface-alt)] p-2.5 rounded-xl text-[11px] text-[var(--color-laburante-text)]">
                      "{rep.description}"
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {rep.status === 'pendiente' && (
                    <button
                      onClick={() => handleUpdateReportStatus(rep.id, 'revisado')}
                      className="py-1.5 px-3 rounded-lg border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-xs font-medium cursor-pointer"
                    >
                      Marcar como revisado
                    </button>
                  )}
                  {rep.status !== 'resuelto' && (
                    <button
                      onClick={() => handleUpdateReportStatus(rep.id, 'resuelto')}
                      className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Resolver reporte
                    </button>
                  )}
                  {rep.profiles?.id && (
                    <button
                      onClick={() => handleToggleProfileStatus(rep.profiles.id, rep.profiles.status)}
                      className="py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Slash size={12} />
                      {rep.profiles.status === 'suspendido' ? 'Reactivar perfil' : 'Suspender perfil'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: All Profiles */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          {/* Profile Filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--color-laburante-text-muted)] mr-1 flex items-center gap-1">
              <Filter size={13} /> Filtrar:
            </span>
            {(['todos', 'activos', 'privados', 'verificados', 'suspendidos', 'incompletos'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setProfileFilter(f)}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-colors capitalize cursor-pointer ${
                  profileFilter === f
                    ? 'btn-dark'
                    : 'border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-secondary)]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredProfiles.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-xs text-[var(--color-laburante-text-secondary)]">
                No hay perfiles que coincidan con el filtro seleccionado.
              </div>
            ) : (
              filteredProfiles.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                        {p.name}
                      </h3>

                      {/* Status badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          p.status === 'activo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'oculto'
                            ? 'bg-amber-100 text-amber-800'
                            : p.status === 'suspendido'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {p.status === 'oculto' ? '🔒 Privado' : p.status}
                      </span>

                      {/* WhatsApp verification badge */}
                      {p.whatsapp_verified ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1">
                          <ShieldCheck size={11} className="text-emerald-600" />
                          <span>WhatsApp Verificado</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          Sin verificar
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[var(--color-laburante-text-secondary)]">
                      {p.localidad}, {p.provincia} · Registrado el {new Date(p.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-[11px] font-medium text-[var(--color-laburante-text-muted)]">
                      Modalidad: {formatModality(p.modalidad, p.hybrid_presencial_pct, p.hybrid_remoto_pct)}
                    </p>
                    <p className={`text-[11px] font-bold ${p.completion_percent < 70 ? 'text-rose-700' : p.completion_percent < 100 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      Perfil completado: {p.completion_percent}%
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/p/${p.slug}`}
                      target="_blank"
                      className="py-1.5 px-3 rounded-xl border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-xs font-semibold flex items-center gap-1"
                    >
                      <Eye size={13} />
                      Ver
                    </Link>

                    <button
                      onClick={() => openProfileEditor(p)}
                      className="py-1.5 px-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1"
                    >
                      <Pencil size={13} /> Editar
                    </button>

                    {/* WhatsApp verify toggle */}
                    <button
                      onClick={() => handleToggleWhatsAppVerified(p.id, p.whatsapp_verified)}
                      className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                        p.whatsapp_verified
                          ? 'border border-gray-300 hover:bg-gray-100 text-gray-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800'
                      }`}
                      title={p.whatsapp_verified ? 'Quitar verificación' : 'Certificar número'}
                    >
                      <ShieldCheck size={13} />
                      {p.whatsapp_verified ? 'Quitar Verificado' : 'Certificar WhatsApp'}
                    </button>

                    <button
                      onClick={() => handleDeleteAccount(p)}
                      className="py-1.5 px-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 size={13} /> Eliminar
                    </button>

                    {/* Visibility toggle */}
                    <button
                      onClick={() => handleToggleProfileVisibility(p.id, p.status)}
                      className="py-1.5 px-3 rounded-xl border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-xs font-medium cursor-pointer"
                      title={p.status === 'oculto' ? 'Hacer público' : 'Ocultar / Poner Privado'}
                    >
                      {p.status === 'oculto' ? 'Hacer Público' : 'Poner Privado'}
                    </button>

                    {/* Suspend toggle */}
                    <button
                      onClick={() => handleToggleProfileStatus(p.id, p.status)}
                      className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        p.status === 'suspendido'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      {p.status === 'suspendido' ? 'Reactivar' : 'Suspender'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'companies' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-950">
            <p className="font-bold">Cuentas Empresa</p>
            <p className="mt-1 leading-relaxed">Acá aparecen las cuentas que buscan profesionales. Toda cuenta nueva inicia en Gratis; revisá cada solicitud y usá Plan para activar o quitar Pago. Sólo Pago habilita publicar y derivar oportunidades.</p>
          </div>
          {profiles.filter((p) => p.account_type === 'empresa').length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-laburante-border)] p-8 text-center text-xs text-[var(--color-laburante-text-secondary)]">Todavía no hay cuentas Empresa sincronizadas. Verificá la migración de Supabase y refrescá los datos.</div>
          ) : profiles.filter((p) => p.account_type === 'empresa').map((company) => (
            <div key={company.id} className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-[var(--color-laburante-surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="flex flex-wrap items-center gap-2"><Building2 size={17} className="text-indigo-600" /><h3 className="font-heading font-bold text-sm">{company.name}</h3><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">EMPRESA</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${company.company_plan === 'pago' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>{company.company_plan === 'pago' ? 'PLAN PAGO' : 'PLAN GRATIS'}</span></div><p className="mt-1 text-xs text-[var(--color-laburante-text-secondary)]">{company.localidad}, {company.provincia} · Alta {new Date(company.created_at).toLocaleDateString()}</p></div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Plan<select value={company.company_plan || 'gratis'} onChange={(event) => handleSetCompanyPlan(company, event.target.value as 'gratis' | 'pago')} className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-bold text-amber-900"><option value="gratis">Gratis</option><option value="pago">Pago</option></select></label>
                <button onClick={() => openProfileEditor(company)} className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800"><Pencil size={13} /> Editar</button>
                <button onClick={() => handleToggleProfileStatus(company.id, company.status)} className="rounded-xl border border-[var(--color-laburante-border)] px-3 py-2 text-xs font-semibold">{company.status === 'suspendido' ? 'Reactivar cuenta' : 'Suspender cuenta'}</button>
                <button onClick={() => handleDeleteAccount(company)} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"><Trash2 size={13} /> Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Editar perfil">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--color-laburante-surface)] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Edición administrativa</p><h2 className="mt-1 font-heading text-xl font-bold">{editingProfile.name}</h2></div>
              <button type="button" onClick={() => setEditingProfile(null)} className="rounded-lg p-1 text-[var(--color-laburante-text-muted)] hover:bg-[var(--color-laburante-surface-alt)]" aria-label="Cerrar"><XCircle size={19} /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">Nombre<input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold">Tipo<select value={editForm.account_type} onChange={(e) => setEditForm({ ...editForm, account_type: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3 py-2 text-sm"><option value="persona">LABURANTE</option><option value="empresa">EMPRESA</option></select></label>
              <label className="text-xs font-semibold">Provincia<input value={editForm.provincia} onChange={(e) => setEditForm({ ...editForm, provincia: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold">Localidad<input value={editForm.localidad} onChange={(e) => setEditForm({ ...editForm, localidad: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3 py-2 text-sm" /></label>
              <label className="text-xs font-semibold">Modalidad<select value={editForm.modalidad} onChange={(e) => setEditForm({ ...editForm, modalidad: e.target.value, hybrid_presencial_pct: e.target.value === 'ambas' ? editForm.hybrid_presencial_pct || 50 : null })} className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3 py-2 text-sm"><option value="presencial">Presencial</option><option value="remoto">Remoto</option><option value="ambas">Híbrido</option></select></label>
              <label className="text-xs font-semibold">Disponibilidad<select value={editForm.disponibilidad} onChange={(e) => setEditForm({ ...editForm, disponibilidad: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3 py-2 text-sm"><option value="disponible">Disponible</option><option value="ocupado">Ocupado</option><option value="no_disponible">No disponible</option></select></label>
            </div>
            {editForm.modalidad === 'ambas' && (
              <div className="mt-3 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/50 p-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--color-laburante-text-secondary)]">
                  <span>Presencial {Number(editForm.hybrid_presencial_pct) || 0}%</span>
                  <span>Remoto {100 - (Number(editForm.hybrid_presencial_pct) || 0)}%</span>
                </div>
                <input type="range" min={0} max={100} step={10} value={Number(editForm.hybrid_presencial_pct) || 0} onChange={(e) => setEditForm({ ...editForm, hybrid_presencial_pct: Number(e.target.value), hybrid_remoto_pct: 100 - Number(e.target.value) })} className="mt-2 w-full accent-[var(--color-laburante-indigo)]" aria-label="Porcentaje presencial en modalidad híbrida" />
              </div>
            )}
            <label className="mt-3 block text-xs font-semibold">Presentación<textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={4} className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] px-3 py-2 text-sm" /></label>
            <button type="button" onClick={handleSaveProfile} className="btn-dark mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"><Save size={14} /> Guardar cambios</button>
          </div>
        </div>
      )}

      {/* Tab 3: Account Deletions */}
      {activeTab === 'deletions' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 text-xs text-rose-950 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-rose-900">
              <Trash2 size={15} className="text-rose-600" />
              Registro de bajas voluntarias de perfiles y cuentas
            </p>
            <p className="text-[11px] text-rose-800 leading-relaxed">
              Acá se auditan los motivos y explicaciones reales que dejaron los usuarios al dar de baja su cuenta de LABURANTE.
            </p>
          </div>

          {deletions.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-xs text-[var(--color-laburante-text-secondary)]">
              No hay registros de cuentas eliminadas por el momento.
            </div>
          ) : (
            <div className="space-y-3">
              {deletions.map((del) => (
                <div
                  key={del.id}
                  className="p-5 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--color-laburante-border)]/60">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                        Baja de cuenta
                      </span>
                      <h4 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                        {del.profile_name}
                      </h4>
                      {del.profile_slug && (
                        <span className="text-[11px] text-[var(--color-laburante-text-muted)]">
                          (@{del.profile_slug})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-laburante-text-muted)]">
                      {new Date(del.created_at).toLocaleDateString()} {new Date(del.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-xs text-[var(--color-laburante-text-secondary)] space-y-2">
                    {del.user_email && (
                      <p>
                        <strong>Email del usuario:</strong> <span className="font-mono text-[11px]">{del.user_email}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <strong>Motivo seleccionado:</strong>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-[11px]">
                        {REASON_LABELS[del.reason] || del.reason}
                      </span>
                    </div>

                    <div className="space-y-1 pt-1">
                      <strong className="text-[var(--color-laburante-text)]">Explicación del usuario:</strong>
                      <div className="p-3.5 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] text-xs text-[var(--color-laburante-text)] leading-relaxed italic">
                        "{del.explanation}"
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
