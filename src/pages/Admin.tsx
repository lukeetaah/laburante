import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore, type AccountDeletionRecord } from '@/stores/profile-store'
import type { WhatsAppVerificationRequest } from '@/lib/database.types'
import { SITE_CONFIG } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
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
} from 'lucide-react'

const REASON_LABELS: Record<string, string> = {
  trabajo_suficiente: 'Ya consiguió suficiente trabajo',
  sin_consultas: 'No recibió consultas o solicitudes',
  mala_experiencia: 'Problema o desacuerdo con cliente',
  problemas_tecnicos: 'Dificultad técnica con la app',
  cambio_datos: 'Creará otro perfil con otros datos',
  otro: 'Otro motivo',
}

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuthStore()
  const {
    fetchAccountDeletions,
    updateProfileVisibility,
    fetchPendingWhatsAppVerifications,
    adminApproveWhatsAppVerification,
    adminRejectWhatsAppVerification,
  } = useProfileStore()

  const [activeTab, setActiveTab] = useState<'verifications' | 'reports' | 'profiles' | 'companies' | 'deletions'>('verifications')
  const [profileFilter, setProfileFilter] = useState<'todos' | 'activos' | 'privados' | 'verificados' | 'suspendidos'>('todos')
  const [reports, setReports] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [deletions, setDeletions] = useState<AccountDeletionRecord[]>([])
  const [waRequests, setWaRequests] = useState<WhatsAppVerificationRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

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
        .select('id, name, slug, provincia, localidad, status, disponibilidad, account_type, created_at, whatsapp_verified, whatsapp_verified_at')
        .order('created_at', { ascending: false })

      if (resProfiles.error) {
        const resFallback = await (supabase.from('profiles') as any)
          .select('id, name, slug, provincia, localidad, status, disponibilidad, created_at')
          .order('created_at', { ascending: false })
        profilesData = resFallback.data
      } else {
        profilesData = resProfiles.data
      }

      // 3. Fetch WhatsApp verification requests
      const waReqs = await fetchPendingWhatsAppVerifications()
      setWaRequests(waReqs)

      // Ensure any profile with a verification request is visible in the profiles list
      const profileIds = new Set((profilesData || []).map((p: any) => p.id))
      const extraProfiles: any[] = []
      for (const req of waReqs) {
        if (!profileIds.has(req.profile_id)) {
          profileIds.add(req.profile_id)
          extraProfiles.push({
            id: req.profile_id,
            name: req.profile_name,
            slug: req.profile_slug,
            provincia: 'Buenos Aires',
            localidad: 'Zona Norte',
            status: 'activo',
            disponibilidad: 'disponible',
            created_at: req.created_at,
            whatsapp_verified: req.status === 'aprobado',
            whatsapp_verified_at: req.reviewed_at,
          })
          // Also automatically upsert to public.profiles in Supabase in background
          try {
            (supabase.from('profiles') as any).upsert({
              id: req.profile_id,
              name: req.profile_name,
              slug: req.profile_slug,
              provincia: 'Buenos Aires',
              localidad: 'Zona Norte',
              status: 'activo',
              disponibilidad: 'disponible',
              modalidad: 'presencial',
              whatsapp_verified: req.status === 'aprobado',
              whatsapp_verified_at: req.reviewed_at,
            }, { onConflict: 'id' }).then(() => {})
          } catch {}
        }
      }

      // Local WhatsApp cache hydration
      let localWA: Record<string, any> = {}
      try {
        const raw = localStorage.getItem('laburante_verified_wa')
        if (raw) localWA = JSON.parse(raw)
      } catch {}

      const allCombined = [...(profilesData || []), ...extraProfiles]
      if (allCombined.length > 0) {
        const hydrated = allCombined.map((p: any) => ({
          ...p,
          whatsapp_verified: Boolean(p.whatsapp_verified || (localWA[p.id] !== undefined)),
        }))
        setProfiles(hydrated)
      }

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
      const raw = localStorage.getItem('laburante_verified_wa')
      const parsed = raw ? JSON.parse(raw) : {}
      if (nextVal) {
        parsed[profileId] = { phone: 'admin-override', at: now }
      } else {
        delete parsed[profileId]
      }
      localStorage.setItem('laburante_verified_wa', JSON.stringify(parsed))
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

  const pendingReportsCount = reports.filter((r) => r.status === 'pendiente').length
  const pendingWaCount = waRequests.filter((r) => r.status === 'pendiente').length

  const filteredProfiles = profiles.filter((p) => {
    if (profileFilter === 'activos') return p.status === 'activo'
    if (profileFilter === 'privados') return p.status === 'oculto'
    if (profileFilter === 'verificados') return p.whatsapp_verified === true
    if (profileFilter === 'suspendidos') return p.status === 'suspendido'
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
            {(['todos', 'activos', 'privados', 'verificados', 'suspendidos'] as const).map((f) => (
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
            <p className="mt-1 leading-relaxed">Acá aparecen las cuentas que buscan profesionales. Sus perfiles internos quedan ocultos del buscador público y se administran desde este panel.</p>
          </div>
          {profiles.filter((p) => p.account_type === 'empresa').length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-laburante-border)] p-8 text-center text-xs text-[var(--color-laburante-text-secondary)]">Todavía no hay cuentas Empresa sincronizadas. Verificá la migración de Supabase y refrescá los datos.</div>
          ) : profiles.filter((p) => p.account_type === 'empresa').map((company) => (
            <div key={company.id} className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-[var(--color-laburante-surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="flex items-center gap-2"><Building2 size={17} className="text-indigo-600" /><h3 className="font-heading font-bold text-sm">{company.name}</h3><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">EMPRESA</span></div><p className="mt-1 text-xs text-[var(--color-laburante-text-secondary)]">{company.localidad}, {company.provincia} · Alta {new Date(company.created_at).toLocaleDateString()}</p></div>
              <button onClick={() => handleToggleProfileStatus(company.id, company.status)} className="rounded-xl border border-[var(--color-laburante-border)] px-3 py-2 text-xs font-semibold">{company.status === 'suspendido' ? 'Reactivar cuenta' : 'Suspender cuenta'}</button>
            </div>
          ))}
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
