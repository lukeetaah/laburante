import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, MapPin, Filter, Briefcase, Sparkles, X, PlusCircle } from 'lucide-react'
import { useProfileStore } from '@/stores/profile-store'
import ProfileCard from '@/components/profile/ProfileCard'
import { PROVINCES } from '@/data/provinces'
import { CATEGORIES } from '@/data/categories'
import { Link } from 'react-router-dom'
import { interpretSearch, inferCategory } from '@/lib/search-intent'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [provincia, setProvincia] = useState(searchParams.get('provincia') || '')
  const [localidad, setLocalidad] = useState(searchParams.get('localidad') || '')
  const [category, setCategory] = useState(searchParams.get('categoria') || '')
  const [modalidad, setModalidad] = useState(searchParams.get('modalidad') || 'todas')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const { profiles, loading, fetchProfiles } = useProfileStore()
  const interpretation = query.trim() ? interpretSearch(query) : null
  const inferredCategory = query.trim() ? inferCategory(query) : undefined

  // Sync state with URL params
  useEffect(() => {
    fetchProfiles({
      query: searchParams.get('q') || undefined,
      provincia: searchParams.get('provincia') || undefined,
      localidad: searchParams.get('localidad') || undefined,
      category: searchParams.get('categoria') || undefined,
      modalidad: searchParams.get('modalidad') || undefined,
    })
  }, [searchParams, fetchProfiles])

  // Keep results live while the user edits filters, without querying on every keystroke.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (provincia) params.set('provincia', provincia)
      if (localidad.trim()) params.set('localidad', localidad.trim())
      if (category) params.set('categoria', category)
      if (modalidad && modalidad !== 'todas') params.set('modalidad', modalidad)
      if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true })
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [query, provincia, localidad, category, modalidad, searchParams, setSearchParams])

  useEffect(() => {
    if (!mobileFiltersOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFiltersOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileFiltersOpen])

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (provincia) params.set('provincia', provincia)
    if (localidad.trim()) params.set('localidad', localidad.trim())
    if (category) params.set('categoria', category)
    if (modalidad && modalidad !== 'todas') params.set('modalidad', modalidad)
    setSearchParams(params)
    setMobileFiltersOpen(false)
  }

  const handleClearFilters = () => {
    setQuery('')
    setProvincia('')
    setLocalidad('')
    setCategory('')
    setModalidad('todas')
    setSearchParams(new URLSearchParams())
  }

  const activeFilterCount = [
    provincia,
    localidad.trim(),
    category,
    modalidad !== 'todas' ? modalidad : '',
  ].filter(Boolean).length

  const clearOneFilter = (filter: 'provincia' | 'localidad' | 'category' | 'modalidad') => {
    if (filter === 'provincia') setProvincia('')
    if (filter === 'localidad') setLocalidad('')
    if (filter === 'category') setCategory('')
    if (filter === 'modalidad') setModalidad('todas')
  }

  return (
    <div className="container py-8 md:py-12">
      {/* Top Search Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)] tracking-tight">
          Encontrá a la persona indicada para lo que necesitás
        </h1>
        <p className="text-sm text-[var(--color-laburante-text-secondary)] mt-1">
          Desde un oficio o un proyecto profesional hasta una tarea puntual: describilo con tus palabras y filtrá por zona o modalidad.
        </p>
      </div>

      {/* Main Grid: Sidebar Filters + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar (Desktop) */}
        <aside className="hidden lg:block lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-laburante-border)]">
              <div className="flex items-center gap-2 font-heading font-semibold text-sm text-[var(--color-laburante-text)]">
                <Filter size={16} />
                Filtros
                {activeFilterCount > 0 && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{activeFilterCount}</span>}
              </div>
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)] underline"
              >
                Limpiar
              </button>
            </div>

            {/* Keyword */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1.5">
                Oficio, servicio o habilidad
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ej: gasista, diseño..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
              />
            </div>

            {/* Province */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1.5">
                Provincia
              </label>
              <select
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
              >
                <option value="">Todas las provincias</option>
                {PROVINCES.map((p) => (
                  <option key={p.slug} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Localidad */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1.5">
                Localidad o zona
              </label>
              <input
                type="text"
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                placeholder="ej: Palermo, Rosario..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1.5">
                Rubro principal
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
              >
                <option value="">Todos los rubros</option>
                {CATEGORIES.filter((c) => !c.hidden).map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Modality */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-laburante-text)] mb-1.5">
                Modalidad
              </label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] focus:ring-2 focus:ring-[var(--color-laburante-indigo)]"
              >
                <option value="todas">Cualquiera</option>
                <option value="presencial">Presencial</option>
                <option value="remoto">Remoto</option>
                <option value="ambas">Híbrido</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleApplyFilters()}
              className="btn-dark w-full py-2.5 px-4 rounded-xl font-heading font-semibold text-xs shadow-xs"
            >
              Aplicar filtros
            </button>

          </div>

          {interpretation && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-laburante-text-secondary)]">
              <Sparkles size={14} className="text-[var(--color-laburante-accent)]" />
              <span>Entendimos: <strong className="text-[var(--color-laburante-text)]">{interpretation.label}</strong></span>
              {inferredCategory && <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">Rubro sugerido: {inferredCategory}</span>}
            </div>
          )}
        </aside>

        {/* Results Content */}
        <section className="lg:col-span-3 space-y-6" aria-label="Resultados de búsqueda" aria-busy={loading}>
          {/* Quick Search Bar (Mobile + quick inline) */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 relative">
              <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-laburante-text-muted)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                placeholder="Ej: necesito alguien para llevar las redes de mi negocio"
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-sm outline-none focus:border-[var(--color-laburante-indigo)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className={`lg:hidden inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors ${activeFilterCount > 0
                ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                : 'border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-[var(--color-laburante-text)] hover:bg-[var(--color-laburante-surface-alt)]'
              }`}
              aria-label={activeFilterCount > 0 ? `Filtros, ${activeFilterCount} activos` : 'Abrir filtros'}
            >
              <Filter size={18} aria-hidden="true" />
              <span>Filtros</span>
              {activeFilterCount > 0 && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">{activeFilterCount}</span>}
            </button>
            <button
              type="button"
              onClick={() => handleApplyFilters()}
              className="hidden min-h-12 px-5 py-3 rounded-2xl bg-[var(--color-laburante-accent)] text-black font-heading font-bold text-sm hover:bg-[var(--color-laburante-accent-hover)] transition-colors sm:inline-flex sm:items-center sm:justify-center"
            >
              Buscar
            </button>
          </div>

          {/* Results Counter / Active indicators */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-laburante-text-muted)]" aria-live="polite">
            <span>
              {loading ? 'Buscando...' : `${profiles.length} ${profiles.length === 1 ? 'perfil encontrado' : 'perfiles encontrados'}`}
            </span>
            {activeFilterCount > 0 && <span className="font-medium text-[var(--color-laburante-indigo)]">{activeFilterCount} {activeFilterCount === 1 ? 'filtro activo' : 'filtros activos'}</span>}
          </div>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Filtros aplicados">
              {provincia && <button type="button" onClick={() => clearOneFilter('provincia')} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-800 hover:bg-indigo-100">{provincia}<X size={13} aria-hidden="true" /></button>}
              {localidad.trim() && <button type="button" onClick={() => clearOneFilter('localidad')} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-800 hover:bg-indigo-100">{localidad}<X size={13} aria-hidden="true" /></button>}
              {category && <button type="button" onClick={() => clearOneFilter('category')} className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-800 hover:bg-indigo-100"><span className="truncate">{category}</span><X size={13} aria-hidden="true" /></button>}
              {modalidad !== 'todas' && <button type="button" onClick={() => clearOneFilter('modalidad')} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium capitalize text-indigo-800 hover:bg-indigo-100">{modalidad === 'ambas' ? 'Híbrido' : modalidad}<X size={13} aria-hidden="true" /></button>}
              <button type="button" onClick={handleClearFilters} className="min-h-9 px-2 text-xs font-semibold text-[var(--color-laburante-text-muted)] underline underline-offset-2 hover:text-[var(--color-laburante-text)]">Limpiar todo</button>
            </div>
          )}

          {/* Profiles Grid */}
          {loading ? (
            <div className="py-16 text-center text-sm text-[var(--color-laburante-text-muted)]" role="status" aria-live="polite">
              Cargando perfiles...
            </div>
          ) : profiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          ) : (
            /* Honest, encouraging empty state */
            <div className="py-16 px-6 text-center rounded-3xl border-2 border-dashed border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/50 max-w-lg mx-auto space-y-4">
              <div className="h-12 w-12 rounded-full bg-white shadow-xs mx-auto flex items-center justify-center text-[var(--color-laburante-accent)]">
                <Briefcase size={24} />
              </div>
              <h3 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
                Aún no hay perfiles publicados con estos criterios
              </h3>
              <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
                Preferimos mostrarte la realidad: no inventamos perfiles ficticios para rellenar la búsqueda.
                ¿Sabés hacer este trabajo? Publicá tu perfil gratis y sé el primero en tu zona.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/crear-perfil"
                  className="btn-dark px-5 py-2.5 rounded-xl text-xs font-heading font-semibold shadow-xs"
                >
                  Ofrecer mi trabajo gratis
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Mobile Filters Drawer Modal */}
      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setMobileFiltersOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-t-3xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl max-h-[min(90dvh,680px)] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="mobile-filters-title">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-laburante-border)]">
              <div>
                <h3 id="mobile-filters-title" className="font-heading font-bold text-base">Filtros de búsqueda</h3>
                <p className="mt-0.5 text-xs text-[var(--color-laburante-text-muted)]">Refiná los resultados según lo que necesitás.</p>
              </div>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[var(--color-laburante-text-muted)] hover:bg-[var(--color-laburante-surface-alt)] hover:text-[var(--color-laburante-text)]" aria-label="Cerrar filtros">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Provincia</label>
              <select
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--color-laburante-border)] bg-transparent px-3 text-sm"
              >
                <option value="">Todas las provincias</option>
                {PROVINCES.map((p) => (
                  <option key={p.slug} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Localidad o zona</label>
              <input
                type="text"
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                placeholder="ej: Tigre, San Martín..."
                className="min-h-11 w-full rounded-xl border border-[var(--color-laburante-border)] bg-transparent px-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Rubro principal</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--color-laburante-border)] bg-transparent px-3 text-sm"
              >
                <option value="">Todos los rubros</option>
                {CATEGORIES.filter((c) => !c.hidden).map((c) => (
                  <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Modalidad</label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--color-laburante-border)] bg-transparent px-3 text-sm"
              >
                <option value="todas">Cualquiera</option>
                <option value="presencial">Presencial</option>
                <option value="remoto">Remoto</option>
                <option value="ambas">Híbrido</option>
              </select>
            </div>

            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={handleClearFilters}
                className="min-h-12 flex-1 rounded-xl border border-[var(--color-laburante-border)] text-sm font-medium"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => handleApplyFilters()}
                className="btn-dark min-h-12 flex-1 rounded-xl text-sm font-semibold shadow-xs"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
