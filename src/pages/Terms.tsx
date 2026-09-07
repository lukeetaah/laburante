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
          Última actualización: Septiembre 2026 · República Argentina
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
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            2. Gratuidad
          </h2>
          <p>
            El acceso a LABURANTE, la búsqueda de perfiles, la publicación de servicios y la visualización de medios de contacto son libres y gratuitos. La plataforma no cobra comisiones sobre trabajos concretados ni exige la compra de créditos para establecer contacto.
          </p>
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
            Por consultas o denuncias legales podés escribirnos a:{' '}
            <strong className="text-[var(--color-laburante-text)]">contacto@laburante.com.ar</strong>
          </p>
        </section>
      </div>
    </div>
  )
}
