export function normalizeProfileLocation(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function hasValidProfileLocation(profile: { provincia?: unknown; localidad?: unknown }): boolean {
  return Boolean(normalizeProfileLocation(profile.provincia) && normalizeProfileLocation(profile.localidad))
}

export function formatProfileLocation(
  profile: { provincia?: unknown; localidad?: unknown },
  fallback = 'Ubicación no informada',
): string {
  const parts = [profile.localidad, profile.provincia]
    .map(normalizeProfileLocation)
    .filter(Boolean)
  return parts.length ? parts.join(', ') : fallback
}

