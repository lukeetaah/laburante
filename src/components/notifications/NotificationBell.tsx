import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  Briefcase,
  DollarSign,
  Star,
  ShieldCheck,
  Clock,
  ExternalLink,
  ChevronRight,
  X
} from 'lucide-react'
import { useNotificationStore } from '@/stores/notification-store'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { navigateToContextualLink, parseContextualLink } from '@/lib/contextual-navigation'
import EmailPreferencesToggle from '@/components/notifications/EmailPreferencesToggle'

export default function NotificationBell() {
  const { user } = useAuthStore()
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
  } = useNotificationStore()

  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'new' | 'archived'>('new')
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchNotifications()
    if (!user) return
    const refresh = window.setInterval(fetchNotifications, 10000)
    const refreshOnFocus = () => fetchNotifications()
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') fetchNotifications()
    }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnVisibility)
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchNotifications())
      .subscribe()
    return () => {
      window.clearInterval(refresh)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnVisibility)
      supabase.removeChannel(channel)
    }
  }, [user, fetchNotifications])

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const getIcon = (type: string) => {
    switch (type) {
      case 'job':
        return <Briefcase size={15} className="text-amber-600" />
      case 'budget':
        return <DollarSign size={15} className="text-indigo-600" />
      case 'review':
        return <Star size={15} className="text-amber-500 fill-amber-500" />
      case 'system':
        return <ShieldCheck size={15} className="text-emerald-600" />
      default:
        return <Clock size={15} className="text-indigo-600" />
    }
  }

  const handleNotificationClick = async (id: string, read: boolean, link?: string | null) => {
    const externalLink = link ? !parseContextualLink(link) : false
    if (externalLink && link) {
      navigateToContextualLink(navigate, link)
      setIsOpen(false)
      if (!read) await markAsRead(id)
      return
    }
    if (!read) await markAsRead(id)
    setIsOpen(false)
    if (link) navigateToContextualLink(navigate, link)
  }

  const visibleNotifications = notifications.filter((notification) => view === 'new' ? !notification.read : notification.read)

  return (
    <div className="relative" ref={menuRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)] transition-colors"
        title="Avisos y notificaciones"
        aria-label="Notificaciones"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-[var(--color-laburante-border)] flex items-center justify-between bg-[var(--color-laburante-surface-alt)]/50">
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-xs text-[var(--color-laburante-text)]">
                Notificaciones y Avisos
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                  {unreadCount} nuevas
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-semibold text-[var(--color-laburante-indigo)] hover:underline flex items-center gap-1"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck size={13} />
                  <span>Marcar leídas</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('¿Deseás borrar todos los avisos de la lista?')) {
                      clearAllNotifications()
                    }
                  }}
                  className="text-[10px] text-[var(--color-laburante-text-muted)] hover:text-rose-600 hover:underline"
                  title="Limpiar todas"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 border-b border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-1.5">
            <button type="button" onClick={() => setView('new')} className={`rounded-lg px-2 py-2 text-[11px] font-bold ${view === 'new' ? 'bg-amber-100 text-amber-900' : 'text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)]'}`}>Novedades ({notifications.filter((n) => !n.read).length})</button>
            <button type="button" onClick={() => setView('archived')} className={`rounded-lg px-2 py-2 text-[11px] font-bold ${view === 'archived' ? 'bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)]' : 'text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)]'}`}>Archivadas ({notifications.filter((n) => n.read).length})</button>
          </div>

          {/* Notifications List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-laburante-border)]/50">
            {visibleNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Bell size={24} className="mx-auto text-[var(--color-laburante-text-muted)] opacity-40" />
                <p className="text-xs text-[var(--color-laburante-text-secondary)] font-medium">
                  {view === 'new' ? 'No tenés novedades pendientes' : 'No tenés avisos archivados'}
                </p>
                <p className="text-[11px] text-[var(--color-laburante-text-muted)]">
                  Acá verás cuando te pidan un presupuesto, acepten una cotización o certifiques tu número.
                </p>
              </div>
            ) : (
              visibleNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 transition-colors flex items-start gap-3 text-xs ${
                    !n.read
                      ? 'bg-amber-50/30 hover:bg-amber-50/50'
                      : 'hover:bg-[var(--color-laburante-surface-alt)]/60 opacity-80'
                  }`}
                >
                  <div className="h-8 w-8 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] flex items-center justify-center shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-heading font-bold text-[var(--color-laburante-text)] text-xs truncate">
                        {n.title}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!n.read && (
                          <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            dismissNotification(n.id)
                          }}
                          className="p-0.5 rounded-md text-[var(--color-laburante-text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Descartar aviso"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--color-laburante-text-secondary)] leading-relaxed line-clamp-2">
                      {n.message}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[10px] text-[var(--color-laburante-text-muted)]">
                      <span>{new Date(n.created_at).toLocaleDateString()}</span>

                      <div className="flex items-center gap-2">
                        {n.link && (
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(n.id, n.read, n.link)}
                            className="text-[var(--color-laburante-indigo)] font-semibold hover:underline flex items-center gap-0.5"
                          >
                            <span>Ver</span>
                            <ChevronRight size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {user && (
            <div className="px-3.5 py-2.5 border-t border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/30">
              <EmailPreferencesToggle variant="compact" />
            </div>
          )}

          {/* Footer */}
          <div className="p-2.5 border-t border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/40 text-center">
            <Link
              to="/mis-trabajos"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-heading font-semibold text-[var(--color-laburante-text)] hover:text-[var(--color-laburante-indigo)] transition-colors inline-flex items-center gap-1"
            >
              <span>Ver mis pedidos y trabajos</span>
              <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
