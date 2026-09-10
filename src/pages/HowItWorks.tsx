import { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Search, 
  UserCheck, 
  MessageCircle, 
  Shield, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  X, 
  AlertCircle,
  HelpCircle,
  Phone,
  DollarSign,
  HeartHandshake,
  Layers,
  MapPin
  ,Building2
} from 'lucide-react'
import ComparisonSection from '@/components/home/ComparisonSection'

export default function HowItWorks() {
  const [activeTab, setActiveTab] = useState<'buscar' | 'ofrecer' | 'empresa'>('buscar')

  return (
    <div className="space-y-16 md:space-y-24 pb-20">
      {/* 1. HERO HEADER */}
      <section className="pt-12 md:pt-20 pb-12 border-b border-[var(--color-laburante-border)] bg-gradient-to-b from-[var(--color-laburante-surface-alt)]/60 to-[var(--color-laburante-bg)]">
        <div className="container max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-xs font-semibold text-[var(--color-laburante-text-secondary)] shadow-xs">
            <Sparkles size={14} className="text-[var(--color-laburante-accent)]" />
            Infraestructura abierta · 0% comisión · Trato directo
          </div>

          <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl font-extrabold text-[var(--color-laburante-text)] tracking-tight leading-[1.15]">
            Vos también podés ser encontrado
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-[var(--color-laburante-text-secondary)] max-w-2xl mx-auto leading-relaxed">
            LABURANTE te permite decir para qué sos bueno y dejar que otras personas o Empresas te encuentren. También podés buscar a alguien para resolver algo, sin comisiones para quienes ofrecen su trabajo.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setActiveTab('buscar')}
              className={`px-6 py-3 rounded-2xl font-heading text-sm font-bold transition-all ${
                activeTab === 'buscar'
                  ? 'bg-[var(--color-laburante-text)] text-white shadow-md'
                  : 'bg-[var(--color-laburante-surface)] border border-[var(--color-laburante-border)] text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]'
              }`}
            >
              Para quien busca a alguien
            </button>
            <button
              onClick={() => setActiveTab('ofrecer')}
              className={`px-6 py-3 rounded-2xl font-heading text-sm font-bold transition-all ${
                activeTab === 'ofrecer'
                  ? 'bg-[var(--color-laburante-text)] text-white shadow-md'
                  : 'bg-[var(--color-laburante-surface)] border border-[var(--color-laburante-border)] text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]'
              }`}
            >
              Para quien ofrece su trabajo
            </button>
            <button
              onClick={() => setActiveTab('empresa')}
              className={`px-6 py-3 rounded-2xl font-heading text-sm font-bold transition-all ${activeTab === 'empresa' ? 'bg-[var(--color-laburante-text)] text-white shadow-md' : 'bg-[var(--color-laburante-surface)] border border-[var(--color-laburante-border)] text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]'}`}
            >
              Para Empresas
            </button>
          </div>
        </div>
      </section>

      {/* 2. TEXT-ONLY WALKTHROUGH */}
      <section className="container max-w-5xl mx-auto">
        <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-laburante-indigo)]">Prueba textual actualizada</p>
          <h3 className="mt-2 font-heading text-xl font-bold text-[var(--color-laburante-text)]">Dos recorridos reales: acuerdo privado o selección Empresa</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">Las personas piden presupuestos para trabajos puntuales; las Empresas guardan perfiles y proponen entrevistas o contrataciones sin convertir una entrevista en un presupuesto.</p>
        </div>
      </section>

      {/* 3. TAB 1: PARA QUIEN BUSCA */}
      {activeTab === 'buscar' && (
        <section className="container max-w-5xl mx-auto space-y-16 animate-in fade-in duration-300">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)]">
              Guía para encontrar a la persona adecuada
            </h2>
            <p className="text-sm text-[var(--color-laburante-text-secondary)] mt-2">
              Desde una tarea puntual hasta un proyecto profesional, así de simple es encontrar a la persona adecuada.
            </p>
          </div>

          {/* Step 1 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-6 space-y-4">
              <div className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                1
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-[var(--color-laburante-text)]">
                Filtrá por oficio, profesión y tu zona
              </h3>
              <p className="text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                Ingresá lo que necesitás en el buscador. Podés seleccionar tu provincia entre las 23 provincias argentinas y CABA, especificar tu barrio o localidad, o elegir si el trabajo requiere presencia física o puede realizarse de forma remota.
              </p>
              <div className="space-y-2 text-xs text-[var(--color-laburante-text)] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Sin necesidad de crear una cuenta para ver a los laburantes</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Sin anuncios pagos que tapen a los profesionales cercanos</span>
                </div>
              </div>
            </div>

            <div id="buscar" className="md:col-span-6 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-laburante-indigo)]">Marcador 1 · Buscar</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">Escribí un oficio, una necesidad o un proyecto. Elegí provincia, localidad y modalidad; los resultados salen de perfiles activos reales.</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-6 order-last md:order-first rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-laburante-indigo)]">Marcador 2 · Revisar</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">Abrí el perfil para comparar habilidades, servicios, idiomas, portfolio, CV, zona, disponibilidad y referencias con contexto.</p>
            </div>

            <div className="md:col-span-6 space-y-4">
              <div className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                2
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-[var(--color-laburante-text)]">
                Revisá el perfil con información transparente
              </h3>
              <p className="text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                Cada persona detalla qué sabe hacer, en qué zonas trabaja y los servicios específicos que ofrece con precios orientativos sinceros. Además, podés leer recomendaciones comunitarias que explican el contexto real de trabajos anteriores.
              </p>
              <div className="space-y-2 text-xs text-[var(--color-laburante-text)] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Sin falsos sellos pagos de "100% verificado"</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Botón de reporte comunitario ante cualquier irregularidad</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-6 space-y-4">
              <div className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                3
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-[var(--color-laburante-text)]">
                Recibí y respondé pedidos con contexto
              </h3>
              <p className="text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                Para un acuerdo entre particulares enviás un pedido de presupuesto con alcance y fecha. Si sos Empresa, guardás el perfil y proponés una entrevista o contratación; la persona responde desde su cuenta.
              </p>
              <div className="space-y-2 text-xs text-[var(--color-laburante-text)] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>No te cobramos "créditos" para ver el número</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Acuerdan presupuesto, materiales y fechas directamente entre ustedes</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-6 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-laburante-indigo)]">Marcador 3 · Contactar</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">El contacto aparece dentro del pedido respondido y abre únicamente los canales que la persona autorizó: WhatsApp, teléfono, email, redes o portfolio.</p>
            </div>
          </div>
        </section>
      )}

      {/* 4. TAB 2: PARA QUIEN OFRECE SU TRABAJO */}
      {activeTab === 'ofrecer' && (
        <section className="container max-w-5xl mx-auto space-y-16 animate-in fade-in duration-300">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)]">
              Guía para trabajadores y profesionales independientes
            </h2>
            <p className="text-sm text-[var(--color-laburante-text-secondary)] mt-2">
              Publicá lo que sabés hacer y sumá una oportunidad más para que te encuentren.
            </p>
          </div>

          {/* Worker Step 1 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-6 space-y-4">
              <div className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                1
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-[var(--color-laburante-text)]">
              Decí para qué sos bueno en 2 minutos
              </h3>
              <p className="text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                Respetamos tu privacidad: solo te pedimos la información estrictamente necesaria para que la gente sepa qué hacés y en qué zona trabajás. No recopilamos DNI, antecedentes inventados ni números de cuenta bancaria.
              </p>
              <div className="space-y-2 text-xs text-[var(--color-laburante-text)] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>100% gratuito para siempre: sin suscripción mensual obligatoria</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Podés pausar o eliminar tu perfil cuando quieras</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-6 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-laburante-indigo)]">Marcador 1 · Publicar</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">Completá tu perfil, sumá foto, CV, servicios, idiomas y los canales de contacto que decidís mostrar. Es gratuito.</p>
            </div>
          </div>

          {/* Worker Step 2 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-6 order-last md:order-first rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-laburante-indigo)]">Marcador 2 · Recibir oportunidades</p>
               <p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">Las personas te envían pedidos de presupuesto por trabajos puntuales. Las Empresas pueden proponerte una entrevista o contratación directa. En ambos casos decidís qué aceptar, rechazar o pausar.</p>
            </div>

            <div className="md:col-span-6 space-y-4">
              <div className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                2
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-[var(--color-laburante-text)]">
                Vos elegís qué canales mostrar y recibís mensajes directo a tu WhatsApp
              </h3>
              <p className="text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                Si querés recibir pedidos por WhatsApp, ponés tu número. Si preferís llamadas o email, elegís esos canales. Cada dato requiere tu consentimiento voluntario. El contacto se habilita dentro del flujo cuando respondés un pedido de presupuesto.
              </p>
              <div className="space-y-2 text-xs text-[var(--color-laburante-text)] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Sin chats retenidos ni algoritmos que censuren tus presupuestos</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>No tenés que pagar para responder mensajes a clientes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Worker Step 3 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-6 space-y-4">
              <div className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                3
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-[var(--color-laburante-text)]">
                Cobrás el 100% de lo que pactás: 0% comisiones
              </h3>
              <p className="text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                En otros portales te descuentan entre el 10% y el 20% del valor del trabajo que hiciste con tu tiempo y esfuerzo. En LABURANTE la comisión es 0%. Acuerdan el medio de pago directamente (efectivo, transferencia, cuotas) sin que la plataforma retenga tu dinero.
              </p>
              <div className="space-y-2 text-xs text-[var(--color-laburante-text)] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Sin saldo retenido en billeteras virtuales de la plataforma</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Tu trabajo, tu precio y tu dinero</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-3xl font-extrabold shadow-lg">
                0%
              </div>
              <h4 className="font-heading text-xl font-bold text-emerald-950">
                Comisión Cero Garantizada
              </h4>
              <p className="text-xs text-emerald-900/80 leading-relaxed max-w-sm mx-auto">
                LABURANTE forma parte del ecosistema abierto de Lukson Arts. No buscamos lucrar cobrándole comisiones a quien sale a ganarse el pan.
              </p>
              <Link
                to="/crear-perfil"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-heading font-bold text-xs shadow-md transition-colors"
              >
                Crear mi perfil ahora
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'empresa' && (
        <section className="container max-w-5xl mx-auto space-y-10 animate-in fade-in duration-300">
           <div className="text-center max-w-2xl mx-auto"><Building2 size={30} className="mx-auto text-[var(--color-laburante-indigo)]" /><h2 className="mt-3 font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)]">Para Empresas: encontrá y seleccioná capacidad real</h2><p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">Describí el rol o proyecto, compará perfiles reales y guardá personas. Luego proponé una entrevista o contratación directa; tu empresa gestiona el alta de proveedor, la orden de compra y sus aprobaciones internas.</p></div>
          <div className="grid gap-4 md:grid-cols-3">
             {[['1', 'Definí el rol o proyecto', 'Escribí una necesidad concreta: “busco una fotógrafa para un evento” o “necesito soporte para mi comercio”.'], ['2', 'Compará y organizá perfiles', 'Usá zona, modalidad, habilidades, CV y portfolio. Guardá los perfiles que te interesan dentro de un proyecto.'], ['3', 'Proponé entrevista o contratación', 'La persona recibe tu propuesta y responde. Después tu empresa gestiona alta de proveedor, orden de compra y condiciones internas.']].map(([number, title, description]) => <article key={number} className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6"><span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 font-heading font-bold text-indigo-700">{number}</span><h3 className="mt-4 font-heading text-lg font-bold text-[var(--color-laburante-text)]">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[var(--color-laburante-text-secondary)]">{description}</p></article>)}
          </div>
          <div className="flex flex-wrap justify-center gap-3"><Link to="/empresas" className="btn-dark inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold">Ver opciones Empresa <ArrowRight size={15} /></Link><Link to="/buscar" className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-laburante-border)] px-5 py-3 text-sm font-semibold">Probar búsqueda real <Search size={15} /></Link></div>
        </section>
      )}

      {/* 5. SIDE-BY-SIDE COMPARISON SECTION */}
      <ComparisonSection />

      {/* 6. CONSEJOS DE SEGURIDAD Y TRATO TRANSPARENTE */}
      <section className="container max-w-4xl mx-auto">
        <div className="p-8 rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] space-y-6">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-[var(--color-laburante-indigo)]" />
            <h3 className="font-heading text-xl font-bold text-[var(--color-laburante-text)]">
              Buenas prácticas y seguridad comunitaria
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[var(--color-laburante-text-secondary)] leading-relaxed">
            <div className="p-4 rounded-xl bg-[var(--color-laburante-surface)] border border-[var(--color-laburante-border)] space-y-1.5">
              <h5 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                Acordar presupuesto previo por escrito
              </h5>
              <p>
                Antes de iniciar una tarea importante, definan claramente el alcance del trabajo, si los materiales están incluidos y los tiempos estimados de entrega en WhatsApp o email.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--color-laburante-surface)] border border-[var(--color-laburante-border)] space-y-1.5">
              <h5 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                Pagos contra avance o materiales
              </h5>
              <p>
                Es habitual coordinar un anticipo si hay compra previa de materiales y cancelar el resto al finalizar el trabajo a satisfacción mutua.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--color-laburante-surface)] border border-[var(--color-laburante-border)] space-y-1.5">
              <h5 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                Herramienta de reporte comunitario
              </h5>
              <p>
                Si detectás algún perfil con datos falsos, spam, intento de fraude o información no autorizada, podés reportarlo inmediatamente desde el perfil.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--color-laburante-surface)] border border-[var(--color-laburante-border)] space-y-1.5">
              <h5 className="font-heading font-bold text-sm text-[var(--color-laburante-text)]">
                Honestidad sobre lo que somos
              </h5>
              <p>
                LABURANTE no es empleador ni cobra seguro: somos una plataforma abierta de encuentro. Fomentamos la claridad y la confianza persona a persona.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FINAL CTAS */}
      <section className="container max-w-3xl mx-auto text-center space-y-6 pt-6">
        <h3 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)]">
          ¿Listo para decir para qué sos bueno?
        </h3>
        <p className="text-sm text-[var(--color-laburante-text-secondary)]">
          Elegí tu camino: buscá a alguien o sumá tu trabajo a una red federal gratuita en minutos.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/buscar"
            className="btn-dark w-full sm:w-auto px-8 py-3.5 rounded-2xl font-heading font-bold text-sm shadow-md flex items-center justify-center gap-2"
          >
            <Search size={16} />
            Buscar personas que saben hacer cosas
          </Link>
          <Link
            to="/crear-perfil"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[var(--color-laburante-surface)] border-2 border-[var(--color-laburante-border)] text-[var(--color-laburante-text)] font-heading font-bold text-sm hover:border-[var(--color-laburante-text)] transition-all flex items-center justify-center gap-2"
          >
            Decir para qué soy bueno
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  )
}
