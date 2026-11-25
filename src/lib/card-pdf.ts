import { jsPDF } from 'jspdf'
import type { PublicDigitalCardData } from '@/lib/digital-card'
import { formatModality, type WorkModality } from '@/lib/profile-format'
import { generateQrPngDataUrl } from '@/lib/qr-service'

export function getDigitalCardContactHref(type: string, value: string): string | undefined {
  const clean = value.trim()
  switch (type) {
    case 'whatsapp': {
      const digits = clean.replace(/\D/g, '')
      return digits ? `https://wa.me/${digits}` : undefined
    }
    case 'telefono':
      return `tel:${clean.replace(/[^\d+]/g, '')}`
    case 'email':
      return `mailto:${clean}`
    case 'web':
    case 'portfolio':
      return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
    case 'instagram': {
      const handle = clean.replace(/^@/, '').trim()
      return `https://instagram.com/${handle}`
    }
    case 'linkedin':
      return /^https?:\/\//i.test(clean) ? clean : `https://linkedin.com/in/${clean}`
    default:
      return undefined
  }
}

export function formatDigitalCardContactDisplay(type: string, value: string): string {
  const clean = value.trim()
  switch (type) {
    case 'whatsapp':
      return `WhatsApp: ${clean}`
    case 'telefono':
      return `Tel: ${clean}`
    case 'email':
      return `Email: ${clean}`
    case 'instagram':
      return `Instagram: ${clean.startsWith('@') ? clean : `@${clean}`}`
    case 'linkedin':
      return `LinkedIn: ${clean.replace(/^https?:\/\/(www\.)?/i, '')}`
    case 'portfolio':
      return `Portafolio: ${clean.replace(/^https?:\/\//i, '')}`
    case 'web':
    default:
      return `Web: ${clean.replace(/^https?:\/\//i, '')}`
  }
}

function loadPhotoDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => resolve(null), 3500)
    img.onload = () => {
      window.clearTimeout(timer)
      try {
        const size = 192
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    img.src = src
  })
}

/**
 * Genera y descarga la tarjeta digital unificada en formato PDF vectorial,
 * con texto seleccionable/copiable, links clicables reales y el código QR embebido.
 */
export async function downloadDigitalCardAsPdf(
  card: PublicDigitalCardData,
  cardUrl: string,
  filenameSlug?: string
): Promise<void> {
  const pageW = 148 // A5 ancho (mm)
  const margin = 8
  const cardX = margin
  const cardW = pageW - margin * 2
  const padX = 7
  const contentW = cardW - padX * 2

  const probe = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, 210] })

  const locationText = [card.localidad, card.provincia].filter(Boolean).join(', ')
  const modalityText = card.modalidad
    ? formatModality(card.modalidad as WorkModality, card.hybrid_presencial_pct, card.hybrid_remoto_pct)
    : ''
  const availabilityText = card.disponibilidad
    ? card.disponibilidad === 'disponible'
      ? 'Disponible'
      : card.disponibilidad
    : ''
  const metaLine = [locationText, modalityText, availabilityText].filter(Boolean).join(' · ')

  probe.setFont('helvetica', 'bold')
  probe.setFontSize(13)
  const nameLines = probe.splitTextToSize(card.name || 'Profesional LABURANTE', contentW - 22) as string[]

  probe.setFont('helvetica', 'bold')
  probe.setFontSize(9.5)
  const headlineLines = card.headline
    ? (probe.splitTextToSize(card.headline, contentW - 22) as string[]).slice(0, 2)
    : []

  probe.setFont('helvetica', 'normal')
  probe.setFontSize(8)
  const bioLines = card.bio ? (probe.splitTextToSize(card.bio, contentW) as string[]).slice(0, 3) : []

  const skills = (card.skills || []).slice(0, 6)
  const skillsText = skills.length > 0 ? `Especialidades: ${skills.join(' · ')}` : ''
  const skillsLines = skillsText ? (probe.splitTextToSize(skillsText, contentW) as string[]).slice(0, 2) : []

  const services = (card.services || []).slice(0, 3)
  const servicesText =
    services.length > 0
      ? `Servicios: ${services
          .map((s) => (s.precio_orientativo ? `${s.title} (${s.precio_orientativo})` : s.title))
          .join(' · ')}`
      : ''
  const servicesLines = servicesText ? (probe.splitTextToSize(servicesText, contentW) as string[]).slice(0, 2) : []

  const languages = card.languages || []
  const langText =
    languages.length > 0 ? `Idiomas: ${languages.map((l) => `${l.language} (${l.level})`).join(', ')}` : ''
  const langLines = langText ? (probe.splitTextToSize(langText, contentW) as string[]).slice(0, 2) : []

  const contacts = card.contacts || []

  // Calcular altura exacta del documento
  let bodyH = 12 // header bar
  bodyH += Math.max(18, nameLines.length * 5.2 + headlineLines.length * 4 + (metaLine ? 4.5 : 0) + (card.whatsapp_verified ? 4 : 0)) + 4
  if (card.zona_trabajo) bodyH += 4.5
  if (bioLines.length > 0) bodyH += bioLines.length * 3.8 + 4
  if (skillsLines.length > 0) bodyH += skillsLines.length * 3.8 + 3
  if (servicesLines.length > 0) bodyH += servicesLines.length * 3.8 + 3
  if (langLines.length > 0) bodyH += langLines.length * 3.8 + 3
  const bottomSectionH = Math.max(38, contacts.length * 5.4 + 10)
  bodyH += bottomSectionH + 10 // footer

  const pageH = Math.max(96, margin * 2 + bodyH)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageW, pageH],
    compress: true,
  })

  // Fondo crema
  doc.setFillColor(250, 250, 247)
  doc.rect(0, 0, pageW, pageH, 'F')

  // Tarjeta blanca con borde
  const cardH = pageH - margin * 2
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(229, 229, 223)
  doc.setLineWidth(0.35)
  doc.roundedRect(cardX, margin, cardW, cardH, 3.5, 3.5, 'FD')

  // Header oscuro + línea acento
  doc.setFillColor(18, 19, 36)
  doc.roundedRect(cardX, margin, cardW, 10, 3.5, 3.5, 'F')
  doc.rect(cardX, margin + 6, cardW, 4, 'F')
  doc.setFillColor(245, 166, 35)
  doc.rect(cardX, margin + 10, cardW, 0.9, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('LABURANTE', cardX + padX, margin + 6.4)

  doc.setTextColor(245, 166, 35)
  doc.setFontSize(7)
  doc.text('TARJETA DIGITAL', cardX + cardW - padX, margin + 6.2, { align: 'right' })

  // Identidad (Foto + Nombre + Headline + Meta)
  let y = margin + 15
  const avatarSize = 16
  const avatarX = cardX + padX
  const avatarY = y

  const photoDataUrl = card.photo_url ? await loadPhotoDataUrl(card.photo_url) : null
  if (photoDataUrl) {
    doc.addImage(photoDataUrl, 'PNG', avatarX, avatarY, avatarSize, avatarSize)
  } else {
    doc.setFillColor(18, 19, 36)
    doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'F')
    const initials = (card.name || 'L')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(initials, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1.5, { align: 'center' })
  }

  const infoX = avatarX + avatarSize + 4.5
  let infoY = avatarY + 4

  doc.setTextColor(26, 26, 46)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  for (const line of nameLines) {
    doc.text(line, infoX, infoY)
    infoY += 5.2
  }

  if (headlineLines.length > 0) {
    doc.setTextColor(217, 119, 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    for (const line of headlineLines) {
      doc.text(line, infoX, infoY)
      infoY += 4
    }
  }

  if (metaLine) {
    doc.setTextColor(82, 82, 91)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    const metaWrapped = (doc.splitTextToSize(metaLine, contentW - 22) as string[]).slice(0, 2)
    for (const line of metaWrapped) {
      doc.text(line, infoX, infoY)
      infoY += 3.6
    }
  }

  if (card.whatsapp_verified) {
    doc.setTextColor(4, 120, 87)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('✓ WhatsApp verificado en LABURANTE', infoX, infoY + 0.5)
    infoY += 3.8
  }

  y = Math.max(avatarY + avatarSize, infoY) + 3.5

  if (card.zona_trabajo) {
    doc.setTextColor(82, 82, 91)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(`Zona habitual: ${card.zona_trabajo}`, cardX + padX, y)
    y += 4.2
  }

  if (bioLines.length > 0) {
    doc.setFillColor(250, 250, 247)
    doc.roundedRect(cardX + padX, y - 2.5, contentW, bioLines.length * 3.8 + 3, 1.5, 1.5, 'F')
    doc.setTextColor(63, 63, 70)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const line of bioLines) {
      doc.text(line, cardX + padX + 2, y + 0.8)
      y += 3.8
    }
    y += 3.5
  }

  if (skillsLines.length > 0) {
    doc.setTextColor(26, 26, 46)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    for (const line of skillsLines) {
      doc.text(line, cardX + padX, y)
      y += 3.8
    }
    y += 1.5
  }

  if (servicesLines.length > 0) {
    doc.setTextColor(26, 26, 46)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    for (const line of servicesLines) {
      doc.text(line, cardX + padX, y)
      y += 3.8
    }
    y += 1.5
  }

  if (langLines.length > 0) {
    doc.setTextColor(82, 82, 91)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    for (const line of langLines) {
      doc.text(line, cardX + padX, y)
      y += 3.8
    }
    y += 1.5
  }

  // Línea divisoria antes de Contactos + QR
  y += 1
  doc.setDrawColor(229, 229, 223)
  doc.line(cardX + padX, y, cardX + cardW - padX, y)
  y += 4.5

  // Columna derecha: QR + URL clicable
  // qrMarginR: margen interno derecho adicional para que el QR no llegue al borde del card
  const qrSize = 26
  const qrMarginR = 2
  const qrX = cardX + cardW - padX - qrSize - qrMarginR
  const qrY = y
  const qrPng = await generateQrPngDataUrl(cardUrl, 512)
  doc.addImage(qrPng, 'PNG', qrX, qrY, qrSize, qrSize)

  const shortUrl = cardUrl.replace(/^https?:\/\//i, '')
  doc.setTextColor(79, 70, 229)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  // Centrar la URL sobre el QR (no sobre la página)
  const urlCenterX = qrX + qrSize / 2
  const urlLines = doc.splitTextToSize(shortUrl, qrSize + 2) as string[]
  let urlY = qrY + qrSize + 3
  for (const line of urlLines.slice(0, 2)) {
    doc.textWithLink(line, urlCenterX, urlY, { url: cardUrl, align: 'center' })
    urlY += 2.8
  }

  // Columna izquierda: Contactos autorizados con link clicable y texto copiable
  // leftW: ancho disponible desde el inicio del contenido hasta 4mm antes del QR
  const leftW = qrX - (cardX + padX) - 4
  let contactY = y + 2
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(113, 113, 122)
  doc.text('CONTACTO DIRECTO', cardX + padX, contactY)
  contactY += 4.5

  if (contacts.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(113, 113, 122)
    doc.text('Escaneá el QR o abrí el enlace para ver el perfil.', cardX + padX, contactY)
  } else {
    for (const contact of contacts) {
      const display = formatDigitalCardContactDisplay(contact.type, contact.value)
      const href = getDigitalCardContactHref(contact.type, contact.value)
      const clipped = (doc.splitTextToSize(display, leftW) as string[])[0] || display

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      if (href) {
        doc.setTextColor(37, 99, 235)
        doc.textWithLink(clipped, cardX + padX, contactY, { url: href })
      } else {
        doc.setTextColor(26, 26, 46)
        doc.text(clipped, cardX + padX, contactY)
      }
      contactY += 5.2
    }
  }

  // Footer
  doc.setTextColor(113, 113, 122)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.text('Tarjeta digital oficial de LABURANTE · Conexión laboral argentina', pageW / 2, margin + cardH - 3, {
    align: 'center',
  })

  const cleanSlug = (filenameSlug || card.slug || card.card_key || 'profesional')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')

  doc.save(`tarjeta-laburante-${cleanSlug || 'contacto'}.pdf`)
}
