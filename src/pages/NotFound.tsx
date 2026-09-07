import { Link } from 'react-router-dom'
import { ArrowLeft, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="container py-24 text-center max-w-md mx-auto space-y-4">
      <span className="font-heading text-6xl font-extrabold text-[var(--color-laburante-text)]/20">
        404
      </span>
      <h1 className="font-heading text-2xl font-bold text-[var(--color-laburante-text)]">
        Página no encontrada
      </h1>
      <p className="text-xs sm:text-sm text-[var(--color-laburante-text-secondary)] leading-relaxed">
        La dirección a la que intentaste acceder no existe o fue movida.
      </p>
      <div className="pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-laburante-text)] text-white text-xs font-heading font-semibold hover:bg-black transition-colors"
        >
          <Home size={14} />
          Volver a la portada de LABURANTE
        </Link>
      </div>
    </div>
  )
}
