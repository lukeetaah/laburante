export const GROWTH_TIME_ZONE = 'America/Argentina/Buenos_Aires'

export type RetentionState = 'measured' | 'in_progress' | 'no_data'

export interface RetentionCell {
  relative_week: number
  state: RetentionState
  active_users: number | null
  retention_percent: number | null
}

export interface GrowthCohort {
  week_start: string
  week_end: string
  cohort_size: number
  previous_size: number
  absolute_change: number
  percent_change: number | null
  profiles_count: number
  profiles_complete: number
  profiles_visible: number
  whatsapp_verified: number
  service_providers: number
  retention: RetentionCell[]
}

export interface GrowthSummary {
  generated_at: string
  timezone: string
  first_week: string
  current_week_start: string
  instrumentation_started_week: string | null
  measurement_available_from: string | null
  metrics: {
    total_accounts: number
    new_last_week: number
    active_last_week: number | null
    active_last_week_state: 'measured' | 'no_data'
    profiles_complete: number
    profiles_visible: number
    service_providers: number
  }
  cohorts: GrowthCohort[]
}

export interface CohortMember {
  user_id: string
  account_created_at: string
  last_sign_in_at: string | null
  name: string | null
  account_type: string
  profile_status: string | null
  profile_complete: boolean
  profile_visible: boolean
  whatsapp_verified: boolean
  offers_services: boolean
  active_in_selected_week: boolean
  acquisition_source: string
}

export interface CohortMemberPage {
  members: CohortMember[]
  total_count: number
  limit: number
  offset: number
}

export function getBuenosAiresWeekStart(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('invalid_date')

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: GROWTH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const localDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)))
  const day = localDate.getUTCDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday)
  return localDate.toISOString().slice(0, 10)
}

export function getRetentionState(
  activityWeekStart: string,
  currentWeekStart: string,
  measurementAvailableFrom: string | null,
): RetentionState {
  if (activityWeekStart >= currentWeekStart) return 'in_progress'
  if (!measurementAvailableFrom || activityWeekStart < measurementAvailableFrom) return 'no_data'
  return 'measured'
}

export function getMemberPageBounds(totalCount: number, page: number, pageSize = 25) {
  const safeTotal = Math.max(0, totalCount)
  const safePage = Math.max(0, page)
  const safePageSize = Math.min(Math.max(1, pageSize), 100)
  const start = safeTotal === 0 ? 0 : safePage * safePageSize + 1
  const end = Math.min((safePage + 1) * safePageSize, safeTotal)
  return { start, end, hasPrevious: safePage > 0, hasNext: end < safeTotal }
}

export function formatWeekRange(start: string, end: string): string {
  const format = (value: string) => new Date(`${value}T12:00:00-03:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  return `${format(start)} – ${format(end)}`
}

export function formatRetentionCell(cell: RetentionCell): string {
  if (cell.state === 'in_progress') return 'En curso'
  if (cell.state === 'no_data') return 'Sin datos'
  return `${cell.active_users ?? 0} · ${cell.retention_percent ?? 0}%`
}

export function stableMemberKey(member: Pick<CohortMember, 'user_id'>): string {
  return member.user_id
}
