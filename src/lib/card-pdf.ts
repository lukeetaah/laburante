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
  // Dimensiones compactas tipo tarjeta digital (ancho fijo proporcional a la vista previa, alto dinámico)
  const margin = 6
  const cardW = 136
  const pageW = cardW + margin * 2 // 148mm
  const cardX = margin
  const padX = 8
  const contentW = cardW - padX * 2 // 120mm

  const probe = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, 200] })

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

  const avatarSize = 15
  const avatarGap = 4
  const infoW = contentW - avatarSize - avatarGap

  probe.setFont('helvetica', 'bold')
  probe.setFontSize(13)
  const nameLines = probe.splitTextToSize(card.name || 'Profesional LABURANTE', infoW) as string[]

  probe.setFont('helvetica', 'bold')
  probe.setFontSize(9.5)
  const headlineLines = card.headline
    ? (probe.splitTextToSize(card.headline, infoW) as string[])
    : []

  probe.setFont('helvetica', 'normal')
  probe.setFontSize(8)
  const metaLines = metaLine ? (probe.splitTextToSize(metaLine, infoW) as string[]) : []
  const zonaLines = card.zona_trabajo
    ? (probe.splitTextToSize(`Zona habitual: ${card.zona_trabajo}`, contentW) as string[])
    : []

  probe.setFont('helvetica', 'normal')
  probe.setFontSize(8)
  const bioLines = card.bio ? (probe.splitTextToSize(card.bio, contentW - 6) as string[]) : []

  const skills = card.skills || []

  // Precalcular filas de pills para simulación de altura
  const pillPadX = 2.6   // padding horizontal dentro del pill (mm)
  const pillGap = 2      // separación horizontal entre pills (mm)
  const pillRowH = 5.6   // altura de una fila de pills (mm)
  const pillFontSize = 7.8
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
  probe.setFont('helvetica', 'normal')
  probe.setFontSize(8)
  const servicesLines = servicesText ? (probe.splitTextToSize(servicesText, contentW) as string[]) : []

  const languages = card.languages || []
  const langText =
    languages.length > 0 ? `Idiomas: ${languages.map((l) => `${l.language} (${l.level})`).join(', ')}` : ''
  probe.setFontSize(7.5)
  const langLines = langText ? (probe.splitTextToSize(langText, contentW) as string[]) : []

  const contacts = options?.contactsLocked ? [] : card.contacts || []

  const qrSize = 27
  const qrX = cardX + cardW - padX - qrSize
  const leftW = qrX - (cardX + padX) - 5

  probe.setFont('helvetica', 'normal')
  probe.setFontSize(8)
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
  const urlLabelText = 'O accedé mediante el link:'
  probe.setFont('helvetica', 'normal')
  probe.setFontSize(7.5)
  const urlLabelW = probe.getTextWidth(urlLabelText)
  probe.setFont('helvetica', 'bold')
  probe.setFontSize(7.5)
  const singleLineUrlW = probe.getTextWidth(shortUrl)
  const urlFitsInline = urlLabelW + 1.5 + singleLineUrlW <= contentW - 6
  const urlLines = urlFitsInline
    ? [shortUrl]
    : (probe.splitTextToSize(shortUrl, contentW - 6) as string[])

  // Simular altura exacta de cada bloque sincronizada con el renderizado
  let simY = margin + 16
  let simInfoY = simY + 4
  simInfoY += nameLines.length * 5.2
  simInfoY += headlineLines.length * 4.2
  simInfoY += metaLines.length * 3.8
  if (card.whatsapp_verified) simInfoY += 4.5
  simY = Math.max(simY + avatarSize, simInfoY) + 3.5

  if (zonaLines.length > 0) simY += zonaLines.length * 3.8 + 1.8
  if (bioLines.length > 0) {
    const bioBoxH = bioLines.length * 3.8 + 3.6
    simY += bioBoxH + 2.5
  }
  if (skillPillRows > 0) simY += 3.5 + skillPillRows * pillRowH + 1.5
  if (servicesLines.length > 0) simY += servicesLines.length * 3.8 + 2
  if (langLines.length > 0) simY += langLines.length * 3.6 + 2

  // Divisor
  simY += 5

  // Zona inferior 2 columnas (Contactos + QR integrados)
  let leftColH = 5.5 // título CONTACTO DIRECTO + margen
  if (options?.contactsLocked) {
    leftColH += lockLines.length * 4
  } else if (contactBlocks.length === 0) {
    leftColH += 4.5
  } else {
    for (const block of contactBlocks) {
      leftColH += block.lines.length * 3.9 + 1.4
    }
  }
  const rightColH = qrSize + 5.5
  simY += Math.max(leftColH, rightColH) + 2.5

  // Caja URL completa
  if (cardUrl) {
    const urlRowCount = urlFitsInline ? 1 : 1 + urlLines.length
    const urlBoxH = urlRowCount * 3.8 + 3.6
    simY += urlBoxH + 2.5
  }

  // Footer
  const cardEndY = simY + 4.5
  const cardH = Math.ceil(cardEndY - margin)
  const pageH = cardH + margin * 2
  const cardY = margin

  const doc = new jsPDF({
    orientation: pageW > pageH ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageW, pageH],
    compress: true,
  })

  // Fondo crema
  doc.setFillColor(250, 250, 247)
  doc.rect(0, 0, pageW, pageH, 'F')

  // Tarjeta blanca con borde
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(229, 229, 223)
  doc.setLineWidth(0.35)
  doc.roundedRect(cardX, cardY, cardW, cardH, 3.5, 3.5, 'FD')

  // Header oscuro + línea acento
  doc.setFillColor(18, 19, 36)
  doc.roundedRect(cardX, cardY, cardW, 10, 3.5, 3.5, 'F')
  doc.rect(cardX, cardY + 6.5, cardW, 3.5, 'F')
  doc.setFillColor(245, 166, 35)
  doc.rect(cardX, cardY + 10, cardW, 0.9, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('LABURANTE', cardX + padX, cardY + 6.5)

  doc.setTextColor(245, 166, 35)
  doc.setFontSize(7)
  doc.text('TARJETA DIGITAL', cardX + cardW - padX, cardY + 6.4, { align: 'right' })

  // Identidad (Foto + Nombre + Headline + Meta)
  let y = cardY + 16
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
    doc.text(initials, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1.3, { align: 'center' })
  }

  const infoX = avatarX + avatarSize + avatarGap
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
      infoY += 4.2
    }
  }

  if (metaLines.length > 0) {
    doc.setTextColor(82, 82, 91)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const line of metaLines) {
      doc.text(line, infoX, infoY)
      infoY += 3.8
    }
  }

  if (card.whatsapp_verified) {
    // Dibujar tilde vectorial en lugar de carácter Unicode (✓) para evitar el bug de espaciado de jsPDF Helvetica
    doc.setDrawColor(4, 120, 87)
    doc.setLineWidth(0.42)
    const cx = infoX + 0.6
    const cy = infoY - 0.6
    doc.line(cx, cy, cx + 1.0, cy + 1.0)
    doc.line(cx + 1.0, cy + 1.0, cx + 2.7, cy - 1.3)

    doc.setTextColor(4, 120, 87)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('Número verificado en LABURANTE', infoX + 3.8, infoY + 0.3)
    infoY += 4.5
  }

  y = Math.max(avatarY + avatarSize, infoY) + 3.5

  if (zonaLines.length > 0) {
    doc.setTextColor(82, 82, 91)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const line of zonaLines) {
      doc.text(line, cardX + padX, y)
      y += 3.8
    }
    y += 1.8
  }

  if (bioLines.length > 0) {
    const bioBoxH = bioLines.length * 3.8 + 3.6
    doc.setFillColor(250, 250, 247)
    doc.roundedRect(cardX + padX, y - 2.4, contentW, bioBoxH, 2, 2, 'F')
    doc.setTextColor(63, 63, 70)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    let bioY = y + 0.8
    for (const line of bioLines) {
      doc.text(line, cardX + padX + 3, bioY)
      bioY += 3.8
    }
    y += bioBoxH + 0.1
  }

  if (skills.length > 0) {
    // Título de sección
    doc.setTextColor(113, 113, 122)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)
    doc.text('ESPECIALIDADES', cardX + padX, y)
    y += 3.5

    // Pills/globitos grises con texto
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(pillFontSize)
    let pillX = cardX + padX
    const pillBaseY = y
    let currentRow = 0

    for (const skill of skills) {
      const tw = doc.getTextWidth(skill)
      const pillW = tw + pillPadX * 2
      const pillH = pillRowH - 1.3

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
      doc.roundedRect(pillX, pillY, pillW, pillH, 1.8, 1.8, 'FD')

      // Texto centrado dentro del pill
      doc.setTextColor(42, 42, 54)
      doc.text(skill, pillX + pillPadX, pillY + pillH / 2 + 1.05)

      pillX += pillW + pillGap
    }

    y = pillBaseY + (currentRow + 1) * pillRowH + 1.5
  }

  if (servicesLines.length > 0) {
    doc.setTextColor(26, 26, 46)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const line of servicesLines) {
      doc.text(line, cardX + padX, y)
      y += 3.8
    }
    y += 2
  }

  if (langLines.length > 0) {
    doc.setTextColor(82, 82, 91)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    for (const line of langLines) {
      doc.text(line, cardX + padX, y)
      y += 3.6
    }
    y += 2
  }

  // Línea divisoria antes de Contactos + QR
  y += 1
  doc.setDrawColor(229, 229, 223)
  doc.line(cardX + padX, y, cardX + cardW - padX, y)
  y += 4

  // Columna derecha: QR integrado junto a los contactos
  const qrY = y
  const qrPng = await generateQrPngDataUrl(cardUrl, 512)
  doc.addImage(qrPng, 'PNG', qrX, qrY, qrSize, qrSize)

  doc.setTextColor(113, 113, 122)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('Escaneá para ver', qrX + qrSize / 2, qrY + qrSize + 1.5, { align: 'center' })
  doc.text('el perfil completo', qrX + qrSize / 2, qrY + qrSize + 4.2, { align: 'center' })

  // Columna izquierda: Contactos autorizados con link clicable y texto copiable
  let contactY = y + 1.5
  doc.setFontSize(7.2)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(113, 113, 122)
  doc.text('CONTACTO DIRECTO', cardX + padX, contactY)
  contactY += 4

  if (options?.contactsLocked) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(113, 113, 122)
    for (const line of lockLines) {
      doc.text(line, cardX + padX, contactY)
      contactY += 4
    }
  } else if (contactBlocks.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(113, 113, 122)
    doc.text('Escaneá el QR o abrí el enlace para ver el perfil.', cardX + padX, contactY)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    for (const block of contactBlocks) {
      for (const line of block.lines) {
        if (block.href) {
          doc.setTextColor(37, 99, 235)
          doc.textWithLink(line, cardX + padX, contactY, { url: block.href })
        } else {
          doc.setTextColor(26, 26, 46)
          doc.text(line, cardX + padX, contactY)
        }
        contactY += 3.9
      }
      contactY += 1.4
    }
  }

  y += Math.max(leftColH, rightColH) + 2.5

  // Caja inferior con la URL completa (nunca cortada)
  if (cardUrl) {
    const urlRowCount = urlFitsInline ? 1 : 1 + urlLines.length
    const urlBoxH = urlRowCount * 3.8 + 3.6
    doc.setFillColor(244, 242, 237)
    doc.roundedRect(cardX + padX, y - 1.5, contentW, urlBoxH, 2, 2, 'F')

    doc.setTextColor(113, 113, 122)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(urlLabelText, cardX + padX + 3, y + 1.8)

    doc.setTextColor(79, 70, 229)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    if (urlFitsInline) {
      doc.textWithLink(shortUrl, cardX + padX + 3 + urlLabelW + 1.5, y + 1.8, { url: cardUrl })
    } else {
      let urlTextY = y + 5.6
      for (const line of urlLines) {
        doc.textWithLink(line, cardX + padX + 3, urlTextY, { url: cardUrl })
        urlTextY += 3.8
      }
    }
  }

  // Footer
  doc.setTextColor(113, 113, 122)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.text('Tarjeta digital oficial de LABURANTE · Conexión laboral argentina', pageW / 2, cardY + cardH - 3.2, {
    align: 'center',
  })

  const cleanSlug = (filenameSlug || card.slug || card.card_key || 'profesional')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')

  doc.save(`tarjeta-laburante-${cleanSlug || 'contacto'}.pdf`)
}
