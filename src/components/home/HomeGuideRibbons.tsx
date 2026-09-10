import { useState } from 'react'
import { BookOpen, ChevronDown, CirclePlay, Search, UserRound, MessageCircle, Building2, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const guides = {
  flow: {
    title: 'Cómo funciona LABURANTE paso a paso',
    icon: BookOpen,
    content: <>
      <p>Un puente directo entre personas que saben hacer cosas y quienes necesitan resolverlas. Sin intermediarios ni cobros ocultos.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {[
          ['1', 'Buscás', 'Por oficio, necesidad y zona.'],
          ['2', 'Revisás', 'Perfil, habilidades, idiomas y referencias.'],
          ['3', 'Pedís presupuesto', 'La persona revisa tu pedido y responde con contexto.'],
          ['4', 'Contactan y acuerdan', 'Cuando hay respuesta, coordinan entre ustedes con 0% de comisión.'],
        ].map(([number, title, text]) => <div key={number} className="rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-3"><span className="font-heading text-sm font-bold text-[var(--color-laburante-indigo)]">{number}</span><p className="mt-1 text-xs font-bold">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-[var(--color-laburante-text-secondary)]">{text}</p></div>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><Link to="/buscar" className="inline-flex items-center gap-1.5 font-bold text-[var(--color-laburante-indigo)] hover:underline">Probar la búsqueda <ArrowRight size={14} /></Link><Link to="/como-funciona#buscar" className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-laburante-text-muted)] hover:underline">Guía completa <ArrowRight size={14} /></Link></div>
    </>,
  },
  real: {
    title: 'Prueba de uso de la plataforma',
    icon: CirclePlay,
    content: <>
      <p>Una demostración textual de la experiencia real, actualizada con las funciones que existen hoy.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="flex items-start gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-3"><Search size={15} className="mt-0.5 shrink-0 text-[var(--color-laburante-indigo)]" /><p className="text-xs leading-relaxed"><strong>Visitante:</strong> buscá sin registrarte y filtrá por provincia, localidad y modalidad.</p></div>
        <div className="flex items-start gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-3"><UserRound size={15} className="mt-0.5 shrink-0 text-emerald-600" /><p className="text-xs leading-relaxed"><strong>LABURANTE:</strong> publicá foto, CV, portfolio, servicios, idiomas y canales autorizados.</p></div>
        <div className="flex items-start gap-2 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-3"><Building2 size={15} className="mt-0.5 shrink-0 text-indigo-600" /><p className="text-xs leading-relaxed"><strong>Empresa:</strong> guardá perfiles, armá proyectos y derivá búsquedas a empresas similares.</p></div>
      </div>
      <p className="mt-4 flex items-center gap-2 text-[11px] text-[var(--color-laburante-text-muted)]"><MessageCircle size={14} /> Primero enviás un pedido de presupuesto; luego el contacto se habilita dentro del flujo correspondiente.</p>
    </>,
  },
}

export default function HomeGuideRibbons() {
  const [open, setOpen] = useState<keyof typeof guides | null>(null)
  return <section className="container max-w-5xl space-y-3" aria-label="Guías rápidas de LABURANTE">
    <div className="flex flex-col gap-2 sm:flex-row">
      {(Object.entries(guides) as [keyof typeof guides, typeof guides.flow][]).map(([key, guide]) => { const Icon = guide.icon; const isOpen = open === key; return <button key={key} type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : key)} className={`inline-flex min-h-12 flex-1 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold transition-colors ${isOpen ? 'border-[var(--color-laburante-indigo)] bg-indigo-50 text-indigo-900' : 'border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]'}`}><span className="flex items-center gap-2"><Icon size={17} />{guide.title}</span><ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button> })}
    </div>
    {open && <div className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-5 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">{guides[open].content}</div>}
  </section>
}
