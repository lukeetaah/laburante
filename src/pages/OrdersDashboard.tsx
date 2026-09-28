import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Briefcase,
  FileText,
  Clock,
  MapPin,
  MessageSquare,
  CheckCircle2,
  XCircle,
  DollarSign,
  Phone,
  ArrowRight,
  Filter,
  Star,
  ExternalLink,
  ChevronRight,
  Eye,
  AlertTriangle,
  Archive,
  Mail,
  MessageCircle
} from 'lucide-react'
import { useJobStore, type JobRequestWithDetails } from '@/stores/job-store'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import JobStatusStepper from '@/components/jobs/JobStatusStepper'
import BudgetModal from '@/components/jobs/BudgetModal'
import CancelJobModal from '@/components/jobs/CancelJobModal'
import RecommendationModal from '@/components/profile/RecommendationModal'
import ReportModal from '@/components/profile/ReportModal'
import OutcomeModal from '@/components/jobs/OutcomeModal'
import type { JobRequestStatus } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { useNotificationStore } from '@/stores/notification-store'
import { isCompanyAccount } from '@/lib/account'
import { focusContextualElement } from '@/lib/contextual-navigation'

const isArchivedInquiry = (item: any) => Boolean(item?.archived_at) || item?.status === 'cerrada'

const REJECTION_REASONS = [
  'No me interesa la propuesta.',
  'Las condiciones no se ajustan a lo que busco.',
  'La remuneración no se ajusta a mis expectativas.',
  'La modalidad o ubicación no me sirve.',
  'El puesto/servicio no coincide con mi perfil.',
  'Ya acepté otra oportunidad.',
  'Otro.',
]

export default function OrdersDashboard() {
  const { user } = useAuthStore()
  const { myProfile, fetchMyProfile } = useProfileStore()
  const companyAccount = isCompanyAccount(user, myProfile)
  const {
    clientRequests,
    proJobs,
    fetchMyRequests,
    fetchMyJobs,
    acceptBudget,
    updateJobStatus,
    submitOutcome,
    archiveJob,
    loading,
  } = useJobStore()
  const [searchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<'cliente' | 'profesional' | 'mensajes'>('cliente')
  const [statusFilter, setStatusFilter] = useState<'activos' | 'completados' | 'cancelados' | 'archivados' | 'todos'>('activos')
  const [activityFilter, setActivityFilter] = useState<'todo' | 'pedidos' | 'empresa'>('todo')
  const [showArchivedCompany, setShowArchivedCompany] = useState(false)

  // Messaging state (Conversaciones directas con LABURANTE Admin)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)

  // Modals state
  const [budgetModalJob, setBudgetModalJob] = useState<JobRequestWithDetails | null>(null)
  const [cancelModalJob, setCancelModalJob] = useState<{ job: JobRequestWithDetails; role: 'cliente' | 'profesional' } | null>(null)
  const [reviewModalJob, setReviewModalJob] = useState<JobRequestWithDetails | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [outcomeModal, setOutcomeModal] = useState<{ job: JobRequestWithDetails; role: 'cliente' | 'profesional'; blocking?: boolean } | null>(null)
  const [reportJob, setReportJob] = useState<{ job: JobRequestWithDetails; profileId: string; profileName: string } | null>(null)
  const [companyInquiries, setCompanyInquiries] = useState<any[]>([])
  const [selectedCompanyInquiry, setSelectedCompanyInquiry] = useState<any | null>(null)
  const [archiveMessage, setArchiveMessage] = useState('')
  const [rejectingInquiry, setRejectingInquiry] = useState<any | null>(null)
  const [rejectionReason, setRejectionReason] = useState<string>('No me interesa la propuesta.')
  const [rejectionComment, setRejectionComment] = useState<string>('')
  const [isRejecting, setIsRejecting] = useState<boolean>(false)
  const [isAccepting, setIsAccepting] = useState<boolean>(false)
  const selectedJobId = searchParams.get('pedido')
  const selectedCompanyInquiryId = searchParams.get('seleccion')
  const explicitTab = searchParams.get('tab')

  useEffect(() => {
    const tab = searchParams.get('tab')
    const estado = searchParams.get('estado')
    const actividad = searchParams.get('actividad')
    if (tab === 'cliente' || tab === 'profesional' || tab === 'mensajes') setActiveTab(tab)
    if (estado === 'activos' || estado === 'completados' || estado === 'cancelados' || estado === 'archivados' || estado === 'todos') setStatusFilter(estado)
    if (actividad === 'todo' || actividad === 'pedidos' || actividad === 'empresa') setActivityFilter(actividad)
    if (selectedJobId) setStatusFilter('todos')
    if (selectedCompanyInquiryId) setActivityFilter('empresa')
  }, [searchParams, selectedJobId, selectedCompanyInquiryId])

  useEffect(() => {
    fetchMyRequests()
    if (user) {
      fetchMyProfile()
      fetchMyJobs()
      if (!companyAccount) {
        ;(async () => {
          const { data } = await (supabase.from('company_candidate_inquiries') as any)
            .select('*').eq('profile_id', user.id).order('created_at', { ascending: false })
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const staleIds = (data || []).filter((item: any) => item.status === 'pendiente' && !isArchivedInquiry(item) && new Date(item.created_at) < today).map((item: any) => item.id)
          if (staleIds.length) await (supabase.from('company_candidate_inquiries') as any).update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', staleIds).eq('profile_id', user.id)
          const normalized = (data || []).map((item: any) => staleIds.includes(item.id) ? { ...item, archived_at: new Date().toISOString() } : item)
          const companyIds = Array.from(new Set(normalized.map((item: any) => item.company_id).filter(Boolean)))
          let companies: any[] = []
          if (companyIds.length) {
            const { data: authCompanies } = await (supabase.from('authenticated_company_profiles') as any)
              .select('id, name, slug, photo_url, provincia, localidad')
              .in('id', companyIds)
            if (authCompanies && authCompanies.length > 0) {
              companies = authCompanies
            } else {
              const { data: pubCompanies } = await (supabase.from('public_profiles') as any)
                .select('id, name, slug, photo_url, provincia, localidad')
                .in('id', companyIds)
              companies = pubCompanies || []
            }
          }
          const companyById = new Map((companies || []).map((company: any) => [company.id, company]))
          const hydrated = normalized.map((item: any) => ({ ...item, company: companyById.get(item.company_id) }))
          setCompanyInquiries(hydrated)
          if (selectedCompanyInquiryId) {
            const selected = hydrated.find((item: any) => item.id === selectedCompanyInquiryId)
            if (selected) setSelectedCompanyInquiry(selected)
          }
        })()
      }
    }
  }, [user, companyAccount, fetchMyRequests, fetchMyJobs, fetchMyProfile, selectedCompanyInquiryId])

  // Explicit navigation state takes priority over the automatic professional default.
  useEffect(() => {
    if (explicitTab === 'cliente' || explicitTab === 'profesional') return
    if (selectedJobId) {
      if (proJobs.some((job) => job.id === selectedJobId)) setActiveTab('profesional')
      else if (clientRequests.some((job) => job.id === selectedJobId)) setActiveTab('cliente')
      return
    }
    if (proJobs.length > 0 && clientRequests.length === 0) {
      setActiveTab('profesional')
    }
  }, [explicitTab, selectedJobId, proJobs, clientRequests])

  const currentList = activeTab === 'cliente' ? clientRequests : proJobs

  const filteredList = currentList.filter((item) => {
    const archived = Boolean((item as any).archived_at)
    if (statusFilter === 'activos') {
      return !archived && ['solicitado', 'presupuestado', 'aceptado', 'en_progreso'].includes(item.status)
    }
    if (statusFilter === 'completados') {
      return !archived && item.status === 'completado'
    }
    if (statusFilter === 'cancelados') {
      return !archived && item.status === 'cancelado'
    }
    if (statusFilter === 'archivados') {
      return archived
    }
    return true
  }).sort((a, b) => {
    const priority = (item: JobRequestWithDetails) => {
      if ((item as any).archived_at) return 3
      if (['solicitado', 'presupuestado', 'aceptado', 'en_progreso'].includes(item.status)) return 0
      if (item.status === 'completado') return 1
      return 2
    }
    return priority(a) - priority(b) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  useEffect(() => {
    if (!selectedJobId) return
    return focusContextualElement({ attribute: 'data-request-id', value: selectedJobId })
  }, [selectedJobId, activeTab, statusFilter, filteredList.length])

  useEffect(() => {
    if (!selectedCompanyInquiryId) return
    return focusContextualElement({ attribute: 'data-inquiry-id', value: selectedCompanyInquiryId })
  }, [selectedCompanyInquiryId, companyInquiries.length, showArchivedCompany])

  const activeCount = currentList.filter((i) =>
    !(i as any).archived_at && ['solicitado', 'presupuestado', 'aceptado', 'en_progreso'].includes(i.status)
  ).length
  const archivedCount = currentList.filter((i) => Boolean((i as any).archived_at)).length
  const pendingClientCount = clientRequests.filter((item) =>
    !(item as any).archived_at && ['solicitado', 'presupuestado', 'aceptado', 'en_progreso'].includes(item.status)
  ).length
  const historicalCount = currentList.filter((i) =>
    Boolean((i as any).archived_at) || ['completado', 'cancelado'].includes(i.status)
  ).length

  const handleOpenWhatsApp = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleAcceptBudget = async (jobId: string) => {
    const result = await acceptBudget(jobId)
    if (!result.error) await fetchMyRequests()
  }

  const handleOutcome = async (outcome: string, note: string) => {
    if (!outcomeModal) return
    const result = await submitOutcome(outcomeModal.job.id, outcomeModal.role, outcome, note)
    if (!result.error) setOutcomeModal(null)
  }

  const handleArchiveJob = async (jobId: string, archived: boolean) => {
    const result = await archiveJob(jobId, archived)
    if (result.error) {
      setArchiveMessage(`${result.error} Aplicá migration_admin_settings_and_job_archiving.sql en Supabase.`)
    } else {
      setArchiveMessage(archived ? 'Pedido archivado. Sigue disponible desde el filtro Archivados.' : 'Pedido restaurado a la vista principal.')
    }
  }

  const handleAcceptInquiry = async (inquiry: any) => {
    if (!user || isAccepting) return
    setIsAccepting(true)
    try {
      const operationAt = new Date().toISOString()
      const { error } = await (supabase.from('company_candidate_inquiries') as any)
        .update({ status: 'aceptada', updated_at: operationAt })
        .eq('id', inquiry.id)
        .eq('profile_id', user.id)
      if (error) throw error
      setCompanyInquiries((items) => items.map((item) => item.id === inquiry.id ? { ...item, status: 'aceptada' } : item))
      setSelectedCompanyInquiry(null)
      await useNotificationStore.getState().addNotification({
        kind: 'company_candidate_inquiry',
        inquiryId: inquiry.id,
        event: 'responded',
        operationAt,
      })
    } catch (err: any) {
      console.warn('Error al aceptar propuesta:', err)
    } finally {
      setIsAccepting(false)
    }
  }

  const handleConfirmRejection = async () => {
    if (!user || !rejectingInquiry || isRejecting) return
    setIsRejecting(true)
    try {
      const operationAt = new Date().toISOString()
      const reason = rejectionReason || 'No me interesa la propuesta.'
      const comment = rejectionComment.trim() || null
      const { error } = await (supabase.from('company_candidate_inquiries') as any)
        .update({
          status: 'rechazada',
          rejection_reason: reason,
          rejection_comment: comment,
          updated_at: operationAt,
        })
        .eq('id', rejectingInquiry.id)
        .eq('profile_id', user.id)
      if (error) throw error
      setCompanyInquiries((items) =>
        items.map((item) =>
          item.id === rejectingInquiry.id
            ? { ...item, status: 'rechazada', rejection_reason: reason, rejection_comment: comment }
            : item
        )
      )
      setRejectingInquiry(null)
      setSelectedCompanyInquiry(null)
      await useNotificationStore.getState().addNotification({
        kind: 'company_candidate_inquiry',
        inquiryId: rejectingInquiry.id,
        event: 'responded',
        operationAt,
      })
    } catch (err: any) {
      console.warn('Error al rechazar propuesta:', err)
    } finally {
      setIsRejecting(false)
    }
  }

  const archiveCompanyInquiry = async (inquiryId: string) => {
    if (!user) return
    const archivedAt = new Date().toISOString()
    const query = (supabase.from('company_candidate_inquiries') as any).update({ archived_at: archivedAt, updated_at: archivedAt }).eq('id', inquiryId).eq('profile_id', user.id)
    const { data: archived, error } = await query.select('id, archived_at').maybeSingle()
    if (!error && archived) {
      setCompanyInquiries((items) => items.map((item) => item.id === inquiryId ? { ...item, archived_at: archivedAt } : item))
      setArchiveMessage('')
      return
    }
    // Compatibilidad con instalaciones que aún no aplicaron la columna archived_at.
    const fallback = await (supabase.from('company_candidate_inquiries') as any).update({ status: 'cerrada', updated_at: archivedAt }).eq('id', inquiryId).eq('profile_id', user.id).select('id').maybeSingle()
    if (!fallback.error && fallback.data) {
      setCompanyInquiries((items) => items.map((item) => item.id === inquiryId ? { ...item, status: 'cerrada', archived_at: archivedAt } : item))
      setArchiveMessage('')
      return
    }
    setArchiveMessage('No se pudo archivar la propuesta. Verificá que la migración de selección Empresa esté aplicada en Supabase.')
  }

  const loadConversationAndMessages = async () => {
    if (!user) return
    setMessagesLoading(true)
    setMessageError(null)
    try {
      let targetConvId = conversationId
      if (!targetConvId) {
        const { data: convId, error: rpcError } = await (supabase.rpc as any)('get_or_create_admin_conversation')
        if (rpcError) {
          setMessageError(rpcError.message)
          setMessagesLoading(false)
          return
        }
        targetConvId = convId
        setConversationId(convId)
      }

      if (targetConvId) {
        const { data, error } = await (supabase.from('messages') as any)
          .select('id, conversation_id, sender_id, sender_role, content, created_at, read_at')
          .eq('conversation_id', targetConvId)
          .order('created_at', { ascending: true })

        if (error) {
          setMessageError(error.message)
        } else {
          setMessages(data || [])
          // Mark incoming admin messages as read
          const unreadAdminMsgIds = (data || [])
            .filter((m: any) => m.sender_role === 'admin' && !m.read_at)
            .map((m: any) => m.id)
          if (unreadAdminMsgIds.length > 0) {
            await (supabase.from('messages') as any)
              .update({ read_at: new Date().toISOString() })
              .in('id', unreadAdminMsgIds)
          }
        }
      }
    } catch (err: any) {
      setMessageError(err.message || 'Error al cargar mensajes')
    } finally {
      setMessagesLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'mensajes' && user) {
      loadConversationAndMessages()
    }
  }, [activeTab, user])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sendingMessage || !user) return
    setSendingMessage(true)
    setMessageError(null)
    try {
      let targetConvId = conversationId
      if (!targetConvId) {
        const { data: convId, error: rpcError } = await (supabase.rpc as any)('get_or_create_admin_conversation')
        if (rpcError) throw rpcError
        targetConvId = convId
        setConversationId(convId)
      }

      const { error } = await (supabase.rpc as any)('send_conversation_message', {
        p_conversation_id: targetConvId,
        p_content: newMessage.trim(),
      })

      if (error) {
        setMessageError(error.message)
      } else {
        setNewMessage('')
        await loadConversationAndMessages()
      }
    } catch (err: any) {
      setMessageError(err.message || 'Error al enviar el mensaje')
    } finally {
      setSendingMessage(false)
    }
  }

  return (
    <div className="container py-8 md:py-12 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)] tracking-tight">
            Control de Trabajos y Pedidos
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] mt-1">
            Seguí el estado de tus presupuestos y gestioná tus trabajos en tiempo real estilo PedidosYa.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex p-1 rounded-2xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('cliente')}
            className={`px-4 py-2 rounded-xl text-xs font-heading font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'cliente'
                ? 'bg-white text-[var(--color-laburante-text)] shadow-xs'
                : 'text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'
            }`}
          >
            <FileText size={14} />
            {pendingClientCount > 0 ? `Mis Pedidos (${pendingClientCount})` : 'Mis Pedidos'}
          </button>

          <button
            onClick={() => setActiveTab('profesional')}
            className={`px-4 py-2 rounded-xl text-xs font-heading font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'profesional'
                ? 'bg-white text-[var(--color-laburante-text)] shadow-xs'
                : 'text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'
            }`}
          >
            <Briefcase size={14} />
            Mis Trabajos ({proJobs.length})
          </button>

          <button
            onClick={() => setActiveTab('mensajes')}
            className={`px-4 py-2 rounded-xl text-xs font-heading font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'mensajes'
                ? 'bg-white text-[var(--color-laburante-text)] shadow-xs'
                : 'text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]'
            }`}
          >
            <MessageCircle size={14} />
            Mensajes
          </button>
        </div>
      </div>

      {activeTab === 'mensajes' ? (
        <section className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] overflow-hidden shadow-xs flex flex-col min-h-[480px]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[var(--color-laburante-border)] bg-indigo-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-heading font-bold text-sm">
                L
              </div>
              <div>
                <h2 className="font-heading font-bold text-sm sm:text-base text-[var(--color-laburante-text)]">
                  Equipo de LABURANTE
                </h2>
                <p className="text-[11px] text-[var(--color-laburante-text-secondary)]">
                  Canal directo de consultas y soporte oficial
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadConversationAndMessages}
              disabled={messagesLoading}
              className="p-2 rounded-xl border border-[var(--color-laburante-border)] bg-white hover:bg-gray-50 text-xs font-semibold text-[var(--color-laburante-text-secondary)] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refrescar mensajes"
            >
              <Clock size={13} className={messagesLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>

          {messageError && (
            <div className="p-3 mx-4 mt-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle size={15} />
              <span>{messageError}</span>
            </div>
          )}

          {/* Message Thread */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 max-h-[500px]">
            {messagesLoading && messages.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--color-laburante-text-secondary)]">
                Cargando conversación...
              </div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center mx-auto">
                  <MessageCircle size={22} />
                </div>
                <h3 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                  Conversación con LABURANTE
                </h3>
                <p className="text-xs text-[var(--color-laburante-text-secondary)] max-w-sm mx-auto">
                  Dejanos tu consulta o mensaje y un administrador del equipo de LABURANTE te responderá a la brevedad.
                </p>
              </div>
            ) : (
              messages.map((msg: any) => {
                const isUser = msg.sender_role === 'user' || msg.sender_id === user?.id
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] sm:max-w-[70%] rounded-2xl p-3.5 text-xs leading-relaxed space-y-1 ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-br-xs'
                          : 'bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)] border border-[var(--color-laburante-border)] rounded-bl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-line break-words">{msg.content}</p>
                      <div
                        className={`flex items-center justify-end gap-1 text-[10px] ${
                          isUser ? 'text-indigo-200' : 'text-[var(--color-laburante-text-muted)]'
                        }`}
                      >
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isUser && msg.read_at && (
                          <span title={`Leído el ${new Date(msg.read_at).toLocaleString()}`}>· Leído</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Reply Form */}
          <div className="p-3 sm:p-4 border-t border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribí un mensaje para el equipo de LABURANTE..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-laburante-border)] bg-white text-xs text-[var(--color-laburante-text)] placeholder:text-[var(--color-laburante-text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={sendingMessage}
                maxLength={5000}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sendingMessage}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-heading font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shrink-0"
              >
                {sendingMessage ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          </div>
        </section>
      ) : (
      <>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-2">
        <span className="px-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)]">Actividad</span>
        {([['todo', 'Todo'], ['pedidos', 'Pedidos privados'], ['empresa', `Empresa (${companyInquiries.length})`]] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setActivityFilter(key)} className={`rounded-xl px-3 py-2 text-xs font-bold ${activityFilter === key ? 'bg-white text-[var(--color-laburante-text)] shadow-xs' : 'text-[var(--color-laburante-text-secondary)] hover:bg-white/70'}`}>{label}</button>)}
      </div>
      {archiveMessage && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{archiveMessage}</div>}

      {activityFilter !== 'pedidos' && <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 space-y-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading text-lg font-bold text-indigo-950">Selección Empresa</h2><p className="mt-1 text-xs leading-relaxed text-indigo-900/75">Las propuestas pendientes de días anteriores se archivan automáticamente. Nada se borra: podés consultar el historial cuando quieras.</p></div><button type="button" onClick={() => setShowArchivedCompany((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[11px] font-bold text-indigo-800"><Archive size={14} /> {showArchivedCompany ? 'Ocultar archivadas' : 'Ver archivadas'}</button></div>{companyInquiries.filter((item) => showArchivedCompany || !isArchivedInquiry(item)).length === 0 ? <p className="rounded-xl border border-dashed border-indigo-200 bg-white/70 p-5 text-center text-xs text-indigo-900/75">No hay propuestas {showArchivedCompany ? 'archivadas' : 'activas'} de Empresa.</p> : companyInquiries.filter((item) => showArchivedCompany || !isArchivedInquiry(item)).map((inquiry) => <article key={inquiry.id} data-inquiry-id={inquiry.id} className="rounded-xl border border-indigo-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold text-[var(--color-laburante-text)]">{inquiry.process_type === 'entrevista' ? 'Propuesta de entrevista' : 'Propuesta de contratación'}</p><p className="mt-1 text-xs text-indigo-950 font-semibold">Te contactó: <span className="font-bold">{inquiry.company?.name || 'Empresa'}</span><span className="font-normal text-[var(--color-laburante-text-secondary)]"> · {new Date(inquiry.created_at).toLocaleDateString('es-AR')}</span></p><p className="mt-0.5 text-[11px] text-[var(--color-laburante-text-muted)]">Ubicación: {[inquiry.company?.localidad, inquiry.company?.provincia].filter(Boolean).join(', ') || 'no disponible'}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${inquiry.status === 'pendiente' ? 'bg-amber-100 text-amber-800' : inquiry.status === 'aceptada' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>{inquiry.status}{isArchivedInquiry(inquiry) ? ' · archivada' : ''}</span></div>{inquiry.message && <p className="mt-2 line-clamp-2 text-xs text-[var(--color-laburante-text-secondary)]">{inquiry.message}</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedCompanyInquiry(inquiry)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white">Ver propuesta y datos <ChevronRight size={14} /></button>{!isArchivedInquiry(inquiry) && <button type="button" onClick={() => archiveCompanyInquiry(inquiry.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700" title="Archivar propuesta"><Archive size={14} /> Archivar</button>}</div></article>)}</section>}

      {selectedCompanyInquiry && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Detalle de selección Empresa</p><h2 className="mt-1 font-heading text-xl font-bold">{selectedCompanyInquiry.process_type === 'entrevista' ? 'Propuesta de entrevista' : 'Propuesta de contratación'}</h2></div><button type="button" onClick={() => setSelectedCompanyInquiry(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Cerrar"><XCircle size={18} /></button></div><div className="mt-5 space-y-3 text-sm"><div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Te contactó</p><p className="text-base font-bold text-indigo-950 mt-0.5">{selectedCompanyInquiry.company?.name || 'Empresa'}</p><p className="mt-1 text-xs text-indigo-900/80"><strong>Ubicación:</strong> {[selectedCompanyInquiry.company?.localidad, selectedCompanyInquiry.company?.provincia].filter(Boolean).join(', ') || 'no disponible'}</p>{selectedCompanyInquiry.company?.slug ? <Link to={`/p/${selectedCompanyInquiry.company.slug}`} onClick={() => setSelectedCompanyInquiry(null)} className="mt-2.5 inline-flex items-center text-xs font-semibold text-indigo-700 hover:text-indigo-900">Ver perfil público de la Empresa <ExternalLink size={13} className="ml-1" /></Link> : <span className="mt-2 text-xs text-gray-500">Perfil público no disponible</span>}</div><div><p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Mensaje de la Empresa</p><p className="mt-1 whitespace-pre-line text-sm text-gray-800">{selectedCompanyInquiry.message || 'La Empresa no agregó un mensaje adicional.'}</p></div><p className="text-xs text-gray-500">Recibida el {new Date(selectedCompanyInquiry.created_at).toLocaleString('es-AR')}</p></div>{selectedCompanyInquiry.status === 'pendiente' ? <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setRejectingInquiry(selectedCompanyInquiry); setRejectionReason('No me interesa la propuesta.'); setRejectionComment('') }} disabled={isAccepting} className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold hover:bg-gray-50">Rechazar propuesta</button><button type="button" onClick={() => handleAcceptInquiry(selectedCompanyInquiry)} disabled={isAccepting} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition-opacity disabled:opacity-50">{isAccepting ? 'Aceptando...' : 'Aceptar y conversar'}</button></div> : <div className="mt-6 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 space-y-1"><p>Ya respondiste esta propuesta como <strong>{selectedCompanyInquiry.status}</strong>.</p>{selectedCompanyInquiry.status === 'rechazada' && selectedCompanyInquiry.rejection_reason && <p className="text-gray-500">Motivo informado: {selectedCompanyInquiry.rejection_reason}</p>}</div>}</div></div>}

      {rejectingInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Rechazar propuesta</p>
                <h3 className="font-heading text-lg font-bold text-gray-900 mt-1">Registrar motivo de devolución</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingInquiry(null)}
                disabled={isRejecting}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <XCircle size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Seleccioná el motivo por el cual no avanzarás con la propuesta de <strong>{rejectingInquiry.company?.name || 'la empresa'}</strong>. Esto ayuda a la empresa a calibrar sus búsquedas.
            </p>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {REJECTION_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    rejectionReason === reason
                      ? 'border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-950'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="rejection_reason"
                    value={reason}
                    checked={rejectionReason === reason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-700">Comentario adicional (opcional)</label>
              <textarea
                value={rejectionComment}
                onChange={(e) => setRejectionComment(e.target.value.slice(0, 500))}
                placeholder="Podés agregar detalles adicionales..."
                rows={3}
                disabled={isRejecting}
                className="w-full rounded-xl border border-[var(--color-laburante-border)] px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-400"
              />
              <p className="text-[10px] text-gray-400 text-right">{rejectionComment.length}/500</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRejectingInquiry(null)}
                disabled={isRejecting}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                disabled={isRejecting}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white transition-opacity disabled:opacity-50"
              >
                {isRejecting ? 'Enviando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activityFilter !== 'empresa' && <>
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--color-laburante-border)]">
        <div className="flex items-center gap-2">
          {(['activos', 'completados', 'cancelados', 'archivados', 'todos'] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setStatusFilter(filterKey)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${
                statusFilter === filterKey
                  ? 'bg-[var(--color-laburante-text)] text-white font-semibold'
                  : 'text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)]'
              }`}
            >
              {filterKey}
            </button>
          ))}
        </div>

        {activeCount > 0 && (
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            {activeCount} {activeCount === 1 ? 'trabajo activo' : 'trabajos activos'}
          </span>
        )}
        {archivedCount > 0 && (
          <span className="text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">
            {archivedCount} archivado{archivedCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Content List */}
      {filteredList.length > 0 ? (
        <div className="space-y-4">
          {filteredList.map((job) => (
            <div
              key={job.id}
              data-request-id={job.id}
                className={`rounded-2xl border bg-[var(--color-laburante-surface)] p-4 sm:p-5 space-y-4 shadow-xs relative overflow-hidden ${
                (job as any).archived_at ? 'border-gray-300 bg-gray-50/80 opacity-75' : 'border-[var(--color-laburante-border)]'
              } ${selectedJobId === job.id ? 'ring-2 ring-indigo-500/20' : ''}`}
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {(job as any).archived_at ? 'Archivado' : activeTab === 'cliente' ? 'Pedido enviado' : 'Solicitud recibida'}
                    </span>
                    <span className="text-[11px] text-[var(--color-laburante-text-muted)]">
                      {new Date(job.created_at).toLocaleDateString()} a las{' '}
                      {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="font-heading text-lg sm:text-xl font-bold text-[var(--color-laburante-text)]">
                    {job.title}
                  </h3>

                  <div className="text-xs text-[var(--color-laburante-text-secondary)] flex flex-wrap items-center gap-3">
                    {activeTab === 'cliente' ? (
                      <span>
                        Profesional:{' '}
                        {job.pro_slug ? (
                          <Link to={`/p/${job.pro_slug}`} className="font-bold text-[var(--color-laburante-text)] hover:underline">
                            {job.pro_name || 'Ver perfil'}
                          </Link>
                        ) : (
                          <strong className="text-[var(--color-laburante-text)]">{job.pro_name || 'Profesional'}</strong>
                        )}
                      </span>
                    ) : (
                      <span>
                        Cliente: <strong className="text-[var(--color-laburante-text)]">{job.client_name}</strong>
                      </span>
                    )}

                    {job.client_location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-[var(--color-laburante-accent)]" />
                        {job.client_location}
                      </span>
                    )}

                    <span className="flex items-center gap-1 font-medium text-amber-700">
                      <Clock size={12} />
                      Plazo: {job.urgency === 'urgente' ? 'Urgente hoy/mañana' : job.urgency === 'esta_semana' ? 'Esta semana' : job.preferred_date || 'A coordinar'}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="self-start">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                      job.status === 'completado'
                        ? 'bg-emerald-100 text-emerald-800'
                        : job.status === 'cancelado'
                        ? 'bg-rose-100 text-rose-800'
                        : job.status === 'presupuestado'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-indigo-100 text-indigo-900'
                    }`}
                  >
                    {job.status === 'solicitado'
                      ? 'Solicitado'
                      : job.status === 'presupuestado'
                      ? 'Presupuesto listo'
                      : job.status === 'aceptado' || job.status === 'en_progreso'
                      ? 'En progreso'
                      : job.status === 'completado'
                      ? 'Finalizado'
                      : 'Cancelado'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 rounded-2xl bg-[var(--color-laburante-surface-alt)]/50 border border-[var(--color-laburante-border)] text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                <p className="font-semibold text-[var(--color-laburante-text)] mb-1">
                  Detalle del problema informado:
                </p>
                <p className="whitespace-pre-line">"{job.description}"</p>
              </div>

              {/* Attached Photos */}
              {job.photos && job.photos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-[var(--color-laburante-text)]">
                    Fotos adjuntas ({job.photos.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {job.photos.map((src, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setSelectedPhoto(src)}
                        className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-[var(--color-laburante-border)] hover:opacity-90 transition-opacity cursor-pointer group"
                      >
                        <img src={src} alt="Foto del problema" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Eye size={16} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Tracking Stepper (PedidosYa Style) */}
              <div className="pt-2">
                <JobStatusStepper
                  status={job.status}
                  cancelReason={job.cancel_reason}
                  cancelledBy={job.cancelled_by}
                />
              </div>

              {/* Budget Details Card (when sent or accepted) */}
              {job.budget_amount && (
                <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <DollarSign size={20} className="text-emerald-700 shrink-0" />
                      <span className="font-heading font-extrabold text-lg sm:text-xl text-emerald-900">
                        Presupuesto: ${job.budget_amount}
                      </span>
                    </div>
                    {job.budget_estimated_time && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800">
                        ⏱️ Tiempo: {job.budget_estimated_time}
                      </span>
                    )}
                  </div>

                  {job.budget_details && (
                    <p className="text-xs text-emerald-900 leading-relaxed pt-1 border-t border-emerald-200/60">
                      <strong>Detalle:</strong> {job.budget_details}
                    </p>
                  )}

                  {/* Client actions on budget */}
                  {activeTab === 'cliente' && job.status === 'presupuestado' && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleAcceptBudget(job.id)}
                        className="btn-dark py-2.5 px-5 rounded-xl font-heading font-bold text-xs shadow-xs"
                      >
                        Aceptar presupuesto y coordinar
                      </button>
                      <button
                        onClick={() => setCancelModalJob({ job, role: 'cliente' })}
                        className="py-2.5 px-4 rounded-xl border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 text-xs font-semibold"
                      >
                        Rechazar / Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons for Client */}
              {activeTab === 'cliente' && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-laburante-border)]">
                  {/* WhatsApp contact once accepted or in progress */}
                  {['presupuestado', 'aceptado', 'en_progreso'].includes(job.status) && (job.pro_contacts || []).filter((contact) => contact.is_public && contact.value).map((contact) => {
                    if (contact.type === 'whatsapp') return <button key={`${contact.type}-${contact.value}`} onClick={() => handleOpenWhatsApp(contact.value, `Hola ${job.pro_name || ''}, te contacto por el trabajo "${job.title}" en LABURANTE.`)} className="py-2.5 px-4 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"><MessageCircle size={14} /> Contactar por WhatsApp</button>
                    if (contact.type === 'email') return <a key={`${contact.type}-${contact.value}`} href={`mailto:${contact.value}?subject=Coordinación de ${encodeURIComponent(job.title)}`} className="py-2.5 px-4 rounded-xl border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"><Mail size={14} /> Correo electrónico</a>
                    if (contact.type === 'telefono') return <a key={`${contact.type}-${contact.value}`} href={`tel:${contact.value.replace(/\s+/g, '')}`} className="py-2.5 px-4 rounded-xl border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"><Phone size={14} /> Llamar</a>
                    return null
                  })}

                  {/* Review button on completion */}
                  {job.status === 'completado' && !job.client_outcome && (
                    <button
                      onClick={() => setReviewModalJob(job)}
                      className="btn-dark py-2.5 px-5 rounded-xl font-heading font-bold text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      Dejar reseña del trabajo
                    </button>
                  )}
                  {job.status === 'completado' && !job.client_outcome && <button type="button" onClick={() => setOutcomeModal({ job, role: 'cliente', blocking: true })} className="btn-dark py-2.5 px-5 rounded-xl font-heading font-bold text-xs">Indicar qué sucedió</button>}

                  {/* Cancel button if active */}
                  {!['completado', 'cancelado'].includes(job.status) && (
                    <button
                      onClick={() => setCancelModalJob({ job, role: 'cliente' })}
                      className="py-2.5 px-3 rounded-xl text-xs text-[var(--color-laburante-text-muted)] hover:text-rose-600 transition-colors ml-auto"
                    >
                      Cancelar solicitud
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setReportJob({ job, profileId: job.profile_id, profileName: job.pro_name || 'Profesional' })}
                    className="py-2.5 px-3 rounded-xl border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <AlertTriangle size={13} className="inline-block mr-1" /> Reportar problema
                  </button>
                  {(job as any).archived_at ? (
                    <button
                      type="button"
                      onClick={() => handleArchiveJob(job.id, false)}
                      className="py-2.5 px-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 ml-auto inline-flex items-center gap-1.5"
                    >
                      <Archive size={14} /> Desarchivar
                    </button>
                  ) : (
                    ['completado', 'cancelado'].includes(job.status) && (
                      <button
                        type="button"
                        onClick={() => handleArchiveJob(job.id, true)}
                        className="py-2.5 px-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 ml-auto inline-flex items-center gap-1.5"
                      >
                        <Archive size={14} /> Archivar
                      </button>
                    )
                  )}
                </div>
              )}

              {/* Action Buttons for Professional */}
              {activeTab === 'profesional' && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-laburante-border)]">
                  {job.status === 'solicitado' && (
                    <>
                      <button
                        onClick={() => setBudgetModalJob(job)}
                        className="btn-dark py-2.5 px-5 rounded-xl font-heading font-bold text-xs flex items-center gap-1.5 shadow-xs"
                      >
                        <DollarSign size={14} /> Enviar Presupuesto
                      </button>
                      <button
                        onClick={() => setCancelModalJob({ job, role: 'profesional' })}
                        className="py-2.5 px-4 rounded-xl border border-[var(--color-laburante-border)] text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Rechazar trabajo
                      </button>
                    </>
                  )}

                  {['aceptado', 'en_progreso'].includes(job.status) && (
                    <>
                      <button
                        onClick={() => setOutcomeModal({ job, role: 'profesional', blocking: true })}
                        className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <CheckCircle2 size={14} /> Marcar como Finalizado
                      </button>
                      <button
                        onClick={() =>
                          handleOpenWhatsApp(
                            job.client_contact,
                            `Hola ${job.client_name}, te escribo respecto al trabajo "${job.title}" presupuestado en LABURANTE.`
                          )
                        }
                        className="py-2.5 px-4 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Phone size={14} /> Escribir al cliente (WhatsApp)
                      </button>
                      <button
                        onClick={() => setCancelModalJob({ job, role: 'profesional' })}
                        className="py-2.5 px-3 rounded-xl text-xs text-[var(--color-laburante-text-muted)] hover:text-rose-600 ml-auto"
                      >
                        Cancelar trabajo
                      </button>
                    </>
                  )}

                  {job.status === 'completado' && !job.professional_outcome && <button type="button" onClick={() => setOutcomeModal({ job, role: 'profesional', blocking: true })} className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white">Completar resultado pendiente</button>}
                  {job.status === 'completado' && (
                    <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Trabajo completado exitosamente y guardado en tu historial.
                    </div>
                  )}
                  {job.client_id && (
                    <button
                      type="button"
                      onClick={() => setReportJob({ job, profileId: job.client_id as string, profileName: job.client_name })}
                      className="rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      <AlertTriangle size={13} className="mr-1 inline-block" /> Reportar problema
                    </button>
                  )}
                  {(job as any).archived_at ? (
                    <button
                      type="button"
                      onClick={() => handleArchiveJob(job.id, false)}
                      className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 inline-flex items-center gap-1.5"
                    >
                      <Archive size={14} /> Desarchivar
                    </button>
                  ) : (
                    ['completado', 'cancelado'].includes(job.status) && (
                      <button
                        type="button"
                        onClick={() => handleArchiveJob(job.id, true)}
                        className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 inline-flex items-center gap-1.5"
                      >
                        <Archive size={14} /> Archivar
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 rounded-3xl border border-dashed border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/30 text-center space-y-4">
          <div className="h-16 w-16 mx-auto rounded-full bg-white border border-[var(--color-laburante-border)] flex items-center justify-center text-[var(--color-laburante-accent)] shadow-xs">
            {activeTab === 'cliente' ? <FileText size={28} /> : <Briefcase size={28} />}
          </div>

          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
              {statusFilter === 'activos' && historicalCount > 0
                ? 'No hay pedidos activos ahora'
                : activeTab === 'cliente' ? 'No tenés pedidos registrados' : 'No tenés solicitudes recibidas aún'}
            </h3>
            <p className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed">
              {statusFilter === 'activos' && historicalCount > 0
                ? `Tenés ${historicalCount} ${historicalCount === 1 ? 'pedido histórico' : 'pedidos históricos'} completado${historicalCount === 1 ? '' : 's'} o cancelado${historicalCount === 1 ? '' : 's'}. Cambiá el filtro para consultarlos.`
                : activeTab === 'cliente'
                ? 'Cuando solicites un presupuesto a cualquier trabajador desde su perfil, podrás seguir su estado paso a paso aquí.'
                : 'Asegurate de tener tu perfil profesional activo para que los vecinos puedan enviarte solicitudes directas.'}
            </p>
          </div>

          <div className="pt-2">
            {statusFilter === 'activos' && historicalCount > 0 ? (
              <button type="button" onClick={() => setStatusFilter('todos')} className="btn-dark py-3 px-6 rounded-xl font-heading font-bold text-xs inline-flex items-center gap-2">
                Ver historial <ArrowRight size={14} />
              </button>
            ) : activeTab === 'cliente' ? (
              <Link to="/buscar" className="btn-dark py-3 px-6 rounded-xl font-heading font-bold text-xs inline-flex items-center gap-2">
                Buscar trabajadores <ArrowRight size={14} />
              </Link>
            ) : (
              <Link to="/crear-perfil" className="btn-dark py-3 px-6 rounded-xl font-heading font-bold text-xs inline-flex items-center gap-2">
                Administrar mi perfil profesional <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}
      </>}
      </>
      )}
      {outcomeModal && <OutcomeModal role={outcomeModal.role} blocking={outcomeModal.blocking} onClose={() => setOutcomeModal(null)} onSubmit={handleOutcome} />}

      {/* Lightbox Photo Preview */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-black"
            >
              <XCircle size={22} />
            </button>
            <img src={selectedPhoto} alt="Ampliación de foto" className="max-w-full max-h-[85vh] object-contain" />
          </div>
        </div>
      )}

      {/* Modals */}
      {budgetModalJob && (
        <BudgetModal
          requestId={budgetModalJob.id}
          jobTitle={budgetModalJob.title}
          clientName={budgetModalJob.client_name}
          isOpen={true}
          onClose={() => setBudgetModalJob(null)}
        />
      )}

      {cancelModalJob && (
        <CancelJobModal
          requestId={cancelModalJob.job.id}
          jobTitle={cancelModalJob.job.title}
          cancelledBy={cancelModalJob.role}
          isOpen={true}
          onClose={() => setCancelModalJob(null)}
        />
      )}

      {reviewModalJob && (
        <RecommendationModal
          profileId={reviewModalJob.profile_id}
          profileName={reviewModalJob.pro_name || 'Profesional'}
          isOpen={true}
          onClose={() => setReviewModalJob(null)}
        />
      )}

      {reportJob && (
        <ReportModal
          isOpen={true}
          onClose={() => setReportJob(null)}
          profileId={reportJob.profileId}
          profileName={reportJob.profileName}
          jobRequestId={reportJob.job.id}
          jobRequestLabel={reportJob.job.title}
        />
      )}
    </div>
  )
}
