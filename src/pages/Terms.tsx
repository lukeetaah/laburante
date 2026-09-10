import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function Terms() {
  return (
    <div className="container py-8 md:py-16 max-w-3xl mx-auto space-y-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)]"
      >
        <ArrowLeft size={14} />
        Volver al inicio
      </Link>

      <div className="space-y-2 border-b border-[var(--color-laburante-border)] pb-6">
        <h1 className="font-heading text-2xl sm:text-4xl font-extrabold text-[var(--color-laburante-text)]">
          Términos y Condiciones de Uso
        </h1>
        <p className="text-xs text-[var(--color-laburante-text-muted)]">
          Última actualización: Septiembre 2026 · República Argentina · Borrador sujeto a revisión legal
        </p>
      </div>

      <div className="space-y-8 text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            1. Objeto y naturaleza de la plataforma
          </h2>
          <p>
            <strong>LABURANTE</strong> es una plataforma tecnológica gratuita y abierta desarrollada para facilitar el encuentro directo entre personas que ofrecen su trabajo, oficio, profesión o servicios y personas que necesitan encontrar a alguien para realizar una labor en la República Argentina.
          </p>
          <p>
            LABURANTE actúa exclusivamente como una <strong>infraestructura digital de contacto</strong>. No es una agencia de empleo, no es una empresa de contratación, no es intermediaria laboral ni comercial, y no forma parte de los acuerdos, contrataciones, presupuestos o relaciones que eventualmente celebren los usuarios entre sí.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">4 bis. Solicitudes, presupuestos y cierre</h2>
          <p>Una solicitud de presupuesto permite ordenar la conversación entre las partes. LABURANTE puede habilitar herramientas de contacto dentro del flujo cuando existe una solicitud, un presupuesto o una aceptación; no garantiza que el trabajo se concrete ni que las partes respondan.</p>
          <p>Las cuentas Empresa utilizan un recorrido distinto para selección: pueden guardar perfiles y enviar propuestas de entrevista o contratación directa. El alta de proveedor, la orden de compra, las retenciones, facturación y aprobaciones internas corresponden exclusivamente a la Empresa y no son emitidas ni gestionadas por LABURANTE.</p>
          <p>Quien solicita y quien ofrece el servicio deben informar el resultado del caso cuando la plataforma lo solicite: realizado, en proceso, no realizado o cancelado. Esa información se usa para mantener el historial, mejorar las sugerencias y reducir solicitudes abandonadas. La plataforma podrá recordar el cierre pendiente y limitar avances dentro del flujo, sin asumir responsabilidad por la relación entre las partes.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">4 ter. Independencia y contratación</h2>
          <p>LABURANTE no contrata trabajadores, no fija precios, no cobra ni retiene pagos, no garantiza resultados y no participa como parte en acuerdos laborales, civiles, comerciales o de consumo. Cada usuario debe cumplir la normativa que le corresponda, incluyendo obligaciones fiscales, laborales, profesionales, de seguridad e higiene y de protección al consumidor.</p>
          <p>La exclusión o limitación de responsabilidad se aplica únicamente en la medida permitida por la legislación vigente y no alcanza obligaciones que legalmente no puedan excluirse. Estos términos no reemplazan asesoramiento jurídico local.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            2. Gratuidad
          </h2>
          <p>
            El acceso a LABURANTE, la búsqueda de perfiles, la publicación de servicios y el envío de pedidos de presupuesto son libres y gratuitos. Para cuidar el contexto y la respuesta de ambas partes, los canales de contacto se habilitan dentro del flujo de un pedido respondido. La plataforma no cobra comisiones sobre trabajos concretados ni exige la compra de créditos.
          </p>
          <p>Las cuentas Empresa tienen una opción Gratis, que incluye búsqueda, perfiles, proyectos y propuestas de selección, y una opción Pago de ARS $39.900 mensuales. El plan Pago agrega la publicación y derivación de oportunidades entre Empresas. La activación se confirma comercialmente y no se realiza ningún cobro desde el formulario de registro sin autorización.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            3. Registro y publicación de perfiles
          </h2>
          <p>
            Para publicar un perfil con habilidades y medios de contacto se requiere la creación de una cuenta de usuario. La persona titular se compromete a ingresar información verídica, actual y propia.
          </p>
          <p>
            <strong>Queda terminantemente prohibido publicar datos personales, teléfonos o correos electrónicos de terceras personas sin su expreso consentimiento.</strong>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            4. Marco de responsabilidad y alcance
          </h2>
          <p>
            La existencia de un perfil en LABURANTE no constituye certificación oficial, aval profesional, recomendación técnica, garantía de identidad, idoneidad ni cumplimiento contractual por parte de la plataforma.
          </p>
          <p>
            Toda relación laboral, profesional o comercial se establece exclusivamente entre las partes que decidan contactarse. Cada usuario es libre y responsable de evaluar antecedentes, presupuestos, condiciones de trabajo y medidas de seguridad antes de contratar o prestar un servicio.
          </p>
          <p>
            LABURANTE no controla ni garantiza los resultados, la calidad, la puntualidad, los pagos ni la conducta de los usuarios.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            5. Conductas prohibidas
          </h2>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li>Publicar información engañosa, falsa o fraudulenta.</li>
            <li>Suplantar la identidad de otra persona o profesional.</li>
            <li>Publicar teléfonos o redes sociales de terceros sin autorización documentada.</li>
            <li>Utilizar la plataforma para envío de spam o comercialización masiva no solicitada.</li>
            <li>Publicar contenidos ilícitos, discriminatorios, violentos o difamatorios.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            6. Reportes, moderación y suspensión
          </h2>
          <p>
            Cualquier usuario puede reportar perfiles sospechosos a través de la herramienta pública de "Reportar perfil". LABURANTE se reserva el derecho de retirar contenidos, pausar visibilidad o suspender temporal o permanentemente cuentas que vulneren estas reglas o pongan en riesgo a la comunidad.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            7. Modificaciones y contacto
          </h2>
          <p>
            Estos términos podrán actualizarse para acompañar el crecimiento del proyecto o modificaciones normativas. Las versiones actualizadas estarán siempre disponibles en esta misma sección.
          </p>
          <p>
            Por consultas o inquietudes podés escribirnos directamente a través del{' '}
            <strong className="text-[var(--color-laburante-text)]">formulario de contacto disponible al pie de página</strong>.
          </p>
        </section>
      </div>
    </div>
  )
}
