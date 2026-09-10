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
          Tratamiento de datos personales y compromiso de minimización · República Argentina · Borrador sujeto a revisión legal
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
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">6. Solicitudes y datos de contacto</h2>
          <p>Cuando una persona pide un presupuesto, LABURANTE procesa los datos necesarios para enviar la solicitud, gestionar el presupuesto, mostrar el estado y registrar el resultado informado por cada parte. Los datos de contacto no deben cargarse para terceros sin autorización.</p>
          <p>Los medios de contacto y la información de una solicitud se utilizan para operar LABURANTE, facilitar el contacto solicitado, prevenir abusos, moderar reportes y cumplir obligaciones legales. No se venden ni se entregan para bases comerciales ajenas. Pueden intervenir proveedores tecnológicos que alojan autenticación, base de datos y archivos bajo instrucciones de LABURANTE.</p>
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
              <strong>Para el perfil público:</strong> Nombre o denominación profesional, localidad, provincia, zona de cobertura, habilidades y descripción de servicios.
            </li>
            <li>
              <strong>Medios de contacto voluntarios:</strong> Teléfono, WhatsApp, redes sociales o email que ingreses y autorices expresamente a mostrar para que otros usuarios se comuniquen con vos.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            3. Consentimiento explícito para datos de contacto
          </h2>
          <p>
            Toda información de contacto visible en un perfil proviene exclusivamente de la carga voluntaria realizada por el titular de la cuenta con consentimiento explícito. Podés pausar tu disponibilidad, ocultar canales de contacto o eliminar tu perfil cuando lo desees.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            4. Derechos de acceso, rectificación y supresión (Ley 25.326)
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
            <strong className="text-[var(--color-laburante-text)]">formulario de contacto al pie de página</strong> indicando "Derechos de Datos Personales".
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
            5. Seguridad y conservación
          </h2>
          <p>
            Implementamos protocolos modernos de seguridad, políticas de Row Level Security (RLS) en la base de datos PostgreSQL y cifrado en tránsito (HTTPS) para proteger la integridad y privacidad de las cuentas.
          </p>
          <p>El acceso se limita por cuenta y por participación en cada solicitud; se minimiza la exposición del contacto en la interfaz y se eliminan o anonimizan datos cuando corresponde. Ningún sistema conectado a Internet puede prometer seguridad absoluta, por eso también recomendamos no publicar información sensible, contraseñas, datos bancarios o documentos innecesarios.</p>
        </section>
      </div>
    </div>
  )
}
