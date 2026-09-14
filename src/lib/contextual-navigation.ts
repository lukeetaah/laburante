import type { NavigateFunction } from 'react-router-dom'
import { normalizeProfileIntent } from '@/lib/profile-publication'

export type ContextualLink =
  | { kind: 'request'; id: string; href: string }
  | { kind: 'inquiry'; id: string; href: string }
  | { kind: 'reviews'; href: string }
  | { kind: 'generic'; href: string }

export function getPostLoginPath(intent: unknown) {
  const normalized = normalizeProfileIntent(intent)
  if (normalized === 'ofrecer' || normalized === 'ambas') return '/mis-trabajos'
  if (normalized === 'buscar') return '/buscar'
  return '/crear-perfil'
}

export function parseContextualLink(link: string): ContextualLink | null {
  try {
    const url = new URL(link, window.location.origin)
    if (url.origin !== window.location.origin) return null
    const href = `${url.pathname}${url.search}${url.hash}`
    const requestId = url.searchParams.get('pedido')
    if (requestId) return { kind: 'request', id: requestId, href }
    const inquiryId = url.searchParams.get('seleccion')
    if (inquiryId) return { kind: 'inquiry', id: inquiryId, href }
    if (url.pathname.startsWith('/p/') && url.hash === '#resenas') return { kind: 'reviews', href }
    return { kind: 'generic', href }
  } catch {
    return null
  }
}

export function navigateToContextualLink(navigate: NavigateFunction, link: string) {
  const parsed = parseContextualLink(link)
  if (!parsed) {
    window.open(link, '_blank', 'noopener,noreferrer')
    return
  }
  navigate(parsed.href)
}

type FocusTarget =
  | { attribute: 'data-request-id' | 'data-inquiry-id' | 'data-opportunity-id' | 'data-opportunity-share-id'; value: string }
  | { id: string }

function findFocusTarget(target: FocusTarget) {
  if ('id' in target) return document.getElementById(target.id)
  return Array.from(document.querySelectorAll<HTMLElement>(`[${target.attribute}]`))
    .find((element) => element.getAttribute(target.attribute) === target.value) || null
}

export function focusContextualElement(target: FocusTarget) {
  let frame = 0
  let safetyTimer = 0
  let cancelled = false
  let observer: MutationObserver | null = null

  const stopObserving = () => {
    cancelled = true
    if (frame) window.cancelAnimationFrame(frame)
    if (safetyTimer) window.clearTimeout(safetyTimer)
    observer?.disconnect()
  }

  const findAndFocus = () => {
    frame = 0
    if (cancelled) return
    const element = findFocusTarget(target)
    if (element) {
      stopObserving()
      cancelled = false
      const hadTabIndex = element.hasAttribute('tabindex')
      if (!hadTabIndex && !element.matches('a,button,input,select,textarea,[tabindex]')) element.setAttribute('tabindex', '-1')
      element.setAttribute('data-contextual-focus', 'true')
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
      element.focus({ preventScroll: true })
      window.setTimeout(() => {
        element.removeAttribute('data-contextual-focus')
        if (!hadTabIndex) element.removeAttribute('tabindex')
      }, 2400)
      return
    }
  }

  const scheduleScan = () => {
    if (!cancelled && !frame) frame = window.requestAnimationFrame(findAndFocus)
  }

  observer = new MutationObserver(scheduleScan)
  observer.observe(document.body, { childList: true, subtree: true })
  safetyTimer = window.setTimeout(stopObserving, 15000)
  scheduleScan()

  return stopObserving
}
