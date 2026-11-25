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
      return `Portfolio: ${clean.replace(/^https?:\/\//i, '')}`
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
  filenameSlug?: string,
  options?: { contactsLocked?: boolean }
): Promise<void> {
  // A4 horizontal real (297mm x 210mm) con orientation: 'landscape' para que jsPDF no invierta los ejes
  const pageW = 297
  const pageH = 210
  const margin = 12
  const cardX = margin
  const cardW = pageW - margin * 2
  const padX = 12
  const contentW = cardW - padX * 2

  const probe = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

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

  const avatarSize = 18
  const avatarGap = 5
  const infoW = contentW - avatarSize - avatarGap

  probe.setFont('helvetica', 'bold')
  probe.setFontSize(14)
  const nameLines = probe.splitTextToSize(card.name || 'Profesional LABURANTE', infoW) as string[]

  probe.setFont('helvetica', 'bold')
  probe.setFontSize(10)
  const headlineLines = card.headline
    ? (probe.splitTextToSize(card.headline, infoW) as string[])
    : []

  probe.setFont('helvetica', 'normal')
  probe.setFontSize(8.5)
  const metaLines = metaLine ? (probe.splitTextToSize(metaLine, infoW) as string[]) : []
  const zonaLines = card.zona_trabajo
    ? (probe.splitTextToSize(`Zona habitual: ${card.zona_trabajo}`, contentW) as string[])
    : []

  probe.setFont('helvetica', 'normal')
  probe.setFontSize(8.5)
  const bioLines = card.bio ? (probe.splitTextToSize(card.bio, contentW - 6) as string[]) : []

  const skills = card.skills || []

  // Precalcular filas de pills para simulación de altura
  const pillPadX = 3     // padding horizontal dentro del pill (mm)
  const pillPadY = 1.5   // padding vertical dentro del pill (mm)
  const pillGap = 2.5    // separación horizontal entre pills (mm)
  const pillRowH = 6.5   // altura de una fila de pills (mm)
  const pillFontSize = 8.5
  let skillPillRows = 0
  if (skills.length > 0) {
    probe.setFont('helvetica', 'normal')
    probe.setFontSize(pillFontSize)
    let rowX = 0
    skillPillRows = 1
    for (const skill of skills) {
      const tw = probe.getTextWidth(skill)
      const pillW = tw + pillPadX * 2
      if (rowX > 0 && rowX + pillW > contentW) {
        skillPillRows++
        rowX = 0
      }
      rowX += pillW + pillGap
    }
  }

  const services = card.services || []
  const servicesText =
    services.length > 0
      ? `Servicios: ${services
          .map((s) => (s.precio_orientativo ? `${s.title} (${s.precio_orientativo})` : s.title))
          .join(' · ')}`
      : ''
  const servicesLines = servicesText ? (probe.splitTextToSize(servicesText, contentW) as string[]) : []

  const languages = card.languages || []
  const langText =
    languages.length > 0 ? `Idiomas: ${languages.map((l) => `${l.language} (${l.level})`).join(', ')}` : ''
  probe.setFontSize(8)
  const langLines = langText ? (probe.splitTextToSize(langText, contentW) as string[]) : []

  const contacts = options?.contactsLocked ? [] : card.contacts || []

  const qrSize = 34
  const qrX = cardX + cardW - padX - qrSize
  const leftW = qrX - (cardX + padX) - 8

  probe.setFont('helvetica', 'normal')
  probe.setFontSize(8.5)
  const contactBlocks = contacts.map((contact) => {
    const display = formatDigitalCardContactDisplay(contact.type, contact.value)
    const href = getDigitalCardContactHref(contact.type, contact.value)
    const lines = probe.splitTextToSize(display, leftW) as string[]
    return { lines, href }
  })

  const lockLines = options?.contactsLocked
    ? (probe.splitTextToSize('Iniciá sesión en LABURANTE para ver contactos y enlaces.', leftW) as string[])
    : []

  const shortUrl = cardUrl.replace(/^https?:\/\//i, '')
  probe.setFont('helvetica', 'bold')
  probe.setFontSize(8)
  const urlLines = probe.splitTextToSize(shortUrl, contentW - 8) as string[]

  // Simular altura exacta de cada bloque para que no sobre ni falte espacio
  let simY = margin + 17
  let simInfoY = simY + 4.5
  simInfoY += nameLines.length * 5.8
  simInfoY += headlineLines.length * 4.5
  simInfoY += metaLines.length * 4
  if (card.whatsapp_verified) simInfoY += 5
  simY = Math.max(simY + avatarSize, simInfoY) + 4

  if (zonaLines.length > 0) simY += zonaLines.length * 4 + 2
  if (bioLines.length > 0) simY += bioLines.length * 4.2 + 7.5
  if (skillPillRows > 0) simY += skillPillRows * pillRowH + 6
  if (servicesLines.length > 0) simY += servicesLines.length * 4.2 + 2.5
  if (langLines.length > 0) simY += langLines.length * 4 + 2.5

  // Divisor
  simY += 6

  // Zona inferior 2 columnas (Contactos + QR)
  let leftColH = 6.5 // título CONTACTO DIRECTO
  if (options?.contactsLocked) {
    leftColH += lockLines.length * 4.5
  } else if (contactBlocks.length === 0) {
    leftColH += 5
  } else {
    for (const block of contactBlocks) {
      leftColH += block.lines.length * 4.3 + 1.8
    }
  }
  const rightColH = qrSize + 4
  simY += Math.max(leftColH, rightColH) + 3

  // Caja URL completa
  if (cardUrl) {
    simY += urlLines.length * 4.2 + 7
  }

  const cardEndY = simY + 7
  // Si el contenido es más bajo que el A4 horizontal, centramos la tarjeta verticalmente
  const neededCardH = Math.max(120, cardEndY - margin)
  const cardH = Math.min(pageH - margin * 2, neededCardH)
  const cardY = Math.max(margin, (pageH - cardH) / 2)

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  // Fondo crema
  doc.setFillColor(250, 250, 247)
  doc.rect(0, 0, pageW, pageH, 'F')

  // Tarjeta blanca con borde
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(229, 229, 223)
  doc.setLineWidth(0.35)
  doc.roundedRect(cardX, cardY, cardW, cardH, 4, 4, 'FD')

  // Header oscuro + línea acento
  doc.setFillColor(18, 19, 36)
  doc.roundedRect(cardX, cardY, cardW, 11, 4, 4, 'F')
  doc.rect(cardX, cardY + 7, cardW, 4, 'F')
  doc.setFillColor(245, 166, 35)
  doc.rect(cardX, cardY + 11, cardW, 1, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('LABURANTE', cardX + padX, cardY + 7.2)

  doc.setTextColor(245, 166, 35)
  doc.setFontSize(7.5)
  doc.text('TARJETA DIGITAL', cardX + cardW - padX, cardY + 7, { align: 'right' })

  // Identidad (Foto + Nombre + Headline + Meta)
  let y = cardY + 17
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
    doc.setFontSize(11)
    doc.text(initials, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1.5, { align: 'center' })
  }

  const infoX = avatarX + avatarSize + avatarGap
  let infoY = avatarY + 4.5

  doc.setTextColor(26, 26, 46)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  for (const line of nameLines) {
    doc.text(line, infoX, infoY)
    infoY += 5.8
  }

  if (headlineLines.length > 0) {
    doc.setTextColor(217, 119, 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    for (const line of headlineLines) {
      doc.text(line, infoX, infoY)
      infoY += 4.5
    }
  }

  if (metaLines.length > 0) {
    doc.setTextColor(82, 82, 91)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    for (const line of metaLines) {
      doc.text(line, infoX, infoY)
      infoY += 4
    }
  }

  if (card.whatsapp_verified) {
    // Dibujar tilde vectorial en lugar de carácter Unicode (✓) para evitar el bug de espaciado de jsPDF Helvetica
    doc.setDrawColor(4, 120, 87)
    doc.setLineWidth(0.45)
    const cx = infoX + 0.8
    const cy = infoY - 0.5
    doc.line(cx, cy, cx + 1.1, cy + 1.1)
    doc.line(cx + 1.1, cy + 1.1, cx + 3.0, cy - 1.4)

    doc.setTextColor(4, 120, 87)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Número verificado en LABURANTE', infoX + 4.2, infoY + 0.5)
    infoY += 5
  }

  y = Math.max(avatarY + avatarSize, infoY) + 4

  if (zonaLines.length > 0) {
    doc.setTextColor(82, 82, 91)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    for (const line of zonaLines) {
      doc.text(line, cardX + padX, y)
      y += 4
    }
    y += 2
  }

  if (bioLines.length > 0) {
    const bioBoxH = bioLines.length * 4.2 + 4
    doc.setFillColor(250, 250, 247)
    doc.roundedRect(cardX + padX, y - 2.8, contentW, bioBoxH, 2, 2, 'F')
    doc.setTextColor(63, 63, 70)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    for (const line of bioLines) {
      doc.text(line, cardX + padX + 3, y + 0.8)
      y += 4.2
    }
    y += 3.5
  }

  if (skills.length > 0) {
    // Título de sección
    doc.setTextColor(113, 113, 122)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('ESPECIALIDADES', cardX + padX, y)
    y += 4

    // Pills/globitos grises con texto
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(pillFontSize)
    let pillX = cardX + padX
    const pillBaseY = y
    let currentRow = 0

    for (const skill of skills) {
      const tw = doc.getTextWidth(skill)
      const pillW = tw + pillPadX * 2
      const pillH = pillRowH - 1.5

      // Wrap a la siguiente fila si se desborda
      if (pillX > cardX + padX && pillX + pillW > cardX + padX + contentW) {
        currentRow++
        pillX = cardX + padX
      }

      const pillY = pillBaseY + currentRow * pillRowH

      // Fondo gris claro con borde sutil
      doc.setFillColor(232, 230, 225)
      doc.setDrawColor(215, 213, 208)
      doc.setLineWidth(0.2)
      doc.roundedRect(pillX, pillY, pillW, pillH, 2, 2, 'FD')

      // Texto centrado dentro del pill
      doc.setTextColor(42, 42, 54)
      doc.text(skill, pillX + pillPadX, pillY + pillH / 2 + 1.2)

      pillX += pillW + pillGap
    }

    y = pillBaseY + (currentRow + 1) * pillRowH + 2
  }

  if (servicesLines.length > 0) {
    doc.setTextColor(26, 26, 46)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    for (const line of servicesLines) {
      doc.text(line, cardX + padX, y)
      y += 4.2
    }
    y += 2.5
  }

  if (langLines.length > 0) {
    doc.setTextColor(82, 82, 91)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const line of langLines) {
      doc.text(line, cardX + padX, y)
      y += 4
    }
    y += 2.5
  }

  // Línea divisoria antes de Contactos + QR
  y += 1.5
  doc.setDrawColor(229, 229, 223)
  doc.line(cardX + padX, y, cardX + cardW - padX, y)
  y += 4.5

  // Columna derecha: QR
  const qrY = y
  const qrPng = await generateQrPngDataUrl(cardUrl, 512)
  doc.addImage(qrPng, 'PNG', qrX, qrY, qrSize, qrSize)

  doc.setTextColor(113, 113, 122)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('Escaneá para ver', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' })
  doc.text('el perfil completo', qrX + qrSize / 2, qrY + qrSize + 6, { align: 'center' })

  // Columna izquierda: Contactos autorizados con link clicable y texto copiable
  let contactY = y + 2
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(113, 113, 122)
  doc.text('CONTACTO DIRECTO', cardX + padX, contactY)
  contactY += 4.5

  if (options?.contactsLocked) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(113, 113, 122)
    for (const line of lockLines) {
      doc.text(line, cardX + padX, contactY)
      contactY += 4.5
    }
  } else if (contactBlocks.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(113, 113, 122)
    doc.text('Escaneá el QR o abrí el enlace para ver el perfil.', cardX + padX, contactY)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    for (const block of contactBlocks) {
      for (const line of block.lines) {
        if (block.href) {
          doc.setTextColor(37, 99, 235)
          doc.textWithLink(line, cardX + padX, contactY, { url: block.href })
        } else {
          doc.setTextColor(26, 26, 46)
          doc.text(line, cardX + padX, contactY)
        }
        contactY += 4.3
      }
      contactY += 1.8
    }
  }

  y += Math.max(leftColH, rightColH) + 3

  // Caja inferior con la URL completa (nunca cortada)
  if (cardUrl) {
    const urlBoxH = urlLines.length * 4.2 + 4
    doc.setFillColor(244, 242, 237)
    doc.roundedRect(cardX + padX, y - 1, contentW, urlBoxH, 2, 2, 'F')
    doc.setTextColor(79, 70, 229)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    let urlTextY = y + 2.5
    for (const line of urlLines) {
      doc.textWithLink(line, pageW / 2, urlTextY, { url: cardUrl, align: 'center' })
      urlTextY += 4.2
    }
  }

  // Footer
  doc.setTextColor(113, 113, 122)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.2)
  doc.text('Tarjeta digital oficial de LABURANTE · Conexión laboral argentina', pageW / 2, cardY + cardH - 3.5, {
    align: 'center',
  })

  const cleanSlug = (filenameSlug || card.slug || card.card_key || 'profesional')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')

  doc.save(`tarjeta-laburante-${cleanSlug || 'contacto'}.pdf`)
}
