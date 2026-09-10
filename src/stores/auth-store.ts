import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface SignUpMetadata {
  name: string
  phone?: string
  provincia?: string
  localidad?: string
  intent?: 'ofrecer' | 'buscar' | 'ambas'
  role?: string
  accountType?: 'persona' | 'empresa'
  companyPlan?: 'gratis' | 'equipo' | 'pro'
  companySector?: string
  teamSize?: string
}

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  setSession: (session: Session | null) => void
  signUp: (email: string, password: string, metadata: SignUpMetadata) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

const checkIsAdmin = (user: User | null): boolean => {
  if (!user) return false
  const userRole = user.user_metadata?.role
  const appRole = (user as any).app_metadata?.role
  return userRole === 'admin' || appRole === 'admin'
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
      const name = meta.name || user.email?.split('@')[0] || 'Profesional'
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') + '-' + user.id.slice(0, 4)

      await (supabase.from('profiles') as any).insert({
        id: user.id,
        name,
        slug,
        provincia: meta.provincia || 'CABA',
        localidad: meta.localidad || 'Buenos Aires',
        disponibilidad: 'disponible',
        modalidad: 'presencial',
        account_type: meta.account_type === 'empresa' ? 'empresa' : 'persona',
        status: meta.account_type === 'empresa' ? 'oculto' : 'activo',
      })

      if (meta.phone) {
        await (supabase.from('contact_methods') as any).insert({
          profile_id: user.id,
          type: 'whatsapp',
          value: meta.phone,
          is_public: true,
        })
      }
    }
  } catch (err) {
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
    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/crear-perfil?confirmed=true`
      : undefined

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: metadata.name,
          phone: metadata.phone || '',
          provincia: metadata.provincia || '',
          localidad: metadata.localidad || '',
          intent: metadata.intent || 'ofrecer',
          role: 'user', // Default role; user can upgrade to 'admin' in Supabase dashboard
          account_type: metadata.accountType || 'persona',
        },
      },
    })
    if (error) return { error: error.message }

    // If Supabase requires email verification, session will be null but user object is returned
    const needsEmailConfirmation = !data.session && !!data.user
    if (data.session) {
      set({
        session: data.session,
        user: data.session.user,
        isAdmin: checkIsAdmin(data.session.user),
        loading: false,
      })
      await ensureUserProfile(data.session.user)
    }
    return { error: null, needsEmailConfirmation }
  },

  signIn: async (email, password) => {
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

  signOut: async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
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
