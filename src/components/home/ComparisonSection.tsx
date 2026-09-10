import { Check, X, Shield, Zap, Sparkles, MessageCircle, DollarSign, Eye } from 'lucide-react'

export default function ComparisonSection() {
  const comparisonItems = [
    {
      feature: 'Comisión sobre el trabajo realizado',
      traditional: 'Cobran entre el 10% y el 20% del monto total de cada trabajo o retienen el dinero en billeteras cerradas.',
      laburante: '0% de comisión. Lo que acordás con el cliente o trabajador es 100% de ustedes. La plataforma no toca tu plata.',
      highlight: true
    },
    {
      feature: 'Contacto directo',
      traditional: 'Ocultan el teléfono. Te obligan a comprar "créditos" o pagar membresías mensuales para ver el contacto o responder presupuestos.',
      laburante: '100% libre e inmediato. Abrís WhatsApp, llamás por teléfono o enviás un email con un solo clic.',
      highlight: true
    },
    {
      feature: 'Canal de mensajería y comunicación',
      traditional: 'Chats cautivos que censuran números de celular, emails o palabras como "whatsapp" bajo amenaza de suspender la cuenta.',
      laburante: 'Libertad absoluta. La conversación transcurre en la aplicación que usás todos los días, sin monitoreo ni retención.',
      highlight: false
    },
    {
      feature: 'Burocracia y datos personales',
      traditional: 'Exigen fotos de DNI, datos bancarios obligatorios y formularios interminables antes de permitirte trabajar o consultar.',
      laburante: 'Privacidad por diseño. No pedimos DNI ni cuentas bancarias. Solo se publica lo que el titular decide y autoriza voluntariamente.',
      highlight: false
    },
    {
      feature: 'Cómo te encuentran',
      traditional: 'Algoritmos "Pagar para figurar". Si no pagás pauta o destacados, tu perfil queda enterrado en las últimas páginas.',
      laburante: 'Tu perfil puede aparecer cuando alguien busca lo que sabés hacer, con filtros reales por oficio, provincia y localidad.',
      highlight: false
    },
    {
      feature: 'Confianza y reputación',
      traditional: 'Venden sellos artificiales de "100% verificado" para cobrar más, prometiendo garantías que legalmente no pueden controlar.',
      laburante: 'Honestidad de base. Recomendaciones con contexto real de trabajos y botón de reporte comunitario ante irregularidades.',
      highlight: false
    }
  ]

  return (
    <section className="container">
      <div className="rounded-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 sm:p-10 md:p-14 shadow-xs">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold mb-4">
            <Sparkles size={14} className="text-amber-600" />
            Sin intermediarios ni trampas comerciales
          </div>
          <h2 className="font-heading text-2xl sm:text-4xl font-extrabold text-[var(--color-laburante-text)] tracking-tight">
            No sos una postulación más
          </h2>
          <p className="text-sm sm:text-base text-[var(--color-laburante-text-secondary)] mt-3 leading-relaxed">
            En muchos portales un algoritmo decide quién aparece. En LABURANTE empezás por vos: qué sabés hacer, dónde estás y cómo pueden contactarte.
          </p>
        </div>

        {/* Comparison Grid (Cards for Mobile, Table for Desktop) */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-[var(--color-laburante-border)]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]">
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-laburante-text-muted)] w-1/3">
                  Aspecto Clave
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50/50 w-1/3">
                  <div className="flex items-center gap-1.5">
                    <X size={16} className="text-rose-600" />
                    Portales tradicionales con comisión
                  </div>
                </th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50/60 w-1/3">
                  <div className="flex items-center gap-1.5">
                    <Check size={16} className="text-emerald-600" />
                    LABURANTE
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-laburante-border)] text-sm">
              {comparisonItems.map((item, idx) => (
                <tr key={idx} className={item.highlight ? 'bg-amber-50/20' : ''}>
                  <td className="p-4 font-heading font-semibold text-[var(--color-laburante-text)] align-top">
                    {item.feature}
                  </td>
                  <td className="p-4 text-rose-950/80 bg-rose-50/20 text-xs leading-relaxed align-top">
                    <div className="flex items-start gap-2">
                      <span className="text-rose-500 font-bold mt-0.5">✕</span>
                      <span>{item.traditional}</span>
                    </div>
                  </td>
                  <td className="p-4 text-emerald-950 bg-emerald-50/30 text-xs leading-relaxed align-top font-medium">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                      <span>{item.laburante}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Comparison Cards */}
        <div className="md:hidden space-y-4">
          {comparisonItems.map((item, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border ${
                item.highlight
                  ? 'border-amber-300 bg-amber-50/30'
                  : 'border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]'
              }`}
            >
              <h4 className="font-heading font-bold text-sm text-[var(--color-laburante-text)] mb-3">
                {item.feature}
              </h4>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/70 text-rose-950">
                  <span className="font-semibold text-rose-700 block mb-1">✕ En otros portales:</span>
                  <p className="leading-relaxed">{item.traditional}</p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950">
                  <span className="font-semibold text-emerald-700 block mb-1">✓ En LABURANTE:</span>
                  <p className="leading-relaxed font-medium">{item.laburante}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Banner */}
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
