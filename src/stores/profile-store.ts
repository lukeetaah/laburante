import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { WhatsAppVerificationRequest } from '@/lib/database.types'
import { SITE_CONFIG } from '@/lib/constants'
import { interpretSearch, normalizeSearchText } from '@/lib/search-intent'
import { CATEGORIES } from '@/data/categories'
import type { WorkModality } from '@/lib/profile-format'
import { dedupeContactMethods } from '@/lib/contact-methods'

export interface ProfileWithDetails {
  id: string
  name: string
  slug: string
  photo_url: string | null
  account_type?: 'persona' | 'empresa'
  company_plan?: 'gratis' | 'pago'
  resume_url?: string | null
  resume_name?: string | null
  bio: string | null
  provincia: string
  localidad: string
  zona_trabajo: string | null
  disponibilidad: 'disponible' | 'ocupado' | 'no_disponible'
  modalidad: WorkModality
  hybrid_presencial_pct?: number | null
  hybrid_remoto_pct?: number | null
  status: 'activo' | 'oculto' | 'suspendido' | 'eliminado'
  whatsapp_verified?: boolean
  whatsapp_verified_at?: string | null
  notify_whatsapp?: boolean
  created_at: string
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
  languages?: { language: string; level: 'basico' | 'intermedio' | 'avanzado' | 'bilingue' | 'nativo'; is_public: boolean }[]
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
  requestWhatsAppVerification: (
    profileId: string,
    profileName: string,
    profileSlug: string,
    phoneDeclared: string
  ) => Promise<{ error: string | null; code?: string; officialPhone: string; requestId?: string }>
  fetchPendingWhatsAppVerifications: () => Promise<WhatsAppVerificationRequest[]>
  adminApproveWhatsAppVerification: (
    requestId: string,
    profileId: string,
    phone: string
  ) => Promise<{ error: string | null }>
  adminRejectWhatsAppVerification: (
    requestId: string
  ) => Promise<{ error: string | null }>
  deleteAccount: (profileId: string, payload: { reason: string; explanation: string; userEmail?: string }) => Promise<{ error: string | null; success?: boolean }>
  fetchAccountDeletions: () => Promise<AccountDeletionRecord[]>
  submitRecommendation: (profileId: string, data: { from_name: string; text: string; context?: string }) => Promise<{ error: string | null }>
  submitReport: (profileId: string, reason: string, description: string) => Promise<{ error: string | null }>
}

const VERIFIED_WA_KEY = 'laburante_v2_verified_wa'
const DELETIONS_KEY = 'laburante_v2_account_deletions'

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

const WA_REQUESTS_KEY = 'laburante_v2_wa_verification_requests'
const HYBRID_COLUMN_MISSING_RE = /hybrid_(presencial|remoto)_pct|column .* does not exist|Could not find .*hybrid_/i

function getLocalWARequests(): WhatsAppVerificationRequest[] {
  try {
    const raw = localStorage.getItem(WA_REQUESTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalWARequests(data: WhatsAppVerificationRequest[]) {
  try {
    localStorage.setItem(WA_REQUESTS_KEY, JSON.stringify(data))
  } catch {}
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function withoutHybridPercentages(payload: any) {
  const { hybrid_presencial_pct, hybrid_remoto_pct, ...rest } = payload
  return rest
}

async function replaceProfileLanguages(profileId: string, languages: any[]) {
  const uniqueRows = Array.from(new Map((languages || [])
    .map((entry: any) => ({
      profile_id: profileId,
      language: String(entry.language || '').trim(),
      level: entry.level,
      is_public: entry.is_public !== false,
    }))
    .filter((entry: any) => entry.language)
    .map((entry: any) => [entry.language.toLocaleLowerCase(), entry])).values())

  if (uniqueRows.some((entry: any) => entry.language.length < 2 || entry.language.length > 40)) {
    throw new Error('Cada idioma debe tener entre 2 y 40 caracteres.')
  }

  const { data: previousLanguages, error: previousLanguagesError } = await (supabase.from('profile_languages') as any)
    .select('language')
    .eq('profile_id', profileId)
  if (previousLanguagesError) throw new Error(previousLanguagesError.message)

  if (uniqueRows.length) {
    const { error: languageError } = await (supabase.from('profile_languages') as any)
      .upsert(uniqueRows, { onConflict: 'profile_id,language' })
    if (languageError) throw new Error(languageError.message)
  }

  const desiredLanguages = new Set(uniqueRows.map((entry: any) => entry.language))
  const staleLanguages = (previousLanguages || []).map((entry: any) => entry.language).filter((language: string) => !desiredLanguages.has(language))
  if (staleLanguages.length) {
    const { error: deleteLanguagesError } = await (supabase.from('profile_languages') as any)
      .delete()
      .eq('profile_id', profileId)
      .in('language', staleLanguages)
    if (deleteLanguagesError) throw new Error(deleteLanguagesError.message)
  }
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  currentProfile: null,
  myProfile: null,
  loading: false,
  fetchProfiles: async (filters = {}) => {
    set({ loading: true })
    try {
      let query = (supabase.from('profiles') as any)
        .select(`
          id, name, slug, photo_url, account_type, company_plan, resume_url, resume_name, bio, provincia, localidad, zona_trabajo,
          disponibilidad, modalidad, hybrid_presencial_pct, hybrid_remoto_pct, status, created_at,
          skills ( name ),
          services ( title, description, precio_orientativo ),
          contact_methods ( type, value, is_public ),
          profile_languages ( language, level, is_public )
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

      let { data, error } = await query
      if (error) {
        let legacyQuery = (supabase.from('profiles') as any)
          .select(`id, name, slug, photo_url, account_type, company_plan, resume_url, resume_name, bio, provincia, localidad, zona_trabajo, disponibilidad, modalidad, status, created_at, skills ( name ), services ( title, description, precio_orientativo ), contact_methods ( type, value, is_public ), profile_languages ( language, level, is_public )`)
          .eq('status', 'activo')
        if (filters.provincia) legacyQuery = legacyQuery.eq('provincia', filters.provincia)
        if (filters.localidad) legacyQuery = legacyQuery.ilike('localidad', `%${filters.localidad}%`)
        if (filters.modalidad && filters.modalidad !== 'todas') legacyQuery = legacyQuery.eq('modalidad', filters.modalidad)
        const legacyResult = await legacyQuery
        data = legacyResult.data
        error = legacyResult.error
      }

      let realProfiles: ProfileWithDetails[] = []
      if (!error && data) {
        const localWA = getLocalVerifiedWA()
        realProfiles = (data as any[]).map((item: any) => ({
          ...item,
          whatsapp_verified: Boolean(item.whatsapp_verified || (localWA[item.id] !== undefined)),
          whatsapp_verified_at: item.whatsapp_verified_at || localWA[item.id]?.at || null,
          skills: item.skills?.map((s: any) => s.name) || [],
          services: item.services || [],
          contact_methods: dedupeContactMethods(item.contact_methods || []),
          languages: item.profile_languages || [],
          categories: []
        }))
      }

      if (filters.category) {
        const categoryDef = CATEGORIES.find((category) => normalizeSearchText(category.name) === normalizeSearchText(filters.category!))
        const categoryTerms = [filters.category, ...(categoryDef?.subcategories || [])].map(normalizeSearchText)
        realProfiles = realProfiles.filter((p) => {
          const text = normalizeSearchText([p.name, p.bio || '', ...(p.skills || []), ...(p.services || []).map((s) => s.title)].join(' '))
          return categoryTerms.some((term) => text.includes(term))
        })
      }

      // Filter by text query if given
      if (filters.query && filters.query.trim()) {
        const interpretation = interpretSearch(filters.query)
        const q = normalizeSearchText(filters.query)
        const score = (p: ProfileWithDetails) => {
          const text = normalizeSearchText([p.name, p.bio || '', p.provincia, p.localidad, ...(p.skills || []), ...(p.services || []).map((s) => s.title)].join(' '))
          const exact = text.includes(q) ? 3 : 0
          const hits = interpretation.expandedTerms.filter((term) => text.includes(term)).length
          return exact + hits
        }
        realProfiles = realProfiles.map((profile) => ({ profile, rank: score(profile) })).filter((item) => item.rank > 0).sort((a, b) => b.rank - a.rank).map((item) => item.profile)
      }

      set({ profiles: realProfiles, loading: false })
    } catch (err) {
      console.warn('Error fetching profiles from Supabase:', err)
      set({ profiles: [], loading: false })
    }
  },

  fetchProfileBySlug: async (slug: string) => {
    set({ loading: true })
    try {
      // Check Supabase first
      let { data, error } = await (supabase.from('profiles') as any)
        .select(`
          id, name, slug, photo_url, account_type, company_plan, resume_url, resume_name, bio, provincia, localidad, zona_trabajo,
          disponibilidad, modalidad, hybrid_presencial_pct, hybrid_remoto_pct, status, created_at,
          skills ( name ),
          services ( title, description, precio_orientativo ),
          contact_methods ( id, type, value, is_public ),
          recommendations ( id, from_name, text, context, created_at ),
          profile_languages ( language, level, is_public )
        `)
        .eq('slug', slug)
        .maybeSingle()

      if (error) {
        const legacyResult = await (supabase.from('profiles') as any)
          .select(`id, name, slug, photo_url, account_type, company_plan, resume_url, resume_name, bio, provincia, localidad, zona_trabajo, disponibilidad, modalidad, status, created_at, skills ( name ), services ( title, description, precio_orientativo ), contact_methods ( id, type, value, is_public ), recommendations ( id, from_name, text, context, created_at ), profile_languages ( language, level, is_public )`)
          .eq('slug', slug)
          .maybeSingle()
        data = legacyResult.data
        error = legacyResult.error
      }

      if (!error && data) {
        const item = data as any
        const localWA = getLocalVerifiedWA()
        const fullProfile: ProfileWithDetails = {
          ...item,
          whatsapp_verified: Boolean(item.whatsapp_verified || (localWA[item.id] !== undefined)),
          whatsapp_verified_at: item.whatsapp_verified_at || localWA[item.id]?.at || null,
          skills: item.skills?.map((s: any) => s.name) || [],
          services: item.services || [],
          contact_methods: dedupeContactMethods(item.contact_methods || []),
          languages: item.profile_languages || [],
          recommendations: item.recommendations || [],
          categories: []
        }
        set({ currentProfile: fullProfile, loading: false })
        return fullProfile
      }

      set({ currentProfile: null, loading: false })
      return null
    } catch (err) {
      console.warn('Error fetching profile by slug:', err)
      set({ currentProfile: null, loading: false })
      return null
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
      let { data, error } = await (supabase.from('profiles') as any)
        .select(`
          id, name, slug, photo_url, account_type, company_plan, resume_url, resume_name, bio, provincia, localidad, zona_trabajo,
          disponibilidad, modalidad, hybrid_presencial_pct, hybrid_remoto_pct, status, created_at,
          skills ( name ),
          services ( title, description, precio_orientativo ),
          contact_methods ( id, type, value, is_public ),
          recommendations ( id, from_name, text, context, created_at ),
          profile_languages ( language, level, is_public )
        `)
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        const legacyResult = await (supabase.from('profiles') as any)
          .select(`id, name, slug, photo_url, account_type, company_plan, resume_url, resume_name, bio, provincia, localidad, zona_trabajo, disponibilidad, modalidad, status, created_at, skills ( name ), services ( title, description, precio_orientativo ), contact_methods ( id, type, value, is_public ), recommendations ( id, from_name, text, context, created_at ), profile_languages ( language, level, is_public )`)
          .eq('id', userId)
          .maybeSingle()
        data = legacyResult.data ? { ...legacyResult.data, account_type: legacyResult.data.account_type || userData.user.user_metadata?.account_type || userData.user.user_metadata?.accountType } : legacyResult.data
        error = legacyResult.error
      }

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
        contact_methods: dedupeContactMethods(item.contact_methods || []),
        languages: item.profile_languages || [],
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
          hybrid_presencial_pct: profileData.modalidad === 'ambas' ? profileData.hybrid_presencial_pct : null,
          hybrid_remoto_pct: profileData.modalidad === 'ambas' ? profileData.hybrid_remoto_pct : null,
          status: targetStatus,
          photo_url: profileData.photo_url || null,
          resume_url: profileData.resume_url || null,
          resume_name: profileData.resume_name || null,
          updated_at: new Date().toISOString()
        }
        if (profileData.notify_whatsapp !== undefined) {
          updatePayload.notify_whatsapp = profileData.notify_whatsapp
        }

        let { error: profileError } = await (supabase.from('profiles') as any)
          .update(updatePayload)
          .eq('id', userId)

        if (profileError && HYBRID_COLUMN_MISSING_RE.test(profileError.message || '')) {
          const retry = await (supabase.from('profiles') as any)
            .update(withoutHybridPercentages(updatePayload))
            .eq('id', userId)
          profileError = retry.error
        }

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
          hybrid_presencial_pct: profileData.modalidad === 'ambas' ? profileData.hybrid_presencial_pct : null,
          hybrid_remoto_pct: profileData.modalidad === 'ambas' ? profileData.hybrid_remoto_pct : null,
          status: targetStatus,
          photo_url: profileData.photo_url || null,
          resume_url: profileData.resume_url || null,
          resume_name: profileData.resume_name || null,
          notify_whatsapp: profileData.notify_whatsapp ?? true
        }

        let { error: profileError } = await (supabase.from('profiles') as any).insert(insertPayload)

        if (profileError && HYBRID_COLUMN_MISSING_RE.test(profileError.message || '')) {
          const retry = await (supabase.from('profiles') as any).insert(withoutHybridPercentages(insertPayload))
          profileError = retry.error
        }

        if (profileError) return { error: profileError.message }
      }

      await replaceProfileLanguages(userId, profileData.languages || [])

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
        const contactRows = dedupeContactMethods(profileData.contact_methods).map((c: any) => ({
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

  requestWhatsAppVerification: async (profileId, profileName, profileSlug, phoneDeclared) => {
    try {
      const codeDigits = Math.floor(100000 + Math.random() * 900000).toString()
      const code = `LAB-${codeDigits}`
      const requestId = generateUUID()
      const now = new Date().toISOString()

      const newReq: WhatsAppVerificationRequest = {
        id: requestId,
        profile_id: profileId,
        profile_name: profileName,
        profile_slug: profileSlug,
        phone_declared: phoneDeclared,
        code,
        status: 'pendiente',
        reviewed_at: null,
        created_at: now,
      }

      // 1. Save local
      const existing = getLocalWARequests().filter(
        (r) => !(r.profile_id === profileId && r.status === 'pendiente')
      )
      saveLocalWARequests([newReq, ...existing])

      // 2. Try Supabase
      try {
        const { data: inserted, error: insErr } = await (supabase.from('whatsapp_verification_requests') as any).insert({
          id: requestId,
          profile_id: profileId,
          profile_name: profileName,
          profile_slug: profileSlug,
          phone_declared: phoneDeclared,
          code,
          status: 'pendiente',
          created_at: now,
        }).select().maybeSingle()

        if (insErr) {
          console.warn('Supabase insert whatsapp_verification_requests notice:', insErr.message)
        } else if (inserted?.id) {
          newReq.id = inserted.id
        }
      } catch (e) {
        console.warn('Supabase insert whatsapp_verification_requests skipped:', e)
      }

      return {
        error: null,
        code,
        officialPhone: SITE_CONFIG.officialWhatsApp,
        requestId: newReq.id,
      }
    } catch (e: any) {
      return {
        error: e.message || 'Error al iniciar la solicitud de verificación.',
        officialPhone: SITE_CONFIG.officialWhatsApp,
      }
    }
  },

  fetchPendingWhatsAppVerifications: async () => {
    const local = getLocalWARequests()
    try {
      const { data, error } = await (supabase.from('whatsapp_verification_requests') as any)
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        const dbIds = new Set(data.map((d: any) => d.id))
        const merged = [
          ...data,
          ...local.filter((l) => !dbIds.has(l.id)),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        const profileIds = Array.from(new Set(merged.map((request) => request.profile_id)))
        if (!profileIds.length) return []
        const { data: existingProfiles, error: profileError } = await (supabase.from('profiles') as any)
          .select('id')
          .in('id', profileIds)
        if (profileError) return merged
        const existingIds = new Set((existingProfiles || []).map((profile: any) => profile.id))
        const validRequests = merged.filter((request) => existingIds.has(request.profile_id))
        saveLocalWARequests(validRequests)
        return validRequests
      }
    } catch (e) {
      console.warn('Supabase fetchPendingWhatsAppVerifications failed, using local:', e)
    }
    return local
  },

  adminApproveWhatsAppVerification: async (requestId, profileId, phone) => {
    try {
      const now = new Date().toISOString()

      // 1. Update local requests
      const local = getLocalWARequests().map((r) =>
        r.id === requestId || (r.profile_id === profileId && r.status === 'pendiente')
          ? { ...r, status: 'aprobado' as const, reviewed_at: now }
          : r
      )
      saveLocalWARequests(local)

      // 2. Update local verified WA
      const localWA = getLocalVerifiedWA()
      localWA[profileId] = { phone, at: now }
      saveLocalVerifiedWA(localWA)

      // 3. Update Supabase request
      try {
        await (supabase.from('whatsapp_verification_requests') as any)
          .update({ status: 'aprobado', reviewed_at: now })
          .eq('id', requestId)
      } catch (e) {
        console.warn('Supabase update request skipped:', e)
      }

      // 4. Update Supabase profile
      try {
        await (supabase.from('profiles') as any)
          .update({
            whatsapp_verified: true,
            whatsapp_verified_at: now,
          })
          .eq('id', profileId)
      } catch (e) {
        console.warn('Supabase update profile skipped:', e)
      }

      // 5. Update Zustand store
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

      // 6. Send in-app notification to the professional
      try {
        const { useNotificationStore } = await import('@/stores/notification-store')
        useNotificationStore.getState().addNotification({
          userId: profileId,
          title: '¡WhatsApp Verificado por Administración!',
          message: `El administrador certificó tu número ${phone}. Tu perfil ahora cuenta con el sello oficial verificado.`,
          type: 'system',
        })
      } catch (e) {
        console.warn('Notification send failed:', e)
      }

      return { error: null }
    } catch (e: any) {
      return { error: e.message || 'Error al aprobar la verificación.' }
    }
  },

  adminRejectWhatsAppVerification: async (requestId) => {
    try {
      const now = new Date().toISOString()
      const local = getLocalWARequests().map((r) =>
        r.id === requestId
          ? { ...r, status: 'rechazado' as const, reviewed_at: now }
          : r
      )
      saveLocalWARequests(local)

      try {
        await (supabase.from('whatsapp_verification_requests') as any)
          .update({ status: 'rechazado', reviewed_at: now })
          .eq('id', requestId)
      } catch (e) {
        console.warn('Supabase reject request skipped:', e)
      }

      return { error: null }
    } catch (e: any) {
      return { error: e.message || 'Error al rechazar verificación.' }
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
