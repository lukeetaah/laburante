import { useParams, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { CATEGORIES } from '@/data/categories'
import { useProfileStore } from '@/stores/profile-store'
import ProfileCard from '@/components/profile/ProfileCard'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const category = CATEGORIES.find((c) => c.slug === slug)

  const { profiles, loading, fetchProfiles } = useProfileStore()

  useEffect(() => {
    if (category) {
      fetchProfiles({ category: category.name })
    }
  }, [category, fetchProfiles])

  if (!category) {
    return (
      <div className="container py-20 text-center">
        <h2 className="font-heading text-2xl font-bold">Categoría no encontrada</h2>
        <Link to="/categorias" className="text-sm text-[var(--color-laburante-indigo)] underline mt-4 inline-block">
          Volver a categorías
        </Link>
      </div>
    )
  }

  return (
    <div className="container py-8 md:py-12 max-w-5xl mx-auto space-y-8">
      <Link
        to="/categorias"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-laburante-text-muted)] hover:text-[var(--color-laburante-text)]"
      >
        <ArrowLeft size={14} />
        Volver a todas las categorías
      </Link>

      <div className="flex items-center gap-4">
        <span className="text-4xl">{category.icon}</span>
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)]">
            {category.name}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] mt-0.5">
            Especialistas, profesionales y trabajadores de este rubro en Argentina.
          </p>
        </div>
      </div>

      {category.subcategories && category.subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4 rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)]">
          <span className="text-xs font-bold text-[var(--color-laburante-text)] self-center mr-2">Especialidades:</span>
          {category.subcategories.map((sub, idx) => (
            <Link
              key={idx}
              to={`/buscar?q=${encodeURIComponent(sub)}`}
              className="text-xs px-3 py-1 rounded-lg bg-[var(--color-laburante-surface-alt)] hover:bg-[var(--color-laburante-border)] text-[var(--color-laburante-text-secondary)] transition-colors"
            >
              {sub}
            </Link>
          ))}
        </div>
      )}

      {/* Profiles list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-lg text-[var(--color-laburante-text)]">
            Personas disponibles en {category.name}
          </h2>
          <Link
            to={`/buscar?categoria=${encodeURIComponent(category.name)}`}
            className="text-xs font-semibold text-[var(--color-laburante-indigo)] hover:underline"
          >
            Filtrar por provincia →
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[var(--color-laburante-text-muted)]">
            Cargando perfiles...
          </div>
        ) : profiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profiles.map((p) => (
              <ProfileCard key={p.id} profile={p} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center rounded-2xl border-2 border-dashed border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface-alt)]/40 p-6 max-w-md mx-auto space-y-3">
            <p className="text-sm font-bold text-[var(--color-laburante-text)]">
              Aún no hay perfiles en {category.name}
            </p>
            <p className="text-xs text-[var(--color-laburante-text-secondary)]">
              ¿Ofrecés servicios en este rubro? Podés publicar tu perfil de forma gratuita.
            </p>
            <Link
              to="/crear-perfil"
              className="inline-block py-2 px-4 rounded-xl bg-[var(--color-laburante-text)] text-white text-xs font-semibold"
            >
              Publicar mi trabajo
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
