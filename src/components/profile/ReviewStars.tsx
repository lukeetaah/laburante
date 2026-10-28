import { Star } from 'lucide-react'
import { formatRating } from '@/lib/rating-format'

interface ReviewStarsProps {
  value: number
  size?: number
  label?: string
}

export default function ReviewStars({ value, size = 16, label }: ReviewStarsProps) {
  const safeValue = Math.max(0, Math.min(5, value))
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={label || `${formatRating(safeValue)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.max(0, Math.min(100, (safeValue - star + 1) * 100))
        return (
          <span key={star} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-slate-300" />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill}%` }}>
              <Star size={size} className="max-w-none fill-amber-400 text-amber-500" />
            </span>
          </span>
        )
      })}
    </span>
  )
}
