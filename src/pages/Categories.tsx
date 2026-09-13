import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES } from '@/data/categories'
import { Search, ChevronRight } from 'lucide-react'
import { normalizeSearchText } from '@/lib/search-intent'

export default function Categories() {
  const [query, setQuery] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const normalizedQuery = normalizeSearchText(query)
  const visibleCategories = CATEGORIES.filter((category) => !category.hidden).map((category) => {
    const categoryMatches = normalizeSearchText(category.name).includes(normalizedQuery)
    const subcategories = category.subcategories || []
    const matchingSubcategories = subcategories.filter((subcategory) => normalizeSearchText(subcategory).includes(normalizedQuery))
    return { category, subcategories: !normalizedQuery || categoryMatches ? subcategories : matchingSubcategories }
  }).filter(({ category, subcategories }) => !normalizedQuery || normalizeSearchText(category.name).includes(normalizedQuery) || subcategories.length > 0)

  return (
    <div className="container py-8 md:py-12 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[var(--color-laburante-text)] tracking-tight">
          Todas las categorías de oficios y servicios
        </h1>
        <p className="text-sm text-[var(--color-laburante-text-secondary)] mt-1">
          Elegí el rubro que estás buscando o donde querés ofrecer tu trabajo.
        </p>
        <label className="relative mt-5 block max-w-xl">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-laburante-text-muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar una categoría u oficio"
            aria-label="Buscar una categoría u oficio"
            className="w-full rounded-xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] py-3 pl-10 pr-4 text-sm text-[var(--color-laburante-text)] outline-none focus:border-[var(--color-laburante-indigo)] focus:ring-2 focus:ring-[var(--color-laburante-indigo)]/20"
          />
        </label>
      </div>

      {visibleCategories.length > 0 ? (
        <div className="grid items-stretch grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleCategories.map(({ category: cat, subcategories }) => (
          <div
            key={cat.id}
            className={`h-full min-h-[280px] rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-6 space-y-4 hover:border-[var(--color-laburante-indigo)] transition-all flex flex-col justify-between ${expandedCategory === cat.id ? 'md:col-span-2 lg:col-span-3' : ''}`}
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{cat.icon}</span>
                <h2 className="font-heading text-lg font-bold text-[var(--color-laburante-text)]">
                  {cat.name}
                </h2>
              </div>

              {subcategories && subcategories.length > 0 && (() => {
                const isExpanded = expandedCategory === cat.id
                const visibleSubcategories = isExpanded ? subcategories : subcategories.slice(0, 6)
                const remaining = subcategories.length - visibleSubcategories.length
                return (
                <>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {visibleSubcategories.map((sub, idx) => (
                    <Link
                      key={idx}
                      to={`/buscar?q=${encodeURIComponent(sub)}`}
                      className="text-xs px-2.5 py-1 rounded-md bg-[var(--color-laburante-surface-alt)] text-[var(--color-laburante-text-secondary)] hover:bg-[var(--color-laburante-border)] transition-colors"
                    >
                      {sub}
                    </Link>
                  ))}
                </div>
                {remaining > 0 || isExpanded ? <button type="button" onClick={() => setExpandedCategory(isExpanded ? null : cat.id)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-laburante-border)] px-2.5 py-1.5 text-xs font-bold text-[var(--color-laburante-indigo)] hover:bg-[var(--color-laburante-surface-alt)]"><span>{isExpanded ? 'Ocultar especialidades' : `+${remaining} especialidades`}</span><ChevronRight size={13} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} /></button> : null}
                </>
                )
              })()}
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
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-laburante-border)] p-8 text-center text-sm text-[var(--color-laburante-text-secondary)]">
          No encontramos categorías u oficios con “{query}”.
        </div>
      )}
    </div>
  )
}
