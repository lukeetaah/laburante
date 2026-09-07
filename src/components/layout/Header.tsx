import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { Menu, X, Search, UserPlus, LogIn, LogOut, User, ShieldAlert, Briefcase } from 'lucide-react'
import NotificationBell from '@/components/notifications/NotificationBell'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, isAdmin, signOut } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => location.pathname === path

  const handleSignOut = async () => {
    await signOut()
    setMenuOpen(false)
    navigate('/')
  }

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Mi cuenta'

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
            to="/mis-trabajos"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/mis-trabajos') || isActive('/pedidos')
                ? 'bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)]'
                : 'text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]'
            }`}
          >
            <Briefcase size={16} />
            Mis Trabajos
          </Link>
          <Link
            to="/como-funciona"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/como-funciona')
                ? 'bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)]'
                : 'text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]'
            }`}
          >
            Cómo funciona
          </Link>
          <Link
            to="/crear-perfil"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-laburante-accent)] hover:bg-amber-50 transition-colors"
          >
            <UserPlus size={16} />
            Ofrecer mi trabajo
          </Link>
        </nav>

        {/* Auth + Admin + Notifications + Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationBell />

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
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/crear-perfil"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] text-xs font-semibold text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-border)] transition-colors max-w-[160px] truncate"
                title={`Conectado como ${displayName}`}
              >
                <User size={14} className="shrink-0 text-[var(--color-laburante-accent)]" />
                <span className="truncate">{displayName}</span>
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[var(--color-laburante-text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={14} />
                <span>Salir</span>
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/ingresar"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)] transition-colors"
              >
                <LogIn size={16} />
                Ingresar
              </Link>
              <Link
                to="/registrar"
                className="btn-dark px-4 py-2 rounded-xl text-xs font-heading font-semibold shadow-xs"
              >
                Registrarme
              </Link>
            </div>
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
          <Link to="/mis-trabajos" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-[var(--color-laburante-surface-alt)]">
            <Briefcase size={16} /> Mis Trabajos
          </Link>
          <Link to="/como-funciona" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-[var(--color-laburante-surface-alt)]">
            Cómo funciona
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
              <div className="px-4 py-2 text-xs font-semibold text-[var(--color-laburante-text-muted)]">
                Conectado como: <span className="text-[var(--color-laburante-text)]">{displayName}</span>
              </div>
              <Link to="/crear-perfil" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm">
                <User size={16} /> Mi perfil profesional
              </Link>
              <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-rose-600 hover:bg-rose-50 w-full text-left font-medium">
                <LogOut size={16} /> Cerrar sesión
              </button>
            </>
          ) : (
            <div className="pt-2 space-y-2">
              <Link to="/ingresar" onClick={() => setMenuOpen(false)} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-laburante-border)] text-sm font-semibold">
                <LogIn size={16} /> Ingresar
              </Link>
              <Link to="/registrar" onClick={() => setMenuOpen(false)} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl btn-dark text-sm font-semibold">
                Registrarme gratis
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
