import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore, type AccountDeletionRecord } from '@/stores/profile-store'
import type { WhatsAppVerificationRequest } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { formatModality } from '@/lib/profile-format'
import { getProfileCompletion } from '@/lib/profile-completion'
import { normalizeSearchText } from '@/lib/search-intent'
import { PROVINCES } from '@/data/provinces'
import { CATEGORIES } from '@/data/categories'
import { saveOperationalSetting, useOperationalSettings } from '@/lib/operational-settings'
import { isProviderProfile, normalizeProfileIntent } from '@/lib/profile-publication'
import { useNotificationStore } from '@/stores/notification-store'
import { addAppBreadcrumb, captureAppError } from '@/lib/sentry'
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
  KeyRound,
  Mail,
  ClipboardList,
  Archive,
  DollarSign,
  Star,
  X,
} from 'lucide-react'

function isValidPhotoUrl(photo: string): boolean {
  if (typeof photo !== 'string') return false
  const trimmed = photo.trim()
  if (
    trimmed.startsWith('data:image/jpeg;base64,') ||
    trimmed.startsWith('data:image/png;base64,') ||
    trimmed.startsWith('data:image/webp;base64,')
  ) {
    return true
  }
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
    return true
  }
  return false
}

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

  const [activeTab, setActiveTab] = useState<'analytics' | 'jobs' | 'verifications' | 'reports' | 'profiles' | 'companies' | 'reviews' | 'deletions' | 'settings'>('analytics')
  const [profileFilter, setProfileFilter] = useState<'todos' | 'activos' | 'privados' | 'verificados' | 'suspendidos' | 'incompletos'>('todos')
  const [adminFilters, setAdminFilters] = useState({
    query: '', provincia: '', localidad: '', category: '', modalidad: '', disponibilidad: '', accountType: '',
    providerKind: 'todos', verification: 'todos', completion: 'todos', dateFrom: '', dateTo: '',
  })
  const [reports, setReports] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [recStatusFilter, setRecStatusFilter] = useState<'todas' | 'pendientes' | 'visibles' | 'ocultas' | 'anonimas'>('todas')
  const [recSearch, setRecSearch] = useState('')
  const [deletions, setDeletions] = useState<AccountDeletionRecord[]>([])
  const [waRequests, setWaRequests] = useState<WhatsAppVerificationRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [credentialsOpen, setCredentialsOpen] = useState(false)
  const [credentialsSaving, setCredentialsSaving] = useState(false)
  const [jobRequests, setJobRequests] = useState<any[]>([])
  const [selectedJob, setSelectedJob] = useState<any | null>(null)
  const [jobLoadingId, setJobLoadingId] = useState<string | null>(null)
  const operationalSettings = useOperationalSettings()
  const [settingsForm, setSettingsForm] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)

  useEffect(() => {
    if (!selectedJob) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedJob(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedJob])

  useEffect(() => {
    setSettingsForm(operationalSettings.officialWhatsApp)
  }, [operationalSettings.officialWhatsApp])

  const loadData = async () => {
    addAppBreadcrumb('admin_data_load_started')
    setLoading(true)
    setActionMessage(null)
    try {
      // 1. Fetch Reports
      const reportsResult = await (supabase.from('reports') as any)
        .select(`
          id, reason, description, status, created_at, profile_id, reporter_id, job_request_id,
          profiles ( name, slug, status, localidad, provincia )
        `)
        .order('created_at', { ascending: false })

      let loadedReports = reportsResult.data || []
      if (reportsResult.error) {
        const legacyReports = await (supabase.from('reports') as any)
          .select(`
            id, reason, description, status, created_at, profile_id, reporter_id,
            profiles ( name, slug, status, localidad, provincia )
          `)
          .order('created_at', { ascending: false })
        loadedReports = (legacyReports.data || []).map((report: any) => ({ ...report, job_request_id: null }))
      }

      // 2. Fetch all Profiles
      let profilesData: any[] | null = null
      const resProfiles = await (supabase.from('profiles') as any)
        .select('id, name, slug, bio, provincia, localidad, modalidad, hybrid_presencial_pct, hybrid_remoto_pct, status, intent, disponibilidad, account_type, company_plan, photo_url, resume_url, resume_name, profile_completion_reminder_sent_at, created_at, whatsapp_verified, whatsapp_verified_at, skills(name), services(title), contact_methods(type,value,is_public)')
        .order('created_at', { ascending: false })

      if (resProfiles.error) {
        const resFallback = await (supabase.from('profiles') as any)
          .select('id, name, slug, bio, provincia, localidad, modalidad, status, disponibilidad, account_type, photo_url, resume_url, resume_name, created_at, skills(name), services(title), contact_methods(type,value,is_public)')
          .order('created_at', { ascending: false })
        profilesData = resFallback.data
      } else {
        profilesData = resProfiles.data
      }

      const profileById = new Map((profilesData || []).map((profile: any) => [profile.id, profile]))
      setReports(loadedReports.map((report: any) => ({
        ...report,
        reporter: report.reporter_id ? profileById.get(report.reporter_id) : null,
      })))

      // 3. Fetch WhatsApp verification requests
      await (supabase.rpc as any)('admin_cleanup_orphan_verifications')
      const waReqs = await fetchPendingWhatsAppVerifications()
      setWaRequests(waReqs)

      // Verification requests are audit records, never a source of profiles.
      // Recreating a profile from a stale local request made deleted accounts reappear.
      const allCombined = [...(profilesData || [])]
      const hydrated = allCombined.map((p: any) => ({
        ...p,
        completion_percent: getProfileCompletion({ ...p, skills: p.skills || [], services: p.services || [], contact_methods: p.contact_methods || [], intent: p.intent }),
        whatsapp_verified: Boolean(p.whatsapp_verified),
      }))
      setProfiles(hydrated)

      const { data: jobsData } = await (supabase.from('job_requests') as any)
        .select('*')
        .order('created_at', { ascending: false })
      const reportsByJob = new Map<string, any[]>()
      loadedReports.forEach((report: any) => {
        if (!report.job_request_id) return
        const linked = reportsByJob.get(report.job_request_id) || []
        linked.push({ ...report, reporter: report.reporter_id ? profileById.get(report.reporter_id) : null })
        reportsByJob.set(report.job_request_id, linked)
      })
      setJobRequests((jobsData || []).map((job: any) => ({
        ...job,
        client_profile: job.client_id ? profileById.get(job.client_id) : null,
        professional_profile: profileById.get(job.profile_id) || null,
        linked_reports: reportsByJob.get(job.id) || [],
      })))

      // 4. Fetch Deletions
      const delList = await fetchAccountDeletions()
      setDeletions(delList)

      // 5. Fetch Recommendations
      const { data: recsData } = await (supabase.from('recommendations') as any)
        .select('*')
        .order('created_at', { ascending: false })
      setRecommendations(recsData || [])
    } catch (err) {
      captureAppError(err, 'admin_data_load')
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
            <li>Buscá tu usuario y en <strong>App Metadata</strong> agregá <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-700">"role": "admin"</code>.</li>
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

  const loadJobAudit = async (jobId: string) => {
    const { data } = await (supabase.from('admin_job_request_actions') as any)
      .select('id, job_request_id, admin_user_id, action, previous_status, new_status, previous_archived_at, new_archived_at, created_at')
      .eq('job_request_id', jobId)
      .order('created_at', { ascending: false })
    return (data || []).map((event: any) => ({
      ...event,
      admin: profiles.find((profile) => profile.id === event.admin_user_id) || null,
    }))
  }

  const openJobDetails = async (job: any) => {
    const audit = await loadJobAudit(job.id)
    setSelectedJob({ ...job, audit })
  }

  const openJobDetailsById = async (jobId: string) => {
    if (!jobId) return
    const existing = jobRequests.find((item) => item.id === jobId)
    if (existing) {
      await openJobDetails(existing)
      return
    }

    setJobLoadingId(jobId)
    try {
      const { data: fetchedJob, error: jobFetchError } = await (supabase.from('job_requests') as any)
        .select('*')
        .eq('id', jobId)
        .maybeSingle()

      if (jobFetchError) {
        setActionMessage(`No se pudo consultar el pedido: ${jobFetchError.message}`)
        return
      }

      if (!fetchedJob) {
        setActionMessage(`El pedido #${jobId} no existe o no se encontró en el sistema.`)
        return
      }

      const clientProfile = fetchedJob.client_id ? profiles.find((p) => p.id === fetchedJob.client_id) || null : null
      const proProfile = profiles.find((p) => p.id === fetchedJob.profile_id) || null
      const linkedReports = reports.filter((r) => r.job_request_id === fetchedJob.id)

      const hydratedJob = {
        ...fetchedJob,
        client_profile: clientProfile,
        professional_profile: proProfile,
        linked_reports: linkedReports,
      }

      setJobRequests((prev) => [hydratedJob, ...prev.filter((j) => j.id !== hydratedJob.id)])
      await openJobDetails(hydratedJob)
    } catch (err: any) {
      captureAppError(err, 'admin_open_job_by_id')
      setActionMessage('Ocurrió un error inesperado al cargar el pedido.')
    } finally {
      setJobLoadingId(null)
    }
  }

  const handleAdminJobAction = async (job: any, action: 'finalized' | 'cancelled' | 'archived' | 'unarchived') => {
    const labels: Record<string, string> = {
      finalized: 'finalización',
      cancelled: 'cancelación',
    }
    if (labels[action] && !window.confirm(`¿Confirmar ${labels[action]} del pedido #${job.id}?`)) return

    const { data, error } = await (supabase.rpc as any)('admin_manage_job_request', {
      target_job_request_id: job.id,
      requested_action: action,
    })
    if (error) {
      setActionMessage(`No se pudo actualizar el pedido: ${error.message}`)
      return
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result) {
      setActionMessage('La operación no devolvió un pedido actualizado.')
      return
    }
    const updated = {
      ...job,
      status: result.status,
      archived_at: result.archived_at,
      audit: await loadJobAudit(job.id),
    }
    setJobRequests((items) => items.map((item) => item.id === job.id ? { ...item, ...updated } : item))
    setSelectedJob(updated)
    setActionMessage('Pedido actualizado y acción administrativa registrada.')
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
    const result = await updateProfileVisibility(profileId, nextStatus)
    if (result.error) {
      setActionMessage(`No se pudo actualizar la visibilidad: ${result.error}`)
      return
    }
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
    const { error } = await (supabase.from('profiles') as any)
      .update({
        whatsapp_verified: nextVal,
        whatsapp_verified_at: nextVal ? now : null,
      })
      .eq('id', profileId)
    if (error) {
      setActionMessage(`No se pudo actualizar la certificación de WhatsApp: ${error.message}`)
      return
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

  const openProfileEditor = async (profile: any) => {
    setEditingProfile(profile)
    setCredentialsOpen(false)
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
      email: '',
      password: '',
    })
    const { data: email } = await (supabase.rpc as any)('admin_get_user_email', { target_user_id: profile.id })
    setEditForm((current: any) => ({ ...current, email: email || '' }))
  }

  const handleUpdateCredentials = async () => {
    if (!editingProfile || (!editForm.email.trim() && !editForm.password)) {
      setActionMessage('Ingresá un nuevo email o una contraseña para actualizar el acceso.')
      return
    }
    setCredentialsSaving(true)
    const { error } = await (supabase.rpc as any)('admin_update_user_credentials', {
      target_user_id: editingProfile.id,
      new_email: editForm.email.trim() || null,
      new_password: editForm.password || null,
    })
    setCredentialsSaving(false)
    if (error) {
      setActionMessage(`No se pudo actualizar el acceso: ${error.message}. Aplicá migration_admin_account_access.sql en Supabase.`)
      return
    }
    setEditForm((current: any) => ({ ...current, password: '' }))
    setCredentialsOpen(false)
    setActionMessage('Datos de acceso actualizados correctamente.')
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
    if (profileFilter === 'activos' && p.status !== 'activo') return false
    if (profileFilter === 'privados' && p.status !== 'oculto') return false
    if (profileFilter === 'verificados' && p.whatsapp_verified !== true) return false
    if (profileFilter === 'suspendidos' && p.status !== 'suspendido') return false
    if (profileFilter === 'incompletos' && p.completion_percent >= 100) return false
    const filters = adminFilters
    const searchable = normalizeSearchText([p.name, p.slug, p.bio, p.provincia, p.localidad, ...(p.skills || []).map((skill: any) => skill.name), ...(p.services || []).map((service: any) => service.title)].filter(Boolean).join(' '))
    if (filters.query && !searchable.includes(normalizeSearchText(filters.query))) return false
    if (filters.provincia && p.provincia !== filters.provincia) return false
    if (filters.localidad && p.localidad !== filters.localidad) return false
    if (filters.modalidad && p.modalidad !== filters.modalidad) return false
    if (filters.disponibilidad && p.disponibilidad !== filters.disponibilidad) return false
    if (filters.accountType && p.account_type !== filters.accountType) return false
    const declaredIntent = normalizeProfileIntent(p.intent)
    const historicalProvider = declaredIntent === null && isProviderProfile({
      ...p,
      skills: p.skills || [],
      services: p.services || [],
      contact_methods: p.contact_methods || [],
    })
    if (filters.providerKind === 'proveedor' && !(declaredIntent === 'ofrecer' || declaredIntent === 'ambas' || historicalProvider)) return false
    if (filters.providerKind === 'buscar' && declaredIntent !== 'buscar') return false
    if (filters.providerKind === 'sin_declarar' && declaredIntent !== null) return false
    if (filters.verification === 'verificado' && !p.whatsapp_verified) return false
    if (filters.verification === 'pendiente' && p.whatsapp_verified) return false
    if (filters.completion === 'completo' && p.completion_percent < 100) return false
    if (filters.completion === 'incompleto' && p.completion_percent >= 100) return false
    if (filters.dateFrom && new Date(p.created_at) < new Date(`${filters.dateFrom}T00:00:00`)) return false
    if (filters.dateTo && new Date(p.created_at) > new Date(`${filters.dateTo}T23:59:59`)) return false
    if (filters.category) {
      const category = CATEGORIES.find((item) => item.name === filters.category)
      const categoryText = normalizeSearchText([category?.name, ...(category?.subcategories || [])].filter(Boolean).join(' '))
      const workText = normalizeSearchText([...(p.skills || []).map((skill: any) => skill.name), ...(p.services || []).map((service: any) => service.title)].join(' '))
      if (!categoryText.split(' ').some((term) => term.length > 3 && workText.includes(term))) return false
    }
    return true
  })

  const selectedProvince = PROVINCES.find((province) => province.name === adminFilters.provincia)
  const setAdminFilter = (key: keyof typeof adminFilters, value: string) => setAdminFilters((current) => ({ ...current, [key]: value }))
  const resetAdminFilters = () => {
    setProfileFilter('todos')
    setAdminFilters({ query: '', provincia: '', localidad: '', category: '', modalidad: '', disponibilidad: '', accountType: '', providerKind: 'todos', verification: 'todos', completion: 'todos', dateFrom: '', dateTo: '' })
  }
  const handleSaveSettings = async () => {
    const digits = settingsForm.replace(/\D/g, '')
    if (digits.length < 8) {
      setActionMessage('Ingresá un número oficial de WhatsApp válido.')
      return
    }
    setSettingsSaving(true)
    const result = await saveOperationalSetting('official_whatsapp', digits)
    setSettingsSaving(false)
    setActionMessage(result.error ? `No se pudo guardar la configuración: ${result.error.message}. Aplicá migration_admin_settings_and_job_archiving.sql.` : 'Configuración operativa guardada. Los nuevos enlaces usarán este número.')
  }

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

  const handleAdminModerateRec = async (id: string, newStatus: string) => {
    try {
      const { error } = await (supabase.from('recommendations') as any)
        .update({ status: newStatus })
        .eq('id', id)

      if (error) {
        const { error: rpcError } = await (supabase.rpc as any)('admin_moderate_recommendation', {
          target_id: id,
          target_status: newStatus,
        })
        if (rpcError) {
          setActionMessage(`No se pudo actualizar la reseña: ${rpcError.message}. Aplicá migration_admin_reviews_moderation.sql en Supabase.`)
          return
        }
      }

      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      )
      setActionMessage(`Reseña marcada como ${newStatus}.`)
    } catch (err: any) {
      setActionMessage(`Error al moderar reseña: ${err.message}`)
    }
  }

  const handleAdminDeleteRec = async (id: string) => {
    if (!window.confirm('¿Confirmás que querés eliminar esta reseña definitivamente?')) return
    try {
      // 1. Probar RPC delete_recommendation
      const { error: rpcError } = await (supabase.rpc as any)('delete_recommendation', {
        target_id: id,
      })

      if (!rpcError) {
        setRecommendations((prev) => prev.filter((r) => r.id !== id))
        setActionMessage('Reseña eliminada definitivamente.')
        return
      }

      // 2. Probar RPC admin_delete_recommendation
      const { error: adminRpcError } = await (supabase.rpc as any)('admin_delete_recommendation', {
        target_id: id,
      })

      if (!adminRpcError) {
        setRecommendations((prev) => prev.filter((r) => r.id !== id))
        setActionMessage('Reseña eliminada definitivamente.')
        return
      }

      // 3. Fallback con DELETE directo y verificación de filas afectadas
      const { data: deleted, error: deleteError } = await (supabase.from('recommendations') as any)
        .delete()
        .eq('id', id)
        .select('id')

      if (deleteError) {
        setActionMessage(`Error al eliminar reseña: ${deleteError.message}`)
        return
      }

      if (!deleted || deleted.length === 0) {
        setActionMessage('No se pudo eliminar en la base de datos. Por favor aplicá el script supabase/migration_fix_reviews_and_notifications.sql en Supabase.')
        return
      }

      setRecommendations((prev) => prev.filter((r) => r.id !== id))
      setActionMessage('Reseña eliminada definitivamente.')
    } catch (err: any) {
      setActionMessage(`Error al eliminar reseña: ${err.message}`)
    }
  }

  const filteredRecommendations = recommendations.filter((rec) => {
    if (recStatusFilter === 'pendientes' && rec.status !== 'pendiente') return false
    if (recStatusFilter === 'visibles' && rec.status !== 'visible') return false
    if (recStatusFilter === 'ocultas' && rec.status !== 'oculto') return false
    if (recStatusFilter === 'anonimas' && rec.from_user_id !== null) return false

    if (recSearch.trim()) {
      const targetProfile = profiles.find((p) => p.id === rec.to_profile_id)
      const term = recSearch.toLowerCase()
      const matchesTarget = targetProfile?.name?.toLowerCase().includes(term) || targetProfile?.slug?.toLowerCase().includes(term)
      const matchesAuthor = rec.from_name?.toLowerCase().includes(term)
      const matchesText = rec.text?.toLowerCase().includes(term) || rec.context?.toLowerCase().includes(term)
      if (!matchesTarget && !matchesAuthor && !matchesText) return false
    }

    return true
  })

  const pendingReviewsCount = recommendations.filter((r) => r.status === 'pendiente').length

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
          onClick={() => setActiveTab('jobs')}
          className={`pb-3 px-4 font-heading font-semibold text-xs sm:text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 cursor-pointer ${activeTab === 'jobs' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'}`}
        >
          <ClipboardList size={16} /> Pedidos ({jobRequests.length})
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

        <button
          onClick={() => setActiveTab('reviews')}
          className={`pb-3 px-4 font-heading font-semibold text-xs sm:text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === 'reviews'
              ? 'border-[var(--color-laburante-indigo)] text-[var(--color-laburante-indigo)]'
              : 'border-transparent text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'
          }`}
        >
          <Star size={16} />
          Reseñas ({recommendations.length})
          {pendingReviewsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              {pendingReviewsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-4 font-heading font-semibold text-xs sm:text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 cursor-pointer ${activeTab === 'settings' ? 'border-[var(--color-laburante-indigo)] text-[var(--color-laburante-indigo)]' : 'border-transparent text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'}`}
        >
          <KeyRound size={16} /> Configuración
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

      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-950">
            <p className="font-bold">Pedidos administrables</p>
            <p className="mt-1 leading-relaxed">Consultá el contexto completo del pedido y aplicá únicamente acciones administrativas registradas.</p>
          </div>
          {jobRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-laburante-border)] p-8 text-center text-xs text-[var(--color-laburante-text-secondary)]">No hay pedidos disponibles.</div>
          ) : (
            <div className="space-y-3">
              {jobRequests.map((job) => (
                <article key={job.id} className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading font-bold text-sm">{job.title}</h3>
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-800">{job.status}</span>
                        {job.archived_at && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-700">Archivado</span>}
                      </div>
                      <p className="truncate text-[11px] text-[var(--color-laburante-text-muted)]">ID: {job.id}</p>
                      <p className="text-xs text-[var(--color-laburante-text-secondary)]">Cliente: {job.client_profile?.name || job.client_name || 'Sin perfil'} · Profesional: {job.professional_profile?.name || 'Sin perfil'}</p>
                      <p className="text-[11px] text-[var(--color-laburante-text-muted)]">{new Date(job.created_at).toLocaleDateString()} · Reportes vinculados: {job.linked_reports?.length || 0}</p>
                    </div>
                    <button type="button" onClick={() => openJobDetails(job)} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-700 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-800"><Eye size={14} /> Ver pedido</button>
                  </div>
                </article>
              ))}
            </div>
          )}
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
                  {rep.job_request_id && (
                    <button
                      type="button"
                      onClick={() => openJobDetailsById(rep.job_request_id)}
                      disabled={jobLoadingId === rep.job_request_id}
                      className="text-[var(--color-laburante-indigo)] underline font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      {jobLoadingId === rep.job_request_id ? 'Cargando pedido...' : `Ver pedido vinculado #${rep.job_request_id}`}
                    </button>
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

          <div className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-[var(--color-laburante-text)]">Filtros de auditoría</p>
              <button type="button" onClick={resetAdminFilters} className="text-[11px] font-semibold text-[var(--color-laburante-indigo)] hover:underline">Limpiar filtros</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input value={adminFilters.query} onChange={(event) => setAdminFilter('query', event.target.value)} placeholder="Nombre, oficio, contacto..." className="rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-xs sm:col-span-2" />
              <select value={adminFilters.accountType} onChange={(event) => setAdminFilter('accountType', event.target.value)} className="rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-xs"><option value="">Tipo de cuenta</option><option value="persona">Persona</option><option value="empresa">Empresa</option></select>
              <select value={adminFilters.providerKind} onChange={(event) => setAdminFilter('providerKind', event.target.value)} className="rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-xs"><option value="todos">Intención: todas</option><option value="proveedor">Ofrece servicios</option><option value="buscar">Solo busca</option><option value="sin_declarar">Sin declarar</option></select>
              <select value={adminFilters.provincia} onChange={(event) => { setAdminFilter('provincia', event.target.value); setAdminFilter('localidad', '') }} className="rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-xs"><option value="">Provincia</option>{PROVINCES.map((province) => <option key={province.name} value={province.name}>{province.name}</option>)}</select>
              <select value={adminFilters.localidad} onChange={(event) => setAdminFilter('localidad', event.target.value)} className="rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-xs"><option value="">Localidad</option>{(selectedProvince?.localidades || []).map((localidad) => <option key={localidad} value={localidad}>{localidad}</option>)}</select>
              <select value={adminFilters.category} onChange={(event) => setAdminFilter('category', event.target.value)} className="rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-xs"><option value="">Categoría / rubro</option>{CATEGORIES.filter((category) => !category.hidden).map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select>
              <select value={adminFilters.modalidad} onChange={(event) => setAdminFilter('modalidad', event.target.value)} className="rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-xs"><option value="">Modalidad</option><option value="presencial">Presencial</option><option value="remoto">Remoto</option><option value="ambas">Ambas</option></select>
              <select value={adminFilters.disponibilidad} onChange={(event) => setAdminFilter('disponibilidad', event.target.value)} className="rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-xs"><option value="">Disponibilidad</option><option value="disponible">Disponible</option><option value="ocupado">Ocupado</option><option value="no_disponible">No disponible</option></select>
              <select value={adminFilters.verification} onChange={(event) => setAdminFilter('verification', event.target.value)} className="rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-xs"><option value="todos">WhatsApp: todos</option><option value="verificado">Verificado</option><option value="pendiente">Sin verificar</option></select>
              <select value={adminFilters.completion} onChange={(event) => setAdminFilter('completion', event.target.value)} className="rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-xs"><option value="todos">Completitud: todas</option><option value="completo">100%</option><option value="incompleto">Incompleto</option></select>
              <label className="flex items-center gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-[11px] text-[var(--color-laburante-text-muted)]">Desde<input type="date" value={adminFilters.dateFrom} onChange={(event) => setAdminFilter('dateFrom', event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-[var(--color-laburante-text)]" /></label>
              <label className="flex items-center gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-[11px] text-[var(--color-laburante-text-muted)]">Hasta<input type="date" value={adminFilters.dateTo} onChange={(event) => setAdminFilter('dateTo', event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-[var(--color-laburante-text)]" /></label>
            </div>
            <p className="text-[11px] text-[var(--color-laburante-text-muted)]">Mostrando {filteredProfiles.length} de {profiles.length} cuentas.</p>
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

      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-4">
          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
            <div className="flex items-center gap-2 text-indigo-900"><KeyRound size={18} /><h2 className="font-heading text-lg font-bold">Configuración operativa</h2></div>
            <p className="mt-2 text-xs leading-relaxed text-indigo-950/75">Estos valores se guardan en Supabase y reemplazan los enlaces operativos sin tocar los botones ni la verificación existente.</p>
          </section>
          <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5 space-y-3">
            <label className="block text-xs font-bold text-[var(--color-laburante-text)]">WhatsApp oficial de LABURANTE</label>
            <input value={settingsForm} onChange={(event) => setSettingsForm(event.target.value)} placeholder="549..." inputMode="tel" className="w-full rounded-xl border border-[var(--color-laburante-border)] px-3 py-2.5 text-sm" />
            <p className="text-[11px] text-[var(--color-laburante-text-muted)]">Actual: {operationalSettings.officialWhatsAppFormatted}. Usá el formato internacional, sin espacios ni símbolos.</p>
            {operationalSettings.source === 'fallback' && <p className="text-[11px] font-semibold text-amber-800">No se pudo confirmar la configuración remota. El valor mostrado es un respaldo integrado y no se considera confirmado por Admin hasta leer Supabase.</p>}
            <button type="button" onClick={handleSaveSettings} disabled={settingsSaving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Save size={14} /> {settingsSaving ? 'Guardando...' : 'Guardar configuración'}</button>
          </section>
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
              <div><div className="flex flex-wrap items-center gap-2"><Building2 size={17} className="text-indigo-600" /><h3 className="font-heading font-bold text-sm">{company.name}</h3><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">EMPRESA</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${company.company_plan === 'pago' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>{company.company_plan === 'pago' ? 'ACTIVACIÓN COORDINADA' : 'CUENTA GRATUITA'}</span></div><p className="mt-1 text-xs text-[var(--color-laburante-text-secondary)]">{company.localidad}, {company.provincia} · Alta {new Date(company.created_at).toLocaleDateString()}</p></div>
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
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/50 p-3">
              {editingProfile.photo_url ? <img src={editingProfile.photo_url} alt={`Foto de ${editingProfile.name}`} className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xs text-[var(--color-laburante-text-muted)]">Sin foto</div>}
              <div className="space-y-1 text-xs">
                <p className="font-bold">Material del perfil</p>
                <p className={editingProfile.resume_url ? 'text-emerald-700' : 'text-[var(--color-laburante-text-muted)]'}>{editingProfile.resume_url ? 'CV cargado' : 'Sin CV cargado'}</p>
                {editingProfile.resume_url && <a href={editingProfile.resume_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--color-laburante-indigo)] hover:underline"><Eye size={12} /> Ver CV</a>}
              </div>
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
            <div className="mt-4 border-t border-[var(--color-laburante-border)] pt-4">
              <button type="button" onClick={() => setCredentialsOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800"><KeyRound size={14} /> {credentialsOpen ? 'Ocultar cambio de acceso' : 'Cambiar email o contraseña'}</button>
              {credentialsOpen && <div className="mt-3 grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">Email de acceso<input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Cargando email..." className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-sm" /></label>
                <label className="text-xs font-semibold">Nueva contraseña<input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Dejar vacío para no cambiarla" minLength={6} className="mt-1 w-full rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-2 text-sm" /></label>
                <p className="flex items-center gap-1 text-[11px] text-indigo-900 sm:col-span-2"><Mail size={13} /> El usuario podrá ingresar con el email y la contraseña nuevos.</p>
                <button type="button" disabled={credentialsSaving} onClick={handleUpdateCredentials} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60 sm:col-span-2"><KeyRound size={14} /> {credentialsSaving ? 'Actualizando...' : 'Guardar datos de acceso'}</button>
              </div>}
            </div>
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

      {/* Tab: Reviews / Reseñas */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs text-amber-950 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-900">
              <Star size={15} className="text-amber-600 fill-amber-500" />
              Gestión y moderación integral de reseñas
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Supervisá todas las reseñas y recomendaciones de la plataforma. Podés publicarlas, ocultarlas o eliminarlas de forma definitiva si son spam o reseñas anónimas no válidas.
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['todas', 'pendientes', 'visibles', 'ocultas', 'anonimas'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setRecStatusFilter(status)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-colors capitalize cursor-pointer ${
                    recStatusFilter === status
                      ? 'btn-dark'
                      : 'border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-secondary)]'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex-1 max-w-xs">
              <input
                type="text"
                value={recSearch}
                onChange={(e) => setRecSearch(e.target.value)}
                placeholder="Buscar por perfil, autor o texto..."
                className="w-full rounded-xl border border-[var(--color-laburante-border)] bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
              />
            </div>
          </div>

          {filteredRecommendations.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-xs text-[var(--color-laburante-text-secondary)]">
              No se encontraron reseñas con los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecommendations.map((rec) => {
                const targetProfile = profiles.find((p) => p.id === rec.to_profile_id)
                const isAnonymous = !rec.from_user_id
                return (
                  <div
                    key={rec.id}
                    className={`p-5 rounded-2xl border bg-[var(--color-laburante-surface)] space-y-3 ${
                      rec.status === 'pendiente'
                        ? 'border-amber-300'
                        : rec.status === 'visible'
                        ? 'border-emerald-200'
                        : 'border-[var(--color-laburante-border)]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--color-laburante-border)]/60">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            rec.status === 'visible'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rec.status === 'pendiente'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {rec.status === 'visible' ? 'Publicada' : rec.status === 'pendiente' ? 'Pendiente' : 'Oculta'}
                        </span>
                        {isAnonymous ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            Anónima (sin usuario)
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Usuario registrado
                          </span>
                        )}
                        <h4 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                          Autor: {rec.from_name}
                        </h4>
                      </div>
                      <span className="text-xs text-[var(--color-laburante-text-muted)]">
                        {new Date(rec.created_at).toLocaleDateString()} {new Date(rec.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-xs text-[var(--color-laburante-text-secondary)] space-y-1.5">
                      <p>
                        <strong>Perfil receptor:</strong>{' '}
                        {targetProfile ? (
                          <Link
                            to={`/p/${targetProfile.slug}#resenas`}
                            target="_blank"
                            className="text-[var(--color-laburante-indigo)] underline font-semibold"
                          >
                            {targetProfile.name} (@{targetProfile.slug})
                          </Link>
                        ) : (
                          <span>ID: {rec.to_profile_id}</span>
                        )}
                      </p>
                      {rec.context && (
                        <p className="text-[11px] text-[var(--color-laburante-indigo)] font-medium">
                          <strong>Trabajo realizado:</strong> {rec.context}
                        </p>
                      )}
                      <div className="p-3 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] text-xs text-[var(--color-laburante-text)] leading-relaxed italic">
                        "{rec.text}"
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-laburante-border)]/40">
                      {rec.status !== 'visible' && (
                        <button
                          type="button"
                          onClick={() => handleAdminModerateRec(rec.id, 'visible')}
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={13} />
                          Hacer visible
                        </button>
                      )}
                      {rec.status === 'visible' && (
                        <button
                          type="button"
                          onClick={() => handleAdminModerateRec(rec.id, 'oculto')}
                          className="py-1.5 px-3 rounded-lg border border-amber-300 hover:bg-amber-50 text-amber-900 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <EyeOff size={13} />
                          Ocultar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAdminDeleteRec(rec.id)}
                        className="py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer ml-auto"
                      >
                        <Trash2 size={13} />
                        Eliminar definitivamente
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 text-xs text-indigo-950 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-indigo-900">
              <KeyRound size={15} className="text-indigo-600" />
              Configuración operativa de la plataforma
            </p>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              Número oficial de WhatsApp de LABURANTE para derivación de consultas, contacto y soporte institucional.
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1">
                Línea oficial de WhatsApp
              </label>
              <input
                type="text"
                value={settingsForm}
                onChange={(e) => setSettingsForm(e.target.value)}
                placeholder="ej: 5491123456789"
                className="w-full rounded-xl border border-[var(--color-laburante-border)] px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={settingsSaving}
              onClick={handleSaveSettings}
              className="btn-dark px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {settingsSaving ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </div>
      )}

      {/* Floating Administrative Modal: Detalle de Pedido */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedJob(null)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-150 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close X */}
            <div className="flex flex-col gap-3 border-b border-[var(--color-laburante-border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-800">
                    Detalle administrativo de pedido
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-800">
                    {selectedJob.status || 'No disponible'}
                  </span>
                  {selectedJob.archived_at && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      Archivado
                    </span>
                  )}
                </div>
                <h2 className="mt-2 font-heading text-xl sm:text-2xl font-bold text-[var(--color-laburante-text)]">
                  {selectedJob.title || 'Sin título'}
                </h2>
                <p className="mt-1 break-all text-[11px] text-[var(--color-laburante-text-muted)]">
                  ID: <span className="font-mono">{selectedJob.id}</span> · Creado el {selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleString() : 'No registrado'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="p-1.5 rounded-xl text-[var(--color-laburante-text-muted)] hover:bg-[var(--color-laburante-surface-alt)] hover:text-[var(--color-laburante-text)] transition-colors self-start cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Grid of Sections */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Section: Pedido */}
              <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/30 p-4 text-xs space-y-2">
                <h3 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">Descripción del trabajo</h3>
                <p className="whitespace-pre-wrap leading-relaxed text-[var(--color-laburante-text-secondary)]">
                  {selectedJob.description || 'No disponible'}
                </p>
                <div className="pt-2 border-t border-[var(--color-laburante-border)]/60 space-y-1 text-[11px]">
                  <p><strong>Urgencia:</strong> {selectedJob.urgency ? selectedJob.urgency.replace(/_/g, ' ') : 'No disponible'}</p>
                  <p><strong>Fecha preferida:</strong> {selectedJob.preferred_date || 'No informada'}</p>
                  <p><strong>Archivado:</strong> {selectedJob.archived_at ? new Date(selectedJob.archived_at).toLocaleString() : 'No'}</p>
                </div>
              </section>

              {/* Section: Participantes */}
              <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/30 p-4 text-xs space-y-2">
                <h3 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">Participantes</h3>
                <div className="space-y-1">
                  <p>
                    <strong>Cliente:</strong> {selectedJob.client_profile?.name || selectedJob.client_name || 'No disponible'}
                    {selectedJob.client_contact ? ` · ${selectedJob.client_contact}` : ''}
                  </p>
                  <p><strong>Ubicación indicada:</strong> {selectedJob.client_location || 'No informada'}</p>
                </div>
                <div className="pt-2 border-t border-[var(--color-laburante-border)]/60 space-y-1">
                  <p><strong>Profesional:</strong> {selectedJob.professional_profile?.name || 'Sin perfil'}</p>
                  {selectedJob.professional_profile?.slug ? (
                    <Link
                      to={`/p/${selectedJob.professional_profile.slug}`}
                      target="_blank"
                      className="mt-1 inline-flex items-center gap-1 text-[var(--color-laburante-indigo)] underline font-medium"
                    >
                      Ver perfil público profesional
                    </Link>
                  ) : (
                    <span className="text-[var(--color-laburante-text-muted)] text-[11px]">Sin slug de perfil</span>
                  )}
                </div>
              </section>

              {/* Section: Presupuesto vigente */}
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs space-y-2">
                <h3 className="flex items-center gap-1.5 font-heading font-bold text-sm text-emerald-950">
                  <DollarSign size={16} className="text-emerald-700" /> Presupuesto vigente
                </h3>
                {selectedJob.budget_amount ? (
                  <div className="space-y-1.5 text-emerald-900">
                    <p className="text-base font-extrabold text-emerald-950">${selectedJob.budget_amount}</p>
                    <p><strong>Detalles / Condiciones:</strong> {selectedJob.budget_details || 'Sin detalles adicionales'}</p>
                    <p><strong>Tiempo estimado:</strong> {selectedJob.budget_estimated_time || 'No informado'}</p>
                    <p className="text-[11px] text-emerald-800/80">
                      <strong>Fecha del presupuesto:</strong> {selectedJob.budget_created_at ? new Date(selectedJob.budget_created_at).toLocaleString() : 'No registrado'}
                    </p>
                  </div>
                ) : (
                  <p className="text-emerald-800/80 italic">Aún no se ha emitido un presupuesto formal para este pedido.</p>
                )}
              </section>

              {/* Section: Resultados / Cancelación */}
              <section className={`rounded-2xl p-4 text-xs space-y-2 border ${
                selectedJob.status === 'cancelado' || selectedJob.cancelled_by || selectedJob.cancel_reason
                  ? 'border-rose-200 bg-rose-50/50 text-rose-950'
                  : 'border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/30'
              }`}>
                <h3 className="font-heading font-bold text-sm">
                  {selectedJob.status === 'cancelado' || selectedJob.cancelled_by || selectedJob.cancel_reason
                    ? 'Cancelación'
                    : 'Resultados informados'}
                </h3>
                {selectedJob.status === 'cancelado' || selectedJob.cancelled_by || selectedJob.cancel_reason ? (
                  <div className="space-y-1 text-rose-900">
                    <p><strong>Quién canceló:</strong> {selectedJob.cancelled_by ? (selectedJob.cancelled_by === 'cliente' ? 'Cliente' : 'Profesional') : 'No registrado'}</p>
                    <p><strong>Motivo de cancelación:</strong> {selectedJob.cancel_reason || 'Sin motivo especificado'}</p>
                  </div>
                ) : (
                  <div className="space-y-1 text-[var(--color-laburante-text-secondary)]">
                    <p><strong>Respuesta del cliente:</strong> {selectedJob.client_outcome || 'Sin respuesta'}</p>
                    <p><strong>Respuesta del profesional:</strong> {selectedJob.professional_outcome || 'Sin respuesta'}</p>
                    {selectedJob.outcome_note && <p><strong>Nota:</strong> {selectedJob.outcome_note}</p>}
                    <p className="text-[11px] text-[var(--color-laburante-text-muted)]">
                      <strong>Actualizado:</strong> {selectedJob.outcome_updated_at ? new Date(selectedJob.outcome_updated_at).toLocaleString() : 'No registrado'}
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* Section: Fotos y Adjuntos */}
            <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/20 p-4 text-xs space-y-3">
              <h3 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                Fotos y archivos adjuntos ({selectedJob.photos?.length || 0})
              </h3>
              {selectedJob.photos && selectedJob.photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {selectedJob.photos.map((photo: string, idx: number) => {
                    const isValid = isValidPhotoUrl(photo)
                    return (
                      <div key={idx} className="group relative rounded-xl border border-[var(--color-laburante-border)] overflow-hidden bg-slate-100 aspect-square flex items-center justify-center">
                        {isValid ? (
                          <img
                            src={photo}
                            alt={`Adjunto ${idx + 1} del pedido`}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform group-hover:scale-105 cursor-pointer"
                            onClick={() => window.open(photo, '_blank')}
                            title="Click para abrir imagen en pestaña nueva"
                          />
                        ) : (
                          <p className="p-2 text-[10px] text-center text-slate-500 font-medium">
                            Archivo adjunto no compatible para vista previa.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[var(--color-laburante-text-muted)] italic">
                  El pedido no incluye fotos ni archivos adjuntos.
                </p>
              )}
            </section>

            {/* Section: Reclamos y Reportes vinculados */}
            <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs space-y-3">
              <h3 className="font-heading font-bold text-sm text-amber-950">
                Reportes y reclamos vinculados ({selectedJob.linked_reports?.length || 0})
              </h3>
              {selectedJob.linked_reports?.length ? (
                <div className="space-y-2">
                  {selectedJob.linked_reports.map((report: any) => (
                    <article key={report.id} className="rounded-xl border border-amber-200 bg-white p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-bold text-amber-950">
                          Reporte #{report.id.slice(0, 8)} · {report.reason ? report.reason.replace(/_/g, ' ') : 'Motivo no especificado'}
                        </p>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                          {report.status || 'pendiente'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Reportó: {report.reporter?.name || report.reporter_id || 'No identificado'} · {report.created_at ? new Date(report.created_at).toLocaleString() : 'Sin fecha'}
                      </p>
                      {report.description && (
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-amber-50/50 p-2 text-[11px] text-slate-800">
                          "{report.description}"
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-amber-900/75 italic">
                  No hay reportes ni reclamos vinculados a este pedido.
                </p>
              )}
            </section>

            {/* Section: Acciones Administrativas */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-laburante-border)] pt-4">
              <div className="flex flex-wrap gap-2">
                {!['completado', 'cancelado'].includes(selectedJob.status) && (
                  <button
                    type="button"
                    onClick={() => handleAdminJobAction(selectedJob, 'finalized')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    <Check size={14} /> Finalizar pedido
                  </button>
                )}
                {!['completado', 'cancelado'].includes(selectedJob.status) && (
                  <button
                    type="button"
                    onClick={() => handleAdminJobAction(selectedJob, 'cancelled')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 px-3.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    <XCircle size={14} /> Cancelar pedido
                  </button>
                )}
                {selectedJob.archived_at ? (
                  <button
                    type="button"
                    onClick={() => handleAdminJobAction(selectedJob, 'unarchived')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 hover:bg-gray-100 px-3.5 py-2 text-xs font-bold text-gray-800 transition-colors cursor-pointer"
                  >
                    <Archive size={14} /> Desarchivar pedido
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAdminJobAction(selectedJob, 'archived')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 hover:bg-gray-100 px-3.5 py-2 text-xs font-bold text-gray-800 transition-colors cursor-pointer"
                  >
                    <Archive size={14} /> Archivar pedido
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="rounded-xl border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] px-4 py-2 text-xs font-semibold text-[var(--color-laburante-text-secondary)] transition-colors cursor-pointer"
              >
                Cerrar detalle
              </button>
            </div>

            {/* Section: Historial Administrativo y Nota de Trazabilidad */}
            <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/30 p-4 text-xs space-y-2">
              <h3 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                Historial de moderación administrativa
              </h3>
              {selectedJob.audit?.length ? (
                <div className="space-y-1.5">
                  {selectedJob.audit.map((event: any) => (
                    <p key={event.id} className="text-[11px] text-[var(--color-laburante-text-secondary)]">
                      <strong className="text-[var(--color-laburante-text)]">{event.action}</strong> por {event.admin?.name || event.admin_user_id} el {new Date(event.created_at).toLocaleString()} · {event.previous_status || 'sin estado'} → {event.new_status || 'sin estado'}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--color-laburante-text-secondary)] italic">
                  No hay acciones administrativas registradas para este pedido.
                </p>
              )}
              <p className="text-[10px] text-[var(--color-laburante-text-muted)] border-t border-[var(--color-laburante-border)]/60 pt-2 leading-relaxed">
                ℹ️ Este dato no puede reconstruirse históricamente con la estructura actual (transiciones directas de usuarios sin intervención administrativa).
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
