import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Check, Search, ShieldCheck, Users, PlayCircle } from 'lucide-react'
import { SITE_CONFIG } from '@/lib/constants'

const benefits = [
  { icon: Search, title: 'Búsquedas que ahorran tiempo', text: 'Filtrá por rubro, ubicación y modalidad para llegar rápido a perfiles relevantes.' },
  { icon: Users, title: 'Un espacio para tu equipo', text: 'Centralizá la búsqueda de profesionales y dejá preparada la cuenta para sumar colaboradores.' },
  { icon: ShieldCheck, title: 'Más confianza para decidir', text: 'Priorizá perfiles completos, canales verificados y señales de reputación.' },
]

const plans = [
  { name: 'Explorar', price: '$0', detail: 'Para probar la red', items: ['Búsqueda base', 'Acceso a perfiles públicos', 'Sin vencimiento'], tone: 'border-[var(--color-laburante-border)]' },
  { name: 'Equipo', price: 'Consultar', detail: 'Para búsquedas frecuentes', items: ['Más búsquedas y guardados', 'Listas para comparar', 'Soporte de activación'], tone: 'border-amber-300 bg-amber-50/40' },
  { name: 'Pro', price: 'Consultar', detail: 'Para equipos con volumen', items: ['Prioridad operativa', 'Colaboración del equipo', 'Beneficios a medida'], tone: 'border-indigo-200 bg-indigo-50/40' },
]

export default function Companies() {
  return (
    <div className="page-enter">
      <section className="border-b border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
        <div className="container grid gap-10 py-16 md:grid-cols-[1.15fr_.85fr] md:items-center md:py-24">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
              <Building2 size={15} /> LABURANTE para empresas
            </div>
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-[var(--color-laburante-text)] sm:text-5xl">
              Encontrá a la persona indicada para cada trabajo.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[var(--color-laburante-text-secondary)] sm:text-lg">
              Una cuenta empresarial para buscar profesionales en Argentina con menos ruido, mejores filtros y beneficios que crecen con tu equipo.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/registrar?tipo=empresa" className="btn-dark inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-sm">
                Crear cuenta empresa <ArrowRight size={16} />
              </Link>
              <Link to="/buscar" className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-laburante-border)] px-5 py-3 text-sm font-semibold text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]">
                Probar una búsqueda <Search size={16} />
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-6 shadow-xs">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-laburante-text-muted)]">Cuenta empresa</p>
            <div className="mt-6 space-y-4">
              {['Filtros avanzados para búsquedas frecuentes', 'Listas de perfiles para comparar', 'Beneficios y límites ampliados según el plan'].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-[var(--color-laburante-text)]">
                  <Check size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-8 border-t border-[var(--color-laburante-border)] pt-5 text-xs leading-relaxed text-[var(--color-laburante-text-secondary)]">
              El alta es gratuita. Los beneficios pagos se activan sólo cuando estén disponibles y sean útiles para tu operación.
            </p>
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <div className="grid gap-5 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6">
              <Icon size={22} className="text-[var(--color-laburante-indigo)]" />
              <h2 className="mt-5 font-heading text-lg font-bold text-[var(--color-laburante-text)]">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">{text}</p>
            </article>
          ))}
        </div>
        <div className="mt-16">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-laburante-indigo)]">Modelo claro</p>
              <h2 className="mt-2 font-heading text-2xl font-bold text-[var(--color-laburante-text)]">LABURANTEs gratis. Empresas con capacidad extra.</h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">La red abierta sigue siendo gratuita. Las empresas pagan sólo por ahorrar tiempo, ordenar búsquedas y trabajar en equipo.</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.name} className={`rounded-2xl border p-5 ${plan.tone}`}>
                <h3 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">{plan.name}</h3>
                <p className="mt-2 font-heading text-2xl font-extrabold text-[var(--color-laburante-text)]">{plan.price}</p>
                <p className="mt-1 text-xs text-[var(--color-laburante-text-secondary)]">{plan.detail}</p>
                <ul className="mt-5 space-y-2 text-xs text-[var(--color-laburante-text-secondary)]">{plan.items.map((item) => <li key={item} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />{item}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
              <div className="mt-14 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-text)] p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300"><PlayCircle size={15} /> Demo real</p><h2 className="mt-2 font-heading text-xl font-bold">Dos caminos, una red.</h2><p className="mt-1 max-w-xl text-sm leading-relaxed text-white/70">LABURANTE crea un perfil y recibe pedidos de presupuesto sin costo. Empresa busca, guarda perfiles y propone entrevistas o contrataciones; luego gestiona internamente proveedor, compra y aprobación.</p></div>
            <a href={`https://wa.me/${SITE_CONFIG.officialWhatsApp}?text=${encodeURIComponent('Hola LABURANTE, quiero activar un plan Empresa.')}`} target="_blank" rel="noopener noreferrer" className="btn-amber inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">Hablar sobre un plan <ArrowRight size={16} /></a>
          </div>
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-5 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="font-heading text-xl font-bold text-[var(--color-laburante-text)]">¿Tu equipo busca profesionales seguido?</h2>
            <p className="mt-1 text-sm text-[var(--color-laburante-text-secondary)]">Creá la cuenta y empecemos a medir qué beneficios realmente te hacen ahorrar.</p>
          </div>
          <Link to="/registrar?tipo=empresa" className="btn-amber inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">Dar de alta la empresa <ArrowRight size={16} /></Link>
        </div>
      </section>
    </div>
  )
}
