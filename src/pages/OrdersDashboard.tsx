import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
  AlertTriangle
} from 'lucide-react'
import { useJobStore, type JobRequestWithDetails } from '@/stores/job-store'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import JobStatusStepper from '@/components/jobs/JobStatusStepper'
import BudgetModal from '@/components/jobs/BudgetModal'
import CancelJobModal from '@/components/jobs/CancelJobModal'
import RecommendationModal from '@/components/profile/RecommendationModal'
import OutcomeModal from '@/components/jobs/OutcomeModal'
import type { JobRequestStatus } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { useNotificationStore } from '@/stores/notification-store'

export default function OrdersDashboard() {
  const { user } = useAuthStore()
  const { myProfile, fetchMyProfile } = useProfileStore()
  const {
    clientRequests,
    proJobs,
    fetchMyRequests,
    fetchMyJobs,
    acceptBudget,
    updateJobStatus,
    submitOutcome,
    loading,
  } = useJobStore()

  const [activeTab, setActiveTab] = useState<'cliente' | 'profesional'>('cliente')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'activos' | 'completados' | 'cancelados'>('todos')

  // Modals state
  const [budgetModalJob, setBudgetModalJob] = useState<JobRequestWithDetails | null>(null)
  const [cancelModalJob, setCancelModalJob] = useState<{ job: JobRequestWithDetails; role: 'cliente' | 'profesional' } | null>(null)
  const [reviewModalJob, setReviewModalJob] = useState<JobRequestWithDetails | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [outcomeModal, setOutcomeModal] = useState<{ job: JobRequestWithDetails; role: 'cliente' | 'profesional'; blocking?: boolean } | null>(null)
  const [companyInquiries, setCompanyInquiries] = useState<any[]>([])

  useEffect(() => {
    fetchMyRequests()
    if (user) {
      fetchMyProfile()
      fetchMyJobs()
      if (user.user_metadata?.account_type !== 'empresa') {
        ;(supabase.from('company_candidate_inquiries') as any).select('*').eq('profile_id', user.id).eq('status', 'pendiente').order('created_at', { ascending: false }).then(({ data }: any) => setCompanyInquiries(data || []))
      }
    }
  }, [user, fetchMyRequests, fetchMyJobs, fetchMyProfile])

  // If user has a profile, default to professional tab if they have received jobs
  useEffect(() => {
    if (proJobs.length > 0 && clientRequests.length === 0) {
      setActiveTab('profesional')
    }
  }, [proJobs.length, clientRequests.length])

  const currentList = activeTab === 'cliente' ? clientRequests : proJobs

  const filteredList = currentList.filter((item) => {
    if (statusFilter === 'activos') {
      return ['solicitado', 'presupuestado', 'aceptado', 'en_progreso'].includes(item.status)
    }
    if (statusFilter === 'completados') {
      return item.status === 'completado'
    }
    if (statusFilter === 'cancelados') {
      return item.status === 'cancelado'
    }
    return true
  })

  const activeCount = currentList.filter((i) =>
    ['solicitado', 'presupuestado', 'aceptado', 'en_progreso'].includes(i.status)
  ).length

  const handleOpenWhatsApp = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleOutcome = async (outcome: string, note: string) => {
    if (!outcomeModal) return
    const result = await submitOutcome(outcomeModal.job.id, outcomeModal.role, outcome, note)
    if (!result.error) setOutcomeModal(null)
  }

  const respondToCompanyInquiry = async (inquiry: any, status: 'aceptada' | 'rechazada') => {
    if (!user) return
    const { error } = await (supabase.from('company_candidate_inquiries') as any).update({ status, updated_at: new Date().toISOString() }).eq('id', inquiry.id).eq('profile_id', user.id)
    if (error) return
    setCompanyInquiries((items) => items.filter((item) => item.id !== inquiry.id))
    await useNotificationStore.getState().addNotification({
      userId: inquiry.company_id,
      title: status === 'aceptada' ? 'Aceptaron tu propuesta' : 'No avanzarán con tu propuesta',
      message: status === 'aceptada' ? 'La persona aceptó conversar. Podés coordinar la entrevista y completar tu proceso interno de proveedor.' : 'La persona rechazó esta propuesta por ahora.',
      type: 'status',
      link: '/empresa',
    })
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
            Mis Pedidos ({clientRequests.length})
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
            Trabajos Recibidos ({proJobs.length})
          </button>
        </div>
      </div>

      {companyInquiries.length > 0 && <section className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 space-y-3"><div><h2 className="font-heading text-lg font-bold text-indigo-950">Propuestas de Empresas</h2><p className="mt-1 text-xs leading-relaxed text-indigo-900/75">No son pedidos de presupuesto: son invitaciones a entrevista o conversación de contratación. Respondé para que la Empresa sepa cómo seguir.</p></div>{companyInquiries.map((inquiry) => <article key={inquiry.id} className="rounded-xl border border-indigo-200 bg-white p-4"><p className="text-sm font-bold text-[var(--color-laburante-text)]">{inquiry.process_type === 'entrevista' ? 'Propuesta de entrevista' : 'Propuesta de contratación'}</p>{inquiry.message && <p className="mt-1 text-xs text-[var(--color-laburante-text-secondary)]">{inquiry.message}</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => respondToCompanyInquiry(inquiry, 'aceptada')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Aceptar propuesta</button><button type="button" onClick={() => respondToCompanyInquiry(inquiry, 'rechazada')} className="rounded-lg border border-[var(--color-laburante-border)] px-3 py-2 text-xs font-semibold">No avanzar</button></div></article>)}</section>}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--color-laburante-border)]">
        <div className="flex items-center gap-2">
          {(['todos', 'activos', 'completados', 'cancelados'] as const).map((filterKey) => (
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
      </div>

      {/* Content List */}
      {filteredList.length > 0 ? (
        <div className="space-y-6">
          {filteredList.map((job) => (
            <div
              key={job.id}
              className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-8 space-y-6 shadow-xs relative overflow-hidden"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {activeTab === 'cliente' ? 'Pedido enviado' : 'Solicitud recibida'}
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
                        onClick={() => acceptBudget(job.id)}
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
                  {['presupuestado', 'aceptado', 'en_progreso'].includes(job.status) && job.pro_contact && (
                    <button
                      onClick={() =>
                        handleOpenWhatsApp(
                          job.pro_contact || '',
                          `Hola ${job.pro_name || ''}, te contacto por el trabajo "${job.title}" en LABURANTE.`
                        )
                      }
                      className="py-2.5 px-4 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Phone size={14} /> Contactar por WhatsApp
                    </button>
                  )}

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
              {activeTab === 'cliente' ? 'No tenés pedidos registrados' : 'No tenés solicitudes recibidas aún'}
            </h3>
            <p className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed">
              {activeTab === 'cliente'
                ? 'Cuando solicites un presupuesto a cualquier trabajador desde su perfil, podrás seguir su estado paso a paso aquí.'
                : 'Asegurate de tener tu perfil profesional activo para que los vecinos puedan enviarte solicitudes directas.'}
            </p>
          </div>

          <div className="pt-2">
            {activeTab === 'cliente' ? (
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
    </div>
  )
}
