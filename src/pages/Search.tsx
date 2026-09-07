import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, MapPin, Filter, Briefcase, Sparkles, X, PlusCircle } from 'lucide-react'
import { useProfileStore } from '@/stores/profile-store'
import ProfileCard from '@/components/profile/ProfileCard'
import { PROVINCES } from '@/data/provinces'
import { CATEGORIES } from '@/data/categories'
import { Link } from 'react-router-dom'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [provincia, setProvincia] = useState(searchParams.get('provincia') || '')
  const [localidad, setLocalidad] = useState(searchParams.get('localidad') || '')
  const [category, setCategory] = useState(searchParams.get('categoria') || '')
  const [modalidad, setModalidad] = useState(searchParams.get('modalidad') || 'todas')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const { profiles, loading, fetchProfiles, includeDevMocks, setIncludeDevMocks } = useProfileStore()

  // Sync state with URL params
  useEffect(() => {
    if (searchParams.get('mock') === '1' && !includeDevMocks) {
      setIncludeDevMocks(true)
    }
    fetchProfiles({
      query: searchParams.get('q') || undefined,
      provincia: searchParams.get('provincia') || undefined,
      localidad: searchParams.get('localidad') || undefined,
      category: searchParams.get('categoria') || undefined,
      modalidad: searchParams.get('modalidad') || undefined,
    })
  }, [searchParams, fetchProfiles, includeDevMocks, setIncludeDevMocks])

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

  return (
    <div className="container py-8 md:py-12">
      {/* Top Search Header */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)] tracking-tight">
          Buscar personas que saben hacer cosas
        </h1>
        <p className="text-sm text-[var(--color-laburante-text-secondary)] mt-1">
          Encontrá oficios, profesiones o servicios por rubro y localidad en toda Argentina.
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
                {CATEGORIES.map((c) => (
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
                <option value="ambas">Ambas</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleApplyFilters()}
              className="btn-dark w-full py-2.5 px-4 rounded-xl font-heading font-semibold text-xs shadow-xs"
            >
              Aplicar filtros
            </button>

            {/* Isolated Development Testing Toggle */}
            <div className="pt-4 border-t border-[var(--color-laburante-border)]">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-[var(--color-laburante-text-secondary)]">
                <input
                  type="checkbox"
                  checked={includeDevMocks}
                  onChange={(e) => setIncludeDevMocks(e.target.checked)}
                  className="rounded border-[var(--color-laburante-border)] text-[var(--color-laburante-indigo)] focus:ring-0"
                />
                <span>Ver perfiles de prueba (MOCK DEV)</span>
              </label>
              <p className="text-[10px] text-[var(--color-laburante-text-muted)] mt-1">
                Útil en desarrollo si aún no hay perfiles reales dados de alta en Supabase.
              </p>
            </div>
          </div>
        </aside>

        {/* Results Content */}
        <main className="lg:col-span-3 space-y-6">
          {/* Quick Search Bar (Mobile + quick inline) */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-laburante-text-muted)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                placeholder="Buscar por oficio, habilidad o palabra clave..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-sm outline-none focus:border-[var(--color-laburante-indigo)]"
              />
            </div>
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden p-3 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-[var(--color-laburante-text)]"
              aria-label="Filtros"
            >
              <Filter size={18} />
            </button>
            <button
              onClick={() => handleApplyFilters()}
              className="hidden sm:inline-flex px-5 py-3 rounded-2xl bg-[var(--color-laburante-accent)] text-black font-heading font-bold text-sm hover:bg-[var(--color-laburante-accent-hover)] transition-colors"
            >
              Buscar
            </button>
          </div>

          {/* Results Counter / Active indicators */}
          <div className="flex items-center justify-between text-xs text-[var(--color-laburante-text-muted)]">
            <span>
              {loading ? 'Buscando...' : `${profiles.length} ${profiles.length === 1 ? 'perfil encontrado' : 'perfiles encontrados'}`}
            </span>
            {(provincia || category || localidad || modalidad !== 'todas') && (
              <span className="text-[var(--color-laburante-indigo)] font-medium">
                Filtros activos
              </span>
            )}
          </div>

          {/* Profiles Grid */}
          {loading ? (
            <div className="py-16 text-center text-sm text-[var(--color-laburante-text-muted)]">
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
                {!includeDevMocks && (
                  <button
                    onClick={() => setIncludeDevMocks(true)}
                    className="text-xs text-[var(--color-laburante-indigo)] hover:underline"
                  >
                    Ver perfiles de prueba de desarrollo
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Filters Drawer Modal */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-laburante-border)]">
              <h3 className="font-heading font-bold text-base">Filtros de búsqueda</h3>
              <button onClick={() => setMobileFiltersOpen(false)} className="p-1 text-[var(--color-laburante-text-muted)]">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Provincia</label>
              <select
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                className="w-full p-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
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
                className="w-full p-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Modalidad</label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value)}
                className="w-full p-2.5 text-sm rounded-xl border border-[var(--color-laburante-border)] bg-transparent"
              >
                <option value="todas">Cualquiera</option>
                <option value="presencial">Presencial</option>
                <option value="remoto">Remoto</option>
                <option value="ambas">Ambas</option>
              </select>
            </div>

            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex-1 py-3 rounded-xl border border-[var(--color-laburante-border)] text-sm font-medium"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => handleApplyFilters()}
                className="btn-dark flex-1 py-3 rounded-xl text-sm font-semibold shadow-xs"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
