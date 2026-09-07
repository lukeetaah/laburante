import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { ShieldAlert, Users, AlertTriangle, CheckCircle, Eye, Slash, RefreshCw, Lock } from 'lucide-react'

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuthStore()

  const [activeTab, setActiveTab] = useState<'reports' | 'profiles'>('reports')
  const [reports, setReports] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
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
      const { data: profilesData } = await (supabase.from('profiles') as any)
        .select('id, name, slug, provincia, localidad, status, disponibilidad, created_at')
        .order('created_at', { ascending: false })

      if (profilesData) setProfiles(profilesData)
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
      setActionMessage(`Estado del perfil actualizado a: ${nextStatus.toUpperCase()}.`)
      loadData()
    }
  }

  const pendingReportsCount = reports.filter((r) => r.status === 'pendiente').length

  return (
    <div className="container py-8 md:py-12 max-w-5xl mx-auto space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-laburante-border)]">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <ShieldAlert size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">Panel de Moderación</span>
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
          className="py-2 px-4 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:bg-[var(--color-laburante-surface-alt)] text-xs font-semibold flex items-center gap-2 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refrescar datos
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle size={16} />
          {actionMessage}
        </div>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
          <p className="text-xs text-[var(--color-laburante-text-muted)] font-medium">Perfiles registrados</p>
          <p className="font-heading text-2xl font-bold text-[var(--color-laburante-text)] mt-1">
            {profiles.length}
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
          <p className="text-xs text-[var(--color-laburante-text-muted)] font-medium">Reportes pendientes</p>
          <p className="font-heading text-2xl font-bold text-rose-600 mt-1">
            {pendingReportsCount}
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
          <p className="text-xs text-[var(--color-laburante-text-muted)] font-medium">Perfiles activos</p>
          <p className="font-heading text-2xl font-bold text-emerald-600 mt-1">
            {profiles.filter((p) => p.status === 'activo').length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-laburante-border)]">
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-4 font-heading font-semibold text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'border-[var(--color-laburante-indigo)] text-[var(--color-laburante-indigo)]'
              : 'border-transparent text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'
          }`}
        >
          <AlertTriangle size={16} />
          Reportes recibidos ({reports.length})
        </button>

        <button
          onClick={() => setActiveTab('profiles')}
          className={`pb-3 px-4 font-heading font-semibold text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'profiles'
              ? 'border-[var(--color-laburante-indigo)] text-[var(--color-laburante-indigo)]'
              : 'border-transparent text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'
          }`}
        >
          <Users size={16} />
          Todos los perfiles ({profiles.length})
        </button>
      </div>

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
                      className="py-1.5 px-3 rounded-lg border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-xs font-medium"
                    >
                      Marcar como revisado
                    </button>
                  )}
                  {rep.status !== 'resuelto' && (
                    <button
                      onClick={() => handleUpdateReportStatus(rep.id, 'resuelto')}
                      className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      Resolver reporte
                    </button>
                  )}
                  {rep.profiles?.id && (
                    <button
                      onClick={() => handleToggleProfileStatus(rep.profiles.id, rep.profiles.status)}
                      className="py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1"
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
        <div className="space-y-3">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                    {p.name}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      p.status === 'activo'
                        ? 'bg-emerald-100 text-emerald-800'
                        : p.status === 'suspendido'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-laburante-text-secondary)] mt-0.5">
                  {p.localidad}, {p.provincia} · Registrado el {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/p/${p.slug}`}
                  target="_blank"
                  className="py-1.5 px-3 rounded-xl border border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface-alt)] text-xs font-semibold flex items-center gap-1"
                >
                  <Eye size={14} />
                  Ver
                </Link>
                <button
                  onClick={() => handleToggleProfileStatus(p.id, p.status)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-colors ${
                    p.status === 'suspendido'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {p.status === 'suspendido' ? 'Reactivar' : 'Suspender'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
