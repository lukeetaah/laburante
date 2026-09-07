import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ArrowRight, UserCheck, Shield, Sparkles, MapPin, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import { PROVINCES } from '@/data/provinces'

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProvince, setSelectedProvince] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchTerm.trim()) params.set('q', searchTerm.trim())
    if (selectedProvince) params.set('provincia', selectedProvince)
    navigate(`/buscar?${params.toString()}`)
  }

  return (
    <div className="space-y-16 md:space-y-24 pb-16">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 md:pt-20 pb-16 border-b border-[var(--color-laburante-border)] bg-gradient-to-b from-[var(--color-laburante-surface-alt)]/60 to-[var(--color-laburante-bg)]">
        <div className="container text-center max-w-4xl mx-auto">
          {/* Tagline pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-xs font-medium text-[var(--color-laburante-text-secondary)] mb-6 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-[var(--color-laburante-accent)]" />
            Infraestructura digital abierta y gratuita para toda la Argentina
          </div>

          {/* Core Title */}
          <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--color-laburante-text)] leading-[1.15] mb-6">
            Hay gente que sabe hacer cosas.<br className="hidden sm:inline" />
            Hay gente que necesita que se hagan.
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-[var(--color-laburante-text-secondary)] max-w-2xl mx-auto leading-relaxed mb-10">
            LABURANTE acerca a quienes ofrecen su oficio, profesión o servicios con quienes buscan resolver un trabajo. Sin comisiones, sin intermediarios obligatorios y de acceso libre.
          </p>

          {/* TWO MAIN INTENTIONS (CTAs) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              to="/buscar"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[var(--color-laburante-text)] text-white font-heading font-semibold text-base shadow-lg hover:bg-black transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              Estoy buscando a alguien
              <ArrowRight size={18} />
            </Link>

            <Link
              to="/crear-perfil"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[var(--color-laburante-surface)] border-2 border-[var(--color-laburante-border)] text-[var(--color-laburante-text)] font-heading font-semibold text-base shadow-xs hover:border-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)] transition-all flex items-center justify-center gap-2"
            >
              Quiero ofrecer mi trabajo
            </Link>
          </div>

          {/* DIRECT SEARCH BOX */}
          <form
            onSubmit={handleSearch}
            className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-2.5 shadow-xl max-w-2xl mx-auto flex flex-col sm:flex-row gap-2"
          >
            <div className="flex-1 flex items-center gap-2.5 px-3 py-2">
              <Search size={18} className="text-[var(--color-laburante-text-muted)] flex-shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="¿Qué necesitás? (ej: electricista, programadora, plomero...)"
                className="w-full text-sm bg-transparent outline-none placeholder:text-[var(--color-laburante-text-muted)] text-[var(--color-laburante-text)]"
              />
            </div>

            <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-[var(--color-laburante-border)] px-3 py-2">
              <MapPin size={16} className="text-[var(--color-laburante-accent)] flex-shrink-0" />
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="text-xs sm:text-sm bg-transparent outline-none text-[var(--color-laburante-text)] cursor-pointer pr-2"
              >
                <option value="">Toda Argentina</option>
                {PROVINCES.map((p) => (
                  <option key={p.slug} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="py-3 px-6 rounded-xl bg-[var(--color-laburante-accent)] hover:bg-[var(--color-laburante-accent-hover)] text-black font-heading font-bold text-sm transition-colors flex items-center justify-center gap-2 flex-shrink-0"
            >
              Buscar
            </button>
          </form>
        </div>
      </section>

      {/* 2. EXTENSIBLE CATEGORIES SECTION */}
      <section className="container">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-laburante-text)]">
              Explorá por rubro u oficio
            </h2>
            <p className="text-sm text-[var(--color-laburante-text-secondary)] mt-1">
              Desde oficios tradicionales y mantenimiento hasta profesionales independientes y tecnología.
            </p>
          </div>
          <Link
            to="/categorias"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-laburante-indigo)] hover:underline"
          >
            Ver todas las categorías →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {CATEGORIES.slice(0, 12).map((cat) => (
            <Link
              key={cat.id}
              to={`/categorias/${cat.slug}`}
              className="group p-4 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] hover:border-[var(--color-laburante-indigo)] hover:shadow-xs transition-all text-center flex flex-col items-center justify-center gap-2"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">{cat.icon}</span>
              <span className="font-heading text-xs font-semibold text-[var(--color-laburante-text)]">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <Link to="/categorias" className="text-sm font-semibold text-[var(--color-laburante-indigo)]">
            Ver todas las categorías →
          </Link>
        </div>
      </section>

      {/* 3. HOW IT WORKS (SIMPLE & HONEST) */}
      <section className="container">
        <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-8 md:p-12">
          <div className="max-w-2xl mb-10">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-laburante-text)]">
              Cómo funciona LABURANTE
            </h2>
            <p className="text-sm text-[var(--color-laburante-text-secondary)] mt-2">
              Un puente directo entre personas. Sin burocracia, sin algoritmos opacos, sin cobro de entrada.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] flex items-center justify-center font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                1
              </div>
              <h3 className="font-heading text-lg font-semibold text-[var(--color-laburante-text)]">
                Buscás o mostrás
              </h3>
              <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                Si sabés hacer algo, publicás tu perfil con lo que ofrecés y tus zonas. Si necesitás resolver algo, buscás por oficio, servicio o lugar.
              </p>
            </div>

            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] flex items-center justify-center font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                2
              </div>
              <h3 className="font-heading text-lg font-semibold text-[var(--color-laburante-text)]">
                Contactás directamente
              </h3>
              <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                Elegís el medio de contacto habilitado por el titular (WhatsApp, teléfono, email, redes). No cobramos por mensaje ni retenemos conversaciones.
              </p>
            </div>

            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] flex items-center justify-center font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                3
              </div>
              <h3 className="font-heading text-lg font-semibold text-[var(--color-laburante-text)]">
                Arreglan entre ustedes
              </h3>
              <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                El presupuesto, los tiempos, el método de pago y los detalles del trabajo los definen libremente las partes. Sin comisiones de plataforma.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. TRUST & PRIVACY PILLARS (NO FAKE GUARANTEES) */}
      <section className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]">
            <Shield size={28} className="text-[var(--color-laburante-indigo)] mb-4" />
            <h3 className="font-heading text-xl font-bold text-[var(--color-laburante-text)] mb-2">
              Privacidad y datos por diseño
            </h3>
            <p className="text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed mb-4">
              Ningún dato de contacto se publica sin consentimiento explícito del titular. No vendemos información, no scrapeamos números ajenos y podés ocultar o dar de baja tu perfil cuando lo decidas.
            </p>
            <Link to="/privacidad" className="text-xs font-semibold text-[var(--color-laburante-indigo)] hover:underline">
              Conocé nuestra política de privacidad →
            </Link>
          </div>

          <div className="p-8 rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]">
            <UserCheck size={28} className="text-[var(--color-laburante-accent)] mb-4" />
            <h3 className="font-heading text-xl font-bold text-[var(--color-laburante-text)] mb-2">
              Honestidad sobre lo que somos
            </h3>
            <p className="text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed mb-4">
              No inventamos sellos de "100% verificado" ni prometemos garantías que no podemos controlar. Facilitamos infraestructura y herramientas de reporte para que la propia comunidad se autorregule sanamente.
            </p>
            <Link to="/terminos" className="text-xs font-semibold text-[var(--color-laburante-indigo)] hover:underline">
              Leé los términos de uso →
            </Link>
          </div>
        </div>
      </section>

      {/* 5. NATIONAL SCOPE MENTION */}
      <section className="container text-center max-w-3xl mx-auto py-6">
        <h3 className="font-heading text-xl font-bold text-[var(--color-laburante-text)] mb-2">
          De Jujuy a Tierra del Fuego
        </h3>
        <p className="text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed mb-6">
          LABURANTE está pensado desde el primer día con alcance federal para las 23 provincias argentinas y la Ciudad Autónoma de Buenos Aires.
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 text-xs text-[var(--color-laburante-text-muted)]">
          {PROVINCES.map((p) => (
            <Link
              key={p.slug}
              to={`/buscar?provincia=${encodeURIComponent(p.name)}`}
              className="hover:text-[var(--color-laburante-text)] hover:underline"
            >
              {p.name} ·
            </Link>
          ))}
        </div>
      </section>

      {/* 6. FAQ */}
      <section className="container max-w-3xl mx-auto">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--color-laburante-text)] text-center mb-8">
          Preguntas frecuentes
        </h2>

        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
            <h4 className="font-heading font-semibold text-sm sm:text-base text-[var(--color-laburante-text)] mb-2">
              ¿Cuánto cuesta usar LABURANTE?
            </h4>
            <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
              Es 100% gratuito. No cobramos por registrarte, por publicar tu trabajo, por aparecer en las búsquedas ni por contactar a personas.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
            <h4 className="font-heading font-semibold text-sm sm:text-base text-[var(--color-laburante-text)] mb-2">
              ¿LABURANTE es una agencia de empleo o una empresa contratista?
            </h4>
            <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
              No. LABURANTE es una plataforma tecnológica para facilitar el encuentro entre partes. No intervenimos en los acuerdos ni garantizamos resultados.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
            <h4 className="font-heading font-semibold text-sm sm:text-base text-[var(--color-laburante-text)] mb-2">
              ¿Cómo se protegen mis datos de contacto?
            </h4>
            <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
              Solo se muestran aquellos canales que vos decidís compartir y autorizás explícitamente. Podés modificarlos u ocultarlos en cualquier momento.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
