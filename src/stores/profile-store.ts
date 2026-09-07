import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { DEV_MOCK_PROFILES } from '@/lib/mock-fixtures'

export interface ProfileWithDetails {
  id: string
  name: string
  slug: string
  photo_url: string | null
  bio: string | null
  provincia: string
  localidad: string
  zona_trabajo: string | null
  disponibilidad: 'disponible' | 'ocupado' | 'no_disponible'
  modalidad: 'presencial' | 'remoto' | 'ambas'
  status: 'activo' | 'oculto' | 'suspendido' | 'eliminado'
  whatsapp_verified?: boolean
  whatsapp_verified_at?: string | null
  notify_whatsapp?: boolean
  created_at: string
  isMock?: boolean
  categories?: string[]
  skills?: string[]
  services?: { title: string; description: string | null; precio_orientativo?: string | null }[]
  contact_methods?: {
    id?: string
    type: 'whatsapp' | 'telefono' | 'email' | 'instagram' | 'linkedin' | 'web' | 'portfolio' | string
    value: string
    is_public: boolean
  }[]
  recommendations?: {
    id?: string
    from_name: string
    text: string
    context: string | null
    date?: string
    created_at?: string
  }[]
}

export interface AccountDeletionRecord {
  id: string
  user_id?: string | null
  user_email?: string | null
  profile_name: string
  profile_slug: string
  reason: string
  explanation: string
  created_at: string
}

interface ProfileState {
  profiles: ProfileWithDetails[]
  currentProfile: ProfileWithDetails | null
  myProfile: ProfileWithDetails | null
  loading: boolean
  includeDevMocks: boolean
  setIncludeDevMocks: (val: boolean) => void
  fetchProfiles: (filters?: {
    query?: string
    category?: string
    provincia?: string
    localidad?: string
    modalidad?: string
  }) => Promise<void>
  fetchProfileBySlug: (slug: string) => Promise<ProfileWithDetails | null>
  fetchMyProfile: () => Promise<ProfileWithDetails | null>
  createProfile: (profileData: any) => Promise<{ error: string | null; slug?: string }>
  updateProfileVisibility: (profileId: string, status: 'activo' | 'oculto') => Promise<{ error: string | null }>
  verifyWhatsApp: (profileId: string, phone: string, code: string) => Promise<{ error: string | null; success?: boolean }>
  deleteAccount: (profileId: string, payload: { reason: string; explanation: string; userEmail?: string }) => Promise<{ error: string | null; success?: boolean }>
  fetchAccountDeletions: () => Promise<AccountDeletionRecord[]>
  submitRecommendation: (profileId: string, data: { from_name: string; text: string; context?: string }) => Promise<{ error: string | null }>
  submitReport: (profileId: string, reason: string, description: string) => Promise<{ error: string | null }>
}

const VERIFIED_WA_KEY = 'laburante_verified_wa'
const DELETIONS_KEY = 'laburante_account_deletions'

function getLocalVerifiedWA(): Record<string, { phone: string; at: string }> {
  try {
    const raw = localStorage.getItem(VERIFIED_WA_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalVerifiedWA(data: Record<string, { phone: string; at: string }>) {
  try {
    localStorage.setItem(VERIFIED_WA_KEY, JSON.stringify(data))
  } catch {}
}

function getLocalDeletions(): AccountDeletionRecord[] {
  try {
    const raw = localStorage.getItem(DELETIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalDeletions(data: AccountDeletionRecord[]) {
  try {
    localStorage.setItem(DELETIONS_KEY, JSON.stringify(data))
  } catch {}
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  currentProfile: null,
  myProfile: null,
  loading: false,
  includeDevMocks: false, // Default false: zero fake profiles shown by default

  setIncludeDevMocks: (val) => {
    set({ includeDevMocks: val })
    get().fetchProfiles()
  },

  fetchProfiles: async (filters = {}) => {
    set({ loading: true })
    try {
      let query = (supabase.from('profiles') as any)
        .select(`
          id, name, slug, photo_url, bio, provincia, localidad, zona_trabajo,
          disponibilidad, modalidad, status, created_at,
          skills ( name ),
          services ( title, description, precio_orientativo ),
          contact_methods ( type, value, is_public )
        `)
        .eq('status', 'activo')

      if (filters.provincia) {
        query = query.eq('provincia', filters.provincia)
      }
      if (filters.localidad) {
        query = query.ilike('localidad', `%${filters.localidad}%`)
      }
      if (filters.modalidad && filters.modalidad !== 'todas') {
        query = query.eq('modalidad', filters.modalidad)
      }

      const { data, error } = await query

      let realProfiles: ProfileWithDetails[] = []
      if (!error && data) {
        const localWA = getLocalVerifiedWA()
        realProfiles = (data as any[]).map((item: any) => ({
          ...item,
          whatsapp_verified: Boolean(item.whatsapp_verified || (localWA[item.id] !== undefined)),
          whatsapp_verified_at: item.whatsapp_verified_at || localWA[item.id]?.at || null,
          skills: item.skills?.map((s: any) => s.name) || [],
          services: item.services || [],
          contact_methods: item.contact_methods || [],
          categories: []
        }))
      }

      // Filter by text query if given
      if (filters.query && filters.query.trim()) {
        const q = filters.query.toLowerCase().trim()
        realProfiles = realProfiles.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.bio?.toLowerCase().includes(q) ||
          p.provincia.toLowerCase().includes(q) ||
          p.localidad.toLowerCase().includes(q) ||
          p.skills?.some((s: string) => s.toLowerCase().includes(q)) ||
          p.services?.some((s: any) => s.title.toLowerCase().includes(q))
        )
      }

      // If user enabled dev mocks in testing toggle
      let combined = [...realProfiles]
      if (get().includeDevMocks) {
        let mockFiltered = [...DEV_MOCK_PROFILES]
        if (filters.provincia) {
          mockFiltered = mockFiltered.filter(p => p.provincia === filters.provincia)
        }
        if (filters.localidad) {
          mockFiltered = mockFiltered.filter(p => p.localidad.toLowerCase().includes(filters.localidad!.toLowerCase()))
        }
        if (filters.modalidad && filters.modalidad !== 'todas') {
          mockFiltered = mockFiltered.filter(p => p.modalidad === filters.modalidad)
        }
        if (filters.category) {
          mockFiltered = mockFiltered.filter(p => p.categories.some(c => c.toLowerCase() === filters.category!.toLowerCase()))
        }
        if (filters.query && filters.query.trim()) {
          const q = filters.query.toLowerCase().trim()
          mockFiltered = mockFiltered.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.bio.toLowerCase().includes(q) ||
            p.skills.some((s: string) => s.toLowerCase().includes(q)) ||
            p.services.some((s: any) => s.title.toLowerCase().includes(q))
          )
        }
        combined = [...combined, ...mockFiltered]
      }

      set({ profiles: combined, loading: false })
    } catch (err) {
      console.warn('Error fetching profiles from Supabase:', err)
      if (get().includeDevMocks) {
        set({ profiles: DEV_MOCK_PROFILES, loading: false })
      } else {
        set({ profiles: [], loading: false })
      }
    }
  },

  fetchProfileBySlug: async (slug: string) => {
    set({ loading: true })
    try {
      // Check Supabase first
      const { data, error } = await (supabase.from('profiles') as any)
        .select(`
          id, name, slug, photo_url, bio, provincia, localidad, zona_trabajo,
          disponibilidad, modalidad, status, created_at,
          skills ( name ),
          services ( title, description, precio_orientativo ),
          contact_methods ( id, type, value, is_public ),
          recommendations ( id, from_name, text, context, created_at )
        `)
        .eq('slug', slug)
        .single()

      if (!error && data) {
        const item = data as any
        const localWA = getLocalVerifiedWA()
        const fullProfile: ProfileWithDetails = {
          ...item,
          whatsapp_verified: Boolean(item.whatsapp_verified || (localWA[item.id] !== undefined)),
          whatsapp_verified_at: item.whatsapp_verified_at || localWA[item.id]?.at || null,
          skills: item.skills?.map((s: any) => s.name) || [],
          services: item.services || [],
          contact_methods: item.contact_methods || [],
          recommendations: item.recommendations || [],
          categories: []
        }
        set({ currentProfile: fullProfile, loading: false })
        return fullProfile
      }

      // Check dev mocks if not found in DB
      const mockFound = DEV_MOCK_PROFILES.find(p => p.slug === slug)
      if (mockFound) {
        set({ currentProfile: mockFound, loading: false })
        return mockFound
      }

      set({ currentProfile: null, loading: false })
      return null
    } catch (err) {
      console.warn('Error fetching profile by slug:', err)
      const mockFound = DEV_MOCK_PROFILES.find(p => p.slug === slug)
      set({ currentProfile: mockFound || null, loading: false })
      return mockFound || null
    }
  },

  fetchMyProfile: async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) {
        set({ myProfile: null })
        return null
      }
      const userId = userData.user.id
      const { data, error } = await (supabase.from('profiles') as any)
        .select(`
          id, name, slug, photo_url, bio, provincia, localidad, zona_trabajo,
          disponibilidad, modalidad, status, created_at,
          skills ( name ),
          services ( title, description, precio_orientativo ),
          contact_methods ( id, type, value, is_public ),
          recommendations ( id, from_name, text, context, created_at )
        `)
        .eq('id', userId)
        .maybeSingle()

      if (error || !data) {
        set({ myProfile: null })
        return null
      }

      const item = data as any
      const localWA = getLocalVerifiedWA()
      const profile: ProfileWithDetails = {
        ...item,
        whatsapp_verified: Boolean(item.whatsapp_verified || (localWA[item.id] !== undefined)),
        whatsapp_verified_at: item.whatsapp_verified_at || localWA[item.id]?.at || null,
        skills: item.skills?.map((s: any) => s.name) || [],
        services: item.services || [],
        contact_methods: item.contact_methods || [],
        recommendations: item.recommendations || [],
        categories: []
      }
      set({ myProfile: profile })
      return profile
    } catch (e) {
      console.warn('fetchMyProfile error:', e)
      set({ myProfile: null })
      return null
    }
  },

  createProfile: async (profileData) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) {
        return { error: 'Debes iniciar sesión para publicar un perfil.' }
      }

      const userId = userData.user.id

      // Check if user already has an existing profile (update vs insert)
      const { data: existingProfile } = await (supabase.from('profiles') as any)
        .select('id, slug, status, whatsapp_verified, whatsapp_verified_at')
        .eq('id', userId)
        .maybeSingle()

      let slug = existingProfile?.slug
      if (!slug) {
        slug = profileData.name
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') + '-' + Math.random().toString(36).substring(2, 6)
      }

      const targetStatus = profileData.status || existingProfile?.status || 'activo'

      if (existingProfile) {
        // 1. Update Profile
        const updatePayload: any = {
          name: profileData.name,
          bio: profileData.bio || null,
          provincia: profileData.provincia,
          localidad: profileData.localidad,
          zona_trabajo: profileData.zona_trabajo || null,
          disponibilidad: profileData.disponibilidad || 'disponible',
          modalidad: profileData.modalidad || 'presencial',
          status: targetStatus,
          updated_at: new Date().toISOString()
        }
        if (profileData.notify_whatsapp !== undefined) {
          updatePayload.notify_whatsapp = profileData.notify_whatsapp
        }

        const { error: profileError } = await (supabase.from('profiles') as any)
          .update(updatePayload)
          .eq('id', userId)

        if (profileError) return { error: profileError.message }

        // Clean previous related records to replace cleanly
        await (supabase.from('skills') as any).delete().eq('profile_id', userId)
        await (supabase.from('services') as any).delete().eq('profile_id', userId)
        await (supabase.from('contact_methods') as any).delete().eq('profile_id', userId)
      } else {
        // 1. Insert Profile
        const insertPayload: any = {
          id: userId,
          name: profileData.name,
          slug: slug,
          bio: profileData.bio || null,
          provincia: profileData.provincia,
          localidad: profileData.localidad,
          zona_trabajo: profileData.zona_trabajo || null,
          disponibilidad: profileData.disponibilidad || 'disponible',
          modalidad: profileData.modalidad || 'presencial',
          status: targetStatus,
          notify_whatsapp: profileData.notify_whatsapp ?? true
        }

        const { error: profileError } = await (supabase.from('profiles') as any).insert(insertPayload)

        if (profileError) return { error: profileError.message }
      }

      // 2. Insert Skills
      if (profileData.skills?.length) {
        const skillsRows = profileData.skills.map((s: string) => ({
          profile_id: userId,
          name: s.trim()
        })).filter((s: any) => s.name)

        if (skillsRows.length) {
          await (supabase.from('skills') as any).insert(skillsRows)
        }
      }

      // 3. Insert Services
      if (profileData.services?.length) {
        const serviceRows = profileData.services.map((srv: any) => ({
          profile_id: userId,
          title: srv.title,
          description: srv.description || null,
          precio_orientativo: srv.precio_orientativo || null
        })).filter((s: any) => s.title)

        if (serviceRows.length) {
          await (supabase.from('services') as any).insert(serviceRows)
        }
      }

      // 4. Insert Contact Methods (only authorized ones with consent)
      if (profileData.contact_methods?.length) {
        const contactRows = profileData.contact_methods.map((c: any) => ({
          profile_id: userId,
          type: c.type,
          value: c.value,
          is_public: c.is_public !== false,
          consent_at: new Date().toISOString()
        })).filter((c: any) => c.value)

        if (contactRows.length) {
          await (supabase.from('contact_methods') as any).insert(contactRows)
        }
      }

      // Refresh myProfile in state
      await get().fetchMyProfile()

      return { error: null, slug }
    } catch (err: any) {
      return { error: err.message || 'Error inesperado al guardar el perfil.' }
    }
  },

  updateProfileVisibility: async (profileId, status) => {
    try {
      const now = new Date().toISOString()
      try {
        await (supabase.from('profiles') as any)
          .update({
            status,
            updated_at: now,
          })
          .eq('id', profileId)
      } catch (e) {
        console.warn('Supabase profile status update error:', e)
      }

      set((s) => {
        const updateObj = (p: ProfileWithDetails | null) =>
          p && p.id === profileId ? { ...p, status } : p

        return {
          currentProfile: updateObj(s.currentProfile),
          myProfile: updateObj(s.myProfile),
          profiles: s.profiles.map((p) => (p.id === profileId ? { ...p, status } : p)),
        }
      })

      return { error: null }
    } catch (e: any) {
      return { error: e.message || 'Error al actualizar visibilidad.' }
    }
  },

  verifyWhatsApp: async (profileId, phone, _code) => {
    try {
      const now = new Date().toISOString()
      // 1. Update localStorage cache
      const localWA = getLocalVerifiedWA()
      localWA[profileId] = { phone, at: now }
      saveLocalVerifiedWA(localWA)

      // 2. Update Supabase if possible
      try {
        await (supabase.from('profiles') as any)
          .update({
            whatsapp_verified: true,
            whatsapp_verified_at: now,
          })
          .eq('id', profileId)
      } catch (e) {
        console.warn('Supabase whatsapp_verified update skipped:', e)
      }

      // 3. Update Zustand state
      set((s) => {
        const updateObj = (p: ProfileWithDetails | null) =>
          p && p.id === profileId
            ? { ...p, whatsapp_verified: true, whatsapp_verified_at: now }
            : p

        return {
          currentProfile: updateObj(s.currentProfile),
          myProfile: updateObj(s.myProfile),
          profiles: s.profiles.map((p) =>
            p.id === profileId
              ? { ...p, whatsapp_verified: true, whatsapp_verified_at: now }
              : p
          ),
        }
      })

      return { error: null, success: true }
    } catch (e: any) {
      return { error: e.message || 'Error al verificar el número de WhatsApp.' }
    }
  },

  deleteAccount: async (profileId, payload) => {
    try {
      const now = new Date().toISOString()
      const current = get().myProfile
      const deletionRecord: AccountDeletionRecord = {
        id: 'del-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        user_id: profileId,
        user_email: payload.userEmail || null,
        profile_name: current?.name || 'Perfil',
        profile_slug: current?.slug || '',
        reason: payload.reason,
        explanation: payload.explanation,
        created_at: now,
      }

      // 1. Save to local deletions
      const localDeletions = [deletionRecord, ...getLocalDeletions()]
      saveLocalDeletions(localDeletions)

      // 2. Try saving to Supabase account_deletions table
      try {
        await (supabase.from('account_deletions') as any).insert({
          id: deletionRecord.id,
          user_id: profileId,
          user_email: payload.userEmail || null,
          profile_name: deletionRecord.profile_name,
          profile_slug: deletionRecord.profile_slug,
          reason: payload.reason,
          explanation: payload.explanation,
        })
      } catch (e) {
        console.warn('Supabase insert account_deletions skipped:', e)
      }

      // 3. Mark profile as 'eliminado' in Supabase
      try {
        await (supabase.from('profiles') as any)
          .update({ status: 'eliminado', updated_at: now })
          .eq('id', profileId)
      } catch (e) {
        console.warn('Supabase mark profile deleted skipped:', e)
      }

      // 4. Clear local profile state
      set({ myProfile: null, currentProfile: null })

      return { error: null, success: true }
    } catch (e: any) {
      return { error: e.message || 'Error al procesar la baja de la cuenta.' }
    }
  },

  fetchAccountDeletions: async () => {
    const local = getLocalDeletions()
    try {
      const { data, error } = await (supabase.from('account_deletions') as any)
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        const dbIds = new Set(data.map((d: any) => d.id))
        const merged = [
          ...data,
          ...local.filter((l) => !dbIds.has(l.id)),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        saveLocalDeletions(merged)
        return merged
      }
    } catch (e) {
      console.warn('Supabase fetchAccountDeletions failed, using cache:', e)
    }
    return local
  },

  submitRecommendation: async (profileId, data) => {
    try {
      if (!data.from_name?.trim()) {
        return { error: 'Por favor ingresá tu nombre o iniciales.' }
      }
      if (!data.text || data.text.trim().length < 10) {
        return { error: 'La reseña debe tener al menos 10 caracteres.' }
      }

      const { data: userData } = await supabase.auth.getUser()
      const { data: inserted, error } = await (supabase.from('recommendations') as any).insert({
        to_profile_id: profileId,
        from_name: data.from_name.trim(),
        text: data.text.trim(),
        context: data.context?.trim() || null,
        from_user_id: userData?.user?.id || null,
        status: 'visible'
      }).select().single()

      if (error) return { error: error.message }

      // Optimistically append new review to currentProfile if matching
      const current = get().currentProfile
      if (current && (current.id === profileId || current.slug === profileId)) {
        const newRec = {
          id: inserted?.id,
          from_name: data.from_name.trim(),
          text: data.text.trim(),
          context: data.context?.trim() || null,
          created_at: new Date().toISOString()
        }
        set({
          currentProfile: {
            ...current,
            recommendations: [newRec, ...(current.recommendations || [])]
          }
        })
      }

      return { error: null }
    } catch (err: any) {
      return { error: err.message || 'Error al guardar la reseña.' }
    }
  },

  submitReport: async (profileId, reason, description) => {
    try {
      const { error } = await (supabase.from('reports') as any).insert({
        profile_id: profileId,
        reason: reason as any,
        description: description || null
      })
      if (error) return { error: error.message }
      return { error: null }
    } catch (err: any) {
      return { error: err.message || 'Error al enviar reporte.' }
    }
  }
}))
