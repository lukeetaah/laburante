export type WorkModality = 'presencial' | 'remoto' | 'ambas'

export function formatModality(
  modalidad: WorkModality | string | null | undefined,
  hybridPresencialPct?: number | null,
  hybridRemotoPct?: number | null
) {
  if (modalidad === 'remoto') return 'Remoto'
  if (modalidad === 'ambas') {
    if (typeof hybridPresencialPct === 'number' && typeof hybridRemotoPct === 'number') {
      return `Híbrido (${hybridPresencialPct}% presencial / ${hybridRemotoPct}% remoto)`
    }
    return 'Híbrido'
  }
  return 'Presencial'
}
