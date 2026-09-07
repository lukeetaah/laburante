import { Link } from 'react-router-dom'
import LuksonUniverse from '@/components/lukson/LuksonUniverse'
import ContactForm from '@/components/layout/ContactForm'
import { SITE_CONFIG } from '@/lib/constants'

export default function Footer() {
  return (
    <footer>
      {/* Main Footer — LABURANTE info */}
      <div className="border-t border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
        <div className="container py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Brand */}
            <div className="md:col-span-3">
              <span className="font-heading text-lg font-bold">{SITE_CONFIG.name}</span>
              <p className="mt-2 text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                Personas que saben hacer cosas.<br />
                Personas que necesitan que se hagan.
              </p>
              <p className="mt-3 text-xs text-[var(--color-laburante-text-muted)]">
                Una creación de{' '}
                <a
                  href={SITE_CONFIG.originUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-[var(--color-laburante-text)] font-medium"
                >
                  {SITE_CONFIG.origin}
                </a>
                .
              </p>
            </div>

            {/* Links */}
            <div className="md:col-span-2">
              <h4 className="font-heading text-sm font-semibold mb-3">Para vos</h4>
              <ul className="space-y-2 text-sm text-[var(--color-laburante-text-secondary)]">
                <li><Link to="/como-funciona" className="hover:text-[var(--color-laburante-text)] transition-colors">Cómo funciona</Link></li>
                <li><Link to="/buscar" className="hover:text-[var(--color-laburante-text)] transition-colors">Buscar personas</Link></li>
                <li><Link to="/mis-trabajos" className="hover:text-[var(--color-laburante-text)] transition-colors">Mis Trabajos y Pedidos</Link></li>
                <li><Link to="/categorias" className="hover:text-[var(--color-laburante-text)] transition-colors">Categorías</Link></li>
                <li><Link to="/crear-perfil" className="hover:text-[var(--color-laburante-text)] transition-colors">Ofrecer tu trabajo</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="md:col-span-2">
              <h4 className="font-heading text-sm font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-[var(--color-laburante-text-secondary)]">
                <li><Link to="/terminos" className="hover:text-[var(--color-laburante-text)] transition-colors">Términos y condiciones</Link></li>
                <li><Link to="/privacidad" className="hover:text-[var(--color-laburante-text)] transition-colors">Política de privacidad</Link></li>
              </ul>
            </div>

            {/* Contacto / Tu voz (Formspree + opción anónima como en MI MANDATO) */}
            <div className="md:col-span-5 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/60 p-5 shadow-xs">
              <ContactForm />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 pt-6 border-t border-[var(--color-laburante-border)]">
            <p className="text-xs text-[var(--color-laburante-text-muted)] leading-relaxed max-w-3xl">
              LABURANTE facilita contactos entre personas. No somos empleadores, agencia de empleo ni garantes de los servicios publicados.
              Cada usuario es responsable de sus decisiones y acuerdos.
              <span className="mx-1">·</span>
              <Link to="/terminos" className="underline hover:text-[var(--color-laburante-text-secondary)]">Términos</Link>
              <span className="mx-1">·</span>
              <Link to="/privacidad" className="underline hover:text-[var(--color-laburante-text-secondary)]">Privacidad</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Lukson Arts Universe Portal */}
      <LuksonUniverse />
    </footer>
  )
}
