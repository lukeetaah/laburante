import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { JobRequest, JobRequestStatus, JobRequestUrgency } from '@/lib/database.types'

export interface JobRequestWithDetails extends JobRequest {
  pro_name?: string
  pro_slug?: string
  pro_photo?: string | null
  pro_provincia?: string
  pro_localidad?: string
  pro_contact?: string | null
}

export interface CreateJobRequestPayload {
  profile_id: string
  pro_name: string
  pro_slug: string
  title: string
  description: string
  urgency: JobRequestUrgency
  preferred_date?: string
  photos?: string[]
  client_name: string
  client_contact: string
  client_location?: string
}

export interface SendBudgetPayload {
  amount: string
  details?: string
  estimatedTime?: string
}

interface JobState {
  clientRequests: JobRequestWithDetails[]
  proJobs: JobRequestWithDetails[]
  loading: boolean
  error: string | null

  fetchMyRequests: () => Promise<void>
  fetchMyJobs: () => Promise<void>
  createJobRequest: (payload: CreateJobRequestPayload) => Promise<{ error: string | null; request?: JobRequestWithDetails }>
  sendBudget: (requestId: string, budget: SendBudgetPayload) => Promise<{ error: string | null }>
  acceptBudget: (requestId: string) => Promise<{ error: string | null }>
  updateJobStatus: (requestId: string, status: JobRequestStatus) => Promise<{ error: string | null }>
  cancelJob: (requestId: string, reason: string, cancelledBy: 'cliente' | 'profesional') => Promise<{ error: string | null }>
  submitOutcome: (requestId: string, role: 'cliente' | 'profesional', outcome: string, note?: string) => Promise<{ error: string | null }>
}

const LOCAL_STORAGE_KEY = 'laburante_job_requests_cache'

function getLocalCache(userId?: string | null): JobRequestWithDetails[] {
  try {
    const key = userId ? `${LOCAL_STORAGE_KEY}:${userId}` : `${LOCAL_STORAGE_KEY}:guest`
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalCache(list: JobRequestWithDetails[], userId?: string | null) {
  try {
    const key = userId ? `${LOCAL_STORAGE_KEY}:${userId}` : `${LOCAL_STORAGE_KEY}:guest`
    localStorage.setItem(key, JSON.stringify(list))
  } catch (e) {
    console.warn('Could not save to localStorage', e)
  }
}

export const useJobStore = create<JobState>((set, get) => ({
  clientRequests: [],
  proJobs: [],
  loading: false,
  error: null,

  fetchMyRequests: async () => {
    set({ loading: true, error: null })
    let currentUserId: string | null = null
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      currentUserId = userId || null
      const localItems = getLocalCache(userId)

      if (userId) {
        const { data, error } = await (supabase.from('job_requests') as any)
          .select(`
            *,
            profiles:profile_id ( name, slug, photo_url, provincia, localidad, contact_methods ( type, value, is_public ) )
          `)
          .eq('client_id', userId)
          .order('created_at', { ascending: false })

        if (!error && data) {
          const formatted: JobRequestWithDetails[] = data.map((item: any) => ({
            ...item,
            pro_name: item.profiles?.name || 'Profesional',
            pro_slug: item.profiles?.slug || '',
            pro_photo: item.profiles?.photo_url || null,
            pro_provincia: item.profiles?.provincia || '',
            pro_localidad: item.profiles?.localidad || '',
            pro_contact: item.profiles?.contact_methods?.find((contact: any) => contact.type === 'whatsapp' && contact.is_public)?.value || null,
          }))
          set({ clientRequests: formatted, loading: false })
          return
        }
      }

      // Fallback to local cache (for guests or before Supabase sync)
      const filtered = localItems.filter((i) => !userId || i.client_id === userId || !i.client_id)
      set({ clientRequests: filtered, loading: false })
    } catch (err: any) {
      console.warn('fetchMyRequests error, using cache:', err)
      set({ clientRequests: getLocalCache(currentUserId), loading: false })
    }
  },

  fetchMyJobs: async () => {
    set({ loading: true, error: null })
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id

      if (!userId) {
        set({ proJobs: [], loading: false })
        return
      }

      const { data, error } = await (supabase.from('job_requests') as any)
        .select('*')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        set({ proJobs: data as JobRequestWithDetails[], loading: false })
        return
      }

      // Check local cache if matching profile_id
      const local = getLocalCache(userId).filter((i) => i.profile_id === userId)
      set({ proJobs: local, loading: false })
    } catch (err: any) {
      console.warn('fetchMyJobs error:', err)
      set({ proJobs: [], loading: false })
    }
  },

  createJobRequest: async (payload) => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id || null

      if (userId && userId === payload.profile_id) {
        return { error: 'No podés contratarte a vos mismo.' }
      }

      const newId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'job-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)

      const record: JobRequestWithDetails = {
        id: newId,
        client_id: userId,
        client_name: payload.client_name.trim(),
        client_contact: payload.client_contact.trim(),
        client_location: payload.client_location?.trim() || null,
        profile_id: payload.profile_id,
        title: payload.title.trim(),
        description: payload.description.trim(),
        urgency: payload.urgency,
        preferred_date: payload.preferred_date || null,
        photos: payload.photos || [],
        status: 'solicitado',
        budget_amount: null,
        budget_details: null,
        budget_estimated_time: null,
        budget_created_at: null,
        cancel_reason: null,
        cancelled_by: null,
        client_outcome: null,
        professional_outcome: null,
        outcome_note: null,
        outcome_updated_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pro_name: payload.pro_name,
        pro_slug: payload.pro_slug,
      }

      // Try inserting into Supabase
      try {
        const { error } = await (supabase.from('job_requests') as any).insert({
          id: newId,
          client_id: userId,
          client_name: record.client_name,
          client_contact: record.client_contact,
          client_location: record.client_location,
          profile_id: record.profile_id,
          title: record.title,
          description: record.description,
          urgency: record.urgency,
          preferred_date: record.preferred_date,
          photos: record.photos,
          status: 'solicitado',
        })
        if (error) return { error: error.message || 'No se pudo enviar la solicitud.' }
      } catch (dbErr) {
        console.warn('Supabase insert failed:', dbErr)
        return { error: 'No se pudo validar la solicitud. Intentá nuevamente.' }
      }

      // Always save to local cache for instant UI feedback
      const local = getLocalCache(userId)
      saveLocalCache([record, ...local], userId)

      set((s) => ({
        clientRequests: [record, ...s.clientRequests],
      }))

      return { error: null, request: record }
    } catch (e: any) {
      return { error: e.message || 'Error al enviar la solicitud.' }
    }
  },

  sendBudget: async (requestId, budget) => {
    try {
      const now = new Date().toISOString()
      const updateData: Partial<JobRequest> & { updated_at: string } = {
        status: 'presupuestado' as JobRequestStatus,
        budget_amount: budget.amount.trim(),
        budget_details: budget.details?.trim() || null,
        budget_estimated_time: budget.estimatedTime?.trim() || null,
        budget_created_at: now,
        updated_at: now,
      }

      try {
        await (supabase.from('job_requests') as any)
          .update(updateData)
          .eq('id', requestId)
      } catch (e) {
        console.warn('Supabase update skipped, updating local state:', e)
      }

      // Update local cache
      const { data: userData } = await supabase.auth.getUser()
      const local = getLocalCache(userData.user?.id).map((item) =>
        item.id === requestId ? { ...item, ...updateData } : item
      )
      saveLocalCache(local as JobRequestWithDetails[], userData.user?.id)

      // Update Zustand state
      set((s) => ({
        proJobs: s.proJobs.map((item) =>
          item.id === requestId ? { ...item, ...updateData } : item
        ),
        clientRequests: s.clientRequests.map((item) =>
          item.id === requestId ? { ...item, ...updateData } : item
        ),
      }))

      return { error: null }
    } catch (e: any) {
      return { error: e.message || 'Error al enviar el presupuesto.' }
    }
  },

  acceptBudget: async (requestId) => {
    return get().updateJobStatus(requestId, 'aceptado')
  },

  updateJobStatus: async (requestId, newStatus) => {
    try {
      const now = new Date().toISOString()
      const updateData: Partial<JobRequest> & { updated_at: string } = {
        status: newStatus,
        updated_at: now,
      }

      try {
        await (supabase.from('job_requests') as any)
          .update(updateData)
          .eq('id', requestId)
      } catch (e) {
        console.warn('Supabase update skipped, updating local state:', e)
      }

      const { data: userData } = await supabase.auth.getUser()
      const local = getLocalCache(userData.user?.id).map((item) =>
        item.id === requestId ? { ...item, ...updateData } : item
      )
      saveLocalCache(local as JobRequestWithDetails[], userData.user?.id)

      set((s) => ({
        proJobs: s.proJobs.map((item) =>
          item.id === requestId ? { ...item, ...updateData } : item
        ),
        clientRequests: s.clientRequests.map((item) =>
          item.id === requestId ? { ...item, ...updateData } : item
        ),
      }))

      return { error: null }
    } catch (e: any) {
      return { error: e.message || 'Error al actualizar el estado.' }
    }
  },

  cancelJob: async (requestId, reason, cancelledBy) => {
    try {
      const now = new Date().toISOString()
      const updateData: Partial<JobRequest> & { updated_at: string } = {
        status: 'cancelado' as JobRequestStatus,
        cancel_reason: reason.trim(),
        cancelled_by: cancelledBy,
        updated_at: now,
      }

      try {
        await (supabase.from('job_requests') as any)
          .update(updateData)
          .eq('id', requestId)
      } catch (e) {
        console.warn('Supabase update skipped, updating local state:', e)
      }

      const { data: userData } = await supabase.auth.getUser()
      const local = getLocalCache(userData.user?.id).map((item) =>
        item.id === requestId ? { ...item, ...updateData } : item
      )
      saveLocalCache(local as JobRequestWithDetails[], userData.user?.id)

      set((s) => ({
        proJobs: s.proJobs.map((item) =>
          item.id === requestId ? { ...item, ...updateData } : item
        ),
        clientRequests: s.clientRequests.map((item) =>
          item.id === requestId ? { ...item, ...updateData } : item
        ),
      }))

      return { error: null }
    } catch (e: any) {
      return { error: e.message || 'Error al cancelar la solicitud.' }
    }
  },

  submitOutcome: async (requestId, role, outcome, note) => {
    try {
      const now = new Date().toISOString()
      const updateData = {
        [role === 'cliente' ? 'client_outcome' : 'professional_outcome']: outcome.trim(),
        outcome_note: note?.trim() || null,
        outcome_updated_at: now,
        updated_at: now,
      }
      if (role === 'profesional') {
        await get().updateJobStatus(requestId, 'completado')
      }
      const { error } = await (supabase.from('job_requests') as any).update(updateData).eq('id', requestId)
      if (error) throw error
      const { data: userData } = await supabase.auth.getUser()
      const local = getLocalCache(userData.user?.id).map((item) => item.id === requestId ? { ...item, ...updateData } : item)
      saveLocalCache(local as JobRequestWithDetails[], userData.user?.id)
      set((s) => ({
        proJobs: s.proJobs.map((item) => item.id === requestId ? { ...item, ...updateData } : item),
        clientRequests: s.clientRequests.map((item) => item.id === requestId ? { ...item, ...updateData } : item),
      }))
      return { error: null }
    } catch (e: any) {
      return { error: e.message || 'No pudimos guardar el resultado del trabajo.' }
    }
  },
}))
