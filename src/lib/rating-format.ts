export function formatRating(value: number | null | undefined) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return '0'

  const safeValue = Math.max(0, Math.min(5, numericValue))
  return safeValue.toFixed(1).replace(/\.0$/, '')
}
