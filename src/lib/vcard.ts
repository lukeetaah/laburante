/**
 * Generador de archivos de contacto vCard (formato estándar vCard 3.0)
 * Solo incorpora datos que hayan sido expresamente autorizados por el usuario.
 */

export interface VCardContactData {
  name: string
  title?: string
  org?: string
  phone?: string
  whatsapp?: string
  email?: string
  url?: string
  city?: string
  region?: string
  note?: string
}

function escapeVCardText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export function generateVCardString(data: VCardContactData): string {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCardText(data.name)}`,
    `N:${escapeVCardText(data.name)};;;;`,
  ]

  if (data.title) {
    lines.push(`TITLE:${escapeVCardText(data.title)}`)
  }

  if (data.org) {
    lines.push(`ORG:${escapeVCardText(data.org)}`)
  }

  if (data.phone) {
    lines.push(`TEL;TYPE=CELL,VOICE:${data.phone}`)
  }

  if (data.whatsapp && data.whatsapp !== data.phone) {
    lines.push(`TEL;TYPE=WORK,MSG:${data.whatsapp}`)
  }

  if (data.email) {
    lines.push(`EMAIL;TYPE=INTERNET,HOME:${data.email}`)
  }

  if (data.url) {
    lines.push(`URL:${data.url}`)
  }

  if (data.city || data.region) {
    lines.push(`ADR;TYPE=WORK:;;;${escapeVCardText(data.city || '')};${escapeVCardText(data.region || '')};;Argentina`)
  }

  if (data.note) {
    lines.push(`NOTE:${escapeVCardText(data.note)}`)
  }

  lines.push('END:VCARD')
  return lines.join('\r\n')
}

export function downloadVCard(data: VCardContactData, filename = 'contacto.vcf'): void {
  const vcardText = generateVCardString(data)
  const blob = new Blob([vcardText], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename.endsWith('.vcf') ? filename : `${filename}.vcf`
  link.href = url
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
