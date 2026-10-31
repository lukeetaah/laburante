import { useEffect, useMemo, useState } from 'react'
import { BarChart3, ChevronDown, ChevronRight, Info, RefreshCw, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatRetentionCell, formatWeekRange, type CohortMember, type GrowthCohort, type GrowthSummary } from '@/lib/growth-cohorts'

const numberFormatter = new Intl.NumberFormat('es-AR')

function Metric({ label, value, help }: { label: string; value: number; help: string }) {
  return <article className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-4">
    <p className="text-xs font-semibold text-[var(--color-laburante-text-muted)]">{label}</p>
    <p className="mt-2 font-heading text-2xl font-extrabold">{numberFormatter.format(value)}</p>
    <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-laburante-text-secondary)]">{help}</p>
  </article>
}

function MembersPanel({ title, members, loading }: { title: string; members: CohortMember[]; loading: boolean }) {
  if (loading) return <div className="p-4 text-xs text-[var(--color-laburante-text-muted)]">Cargando integrantes…</div>
  return <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-laburante-border)]">
    <div className="border-b border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] px-3 py-2 text-xs font-bold">{title} · {members.length}</div>
    {members.length === 0 ? <p className="p-4 text-xs text-[var(--color-laburante-text-muted)]">No hay integrantes para este criterio.</p> : <table className="w-full min-w-[680px] text-left text-[11px]"><thead className="text-[var(--color-laburante-text-muted)]"><tr><th className="px-3 py-2">Cuenta</th><th className="px-3 py-2">Creación</th><th className="px-3 py-2">Última conexión</th><th className="px-3 py-2">Perfil actual</th><th className="px-3 py-2">Origen</th></tr></thead><tbody className="divide-y divide-[var(--color-laburante-border)]">{members.map((member) => <tr key={member.user_id}><td className="px-3 py-2 font-semibold">{member.name || 'Cuenta sin perfil'}</td><td className="px-3 py-2">{new Date(member.account_created_at).toLocaleDateString('es-AR')}</td><td className="px-3 py-2">{member.last_sign_in_at ? new Date(member.last_sign_in_at).toLocaleString('es-AR') : 'Nunca ingresó'}</td><td className="px-3 py-2">{member.profile_complete ? 'Completo' : 'Incompleto'} · {member.profile_visible ? 'Visible' : 'No visible'}{member.offers_services ? ' · Ofrece servicios' : ''}</td><td className="px-3 py-2">{member.acquisition_source}</td></tr>)}</tbody></table>}
  </div>
}

export default function GrowthCohorts() {
  const [weeks, setWeeks] = useState(12)
  const [summary, setSummary] = useState<GrowthSummary | null>(null)
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ cohort: string; relativeWeek: number } | null>(null)
  const [members, setMembers] = useState<CohortMember[]>([])
  const [membersTitle, setMembersTitle] = useState('Integrantes')
  const [membersLoading, setMembersLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = async () => {
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('admin_get_growth_cohort_summary', { p_weeks: weeks })
    if (rpcError) setError(`No se pudo cargar el análisis: ${rpcError.message}`)
    else setSummary(data as GrowthSummary)
    setLoading(false)
  }

  useEffect(() => { void loadSummary() }, [weeks])

  const loadMembers = async (cohortWeek: string, relativeWeek: number | null, includeInactive = true) => {
    setMembersLoading(true)
    const { data, error: rpcError } = await supabase.rpc('admin_get_growth_cohort_members', {
      p_cohort_week: cohortWeek,
      p_relative_week: relativeWeek,
      p_include_inactive: includeInactive,
    })
    if (rpcError) setError(`No se pudo cargar el detalle: ${rpcError.message}`)
    else setMembers((data || []) as CohortMember[])
    setMembersLoading(false)
  }

  const maxRelativeWeek = useMemo(() => Math.max(1, ...(summary?.cohorts || []).flatMap((cohort) => cohort.retention.map((cell) => cell.relative_week))), [summary])
  if (loading && !summary) return <div className="rounded-2xl border border-[var(--color-laburante-border)] p-8 text-center text-sm">Cargando adquisición y retención…</div>
  if (!summary) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error || 'El análisis semanal todavía no está disponible.'}</div>

  return <div className="space-y-5">
    <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-5 text-cyan-950">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><BarChart3 size={18} /><h2 className="font-heading text-lg font-bold">Crecimiento real: adquisición, retención y activación</h2></div><div className="flex items-center gap-2"><label className="text-xs font-semibold">Semanas<select value={weeks} onChange={(event) => setWeeks(Number(event.target.value))} className="ml-2 rounded-lg border border-cyan-300 bg-white px-2 py-1 text-xs"><option value="12">12</option><option value="24">24</option><option value="52">52</option></select></label><button type="button" onClick={() => void loadSummary()} className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 bg-white px-2 py-1 text-xs font-bold"><RefreshCw size={13} /> Actualizar</button></div></div>
      <p className="mt-2 max-w-4xl text-xs leading-relaxed">Una cohorte agrupa cuentas por la semana de creación en Auth. La retención sólo cuenta una presencia autenticada registrada por semana; no demuestra publicación de servicios, contratación ni una operación.</p>
      <p className="mt-2 flex items-start gap-1 text-[11px] leading-relaxed text-cyan-900/75"><Info size={13} className="mt-0.5 shrink-0" /> Semanas de lunes a domingo en America/Argentina/Buenos_Aires. La medición histórica de retorno comienza en {summary.measurement_available_from ? formatWeekRange(summary.measurement_available_from, summary.measurement_available_from) : 'la primera semana posterior a la instalación'}; antes de ese punto se muestra «Sin datos». Las cuentas eliminadas no pueden reconstruirse con el esquema histórico existente.</p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Metric label="Cuentas registradas" value={summary.metrics.total_accounts} help="auth.users existentes, sin confundir con perfiles." />
      <Metric label="Altas última semana" value={summary.metrics.new_last_week} help="Cuentas creadas en la semana calendario anterior." />
      <Metric label="Activos última semana" value={summary.metrics.active_last_week} help="Presencia autenticada registrada en esa semana." />
      <Metric label="Perfiles completos" value={summary.metrics.profiles_complete} help="Estado actual según campos útiles existentes." />
      <Metric label="Perfiles visibles" value={summary.metrics.profiles_visible} help="Estado actual: status activo." />
      <Metric label="Ofrecen servicios" value={summary.metrics.service_providers} help="Estado actual: intención ofrecer/ambas y perfil activo." />
    </div>

    <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-heading font-bold">Adquisición semanal</h3><p className="mt-1 text-xs text-[var(--color-laburante-text-secondary)]">Altas de cuentas por semana de creación en Auth. Hacé clic en una fila para revisar su estado actual.</p></div><span className="text-[11px] text-[var(--color-laburante-text-muted)]">{summary.first_week} → {summary.current_week_start}</span></div>
      <div className="mt-3 flex h-32 items-end gap-1 overflow-x-auto border-b border-[var(--color-laburante-border)] px-2 pb-2">{[...summary.cohorts].reverse().map((cohort) => { const max = Math.max(1, ...summary.cohorts.map((item) => item.cohort_size)); const height = Math.max(4, Math.round((cohort.cohort_size / max) * 100)); return <button type="button" key={cohort.week_start} title={`${formatWeekRange(cohort.week_start, cohort.week_end)}: ${cohort.cohort_size} cuentas`} onClick={() => { setSelectedCohort(cohort.week_start); setSelectedCell(null); setMembersTitle(`Cohorte ${formatWeekRange(cohort.week_start, cohort.week_end)}`); void loadMembers(cohort.week_start, null) }} className="flex min-w-8 flex-1 flex-col items-center justify-end gap-1 text-[9px] text-[var(--color-laburante-text-muted)]"><span>{cohort.cohort_size}</span><span className="w-full rounded-t bg-cyan-600" style={{ height: `${height}%` }} /><span className="truncate">{cohort.week_start.slice(5)}</span></button> })}</div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-muted)]"><tr><th className="px-3 py-2">Semana</th><th className="px-3 py-2 text-right">Cuentas nuevas</th><th className="px-3 py-2 text-right">Variación</th><th className="px-3 py-2 text-right">Perfil completo</th><th className="px-3 py-2 text-right">Visible</th><th className="px-3 py-2 text-right">Ofrece servicios</th></tr></thead><tbody className="divide-y divide-[var(--color-laburante-border)]">{summary.cohorts.map((cohort) => <tr key={cohort.week_start} className={`cursor-pointer hover:bg-cyan-50/50 ${selectedCohort === cohort.week_start ? 'bg-cyan-50' : ''}`} onClick={() => { setSelectedCohort(cohort.week_start); setSelectedCell(null); setMembersTitle(`Cohorte ${formatWeekRange(cohort.week_start, cohort.week_end)}`); void loadMembers(cohort.week_start, null) }}><td className="px-3 py-3 font-semibold"><span className="mr-1 inline-block">{selectedCohort === cohort.week_start ? <ChevronDown size={14} className="inline" /> : <ChevronRight size={14} className="inline" />}</span>{formatWeekRange(cohort.week_start, cohort.week_end)}</td><td className="px-3 py-3 text-right font-bold">{cohort.cohort_size}</td><td className="px-3 py-3 text-right">{cohort.previous_size === 0 ? '—' : `${cohort.absolute_change > 0 ? '+' : ''}${cohort.absolute_change} · ${cohort.percent_change}%`}</td><td className="px-3 py-3 text-right">{cohort.profiles_complete} · {cohort.cohort_size ? Math.round(cohort.profiles_complete / cohort.cohort_size * 100) : 0}%</td><td className="px-3 py-3 text-right">{cohort.profiles_visible}</td><td className="px-3 py-3 text-right">{cohort.service_providers}</td></tr>)}</tbody></table></div>
    </section>

    <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-4 sm:p-5">
      <div><h3 className="font-heading font-bold">Retención semanal</h3><p className="mt-1 text-xs text-[var(--color-laburante-text-secondary)]">Cada celda es usuarios activos · porcentaje sobre el tamaño original. W1 es la primera semana posterior a la semana de registro; las semanas futuras no son ceros.</p></div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-[11px]"><thead className="bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-muted)]"><tr><th className="sticky left-0 bg-[var(--color-laburante-surface-alt)] px-3 py-2">Cohorte</th><th className="px-3 py-2 text-right">Usuarios</th>{Array.from({ length: maxRelativeWeek }, (_, index) => <th key={index} className="px-3 py-2 text-right">W{index + 1}</th>)}</tr></thead><tbody className="divide-y divide-[var(--color-laburante-border)]">{summary.cohorts.map((cohort) => <tr key={cohort.week_start}><td className="sticky left-0 bg-[var(--color-laburante-surface)] px-3 py-3 font-semibold">{formatWeekRange(cohort.week_start, cohort.week_end)}</td><td className="px-3 py-3 text-right font-bold">{cohort.cohort_size}</td>{cohort.retention.map((cell) => <td key={cell.relative_week} className={`px-3 py-3 text-right ${cell.state === 'measured' ? 'cursor-pointer font-semibold text-cyan-800 hover:bg-cyan-50' : 'text-[var(--color-laburante-text-muted)]'}`} onClick={() => { if (cell.state !== 'measured') return; setSelectedCell({ cohort: cohort.week_start, relativeWeek: cell.relative_week }); setSelectedCohort(cohort.week_start); setMembersTitle(`Activos W${cell.relative_week} · ${formatWeekRange(cohort.week_start, cohort.week_end)}`); void loadMembers(cohort.week_start, cell.relative_week, false) }}>{formatRetentionCell(cell)}</td>)}</tr>)}</tbody></table></div>
    </section>

    {selectedCohort && <section className="rounded-2xl border border-cyan-200 bg-cyan-50/30 p-4 sm:p-5"><div className="flex items-center gap-2"><Users size={16} className="text-cyan-800" /><h3 className="font-heading font-bold">Detalle trazable</h3></div><p className="mt-1 text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]">Los totales provienen de la misma función que alimenta la matriz. El origen de adquisición figura como «No registrado» porque el esquema auditado no conserva UTM, referidos ni método de registro.</p><MembersPanel title={membersTitle} members={members} loading={membersLoading} /></section>}
    {error && <p className="text-xs text-rose-700">{error}</p>}
  </div>
}
