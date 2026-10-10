import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

export default function Privacy() {
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
          Política de Privacidad
        </h1>
        <p className="text-xs text-[var(--color-laburante-text-muted)]">
          Tratamiento de datos personales y compromiso de minimización · República Argentina (Versión 2026-10-v1)
        </p>
      </div>

      <div className="space-y-8 text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            1. Principio de minimización de datos
          </h2>
          <p>
            En <strong>LABURANTE</strong> aplicamos el principio de <em>privacidad por diseño</em>: solo recopilamos la información estrictamente indispensable para permitir que las personas conecten entre sí para coordinar trabajos.
          </p>
          <div className="p-4 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] space-y-2">
            <h3 className="font-heading font-semibold text-xs text-[var(--color-laburante-text)]">
              Lo que NO recopilamos ni almacenamos:
            </h3>
            <ul className="list-disc list-inside text-xs space-y-1 pl-1">
              <li>No solicitamos fotos de DNI obligatorias ni certificados penales.</li>
              <li>No almacenamos datos bancarios, tarjetas ni números de cuenta.</li>
              <li>No almacenamos contraseñas en texto plano.</li>
              <li>No vendemos ni comercializamos bases de datos a terceros.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            2. Qué datos recopilamos y para qué
          </h2>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>
              <strong>Para la cuenta:</strong> Correo electrónico y contraseña cifrada (gestionada de forma segura mediante Supabase Auth) para que puedas acceder y administrar tu perfil.
            </li>
            <li>
              <strong>Registro de aceptación legal:</strong> Declaración de mayoría de edad (18 años o más), versión de Términos y Condiciones aceptada y fecha/hora de aceptación, conservados exclusivamente para acreditar la conformidad contractual y responder ante eventuales requerimientos legales o controversias.
            </li>
            <li>
              <strong>Para el perfil público:</strong> Nombre o denominación profesional, localidad, provincia, zona de cobertura, habilidades y descripción de servicios.
            </li>
            <li>
              <strong>Medios de contacto voluntarios:</strong> Teléfono, WhatsApp, redes sociales o email que ingreses y autorices expresamente a mostrar para que otros usuarios se comuniquen con vos.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            3. Solicitudes y datos de contacto en presupuestos
          </h2>
          <p>
            Cuando una persona pide o responde un presupuesto, LABURANTE procesa los datos necesarios para enviar la solicitud, gestionar el presupuesto, mostrar el estado y registrar el resultado informado por cada parte. Los datos de contacto no deben cargarse para terceros sin autorización.
          </p>
          <p>
            Los medios de contacto y la información de una solicitud se utilizan para operar LABURANTE, facilitar el contacto solicitado, prevenir abusos, moderar reportes y cumplir obligaciones legales. No se venden ni se entregan para bases comerciales ajenas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            4. Consentimiento y canales de contacto
          </h2>
          <p>
            Toda información de contacto visible en un perfil proviene exclusivamente de la carga voluntaria realizada por el titular de la cuenta con consentimiento explícito. Podés pausar tu disponibilidad, ocultar canales de contacto o eliminar tu perfil cuando lo desees.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            5. Proveedores de infraestructura y procesamiento de datos
          </h2>
          <p>
            Para brindar el servicio, LABURANTE utiliza infraestructura provista por terceros bajo estrictos estándares técnicos de seguridad y confidencialidad:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
            <li>
              <strong>Supabase Inc.:</strong> Provee el alojamiento de la base de datos PostgreSQL, el servicio de autenticación segura de usuarios (Auth) y el almacenamiento de archivos (Storage), operando con protocolos de cifrado en reposo y en tránsito.
            </li>
            <li>
              <strong>Vercel Inc.:</strong> Aloja y distribuye la aplicación frontend mediante su red global de servidores (*Edge Network* y CDN).
            </li>
          </ul>
          <p className="text-xs">
            Estos proveedores actúan en calidad de encargados de tratamiento bajo las instrucciones y términos de LABURANTE, contando con certificaciones internacionales de seguridad (SOC 2, ISO 27001) y acuerdos de procesamiento de datos (*Data Processing Agreements*).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            6. Seguridad, Row Level Security (RLS) y conservación
          </h2>
          <p>
            Implementamos protocolos modernos de seguridad, políticas estrictas de <em>Row Level Security</em> (RLS) en PostgreSQL y cifrado en tránsito (HTTPS / TLS) para proteger la integridad y privacidad de las cuentas.
          </p>
          <p>
            El acceso a los datos se limita por cuenta y por participación en cada solicitud; se minimiza la exposición del contacto en la interfaz y se eliminan o anonimizan datos cuando dejan de ser necesarios para los fines que justificaron su recolección.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            7. Derechos de acceso, rectificación y supresión (Ley 25.326)
          </h2>
          <p>
            De conformidad con la Ley N° 25.326 de Protección de Datos Personales de la República Argentina, tenés derecho a:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2">
            <li><strong>Acceder</strong> a los datos que tenemos registrados sobre vos.</li>
            <li><strong>Rectificar</strong> o actualizar cualquier información incorrecta o desactualizada.</li>
            <li><strong>Solicitar la supresión</strong> definitiva de tu cuenta y todos los datos asociados a tu perfil.</li>
          </ul>
          <p>
            Podés ejercer estos derechos directamente desde tu cuenta o enviando un mensaje a través del{' '}
            <strong className="text-[var(--color-laburante-text)]">formulario de contacto al pie de página</strong> indicando "Derechos de Datos Personales" (para trámites de supresión o acceso, se requerirá corroborar fehacientemente la titularidad de la cuenta).
          </p>
          <div className="p-4 rounded-xl bg-[var(--color-laburante-surface-alt)] border border-[var(--color-laburante-border)] text-xs space-y-1.5 mt-3">
            <p className="font-semibold text-[var(--color-laburante-text)]">
              Información de la Agencia de Acceso a la Información Pública (AAIP)
            </p>
            <p>
              El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.
            </p>
            <p>
              La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
