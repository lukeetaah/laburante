import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { InAppNotification } from '@/lib/database.types'

const LOCAL_NOTIFS_KEY = 'laburante_notifications_cache'

function getLocalNotifications(): InAppNotification[] {
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalNotifications(notifs: InAppNotification[]) {
  try {
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(notifs))
  } catch (e) {
    console.warn('Could not save notifications to localStorage:', e)
  }
}

interface NotificationState {
  notifications: InAppNotification[]
  unreadCount: number
  loading: boolean
  whatsappAlertsEnabled: boolean

  setWhatsappAlertsEnabled: (enabled: boolean) => void
  fetchNotifications: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  addNotification: (payload: {
    userId?: string
    title: string
    message: string
    type: 'job' | 'budget' | 'status' | 'review' | 'system'
    link?: string
  }) => Promise<void>
  sendViaWhatsApp: (phone: string, message: string) => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  whatsappAlertsEnabled: true,

  setWhatsappAlertsEnabled: (enabled) => {
    set({ whatsappAlertsEnabled: enabled })
    try {
      localStorage.setItem('laburante_notify_whatsapp', enabled ? '1' : '0')
    } catch {}
  },

  fetchNotifications: async () => {
    set({ loading: true })
    const local = getLocalNotifications()

    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id

      if (userId) {
        const { data, error } = await (supabase.from('notifications') as any)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (!error && data) {
          const dbIds = new Set(data.map((n: any) => n.id))
          const merged = [
            ...data,
            ...local.filter((n) => !dbIds.has(n.id) && n.user_id === userId),
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

          saveLocalNotifications(merged)
          set({
            notifications: merged,
            unreadCount: merged.filter((n) => !n.read).length,
            loading: false,
          })
          return
        }
      }
    } catch (e) {
      console.warn('Supabase notifications fetch failed, using cache:', e)
    }

    set({
      notifications: local,
      unreadCount: local.filter((n) => !n.read).length,
      loading: false,
    })
  },

  markAsRead: async (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    )
    saveLocalNotifications(updated)
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    })

    try {
      await (supabase.from('notifications') as any)
        .update({ read: true })
        .eq('id', id)
    } catch (e) {
      console.warn('Failed to update notification read status in DB:', e)
    }
  },

  markAllAsRead: async () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }))
    saveLocalNotifications(updated)
    set({
      notifications: updated,
      unreadCount: 0,
    })

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user?.id) {
        await (supabase.from('notifications') as any)
          .update({ read: true })
          .eq('user_id', userData.user.id)
      }
    } catch (e) {
      console.warn('Failed to mark all notifications read in DB:', e)
    }
  },

  addNotification: async (payload) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = payload.userId || userData?.user?.id || 'anonymous'

    const newNotif: InAppNotification = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      user_id: userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      link: payload.link || null,
      read: false,
      created_at: new Date().toISOString(),
    }

    const local = [newNotif, ...getLocalNotifications()]
    saveLocalNotifications(local)

    set((s) => {
      const merged = [newNotif, ...s.notifications]
      return {
        notifications: merged,
        unreadCount: merged.filter((n) => !n.read).length,
      }
    })

    try {
      if (userId !== 'anonymous') {
        await (supabase.from('notifications') as any).insert({
          id: newNotif.id,
          user_id: userId,
          title: newNotif.title,
          message: newNotif.message,
          type: newNotif.type,
          link: newNotif.link,
          read: false,
        })
      }
    } catch (e) {
      console.warn('Could not insert notification into Supabase:', e)
    }
  },

  sendViaWhatsApp: (phone, message) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  },
}))
