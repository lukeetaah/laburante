import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  CheckCheck,
  Briefcase,
  DollarSign,
  Star,
  ShieldCheck,
  Clock,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  X
} from 'lucide-react'
import { useNotificationStore } from '@/stores/notification-store'
import { useAuthStore } from '@/stores/auth-store'

export default function NotificationBell() {
  const { user } = useAuthStore()
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    whatsappAlertsEnabled,
    setWhatsappAlertsEnabled,
    sendViaWhatsApp,
  } = useNotificationStore()

  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    if (!user) return
    const refresh = window.setInterval(fetchNotifications, 15000)
    return () => window.clearInterval(refresh)
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

  const handleNotificationClick = (id: string, read: boolean) => {
    if (!read) {
      markAsRead(id)
    }
    setIsOpen(false)
  }

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
          </div>

          {/* WhatsApp Alert Option */}
          <div className="p-3 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-950">
            <div className="flex items-center gap-2">
              <MessageCircle size={15} className="text-emerald-600 shrink-0" />
              <span className="text-[11px] font-medium leading-tight">
                Avisarme novedades por WhatsApp
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappAlertsEnabled}
                onChange={(e) => setWhatsappAlertsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Notifications List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-laburante-border)]/50">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Bell size={24} className="mx-auto text-[var(--color-laburante-text-muted)] opacity-40" />
                <p className="text-xs text-[var(--color-laburante-text-secondary)] font-medium">
                  No tenés avisos pendientes
                </p>
                <p className="text-[11px] text-[var(--color-laburante-text-muted)]">
                  Acá verás cuando te pidan un presupuesto, acepten una cotización o certifiques tu número.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
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
                      {!n.read && (
                        <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 mt-1"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-laburante-text-secondary)] leading-relaxed line-clamp-2">
                      {n.message}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[10px] text-[var(--color-laburante-text-muted)]">
                      <span>{new Date(n.created_at).toLocaleDateString()}</span>

                      <div className="flex items-center gap-2">
                        {/* Send via WhatsApp quick action */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            sendViaWhatsApp('', `Aviso de LABURANTE: ${n.title} - ${n.message}`)
                          }}
                          className="hover:text-emerald-600 transition-colors flex items-center gap-0.5 font-medium"
                          title="Abrir este aviso en WhatsApp"
                        >
                          <MessageCircle size={11} />
                          <span>WhatsApp</span>
                        </button>

                        {n.link && (
                          <Link
                            to={n.link}
                            onClick={() => handleNotificationClick(n.id, n.read)}
                            className="text-[var(--color-laburante-indigo)] font-semibold hover:underline flex items-center gap-0.5"
                          >
                            <span>Ver</span>
                            <ChevronRight size={10} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

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
