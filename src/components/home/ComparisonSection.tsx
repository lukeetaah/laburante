import { useState } from 'react'
import { Sparkles, MessageCircle, Shield, MapPin, Star, ChevronDown, Check, ArrowRight } from 'lucide-react'

export default function ComparisonSection() {
  const [heroExpanded, setHeroExpanded] = useState(false)
  const [openCardIndex, setOpenCardIndex] = useState<number | null>(null)

  const featureCards = [
    {
      icon: MessageCircle,
      title: 'Contacto directo y transparente',
      summary: 'Sin créditos, monedas artificiales ni membresías obligatorias para cotizar o responder.',
      expandedInfo: 'Cuando un cliente o empresa solicita un presupuesto y vos decidís responder, la coordinación continúa de forma directa en los canales de comunicación habituales que usás todos los días.',
    },
    {
      icon: Shield,
      title: 'Privacidad y datos bajo tu control',
      summary: 'Sin pedidos de datos bancarios, números de tarjeta ni trámites invasivos para crear tu perfil.',
      expandedInfo: 'Solo se publica la información que autorizás expresamente para tu actividad laboral. Tus canales de contacto están resguardados y vos decidís qué mostrar y cuándo poner tu perfil en pausa.',
    },
    {
      icon: MapPin,
      title: 'Búsqueda por oficio y cercanía',
      summary: 'Filtros organizados por especialidad, provincia y localidad real en toda la Argentina.',
      expandedInfo: 'Las personas que necesitan resolver una tarea en su zona te encuentran por lo que sabés hacer, sin algoritmos opacos de subasta donde quien paga más tapa a quienes trabajan cerca.',
    },
    {
      icon: Star,
      title: 'Reputación con contexto real',
      summary: 'Opiniones y recomendaciones genuinas asociadas a experiencias concretas de trabajo.',
      expandedInfo: 'Cada reseña queda vinculada a un trabajo o servicio acordado, con la posibilidad de que el titular del perfil decida publicarla y un sistema de reporte comunitario ante cualquier irregularidad.',
    },
  ]

  const toggleCard = (index: number) => {
    setOpenCardIndex((current) => (current === index ? null : index))
  }

  return (
    <section className="container">
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-10 md:p-14 shadow-xs space-y-10">
        {/* Main Clickable Hero Block with Collapsible Accordion */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={heroExpanded}
          onClick={() => setHeroExpanded(!heroExpanded)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setHeroExpanded(!heroExpanded)
            }
          }}
          className="group cursor-pointer rounded-2xl border border-[var(--color-laburante-border)] bg-gradient-to-b from-[var(--color-laburante-surface-alt)]/60 to-[var(--color-laburante-surface)] p-6 sm:p-8 md:p-10 text-center transition-all hover:border-amber-300 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold mb-4">
            <Sparkles size={14} className="text-amber-600" />
            Sin intermediarios ni trampas comerciales
          </div>

          <h2 className="font-heading text-2xl sm:text-4xl font-extrabold text-[var(--color-laburante-text)] tracking-tight">
            No sos una postulación más
          </h2>

          <p className="text-sm sm:text-base text-[var(--color-laburante-text-secondary)] mt-3 leading-relaxed max-w-2xl mx-auto">
            En muchos portales un algoritmo decide quién aparece. En LABURANTE empezás por vos: qué sabés hacer, dónde estás y cómo pueden contactarte.
          </p>

          <div className="mt-5 inline-flex items-center gap-1.5 text-xs sm:text-sm font-heading font-bold text-[var(--color-laburante-indigo)] group-hover:underline">
            <span>{heroExpanded ? 'Ocultar info' : 'Ver más info'}</span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${heroExpanded ? 'rotate-180' : ''}`}
            />
          </div>

          {/* Expanded Collapsible Content */}
          {heroExpanded && (
            <div
              className="mt-6 pt-6 border-t border-[var(--color-laburante-border)] text-left grid sm:grid-cols-3 gap-4 text-xs animate-in fade-in slide-in-from-top-2 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-4 space-y-2">
                <p className="font-heading font-bold text-sm text-[var(--color-laburante-text)] flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Descubrimiento abierto
                </p>
                <p className="text-[var(--color-laburante-text-secondary)] leading-relaxed">
                  Cualquier persona o empresa puede encontrar tu perfil por especialidad, oficio y localidad sin necesidad de pagar pauta para figurar.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-4 space-y-2">
                <p className="font-heading font-bold text-sm text-[var(--color-laburante-text)] flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--color-laburante-indigo)]"></span>
                  Trato humano directo
                </p>
                <p className="text-[var(--color-laburante-text-secondary)] leading-relaxed">
                  La plataforma facilita el primer contacto formal mediante solicitudes de presupuesto; luego la conversación fluye de manera directa entre las partes.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-4 space-y-2">
                <p className="font-heading font-bold text-sm text-[var(--color-laburante-text)] flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  Tu trabajo, tus reglas
                </p>
                <p className="text-[var(--color-laburante-text-secondary)] leading-relaxed">
                  Definís tu modalidad (presencial, híbrida o remota), tu disponibilidad horaria, las zonas donde brindás servicio y los medios de contacto autorizados.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Visual Feature Cards Grid (Clean, Responsive, Minimalist) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {featureCards.map((card, idx) => {
            const IconComponent = card.icon
            const isOpen = openCardIndex === idx
            return (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5 sm:p-6 transition-all hover:border-[var(--color-laburante-border-focus)] shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] flex items-center justify-center text-[var(--color-laburante-indigo)] shrink-0">
                    <IconComponent size={20} />
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCard(idx)}
                    className="inline-flex items-center gap-1 text-[11px] font-heading font-semibold text-[var(--color-laburante-indigo)] hover:underline cursor-pointer"
                  >
                    <span>{isOpen ? 'Menos' : 'Detalles'}</span>
                    <ChevronDown
                      size={13}
                      className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="font-heading font-bold text-base text-[var(--color-laburante-text)]">
                    {card.title}
                  </h3>
                  <p className="text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed">
                    {card.summary}
                  </p>
                </div>

                {isOpen && (
                  <div className="pt-3 border-t border-[var(--color-laburante-border)]/60 text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed animate-in fade-in duration-150">
                    {card.expandedInfo}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Bottom Banner — PRESERVED EXACTLY AS REQUESTED */}
        <div className="mt-8 p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-[var(--color-laburante-surface-alt)] to-[var(--color-laburante-surface)] border border-[var(--color-laburante-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="h-10 w-10 rounded-xl bg-[var(--color-laburante-accent)] text-black flex items-center justify-center font-bold flex-shrink-0">
              0%
            </div>
            <div>
              <p className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                Todo el fruto de tu trabajo es tuyo
              </p>
              <p className="text-xs text-[var(--color-laburante-text-secondary)]">
                LABURANTE no es un negocio intermediario; es infraestructura pública abierta de Lukson Arts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
