import { LUKSON_PROJECTS, LUKSON_ARTS_URL, type LuksonProject } from '@/data/lukson-universe'
import { ExternalLink } from 'lucide-react'

function ProjectCard({ project }: { project: LuksonProject }) {
  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-[var(--color-lukson-border)] bg-[var(--color-lukson-card)] p-5 transition-all duration-300 hover:border-opacity-30 hover:shadow-lg hover:shadow-[var(--color-lukson-grad-2)]/10 hover:-translate-y-0.5"
      style={{ borderColor: `${project.accent}22` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.accent, boxShadow: `0 0 8px ${project.accent}60` }}
            />
            <span className="font-heading text-sm font-semibold text-[var(--color-lukson-text-bright)] tracking-wide">
              {project.name}
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: project.accent }}>
            {project.category}
          </p>
          <p className="text-xs text-[var(--color-lukson-text)] leading-relaxed line-clamp-2">
            {project.summary}
          </p>
        </div>
        <ExternalLink
          size={14}
          className="flex-shrink-0 mt-1 text-[var(--color-lukson-text)] opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
    </a>
  )
}

export default function LuksonUniverse() {
  return (
    <section className="bg-[var(--color-lukson-bg)] text-[var(--color-lukson-text)]">
      {/* Transition gradient from LABURANTE warm to Lukson dark */}
      <div className="h-16 bg-gradient-to-b from-[var(--color-laburante-surface)] to-[var(--color-lukson-bg)]" />

      <div className="container pb-16">
        {/* Universe Header */}
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-lukson-text)] mb-3">
            Esto es LABURANTE. Pero no es todo.
          </p>
          <a
            href={LUKSON_ARTS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block group"
          >
            <h3 className="font-heading text-2xl md:text-3xl font-bold text-[var(--color-lukson-text-bright)] tracking-tight group-hover:text-[var(--color-lukson-grad-3)] transition-colors">
              LUKSON ARTS
            </h3>
          </a>
          <p className="mt-2 text-sm text-[var(--color-lukson-text)] max-w-md mx-auto">
            Un universo de proyectos, juegos, ideas y experimentos.
          </p>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {LUKSON_PROJECTS.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>

        {/* Explore CTA */}
        <div className="text-center mt-10">
          <a
            href={LUKSON_ARTS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[var(--color-lukson-border)] text-sm font-medium text-[var(--color-lukson-text)] hover:text-[var(--color-lukson-text-bright)] hover:border-[var(--color-lukson-grad-2)] hover:shadow-lg hover:shadow-[var(--color-lukson-grad-2)]/20 transition-all"
          >
            Explorar Lukson Arts
            <ExternalLink size={14} />
          </a>
        </div>

        {/* Credits */}
        <div className="mt-12 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--color-lukson-text)]/50">
          LABURANTE es una creación de Lukson Arts
        </div>
      </div>
    </section>
  )
}
