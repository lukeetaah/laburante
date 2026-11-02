import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, ChevronDown, ChevronRight, Info, RefreshCw, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  addCalendarDays,
  formatCompactWeekRange,
  formatRetentionCell,
  formatShortDate,
  formatWeekRange,
  getLastCompleteWeekStarts,
  getMemberPageBounds,
  type CohortMember,
  type CohortMemberPage,
  type GrowthCohort,
  type GrowthSummary,
  type RetentionCell,
} from '@/lib/growth-cohorts'

const numberFormatter = new Intl.NumberFormat('es-AR')
const MEMBERS_PAGE_SIZE = 25
type MemberQuery = { cohortWeek: string; relativeWeek: number | null; includeInactive: boolean }

function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

function ratio(value: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((value / total) * 100)
}

function formatSignedCount(value: number): string {
  if (value > 0) return `+${formatNumber(value)}`
  return formatNumber(value)
}

function StatCard({ label, value, period, help, accent = false }: { label: string; value: string; period: string; help: string; accent?: boolean }) {
  return <article className={`rounded-2xl border p-4 ${accent ? 'border-orange-200 bg-orange-50/70' : 'border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]'}`}>
    <p className="text-xs font-semibold text-[var(--color-laburante-text-muted)]">{label}</p>
    <p className="mt-2 font-heading text-2xl font-extrabold text-[var(--color-laburante-text)]">{value}</p>
    <p className="mt-1 text-[11px] font-semibold text-[var(--color-laburante-text-secondary)]">{period}</p>
    <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-laburante-text-secondary)]">{help}</p>
  </article>
}

function ProgressMetric({ label, value, percent, help }: { label: string; value: string; percent: number | null; help: string }) {
  const progressLabel = percent === null ? 'Sin base disponible' : `${percent}%`
  return <article className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold text-[var(--color-laburante-text-muted)]">{label}</p>
        <p className="mt-1 text-sm font-bold text-[var(--color-laburante-text)]">{value}</p>
      </div>
      <span className="text-sm font-extrabold text-orange-700">{progressLabel}</span>
    </div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-orange-100" role="progressbar" aria-label={`${label}: ${progressLabel}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
      <span className="block h-full rounded-full bg-orange-500 transition-[width]" style={{ width: `${percent ?? 0}%` }} />
    </div>
    <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-laburante-text-secondary)]">{help}</p>
  </article>
}

function MembersPanel({ title, members, totalCount, page, loading, onPageChange }: { title: string; members: CohortMember[]; totalCount: number; page: number; loading: boolean; onPageChange: (page: number) => void }) {
  const { start: firstItem, end: lastItem, hasPrevious, hasNext } = getMemberPageBounds(totalCount, page, MEMBERS_PAGE_SIZE)
  if (loading && members.length === 0) return <div className="p-4 text-xs text-[var(--color-laburante-text-muted)]">Cargando integrantes…</div>
  return <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-laburante-border)]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] px-3 py-2 text-xs font-bold"><span>{title} · {formatNumber(totalCount)}</span>{loading && <span className="font-normal text-[var(--color-laburante-text-muted)]">Actualizando…</span>}</div>
    {members.length === 0 ? <p className="p-4 text-xs text-[var(--color-laburante-text-muted)]">No hay integrantes para este criterio.</p> : <>
      <table className="w-full min-w-[680px] text-left text-[11px]"><thead className="text-[var(--color-laburante-text-muted)]"><tr><th className="px-3 py-2">Cuenta</th><th className="px-3 py-2">Creación</th><th className="px-3 py-2">Última conexión</th><th className="px-3 py-2">Perfil actual</th><th className="px-3 py-2">Origen</th></tr></thead><tbody className="divide-y divide-[var(--color-laburante-border)]">{members.map((member) => <tr key={member.user_id}><td className="px-3 py-2 font-semibold">{member.name || 'Cuenta sin perfil'}</td><td className="px-3 py-2">{new Date(member.account_created_at).toLocaleDateString('es-AR')}</td><td className="px-3 py-2">{member.last_sign_in_at ? new Date(member.last_sign_in_at).toLocaleString('es-AR') : 'Nunca ingresó'}</td><td className="px-3 py-2">{member.profile_complete ? 'Completo' : 'Incompleto'} · {member.profile_visible ? 'Activo' : 'No activo'}{member.offers_services ? ' · Ofrece servicios' : ''}</td><td className="px-3 py-2">{member.acquisition_source}</td></tr>)}</tbody></table>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-laburante-border)] px-3 py-2 text-[11px] text-[var(--color-laburante-text-muted)]"><span>{firstItem}–{lastItem} de {formatNumber(totalCount)}</span><div className="flex gap-2"><button type="button" disabled={!hasPrevious || loading} onClick={() => onPageChange(page - 1)} className="rounded-lg border border-[var(--color-laburante-border)] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button><button type="button" disabled={!hasNext || loading} onClick={() => onPageChange(page + 1)} className="rounded-lg border border-[var(--color-laburante-border)] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button></div></div>
    </>}
  </div>
}

function AcquisitionBars({ cohorts, currentWeekStart, onOpenMembers }: { cohorts: GrowthCohort[]; currentWeekStart: string; onOpenMembers: (query: MemberQuery, title: string) => void }) {
  const rows = [...cohorts].reverse()
  const maxCount = Math.max(1, ...rows.map((cohort) => cohort.cohort_size))
  return <div className="mt-4 space-y-2" role="img" aria-label="Altas de cuentas por semana">
    {rows.map((cohort) => {
      const isCurrent = cohort.week_start === currentWeekStart
      const width = Math.max(3, Math.round((cohort.cohort_size / maxCount) * 100))
      return <button type="button" key={cohort.week_start} onClick={() => onOpenMembers({ cohortWeek: cohort.week_start, relativeWeek: null, includeInactive: true }, `Cohorte ${formatWeekRange(cohort.week_start, cohort.week_end)}`)} className={`grid min-w-[350px] grid-cols-[96px_1fr_48px] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-orange-50 ${isCurrent ? 'bg-orange-50' : ''}`}>
        <div className="text-[11px] font-semibold text-[var(--color-laburante-text-secondary)]"><span className="block">{formatCompactWeekRange(cohort.week_start, cohort.week_end)}</span>{isCurrent && <span className="text-[10px] font-normal text-orange-700">En curso</span>}</div>
        <div className="h-5 rounded-r-full bg-orange-50"><div className={`h-5 rounded-r-full ${isCurrent ? 'bg-orange-500' : 'bg-orange-300'}`} style={{ width: `${width}%` }} /></div>
        <strong className="text-right text-sm text-[var(--color-laburante-text)]">{formatNumber(cohort.cohort_size)}</strong>
      </button>
    })}
  </div>
}

function getRetentionTone(cell: RetentionCell): string {
  if (cell.state === 'in_progress') return 'border-slate-200 bg-slate-100 text-slate-600'
  if (cell.state === 'no_data') return 'border-slate-200 bg-slate-50 text-slate-400'
  if ((cell.retention_percent ?? 0) >= 70) return 'border-orange-300 bg-orange-500 text-white'
  if ((cell.retention_percent ?? 0) >= 40) return 'border-orange-200 bg-orange-300 text-orange-950'
  return 'border-orange-100 bg-orange-100 text-orange-950'
}

function retentionLabel(cell: RetentionCell, cohortSize: number): string {
  if (cell.state === 'measured') return `${cell.active_users ?? 0} de ${cohortSize} · ${cell.retention_percent ?? 0}%`
  return formatRetentionCell(cell)
}

function RetentionTimeline({ summary }: { summary: GrowthSummary }) {
  const instrumentationWeek = summary.instrumentation_started_week
  const firstMeasuredWeek = summary.measurement_available_from
  const firstResultsDate = firstMeasuredWeek ? addCalendarDays(firstMeasuredWeek, 7) : null
  if (!instrumentationWeek || !firstMeasuredWeek) return <div className="mt-4 rounded-xl border border-dashed border-orange-200 bg-orange-50/50 p-5 text-sm text-orange-950">Todavía no hay registros semanales suficientes para iniciar la medición del retorno.</div>
  return <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/50 p-5">
    <div className="flex items-start gap-3"><CalendarDays size={20} className="mt-0.5 shrink-0 text-orange-700" /><div><h4 className="font-heading font-bold text-orange-950">Estamos empezando a medir el retorno de la comunidad.</h4><p className="mt-1 text-xs leading-relaxed text-orange-950/75">La primera semana registrada fue parcial. Los primeros resultados estarán disponibles después de cerrar la primera semana completa.</p></div></div>
    <ol className="mt-5 grid gap-3 md:grid-cols-3">
      <li className="rounded-lg border border-orange-200 bg-white/70 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">Instrumentación inicial</p><p className="mt-1 text-sm font-bold">{formatCompactWeekRange(instrumentationWeek, addCalendarDays(instrumentationWeek, 6))}</p><p className="mt-1 text-[11px] text-orange-950/70">Semana parcial: comenzamos a registrar presencia.</p></li>
      <li className="rounded-lg border border-orange-200 bg-white/70 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">Primera medición</p><p className="mt-1 text-sm font-bold">{formatCompactWeekRange(firstMeasuredWeek, addCalendarDays(firstMeasuredWeek, 6))}</p><p className="mt-1 text-[11px] text-orange-950/70">Primera semana completa que puede medirse.</p></li>
      <li className="rounded-lg border border-orange-200 bg-white/70 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">Primer resultado</p><p className="mt-1 text-sm font-bold">{firstResultsDate ? formatShortDate(firstResultsDate) : 'Pendiente'}</p><p className="mt-1 text-[11px] text-orange-950/70">Disponibilidad estimada al cerrar la semana completa.</p></li>
    </ol>
  </div>
}

function RetentionHeatmap({ summary, onOpenMembers }: { summary: GrowthSummary; onOpenMembers: (query: MemberQuery, title: string) => void }) {
  const maxRelativeWeek = Math.max(1, ...summary.cohorts.flatMap((cohort) => cohort.retention.map((cell) => cell.relative_week)))
  const hasMeasured = summary.cohorts.some((cohort) => cohort.retention.some((cell) => cell.state === 'measured'))
  if (!hasMeasured) return <RetentionTimeline summary={summary} />
  return <>
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--color-laburante-text-secondary)]"><span className="font-semibold">Cada celda muestra personas que volvieron / personas de la cohorte · porcentaje.</span><span className="inline-flex items-center gap-1"><i className="h-3 w-3 rounded bg-orange-500" /> Alto</span><span className="inline-flex items-center gap-1"><i className="h-3 w-3 rounded bg-orange-100" /> Bajo</span><span className="inline-flex items-center gap-1"><i className="h-3 w-3 rounded bg-slate-100" /> Sin medición</span></div>
    <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-laburante-border)]"><table className="w-full min-w-[980px] text-left text-[11px]"><caption className="sr-only">Mapa de calor de retención semanal</caption><thead className="bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-muted)]"><tr><th className="sticky left-0 z-10 bg-[var(--color-laburante-surface-alt)] px-3 py-2">Cohorte</th><th className="px-3 py-2 text-right">Personas</th>{Array.from({ length: maxRelativeWeek }, (_, index) => <th key={index} className="px-3 py-2 text-right">W{index + 1}</th>)}</tr></thead><tbody className="divide-y divide-[var(--color-laburante-border)]">{summary.cohorts.map((cohort) => <tr key={cohort.week_start}><th scope="row" className="sticky left-0 z-10 bg-[var(--color-laburante-surface)] px-3 py-3 text-left font-semibold">{formatCompactWeekRange(cohort.week_start, cohort.week_end)}{cohort.cohort_size < 20 && <span className="mt-1 block text-[10px] font-normal text-orange-700">Base pequeña</span>}</th><td className="px-3 py-3 text-right font-bold">{formatNumber(cohort.cohort_size)}</td>{cohort.retention.map((cell) => <td key={cell.relative_week} className="px-1 py-1 text-right"><button type="button" disabled={cell.state !== 'measured'} onClick={() => onOpenMembers({ cohortWeek: cohort.week_start, relativeWeek: cell.relative_week, includeInactive: false }, `Activos W${cell.relative_week} · ${formatWeekRange(cohort.week_start, cohort.week_end)}`)} className={`min-h-14 w-full rounded-lg border px-2 py-2 text-[10px] leading-tight transition ${getRetentionTone(cell)} ${cell.state === 'measured' ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`} aria-label={`${formatCompactWeekRange(cohort.week_start, cohort.week_end)}, W${cell.relative_week}: ${retentionLabel(cell, cohort.cohort_size)}`}>{retentionLabel(cell, cohort.cohort_size)}</button></td>)}</tr>)}</tbody></table></div>
    {summary.cohorts.some((cohort) => cohort.cohort_size < 20) && <p className="mt-3 text-[11px] text-orange-800">Base pequeña: cada usuario modifica sensiblemente el porcentaje.</p>}
  </>
}

export default function GrowthCohorts() {
  const [weeks, setWeeks] = useState(12)
  const [summary, setSummary] = useState<GrowthSummary | null>(null)
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null)
  const [memberQuery, setMemberQuery] = useState<MemberQuery | null>(null)
  const [members, setMembers] = useState<CohortMember[]>([])
  const [membersTotal, setMembersTotal] = useState(0)
  const [membersPage, setMembersPage] = useState(0)
  const [membersTitle, setMembersTitle] = useState('Integrantes')
  const [membersLoading, setMembersLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = async () => {
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('admin_get_growth_cohort_summary', { p_weeks: weeks })
    if (rpcError) setError('No se pudo cargar el análisis: ' + rpcError.message)
    else setSummary(data as GrowthSummary)
    setLoading(false)
  }

  useEffect(() => {
    setSelectedCohort(null)
    setMemberQuery(null)
    setMembers([])
    setMembersTotal(0)
    setMembersPage(0)
    void loadSummary()
  }, [weeks])

  const loadMembers = async (query: MemberQuery, page: number) => {
    setMembersLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('admin_get_growth_cohort_members', {
      p_cohort_week: query.cohortWeek,
      p_relative_week: query.relativeWeek,
      p_include_inactive: query.includeInactive,
      p_limit: MEMBERS_PAGE_SIZE,
      p_offset: page * MEMBERS_PAGE_SIZE,
    })
    if (rpcError) setError('No se pudo cargar el detalle: ' + rpcError.message)
    else {
      const pageData = data as unknown as CohortMemberPage
      setMembers(Array.isArray(pageData?.members) ? pageData.members : [])
      setMembersTotal(Number(pageData?.total_count || 0))
      setMembersPage(page)
    }
    setMembersLoading(false)
  }

  const openMembers = (query: MemberQuery, title: string) => {
    setSelectedCohort(query.cohortWeek)
    setMemberQuery(query)
    setMembersTitle(title)
    setMembersPage(0)
    void loadMembers(query, 0)
  }

  const lastCompleteWeekStarts = useMemo(() => summary ? getLastCompleteWeekStarts(summary.current_week_start, 4) : [], [summary?.current_week_start])
  const lastFourWeeksStart = summary ? addCalendarDays(summary.current_week_start, -28) : ''
  const lastFourWeeksEnd = summary ? addCalendarDays(summary.current_week_start, -1) : ''
  const lastFourAccounts = summary ? summary.cohorts.filter((cohort) => lastCompleteWeekStarts.includes(cohort.week_start)).reduce((total, cohort) => total + cohort.cohort_size, 0) : 0
  const lastWeekStart = summary ? addCalendarDays(summary.current_week_start, -7) : ''
  const lastWeekEnd = summary ? addCalendarDays(summary.current_week_start, -1) : ''
  const completePercent = summary ? ratio(summary.metrics.profiles_complete, summary.metrics.total_accounts) : null
  const activePercent = summary ? ratio(summary.metrics.profiles_visible, summary.metrics.total_accounts) : null

  if (loading && !summary) return <div className="rounded-2xl border border-[var(--color-laburante-border)] p-8 text-center text-sm">Cargando crecimiento y retorno…</div>
  if (!summary) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error || 'El análisis semanal todavía no está disponible.'}</div>

  return <div className="space-y-6">
    <section className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5 text-orange-950">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><BarChart3 size={19} className="text-orange-700" /><h2 className="font-heading text-xl font-bold">Crecimiento de LABURANTE</h2></div><div className="flex items-center gap-2"><label className="text-xs font-semibold">Período<select value={weeks} onChange={(event) => setWeeks(Number(event.target.value))} className="ml-2 rounded-lg border border-orange-300 bg-white px-2 py-1 text-xs"><option value="12">12 semanas</option><option value="24">24 semanas</option><option value="52">52 semanas</option></select></label><button type="button" onClick={() => void loadSummary()} className="inline-flex items-center gap-1 rounded-lg border border-orange-300 bg-white px-2 py-1 text-xs font-bold"><RefreshCw size={13} /> Actualizar</button></div></div>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-orange-950/80">Tres lecturas para entender el momento del proyecto: cuántas cuentas llegan, qué perfiles están tomando forma y si la comunidad vuelve.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3"><StatCard label="Cuentas registradas" value={formatNumber(summary.metrics.total_accounts)} period="Acumulado en Auth" help="Todas las cuentas existentes. No equivale automáticamente a perfiles completos." /><StatCard label="Altas última semana cerrada" value={formatNumber(summary.metrics.new_last_week)} period={`${formatCompactWeekRange(lastWeekStart, lastWeekEnd)} · semana completa`} help="Cuentas nuevas creadas durante la última semana calendario cerrada." accent /><StatCard label="Altas últimas cuatro semanas" value={formatNumber(lastFourAccounts)} period={`${formatCompactWeekRange(lastFourWeeksStart, lastFourWeeksEnd)} · semanas completas`} help="Suma de las cuatro semanas cerradas más recientes para ver el ritmo sin depender de un solo corte." /></div>
    </section>

    <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5">
      <div className="flex items-start gap-3"><BarChart3 size={18} className="mt-0.5 text-orange-600" /><div><h3 className="font-heading text-lg font-bold">Altas por semana</h3><p className="mt-1 text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]">Cada barra representa cuentas nuevas creadas en Auth durante esa semana. La semana actual todavía está en curso.</p></div></div>
      <div className="mt-4 overflow-x-auto"><AcquisitionBars cohorts={summary.cohorts} currentWeekStart={summary.current_week_start} onOpenMembers={openMembers} /></div>
      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--color-laburante-border)]"><table className="w-full min-w-[620px] text-left text-xs"><caption className="sr-only">Detalle de altas y variación absoluta por semana</caption><thead className="bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-muted)]"><tr><th className="px-3 py-2">Semana</th><th className="px-3 py-2 text-right">Cuentas nuevas</th><th className="px-3 py-2 text-right">Cambio frente a la anterior</th><th className="px-3 py-2 text-right">Perfiles completos</th></tr></thead><tbody className="divide-y divide-[var(--color-laburante-border)]">{summary.cohorts.map((cohort) => <tr key={cohort.week_start} className="hover:bg-orange-50/40"><th scope="row" className="px-3 py-2 text-left font-semibold">{formatCompactWeekRange(cohort.week_start, cohort.week_end)}{cohort.week_start === summary.current_week_start && <span className="ml-2 text-[10px] font-normal text-orange-700">En curso</span>}</th><td className="px-3 py-2 text-right font-bold">{formatNumber(cohort.cohort_size)}</td><td className="px-3 py-2 text-right">{cohort.previous_size === null ? 'Sin referencia' : `${formatSignedCount(cohort.absolute_change)} cuentas respecto de la semana anterior`}</td><td className="px-3 py-2 text-right">{formatNumber(cohort.profiles_complete)} · {ratio(cohort.profiles_complete, cohort.cohort_size) ?? 0}%</td></tr>)}</tbody></table></div>
    </section>

    <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5">
      <div className="flex items-start gap-3"><Users size={18} className="mt-0.5 text-orange-600" /><div><h3 className="font-heading text-lg font-bold">Estado de la comunidad</h3><p className="mt-1 text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]">La completitud y el estado activo son lecturas diferentes. Aquí se comparan con las cuentas registradas porque la consulta actual no trae un total global independiente de perfiles.</p></div></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2"><ProgressMetric label="Cuentas con perfil completo" value={`${formatNumber(summary.metrics.profiles_complete)} de ${formatNumber(summary.metrics.total_accounts)} cuentas`} percent={completePercent} help="Cumplen los requisitos operativos del formulario: identidad, ubicación, contacto y los campos necesarios según la intención." /><ProgressMetric label="Cuentas con perfil activo" value={`${formatNumber(summary.metrics.profiles_visible)} de ${formatNumber(summary.metrics.total_accounts)} cuentas`} percent={activePercent} help="El perfil tiene estado activo. Esta métrica no incluye perfiles ocultos ni afirma por sí sola que una cuenta aparezca en cada búsqueda." /></div>
      <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/50 p-4"><p className="text-sm font-bold text-orange-950">{formatNumber(summary.metrics.service_providers)} personas ofrecen servicios</p><p className="mt-1 text-[11px] leading-relaxed text-orange-950/75">Personas activas con intención de ofrecer o ambas y al menos una habilidad o servicio declarado. No mostramos porcentaje porque esta consulta no entrega un denominador elegible separado.</p></div>
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[var(--color-laburante-text-secondary)]"><Info size={14} className="mt-0.5 shrink-0 text-orange-600" />La diferencia entre cuentas y perfiles no se interpreta automáticamente como cuentas sin perfil: este RPC no expone un total global de perfiles ni perfiles huérfanos para afirmarlo.</p>
    </section>

    <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5"><div className="flex items-start gap-3"><CalendarDays size={18} className="mt-0.5 text-orange-600" /><div><h3 className="font-heading text-lg font-bold">Retención semanal</h3><p className="mt-1 text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]">¿Las personas vuelven? Sólo contamos una presencia autenticada registrada por semana; no es una afirmación de contratación ni de empleo conseguido.</p></div></div><RetentionHeatmap summary={summary} onOpenMembers={openMembers} /></section>

    {selectedCohort && memberQuery && <section className="rounded-2xl border border-orange-200 bg-orange-50/30 p-5"><div className="flex items-center gap-2"><Users size={16} className="text-orange-700" /><h3 className="font-heading font-bold">Detalle trazable</h3></div><p className="mt-1 text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]">El detalle conserva el orden por creación de cuenta y permite revisar la última conexión de Auth. Se carga por páginas de {MEMBERS_PAGE_SIZE} integrantes.</p><MembersPanel title={membersTitle} members={members} totalCount={membersTotal} page={membersPage} loading={membersLoading} onPageChange={(nextPage) => { if (memberQuery) void loadMembers(memberQuery, nextPage) }} /></section>}
    {error && <p className="text-xs text-rose-700">{error}</p>}
  </div>
}
