import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useProfileStore } from '@/stores/profile-store'
import { isCompanyAccount } from '@/lib/account'
import { Menu, X, Search, UserPlus, LogIn, LogOut, User, ShieldAlert, Briefcase, Building2, LayoutGrid, CircleHelp, LifeBuoy } from 'lucide-react'
import NotificationBell from '@/components/notifications/NotificationBell'
import { hasProviderContent, normalizeProfileIntent } from '@/lib/profile-publication'
import { useNotificationStore } from '@/stores/notification-store'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, isAdmin, signOut } = useAuthStore()
  const { myProfile, fetchMyProfile } = useProfileStore()
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const [profileChecked, setProfileChecked] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => location.pathname === path

  const handleSignOut = async () => {
    await signOut()
    setMenuOpen(false)
    navigate('/')
  }

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Mi cuenta'
  const companyAccount = isCompanyAccount(user, myProfile)
  const hasProviderProfile = myProfile ? hasProviderContent(myProfile) : false
  const declaredIntent = normalizeProfileIntent(myProfile?.intent) || normalizeProfileIntent(user?.user_metadata?.intent)
  const hasProviderIntent = declaredIntent === 'ofrecer' || declaredIntent === 'ambas'
  const showOfferLink = !companyAccount && (!user || (profileChecked && !hasProviderProfile))
  const accountPath = companyAccount ? '/empresa' : '/crear-perfil'
  const offerLabel = user && myProfile && hasProviderIntent && !hasProviderProfile
    ? 'Completar perfil profesional'
    : 'Ofrecer mi trabajo'

  useEffect(() => {
    let active = true
    if (!user) {
      setProfileChecked(true)
      return
    }
    setProfileChecked(false)
    fetchMyProfile().finally(() => {
      if (active) setProfileChecked(true)
    })
    return () => { active = false }
  }, [user, fetchMyProfile])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!menuOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  const mobileLinkClass = (path: string) => `flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors ${
    isActive(path) || (path === '/mis-trabajos' && (isActive('/pedidos') || isActive('/mis-trabajos')))
      ? 'bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)]'
      : 'text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)] hover:text-[var(--color-laburante-text)]'
  }`

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
          {companyAccount ? (
            <Link
              to="/empresa"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/empresa')
                  ? 'bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)]'
                  : 'text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]'
              }`}
            >
              <Building2 size={16} />
              Espacio Empresa
            </Link>
          ) : (
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
              {unreadCount > 0 && (
                <span className="ml-0.5 h-2 w-2 rounded-full bg-rose-500" aria-label="Hay novedades" />
              )}
            </Link>
          )}
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
          {!companyAccount && <Link
            to="/empresas"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive('/empresas')
                ? 'bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)]'
                : 'text-[var(--color-laburante-text-secondary)] hover:text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]'
            }`}
          >
            <Building2 size={16} />
            Empresas
          </Link>}
          {showOfferLink && <Link
            to={accountPath}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-laburante-accent)] hover:bg-amber-50 transition-colors"
          >
            <UserPlus size={16} />
            {offerLabel}
          </Link>}
        </nav>

        {/* Auth + Admin + Notifications + Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/buscar"
            className="md:hidden inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] px-2.5 text-xs font-semibold text-[var(--color-laburante-text)] shadow-xs transition-colors hover:bg-[var(--color-laburante-surface-alt)]"
            aria-label="Buscar personas"
          >
            <Search size={16} aria-hidden="true" />
            <span className="hidden min-[380px]:inline">Buscar</span>
          </Link>
          <NotificationBell />

          {user && (
            <Link
              to="/soporte"
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-surface-alt)] hover:text-[var(--color-laburante-text)]"
              aria-label="Solicitar soporte"
            >
              <LifeBuoy size={15} />
              Soporte
            </Link>
          )}

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
                to={accountPath}
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
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="md:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text)] shadow-xs transition-colors hover:border-[var(--color-laburante-border-hover)] hover:bg-[var(--color-laburante-border)]"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
          >
            {menuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 top-16 z-40 bg-slate-950/25 md:hidden"
            onClick={closeMenu}
          />
          <div
            id="mobile-navigation"
            className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-xl md:hidden"
            role="dialog"
            aria-label="Navegación principal"
          >
            <nav className="space-y-4">
              <div>
                <p className="px-3.5 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-laburante-text-muted)]">Explorar</p>
                <div className="space-y-0.5">
                  <Link to="/buscar" onClick={closeMenu} className={mobileLinkClass('/buscar')}>
                    <Search size={17} aria-hidden="true" /> Buscar personas
                  </Link>
                  <Link to="/categorias" onClick={closeMenu} className={mobileLinkClass('/categorias')}>
                    <LayoutGrid size={17} aria-hidden="true" /> Categorías
                  </Link>
                  <Link to="/como-funciona" onClick={closeMenu} className={mobileLinkClass('/como-funciona')}>
                    <CircleHelp size={17} aria-hidden="true" /> Cómo funciona
                  </Link>
                  {!companyAccount && (
                    <Link to="/empresas" onClick={closeMenu} className={mobileLinkClass('/empresas')}>
                      <Building2 size={17} aria-hidden="true" /> Empresas
                    </Link>
                  )}
                  {user && <Link to="/soporte" onClick={closeMenu} className={mobileLinkClass('/soporte')}><LifeBuoy size={17} aria-hidden="true" /> Solicitar soporte</Link>}
                </div>
              </div>

              <div>
                <p className="px-3.5 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-laburante-text-muted)]">Tu espacio</p>
                <div className="space-y-0.5">
                  {companyAccount ? (
                    <Link to="/empresa" onClick={closeMenu} className={mobileLinkClass('/empresa')}>
                      <Building2 size={17} aria-hidden="true" /> Espacio Empresa
                      {unreadCount > 0 && <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">Novedades</span>}
                    </Link>
                  ) : (
                    <Link to="/mis-trabajos" onClick={closeMenu} className={mobileLinkClass('/mis-trabajos')}>
                      <Briefcase size={17} aria-hidden="true" /> Mis trabajos
                      {unreadCount > 0 && <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">Novedades</span>}
                    </Link>
                  )}
                  {showOfferLink && (
                    <Link to={accountPath} onClick={closeMenu} className={`${mobileLinkClass(accountPath)} text-[var(--color-laburante-accent)]`}>
                      <UserPlus size={17} aria-hidden="true" /> {offerLabel}
                    </Link>
                  )}
                  {isAdmin && (
                    <Link to="/admin" onClick={closeMenu} className="flex min-h-11 items-center gap-3 rounded-xl bg-indigo-50 px-3.5 py-3 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-100">
                      <ShieldAlert size={17} aria-hidden="true" /> Panel de administración
                    </Link>
                  )}
                </div>
              </div>

              <div className="border-t border-[var(--color-laburante-border)] pt-3">
                {user ? (
                  <div className="space-y-1">
                    <p className="px-3.5 pb-1 text-xs text-[var(--color-laburante-text-muted)]">
                      Conectado como <span className="font-semibold text-[var(--color-laburante-text)]">{displayName}</span>
                    </p>
                    <Link to={accountPath} onClick={closeMenu} className={mobileLinkClass(accountPath)}>
                      <User size={17} aria-hidden="true" /> {companyAccount ? 'Espacio Empresa' : 'Mi perfil profesional'}
                    </Link>
                    <button type="button" onClick={handleSignOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50">
                      <LogOut size={17} aria-hidden="true" /> Cerrar sesión
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 px-1">
                    <Link to="/ingresar" onClick={closeMenu} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-laburante-border)] px-3 text-sm font-semibold text-[var(--color-laburante-text)] transition-colors hover:bg-[var(--color-laburante-surface-alt)]">
                      <LogIn size={16} aria-hidden="true" /> Ingresar
                    </Link>
                    <Link to="/registrar" onClick={closeMenu} className="btn-dark flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold">
                      Registrarme
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  )
}
