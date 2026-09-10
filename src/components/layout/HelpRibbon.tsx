import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, CircleHelp, Search, UserRound, Building2, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

export default function HelpRibbon() {
  const { user, isAdmin } = useAuthStore()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  if (location.pathname === '/como-funciona') return null

  const isCompany = user?.user_metadata?.account_type === 'empresa'
  const context = isAdmin ? 'admin' : isCompany ? 'empresa' : user ? 'laburante' : 'visitante'
  const content = {
    visitante: { icon: Search, title: '¿Cómo funciona LABURANTE?', text: 'Describí lo que necesitás, pedí un presupuesto y coordiná después de recibir respuesta.', link: '/buscar', cta: 'Empezar a buscar' },
    laburante: { icon: UserRound, title: 'Decí para qué sos bueno', text: 'Completá tu perfil, sumá foto, CV, portfolio y canales para que puedan encontrarte.', link: '/crear-perfil', cta: 'Editar mi perfil' },
    empresa: { icon: Building2, title: 'Ayuda para tu Empresa', text: 'Descubrí, evaluá, guardá y organizá LABURANTEs antes de enviar pedidos de presupuesto.', link: '/empresa', cta: 'Ir a mi espacio Empresa' },
    admin: { icon: ShieldCheck, title: 'Ayuda de Administración', text: 'Moderá perfiles, revisá cuentas Empresa y atendé verificaciones desde el panel.', link: '/admin', cta: 'Abrir Admin' },
  }[context]
  const Icon = content.icon

  return <section className="border-b border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]" aria-label="Ayuda contextual">
    <div className="container">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-xs font-semibold text-[var(--color-laburante-text)]"><span className="flex min-w-0 items-center gap-2"><CircleHelp size={16} className="shrink-0 text-[var(--color-laburante-indigo)]" /><span className="truncate">{content.title}</span></span><ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} /></button>
      {open && <div className="flex flex-col gap-3 border-t border-[var(--color-laburante-border)] py-3 text-xs text-[var(--color-laburante-text-secondary)] sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><Icon size={15} className="mt-0.5 shrink-0 text-[var(--color-laburante-accent)]" /><p>{content.text}</p></div><div className="flex shrink-0 gap-3"><Link to={content.link} onClick={() => setOpen(false)} className="font-bold text-[var(--color-laburante-indigo)] hover:underline">{content.cta}</Link><Link to="/como-funciona" onClick={() => setOpen(false)} className="font-semibold text-[var(--color-laburante-text-muted)] hover:underline">Ver guía completa</Link></div></div>}
    </div>
  </section>
}
