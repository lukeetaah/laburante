import { Link } from 'react-router-dom'
import LuksonUniverse from '@/components/lukson/LuksonUniverse'
import { SITE_CONFIG } from '@/lib/constants'

export default function Footer() {
  return (
    <footer>
      {/* Main Footer — LABURANTE info */}
      <div className="border-t border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
        <div className="container py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <span className="font-heading text-lg font-bold">{SITE_CONFIG.name}</span>
              <p className="mt-2 text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                Personas que saben hacer cosas.<br />
                Personas que necesitan que se hagan.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-heading text-sm font-semibold mb-3">Para vos</h4>
              <ul className="space-y-2 text-sm text-[var(--color-laburante-text-secondary)]">
                <li><Link to="/buscar" className="hover:text-[var(--color-laburante-text)] transition-colors">Buscar personas</Link></li>
                <li><Link to="/categorias" className="hover:text-[var(--color-laburante-text)] transition-colors">Categorías</Link></li>
                <li><Link to="/crear-perfil" className="hover:text-[var(--color-laburante-text)] transition-colors">Ofrecer tu trabajo</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-heading text-sm font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-[var(--color-laburante-text-secondary)]">
                <li><Link to="/terminos" className="hover:text-[var(--color-laburante-text)] transition-colors">Términos y condiciones</Link></li>
                <li><Link to="/privacidad" className="hover:text-[var(--color-laburante-text)] transition-colors">Política de privacidad</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-heading text-sm font-semibold mb-3">Contacto</h4>
              <ul className="space-y-2 text-sm text-[var(--color-laburante-text-secondary)]">
                <li>{SITE_CONFIG.contact.email}</li>
              </ul>
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
