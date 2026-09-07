import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  UserCheck, 
  MessageCircle, 
  ShieldCheck, 
  ArrowRight, 
  Play, 
  Image as ImageIcon, 
  CheckCircle2, 
  ExternalLink, 
  Sparkles,
  Phone
} from 'lucide-react'

interface StepData {
  id: number
  title: string
  subtitle: string
  description: string
  highlights: string[]
  imageSrc: string
  urlDisplay: string
  realDetail: string
}

const STEPS: StepData[] = [
  {
    id: 1,
    title: '1. Buscás por oficio y tu zona',
    subtitle: 'Sin registrarte, sin suscripción ni anuncios intrusivos',
    description: 'Ingresás lo que necesitás (plomero, gasista, electricista, diseñadora, etc.) y seleccionás tu provincia y localidad. No hay algoritmos que oculten laburantes.',
    highlights: [
      'Alcance real para las 23 provincias argentinas y CABA',
      'Filtros por modalidad presencial, remota o ambas',
      'Sin pagar créditos para ver resultados'
    ],
    imageSrc: '/assets/demo/step-1-search.png',
    urlDisplay: 'laburante.ar/buscar?provincia=Córdoba',
    realDetail: 'Interfaz real de búsqueda con filtros federales y tarjetas de habilidades.'
  },
  {
    id: 2,
    title: '2. Revisás un perfil transparente',
    subtitle: 'Información clara provista voluntariamente por el titular',
    description: 'En cada perfil podés consultar la presentación del trabajador, sus habilidades comprobadas, zonas de cobertura y servicios con precios orientativos sinceros.',
    highlights: [
      'Servicios con descripciones detalladas y precios de referencia',
      'Recomendaciones con contexto real de trabajos realizados',
      'Sin falsos sellos pagos de "100% verificado"'
    ],
    imageSrc: '/assets/demo/step-2-profile.png',
    urlDisplay: 'laburante.ar/p/esteban-morales',
    realDetail: 'Perfil real mostrando experiencia, zonas y recomendaciones comunitarias.'
  },
  {
    id: 3,
    title: '3. Contactás directo por WhatsApp',
    subtitle: 'En 1 clic, sin chat retenido ni números censurados',
    description: 'Al presionar "Contactar", se despliegan los canales habilitados expresamente por el laburante (WhatsApp, teléfono, email o redes). Un toque y estás hablando en WhatsApp con un mensaje prearmado.',
    highlights: [
      'Sin chat interno cautivo ni palabras bloqueadas',
      'No cobramos por mensaje ni retenemos tus datos',
      'Contacto voluntario y directo entre personas'
    ],
    imageSrc: '/assets/demo/step-3-contact.png',
    urlDisplay: 'laburante.ar/p/esteban-morales?contacto=1',
    realDetail: 'Modal real de contacto directo: conexión inmediata con WhatsApp y teléfono.'
  },
  {
    id: 4,
    title: '4. Acuerdan entre ustedes: 0% comisión',
    subtitle: 'El fruto de tu trabajo es 100% tuyo',
    description: 'El presupuesto, la forma de pago (efectivo, transferencia, cuotas) y los tiempos los definen libremente ustedes. LABURANTE no retiene fondos ni descuenta porcentajes.',
    highlights: [
      '0% de comisión para quien trabaja y para quien contrata',
      'Sin pasarelas obligatorias con retenciones bancarias',
      'Privacidad total: no pedimos DNI ni datos de cuentas'
    ],
    imageSrc: '/assets/demo/step-create.png',
    urlDisplay: 'laburante.ar/crear-perfil',
    realDetail: 'Formulario de registro voluntario y respeto estricto de la privacidad.'
  }
]

export default function HowItWorksVisual() {
  const [activeStep, setActiveStep] = useState<number>(1)
  const [showAnimatedGif, setShowAnimatedGif] = useState<boolean>(false)

  const current = STEPS.find((s) => s.id === activeStep) || STEPS[0]

  return (
    <section className="container">
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-10 md:p-12 shadow-xs space-y-10">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[var(--color-laburante-border)]">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] mb-3">
              <Sparkles size={14} className="text-[var(--color-laburante-accent)]" />
              Imágenes reales de uso de la plataforma
            </div>
            <h2 className="font-heading text-2xl sm:text-4xl font-extrabold text-[var(--color-laburante-text)] tracking-tight">
              Cómo funciona LABURANTE paso a paso
            </h2>
            <p className="text-sm sm:text-base text-[var(--color-laburante-text-secondary)] mt-2 leading-relaxed">
              Un puente directo entre personas que saben hacer cosas y quienes necesitan resolverlas. Mirá la experiencia real sin intermediarios ni cobros ocultos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAnimatedGif(!showAnimatedGif)}
              className={`px-4 py-2.5 rounded-xl font-heading text-xs font-bold transition-all flex items-center gap-2 border ${
                showAnimatedGif 
                  ? 'bg-[var(--color-laburante-text)] text-white border-[var(--color-laburante-text)]'
                  : 'bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)] border-[var(--color-laburante-border)] hover:bg-[var(--color-laburante-surface)]'
              }`}
            >
              {showAnimatedGif ? (
                <>
                  <ImageIcon size={15} />
                  Ver capturas por paso
                </>
              ) : (
                <>
                  <Play size={15} className="text-emerald-600 fill-emerald-600" />
                  Ver animación del flujo (GIF)
                </>
              )}
            </button>

            <Link
              to="/como-funciona"
              className="px-4 py-2.5 rounded-xl bg-[var(--color-laburante-indigo)]/10 text-[var(--color-laburante-indigo)] font-heading text-xs font-bold hover:bg-[var(--color-laburante-indigo)]/20 transition-all flex items-center gap-1.5"
            >
              Guía detallada
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Interactive Step Switcher Tabs */}
        {!showAnimatedGif && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {STEPS.map((step) => {
              const isActive = activeStep === step.id
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all relative ${
                    isActive
                      ? 'border-[var(--color-laburante-text)] bg-[var(--color-laburante-surface-alt)] shadow-sm'
                      : 'border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:border-[var(--color-laburante-text-muted)] text-[var(--color-laburante-text-secondary)]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center justify-center h-6 w-6 rounded-lg text-xs font-bold ${
                        isActive
                          ? 'bg-[var(--color-laburante-accent)] text-black'
                          : 'bg-[var(--color-laburante-border)] text-[var(--color-laburante-text)]'
                      }`}
                    >
                      {step.id}
                    </span>
                    <span className="font-heading text-xs font-bold text-[var(--color-laburante-text)] truncate">
                      Paso {step.id}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[var(--color-laburante-text)] truncate">
                    {step.title.replace(/^\d+\.\s*/, '')}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {/* Main Display Area */}
        {showAnimatedGif ? (
          /* Animated Full Flow GIF Mode */
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--color-laburante-border)] bg-zinc-950 overflow-hidden shadow-xl">
              {/* Browser window topbar */}
              <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                  <span className="ml-3 text-xs text-zinc-400 font-mono hidden sm:inline">
                    Recorrido real en vivo: Búsqueda ➔ Perfil ➔ Contacto directo ➔ 0% comisión
                  </span>
                </div>
                <div className="text-[11px] font-mono text-emerald-400 font-medium flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Flujo 100% real
                </div>
              </div>

              {/* Real Animated GIF */}
              <div className="relative bg-zinc-900 flex items-center justify-center p-2 sm:p-4">
                <img
                  src="/assets/demo/laburante-flow.gif"
                  alt="Recorrido real de uso de LABURANTE"
                  className="w-full max-w-4xl h-auto rounded-xl shadow-2xl border border-zinc-800 object-contain"
                />
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-[var(--color-laburante-text-secondary)]">
                Grabación real de la aplicación en ejecución. Sin simulaciones ficticias ni pantallas falsas.
              </p>
            </div>
          </div>
        ) : (
          /* Step-by-Step Interactive Mode */
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              {/* Left Column: Explanation and key real features */}
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <span className="inline-block text-xs font-bold font-heading uppercase tracking-wider text-[var(--color-laburante-indigo)] mb-2">
                    {current.realDetail}
                  </span>
                  <h3 className="font-heading text-xl sm:text-2xl font-extrabold text-[var(--color-laburante-text)] leading-tight">
                    {current.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-medium text-[var(--color-laburante-accent-hover)] mt-1">
                    {current.subtitle}
                  </p>
                </div>

                <p className="text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                  {current.description}
                </p>

                {/* Bullets */}
                <div className="space-y-2.5 pt-2">
                  {current.highlights.map((h, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-[var(--color-laburante-text)] font-medium">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>

                {/* Step Action CTA */}
                <div className="pt-4 flex items-center gap-3">
                  {current.id === 1 && (
                    <Link
                      to="/buscar"
                      className="btn-dark px-5 py-2.5 rounded-xl font-heading font-bold text-xs shadow-xs inline-flex items-center gap-2"
                    >
                      <Search size={14} />
                      Probar la búsqueda ahora
                    </Link>
                  )}
                  {current.id === 2 && (
                    <Link
                      to="/buscar"
                      className="btn-dark px-5 py-2.5 rounded-xl font-heading font-bold text-xs shadow-xs inline-flex items-center gap-2"
                    >
                      <UserCheck size={14} />
                      Explorar perfiles reales
                    </Link>
                  )}
                  {current.id === 3 && (
                    <Link
                      to="/buscar"
                      className="btn-dark px-5 py-2.5 rounded-xl font-heading font-bold text-xs shadow-xs inline-flex items-center gap-2"
                    >
                      <MessageCircle size={14} />
                      Ver cómo contactar
                    </Link>
                  )}
                  {current.id === 4 && (
                    <Link
                      to="/crear-perfil"
                      className="btn-dark px-5 py-2.5 rounded-xl font-heading font-bold text-xs shadow-xs inline-flex items-center gap-2"
                    >
                      Ofrecer mi oficio gratis
                      <ArrowRight size={14} />
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveStep((prev) => (prev % 4) + 1)}
                    className="px-4 py-2.5 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]"
                  >
                    Siguiente paso →
                  </button>
                </div>
              </div>

              {/* Right Column: Authentic Browser Frame with Real Screenshot */}
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-[var(--color-laburante-border)] bg-zinc-900 overflow-hidden shadow-xl">
                  {/* Browser topbar */}
                  <div className="bg-zinc-900 px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    </div>
                    <div className="bg-zinc-800 text-zinc-300 text-[11px] font-mono px-3 py-1 rounded-md max-w-xs truncate">
                      https://{current.urlDisplay}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-medium">
                      Captura Real
                    </div>
                  </div>

                  {/* Real Screenshot Preview */}
                  <div className="relative bg-zinc-950 p-2 group overflow-hidden">
                    <img
                      src={current.imageSrc}
                      alt={current.title}
                      className="w-full h-auto rounded-lg border border-zinc-800/80 shadow-md object-cover max-h-[420px] transition-transform duration-300 group-hover:scale-[1.01]"
                      loading="lazy"
                    />

                    {/* Bottom floating badge on screenshot */}
                    <div className="absolute bottom-4 left-4 right-4 p-2.5 rounded-xl bg-black/85 backdrop-blur-md border border-white/10 text-white text-[11px] flex items-center justify-between gap-2 shadow-lg">
                      <div className="flex items-center gap-2 truncate">
                        <span className="h-2 w-2 rounded-full bg-[var(--color-laburante-accent)]" />
                        <span className="font-heading font-semibold truncate">{current.realDetail}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono flex-shrink-0">
                        Paso {current.id} de 4
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

      </div>
    </section>
  )
}
