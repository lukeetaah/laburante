import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { Menu, X, Search, UserPlus, LogIn, LogOut, User, ShieldAlert } from 'lucide-react'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, isAdmin, signOut } = useAuthStore()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]/95 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <span className="font-heading text-xl font-bold tracking-tight text-[var(--color-laburante-text)]">
            LABURANTE
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/buscar"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/buscar')
                ? 'bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)]'
                : 'text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]'
            }`}
          >
            <Search size={16} />
            Buscar
          </Link>
          <Link
            to="/categorias"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/categorias')
                ? 'bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)]'
                : 'text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]'
            }`}
          >
            Categorías
          </Link>
          <Link
            to="/crear-perfil"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-laburante-accent)] hover:bg-amber-50 transition-colors"
          >
            <UserPlus size={16} />
            Ofrecer mi trabajo
          </Link>
        </nav>

        {/* Auth + Admin + Mobile Toggle */}
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <ShieldAlert size={14} />
              Admin
            </Link>
          )}

          {user ? (
            <div className="hidden md:flex items-center gap-3">
              <Link to="/crear-perfil" className="flex items-center gap-2 text-sm text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)]">
                <User size={16} />
                Mi perfil
              </Link>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 text-sm text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)]"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              to="/ingresar"
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)] transition-colors"
            >
              <LogIn size={16} />
              Ingresar
            </Link>
          )}

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-[var(--color-laburante-surface-alt)]"
            aria-label="Menú"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-4 space-y-1">
          <Link to="/buscar" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-[var(--color-laburante-surface-alt)]">
            <Search size={16} /> Buscar
          </Link>
          <Link to="/categorias" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-[var(--color-laburante-surface-alt)]">
            Categorías
          </Link>
          <Link to="/crear-perfil" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-[var(--color-laburante-accent)] font-medium">
            <UserPlus size={16} /> Ofrecer mi trabajo
          </Link>
          {isAdmin && (
            <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-indigo-700 font-bold bg-indigo-50/70">
              <ShieldAlert size={16} /> Panel de Administración
            </Link>
          )}
          <hr className="border-[var(--color-laburante-border)]" />
          {user ? (
            <>
              <Link to="/crear-perfil" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm">
                <User size={16} /> Mi perfil
              </Link>
              <button onClick={() => { signOut(); setMenuOpen(false) }} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-[var(--color-laburante-text-muted)] w-full text-left">
                <LogOut size={16} /> Cerrar sesión
              </button>
            </>
          ) : (
            <Link to="/ingresar" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm">
              <LogIn size={16} /> Ingresar
            </Link>
          )}
        </div>
      )}
    </header>
  )
}
