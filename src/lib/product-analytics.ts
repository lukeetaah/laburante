import { track } from '@vercel/analytics'
import { addAppBreadcrumb } from '@/lib/sentry'

type ProductEvent =
  | 'search_submitted'
  | 'profile_viewed'
  | 'request_started'
  | 'request_auth_prompt'
  | 'request_resumed'
  | 'request_created'
  | 'request_create_error'

type ProductEventProperties = Record<string, string | number | boolean | null>

/** Product events use only coarse, non-identifying properties. */
export function trackProductEvent(name: ProductEvent, properties?: ProductEventProperties) {
  addAppBreadcrumb(`product_${name}`)
  try {
    track(`laburante_${name}`, properties)
  } catch {
    // Analytics must never break a user-facing flow.
  }
}
