import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'

type Journey = {
  id: string
  icon: LucideIcon
  label: string
  title: string
  summary: string
  steps: string[]
  outcome: string
  cta: string
  href: string
  tone: string
}

const journeys: Journey[] = [
  {
    id: 'buscar',
    icon: Search,
    label: 'Para quien necesita resolver algo',
    title: 'Quiero encontrar a alguien',
    summary: 'Buscá personas y profesionales por lo que saben hacer, su zona y la modalidad que necesitás.',
    steps: [
      'Describí el oficio, servicio o proyecto y elegí provincia, localidad o modalidad.',
      'Compará perfiles públicos, servicios, experiencia, zona y canales autorizados.',
      'Enviá un pedido de presupuesto con alcance, urgencia, fecha y fotos opcionales.',
    ],
    outcome: 'La solicitud queda guardada en tus pedidos. La otra persona responde cuando puede; después acuerdan alcance, tiempos y forma de pago directamente.',
    cta: 'Probar la búsqueda',
    href: '/buscar',
    tone: 'border-sky-200 bg-sky-50/60',
  },
  {
    id: 'ofrecer',
    icon: UserCheck,
    label: 'Para quien ofrece un oficio o servicio',
    title: 'Quiero ofrecer mi trabajo',
    summary: 'Publicá qué sabés hacer y dejá que personas o Empresas encuentren un perfil claro y real.',
    steps: [
      'Creá tu perfil con servicios, ubicación, modalidad y la información que quieras mostrar.',
      'Elegí qué canales de contacto autorizás y mantené tu perfil visible o pausado.',
      'Respondé pedidos de presupuesto o propuestas de entrevista desde tu cuenta.',
    ],
    outcome: 'Decidís qué aceptar y cómo continuar. LABURANTE no retiene el pago ni cobra comisión a quienes ofrecen su trabajo.',
    cta: 'Crear mi perfil',
    href: '/crear-perfil',
    tone: 'border-emerald-200 bg-emerald-50/60',
  },
  {
    id: 'empresa',
    icon: Building2,
    label: 'Para equipos que buscan capacidad',
    title: 'Represento a una empresa',
    summary: 'Encontrá profesionales, guardá perfiles y organizá selecciones sin convertir una entrevista en un pedido de presupuesto.',
    steps: [
      'Creá una cuenta Empresa y buscá perfiles públicos por rubro, ubicación y modalidad.',
      'Guardá personas, organizá proyectos y revisá la información disponible para decidir.',
      'Proponé una entrevista o contratación; tu empresa gestiona sus aprobaciones y condiciones internas.',
    ],
    outcome: 'La cuenta Gratis permite buscar, guardar perfiles y proponer entrevistas. Las herramientas adicionales se coordinan desde la propuesta comercial vigente.',
    cta: 'Conocer opciones Empresa',
    href: '/empresas',
    tone: 'border-amber-200 bg-amber-50/70',
  },
]

function JourneyCard({ journey }: { journey: Journey }) {
  const Icon = journey.icon

  return (
    <article id={journey.id} className={`scroll-mt-24 rounded-3xl border p-5 sm:p-6 ${journey.tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-laburante-indigo)] shadow-xs">
          <Icon size={22} aria-hidden="true" />
        </div>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-laburante-text-muted)]">
          {journey.label}
        </span>
      </div>

      <h2 className="mt-5 font-heading text-xl font-extrabold text-[var(--color-laburante-text)]">
        {journey.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">
        {journey.summary}
      </p>

      <ol className="mt-5 space-y-3">
        {journey.steps.map((step, index) => (
          <li key={step} className="flex items-start gap-2.5 text-sm leading-relaxed text-[var(--color-laburante-text)]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white font-heading text-[11px] font-extrabold text-[var(--color-laburante-indigo)] shadow-xs">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 border-t border-black/10 pt-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
          <span><strong className="text-[var(--color-laburante-text)]">Qué pasa después:</strong> {journey.outcome}</span>
        </p>
      </div>

      <Link
        to={journey.href}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-laburante-text)] px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        {journey.cta}
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </article>
  )
}

export default function HowItWorks() {
  return (
    <div className="space-y-10 pb-16 md:space-y-14">
      <header className="border-b border-[var(--color-laburante-border)] bg-gradient-to-b from-[var(--color-laburante-surface-alt)]/70 to-[var(--color-laburante-bg)]">
        <div className="container mx-auto max-w-5xl px-4 py-12 text-center sm:py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-laburante-text-secondary)] shadow-xs">
            <Sparkles size={14} className="text-[var(--color-laburante-accent)]" aria-hidden="true" />
            Una red abierta para toda la Argentina
          </div>
          <h1 className="mx-auto mt-5 max-w-3xl font-heading text-3xl font-extrabold tracking-tight text-[var(--color-laburante-text)] sm:text-5xl">
            Tres formas claras de empezar en LABURANTE
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-laburante-text-secondary)] sm:text-lg">
            LABURANTE conecta a quienes necesitan resolver algo con quienes ofrecen su trabajo y con equipos que buscan profesionales. Elegí tu recorrido: los tres funcionan al mismo tiempo.
          </p>
          <nav aria-label="Recorridos de LABURANTE" className="mt-7 flex flex-wrap justify-center gap-2">
            {journeys.map((journey) => (
              <a key={journey.id} href={`#${journey.id}`} className="rounded-full border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] px-3.5 py-2 text-xs font-bold text-[var(--color-laburante-text)] hover:border-[var(--color-laburante-indigo)]">
                {journey.title}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4">
        <section aria-labelledby="journeys-title">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-laburante-indigo)]">Elegí tu punto de partida</p>
              <h2 id="journeys-title" className="mt-1 font-heading text-2xl font-extrabold text-[var(--color-laburante-text)] sm:text-3xl">La experiencia esencial, sin pestañas ocultas</h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">Podés leer los tres recorridos en una misma vista y pasar de uno a otro cuando quieras.</p>
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {journeys.map((journey) => <JourneyCard key={journey.id} journey={journey} />)}
          </div>
        </section>

        <section aria-labelledby="rules-title" className="mt-10 rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5 sm:p-7">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-laburante-indigo)]">Lo importante antes de empezar</p>
            <h2 id="rules-title" className="mt-2 font-heading text-2xl font-extrabold text-[var(--color-laburante-text)]">Qué es LABURANTE y qué podés esperar</h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-5">
              <HeartHandshake size={21} className="text-[var(--color-laburante-indigo)]" aria-hidden="true" />
              <h3 className="mt-3 font-heading font-bold text-[var(--color-laburante-text)]">Un punto de encuentro</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">No somos empleador, aseguradora ni parte del contrato. Facilitamos que las personas se encuentren y decidan con información.</p>
            </article>
            <article className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-5">
              <ClipboardList size={21} className="text-[var(--color-laburante-indigo)]" aria-hidden="true" />
              <h3 className="mt-3 font-heading font-bold text-[var(--color-laburante-text)]">La solicitud no es contratación</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">Un pedido de presupuesto reúne contexto para que la otra persona responda. No garantiza aceptación, precio, disponibilidad ni tiempo de respuesta.</p>
            </article>
            <article className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-5">
              <ShieldCheck size={21} className="text-[var(--color-laburante-indigo)]" aria-hidden="true" />
              <h3 className="mt-3 font-heading font-bold text-[var(--color-laburante-text)]">Contacto con autorización</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">Se comparte el contexto necesario para responder. Los canales públicos dependen de lo que cada persona autorizó en su perfil y del estado del proceso.</p>
            </article>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <DollarSign size={20} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-emerald-950"><strong>Costos claros:</strong> quienes ofrecen su trabajo no pagan comisión. La cuenta Empresa Gratis permite empezar; las opciones adicionales se coordinan aparte.</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
              <MessageCircle size={20} className="mt-0.5 shrink-0 text-sky-700" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-sky-950"><strong>Trato directo:</strong> las partes acuerdan alcance, materiales, fechas y forma de pago. LABURANTE no retiene ese dinero.</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
              <MapPin size={20} className="mt-0.5 shrink-0 text-violet-700" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-violet-950"><strong>Red federal:</strong> usá provincia, localidad y modalidad cuando sean relevantes; si hay pocos resultados, probá ampliar la búsqueda.</p>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-3xl bg-[var(--color-laburante-text)] p-6 text-center text-white sm:p-9" aria-labelledby="start-title">
          <h2 id="start-title" className="font-heading text-2xl font-extrabold sm:text-3xl">¿Ya sabés qué necesitás hacer?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/75">Empezá por una búsqueda, publicá tu perfil o conocé las opciones para Empresas. No necesitás adivinar el recorrido: podés cambiar de camino.</p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/buscar" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[var(--color-laburante-text)] hover:bg-white/90">
              Buscar a alguien <Search size={15} aria-hidden="true" />
            </Link>
            <Link to="/crear-perfil" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">
              Ofrecer mi trabajo <UserCheck size={15} aria-hidden="true" />
            </Link>
            <Link to="/empresas" className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/60 px-5 py-3 text-sm font-bold text-amber-200 hover:bg-amber-300/10">
              Para Empresas <Building2 size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
