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
  measurement_available_from: string | null
  metrics: {
    total_accounts: number
    new_last_week: number
    active_last_week: number
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
