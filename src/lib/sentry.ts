import * as Sentry from '@sentry/react'
import { SITE_CONFIG } from '@/lib/constants'

const DEFAULT_SENTRY_DSN = 'https://d93b3791a4dea7b0645f0012eaed771a@o4512085497806848.ingest.us.sentry.io/4512086004269056'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gmctzgrzwagtsnfkdbte.supabase.co'

function sanitizeSpan(span: {
  span_id: string
  trace_id: string
  start_timestamp: number
  parent_span_id?: string
  timestamp?: number
  status?: string
}) {
  return {
    span_id: span.span_id,
    trace_id: span.trace_id,
    start_timestamp: span.start_timestamp,
    data: {},
    description: 'span',
    op: 'span',
    ...(span.parent_span_id ? { parent_span_id: span.parent_span_id } : {}),
    ...(typeof span.timestamp === 'number' ? { timestamp: span.timestamp } : {}),
    ...(span.status ? { status: span.status } : {}),
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const traceOrigins = Array.from(new Set([
  SITE_CONFIG.url,
  'https://laburante.ar',
  'https://laburante.vercel.app',
  typeof window !== 'undefined' ? window.location.origin : '',
  SUPABASE_URL,
].filter(Boolean).map((value) => new URL(value).origin)))

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || DEFAULT_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || (import.meta.env.PROD ? 'production' : 'development'),
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  tracePropagationTargets: traceOrigins.map((origin) => new RegExp(`^${escapeRegExp(origin)}(?:/|$)`)),
  sendDefaultPii: false,
  maxBreadcrumbs: 20,
  beforeBreadcrumb: (breadcrumb) => {
    if (breadcrumb.category === 'laburante') {
      return {
        category: breadcrumb.category,
        message: breadcrumb.message,
        level: breadcrumb.level,
        timestamp: breadcrumb.timestamp,
      }
    }
    return breadcrumb.type === 'navigation'
      ? { type: 'navigation', category: 'navigation', message: 'route_changed' }
      : null
  },
  beforeSend: (event) => {
    // Keep stack traces while removing request, identity and arbitrary payloads.
    delete event.request
    delete event.user
    delete event.extra
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map((exception) => ({
        ...exception,
        value: 'Application error',
      }))
    }
    return event
  },
  beforeSendTransaction: (event) => {
    delete event.request
    delete event.user
    delete event.extra
    delete event.measurements
    if (event.transaction) {
      event.transaction = event.transaction.split(/[?#]/, 1)[0] || 'transaction'
    }
    if (event.spans) {
      event.spans = event.spans.map(sanitizeSpan)
    }
    return event
  },
  beforeSendSpan: (span) => sanitizeSpan(span),
})

export function addAppBreadcrumb(message: string, category = 'laburante') {
  Sentry.addBreadcrumb({ category, message, level: 'info' })
}

export function captureAppError(error: unknown, operation: string) {
  Sentry.withScope((scope) => {
    scope.setTag('app_operation', operation)
    scope.setContext('laburante', { operation })
    const safeError = new Error('Application error')
    if (error instanceof Error) {
      safeError.name = error.name
      safeError.stack = error.stack
    }
    Sentry.captureException(safeError)
  })
}
