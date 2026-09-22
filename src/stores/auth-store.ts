import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import { dedupeContactMethods } from '@/lib/contact-methods'
import { addAppBreadcrumb, captureAppError } from '@/lib/sentry'
import { normalizeProfileIntent } from '@/lib/profile-publication'

const PROFILE_INTENT_COLUMN_MISSING_RE = /column .*intent.*does not exist|Could not find .*intent.*column|schema cache.*intent/i

export interface SignUpMetadata {
  name: string
  phone?: string
  provincia?: string
  localidad?: string
  intent?: 'ofrecer' | 'buscar' | 'ambas'
  role?: string
  accountType?: 'persona' | 'empresa'
  companyPlan?: 'gratis' | 'pago'
  companySector?: string
  teamSize?: string
}

export const RESEND_COOLDOWN_SECONDS = 60
const RESEND_STORAGE_PREFIX = 'laburante_resend_cooldown:'
const activeResendRequests = new Set<string>()
const inMemoryResendCooldowns = new Map<string, number>()

export function getResendCooldownRemaining(email: string): number {
  if (!email) return 0
  const normalized = email.trim().toLowerCase()
  const inMem = inMemoryResendCooldowns.get(normalized) || 0
  let inStorage = 0
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      inStorage = Number(localStorage.getItem(RESEND_STORAGE_PREFIX + normalized) || 0)
    } catch {
      // Ignorar fallos de almacenamiento en navegadores con storage restringido
    }
  }
  const expiry = Math.max(inMem, inStorage)
  const now = Date.now()
  return expiry > now ? Math.ceil((expiry - now) / 1000) : 0
}

export function setResendCooldown(email: string, seconds = RESEND_COOLDOWN_SECONDS): void {
  if (!email) return
  const normalized = email.trim().toLowerCase()
  const expiry = Date.now() + seconds * 1000
  inMemoryResendCooldowns.set(normalized, expiry)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(RESEND_STORAGE_PREFIX + normalized, String(expiry))
    } catch {
      // Ignorar fallos de almacenamiento
    }
  }
}

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  setSession: (session: Session | null) => void
  signUp: (email: string, password: string, metadata: SignUpMetadata) => Promise<{ error: string | null; needsSignIn?: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resendConfirmationEmail: (email: string) => Promise<{ error: string | null; blockedByCooldown?: boolean; remainingSeconds?: number }>
  initialize: () => Promise<void>
}

const checkIsAdmin = (user: User | null): boolean => {
  if (!user) return false
  const appRole = (user as any).app_metadata?.role
  return appRole === 'admin'
}

async function ensureUserProfile(user: User | null) {
  if (!user) return
  try {
    const { data: existing } = await (supabase.from('profiles') as any)
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!existing) {
      const meta = user.user_metadata || {}
      const name = meta.full_name || meta.name || user.email?.split('@')[0] || 'Profesional'
      const photoUrl = meta.avatar_url || meta.picture || undefined
      const intent = normalizeProfileIntent(meta.intent)
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') + '-' + user.id.slice(0, 4)

      const profilePayload = {
        id: user.id,
        name,
        slug,
        provincia: meta.provincia || 'CABA',
        localidad: meta.localidad || 'Buenos Aires',
        disponibilidad: 'disponible',
        modalidad: 'presencial',
        account_type: meta.account_type === 'empresa' ? 'empresa' : 'persona',
        // El alta nunca puede activar Pago. La habilitación la hace Admin
        // después de revisar la solicitud desde el panel.
        company_plan: meta.account_type === 'empresa' ? 'gratis' : undefined,
        status: meta.account_type === 'empresa' ? 'oculto' : 'activo',
        ...(photoUrl ? { photo_url: photoUrl } : {}),
        ...(intent ? { intent } : {}),
      }
      let { error: profileInsertError } = await (supabase.from('profiles') as any).insert(profilePayload)
      if (profileInsertError && PROFILE_INTENT_COLUMN_MISSING_RE.test(profileInsertError.message || '')) {
        const { intent: _intent, ...legacyPayload } = {
          ...profilePayload,
          // Until the additive migration is applied, a new Buscar account
          // must remain out of the public provider fallback.
          status: intent === 'buscar' ? 'oculto' : profilePayload.status,
        }
        const retry = await (supabase.from('profiles') as any).insert(legacyPayload)
        profileInsertError = retry.error
      }

      if (!profileInsertError && meta.phone && dedupeContactMethods([{ type: 'whatsapp', value: meta.phone }]).length) {
        await (supabase.from('contact_methods') as any).insert({
          profile_id: user.id,
          type: 'whatsapp',
          value: meta.phone,
          is_public: true,
        })
      }
    }
  } catch (err) {
    captureAppError(err, 'ensure_user_profile')
    console.warn('ensureUserProfile skipped:', err)
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,

  setSession: (session) => {
    const user = session?.user ?? null
    set({
      session,
      user,
      isAdmin: checkIsAdmin(user),
      loading: false,
    })
    if (user) {
      ensureUserProfile(user)
    }
  },

  signUp: async (email, password, metadata) => {
    addAppBreadcrumb('signup_started')
    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/ingresar?confirmado=1` : undefined,
        data: {
          name: metadata.name,
          phone: metadata.phone || '',
          provincia: metadata.provincia || '',
          localidad: metadata.localidad || '',
          intent: metadata.intent || 'ofrecer',
          role: 'user', // Default role; user can upgrade to 'admin' in Supabase dashboard
          account_type: metadata.accountType || 'persona',
          // El plan elegido en el formulario sólo expresa una solicitud;
          // jamás se persiste como habilitación comercial.
          company_plan: metadata.accountType === 'empresa' ? 'gratis' : undefined,
          company_plan_requested: metadata.accountType === 'empresa' && metadata.companyPlan === 'pago',
          company_sector: metadata.accountType === 'empresa' ? (metadata.companySector || '') : undefined,
          team_size: metadata.accountType === 'empresa' ? (metadata.teamSize || '') : undefined,
        },
      },
    })
    if (error) return { error: error.message }

    if (data.session) {
      set({
        session: data.session,
        user: data.session.user,
        isAdmin: checkIsAdmin(data.session.user),
        loading: false,
      })
      await ensureUserProfile(data.session.user)
    } else if (data.user) {
      // Registro inicial sin sesión inmediata (esperando confirmación por correo)
      // Activar cooldown inmediato de 60s para evitar clics de reenvío duplicados en el día 0
      setResendCooldown(normalizedEmail, RESEND_COOLDOWN_SECONDS)
    }
    return { error: null, needsSignIn: !data.session && !!data.user }
  },

  resendConfirmationEmail: async (email: string) => {
    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      return { error: 'Por favor ingresá un correo electrónico válido.' }
    }

    // 1. Evitar peticiones simultáneas en vuelo (doble click o múltiples pestañas)
    if (activeResendRequests.has(normalized)) {
      return {
        error: 'Ya hay un reenvío en curso para este correo. Por favor esperá unos segundos.',
        blockedByCooldown: true,
      }
    }

    // 2. Comprobar si existe un cooldown activo (en memoria o en localStorage)
    const remaining = getResendCooldownRemaining(normalized)
    if (remaining > 0) {
      return {
        error: `Debés esperar ${remaining} segundo${remaining === 1 ? '' : 's'} antes de solicitar un nuevo reenvío.`,
        blockedByCooldown: true,
        remainingSeconds: remaining,
      }
    }

    activeResendRequests.add(normalized)
    addAppBreadcrumb('resend_confirmation_started')

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalized,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/ingresar?confirmado=1` : undefined,
        },
      })

      if (error) {
        // Si Supabase devuelve rate limit ("security purposes" o 429), aplicar cooldown
        const isRate = /rate|limit|too many|esper|security purposes|seconds/i.test(error.message)
        const rateMatch = error.message.match(/(\d+)\s*(?:seconds?|segundos?)/i)
        const penaltySeconds = rateMatch ? Math.max(10, Number(rateMatch[1])) : isRate ? 60 : 15
        setResendCooldown(normalized, penaltySeconds)
        return {
          error: error.message,
          remainingSeconds: penaltySeconds,
        }
      }

      // Reenvío exitoso: iniciar cooldown oficial de 60 segundos
      setResendCooldown(normalized, RESEND_COOLDOWN_SECONDS)
      return { error: null, remainingSeconds: RESEND_COOLDOWN_SECONDS }
    } catch (err: any) {
      captureAppError(err, 'resend_confirmation')
      return { error: err.message || 'Error al reenviar el correo de confirmación.' }
    } finally {
      activeResendRequests.delete(normalized)
    }
  },

  signIn: async (email, password) => {
    addAppBreadcrumb('signin_started')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (data.session) {
      set({
        session: data.session,
        user: data.session.user,
        isAdmin: checkIsAdmin(data.session.user),
        loading: false,
      })
    }
    return { error: null }
  },

  signInWithGoogle: async () => {
    addAppBreadcrumb('oauth_google_started')
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/ingresar` : undefined
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) return { error: error.message }
      return { error: null }
    } catch (err: any) {
      captureAppError(err, 'oauth_google')
      return { error: err.message || 'Error al iniciar sesión con Google.' }
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      captureAppError(e, 'signout')
      console.warn('SignOut error:', e)
    }
    set({ user: null, session: null, isAdmin: false })
  },

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    set({
      session,
      user,
      isAdmin: checkIsAdmin(user),
      loading: false,
    })
    await ensureUserProfile(user)

    supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      set({
        session,
        user: u,
        isAdmin: checkIsAdmin(u),
        loading: false,
      })
      await ensureUserProfile(u)
    })
  },
}))
