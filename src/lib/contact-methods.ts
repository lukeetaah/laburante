export interface ContactMethodLike {
  type: string
  value: string
}

function normalizedContactValue(method: ContactMethodLike) {
  const value = method.value.trim()
  if (method.type === 'whatsapp' || method.type === 'telefono') return value.replace(/\D/g, '')
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function dedupeContactMethods<T extends ContactMethodLike>(methods: T[] = []) {
  const seen = new Set<string>()
  return methods.filter((method) => {
    if (!method.value?.trim()) return false
    const key = `${method.type}:${normalizedContactValue(method)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
