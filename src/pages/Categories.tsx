import { Link } from 'react-router-dom'
import { CATEGORIES } from '@/data/categories'
import { ArrowRight, ChevronRight } from 'lucide-react'

export default function Categories() {
  return (
    <div className="container py-8 md:py-12 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)] tracking-tight">
          Todas las categorías de oficios y servicios
        </h1>
        <p className="text-sm text-[var(--color-laburante-text-secondary)] mt-1">
          Elegí el rubro que estás buscando o donde querés ofrecer tu trabajo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 space-y-4 hover:border-[var(--color-laburante-indigo)] transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{cat.icon}</span>
                <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
                  {cat.name}
                </h2>
              </div>

              {cat.subcategories && cat.subcategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {cat.subcategories.map((sub, idx) => (
                    <Link
                      key={idx}
                      to={`/buscar?q=${encodeURIComponent(sub)}`}
                      className="text-xs px-2.5 py-1 rounded-md bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-border)] transition-colors"
                    >
                      {sub}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[var(--color-laburante-border)]/60">
              <Link
                to={`/categorias/${cat.slug}`}
                className="font-heading font-semibold text-xs text-[var(--color-laburante-indigo)] hover:underline flex items-center justify-between"
              >
                <span>Ver especialistas de {cat.name}</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
