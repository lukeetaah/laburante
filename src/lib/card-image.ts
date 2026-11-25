import QRCode from 'qrcode'
import type { PublicDigitalCardData } from '@/lib/digital-card'

const CARD_WIDTH = 1080
const OUTER_PAD = 56
const INNER_X = OUTER_PAD
const INNER_W = CARD_WIDTH - OUTER_PAD * 2

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let current = words[0]

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = words[i]
      if (lines.length >= maxLines) break
    }
  }
  if (lines.length < maxLines && current) {
    lines.push(current)
  }
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    const last = lines[maxLines - 1]
    lines[maxLines - 1] = last.length > 3 ? `${last.slice(0, -1)}…` : `${last}…`
  }
  return lines
}

function loadImageWithCors(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => resolve(null), 4000)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    img.src = src
  })
}

function formatContactLine(type: string, value: string): string {
  switch (type) {
    case 'whatsapp':
      return `WhatsApp: ${value}`
    case 'telefono':
      return `Tel: ${value}`
    case 'email':
      return `Email: ${value}`
    case 'instagram':
      return `Instagram: ${value.startsWith('@') ? value : `@${value}`}`
    case 'linkedin':
      return `LinkedIn: ${value.replace(/^https?:\/\/(www\.)?/i, '')}`
    case 'portfolio':
      return `Portfolio: ${value.replace(/^https?:\/\//i, '')}`
    case 'web':
    default:
      return `Web: ${value.replace(/^https?:\/\//i, '')}`
  }
}

/**
 * Genera una imagen PNG de alta resolución (1080px de ancho) con la tarjeta digital
 * completa y su código QR, lista para compartir por WhatsApp, redes o imprimir.
 */
export async function generateDigitalCardPngDataUrl(
  card: PublicDigitalCardData,
  cardUrl: string
): Promise<string> {
  const probeCanvas = document.createElement('canvas')
  const probeCtx = probeCanvas.getContext('2d')
  if (!probeCtx) {
    throw new Error('Tu navegador no soporta la exportación de imágenes.')
  }

  const contentPadX = 64
  const contentMaxW = INNER_W - contentPadX * 2

  probeCtx.font = '700 44px Inter, system-ui, -apple-system, sans-serif'
  const nameLines = wrapText(probeCtx, card.name || 'Profesional LABURANTE', contentMaxW - 180, 2)

  probeCtx.font = '600 28px Inter, system-ui, -apple-system, sans-serif'
  const headlineLines = card.headline ? wrapText(probeCtx, card.headline, contentMaxW - 180, 2) : []

  const locationText = [card.localidad, card.provincia].filter(Boolean).join(', ')
  const skills = (card.skills || []).slice(0, 6)
  const contacts = (card.contacts || []).slice(0, 5)

  probeCtx.font = '400 24px Inter, system-ui, -apple-system, sans-serif'
  const bioLines = card.bio ? wrapText(probeCtx, card.bio, contentMaxW, 3) : []

  // Calcular altura dinámica
  let estimatedHeight = OUTER_PAD * 2 + 120 // header bar + top padding
  estimatedHeight += Math.max(152, nameLines.length * 52 + headlineLines.length * 36 + (locationText ? 38 : 0) + 32)
  if (bioLines.length > 0) estimatedHeight += bioLines.length * 34 + 36
  if (skills.length > 0) estimatedHeight += 96
  if (contacts.length > 0) estimatedHeight += contacts.length * 46 + 44
  estimatedHeight += 420 // sección QR + URL + footer

  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = Math.max(1180, estimatedHeight)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo de exportación.')
  }

  // 1. Fondo crema institucional
  ctx.fillStyle = '#FAFAF7'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 2. Tarjeta principal blanca con borde sutil
  const cardH = canvas.height - OUTER_PAD * 2
  ctx.save()
  ctx.shadowColor = 'rgba(18, 19, 36, 0.08)'
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 10
  roundRectPath(ctx, INNER_X, OUTER_PAD, INNER_W, cardH, 36)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.restore()

  roundRectPath(ctx, INNER_X, OUTER_PAD, INNER_W, cardH, 36)
  ctx.strokeStyle = '#E5E5DF'
  ctx.lineWidth = 2
  ctx.stroke()

  // 3. Barra superior oscura + franja acento
  ctx.save()
  roundRectPath(ctx, INNER_X, OUTER_PAD, INNER_W, cardH, 36)
  ctx.clip()

  ctx.fillStyle = '#121324'
  ctx.fillRect(INNER_X, OUTER_PAD, INNER_W, 88)

  ctx.fillStyle = '#F5A623'
  ctx.fillRect(INNER_X, OUTER_PAD + 88, INNER_W, 6)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '800 26px Inter, system-ui, -apple-system, sans-serif'
  ctx.fillText('LABURANTE', INNER_X + contentPadX, OUTER_PAD + 54)

  ctx.fillStyle = '#F5A623'
  ctx.font = '700 20px Inter, system-ui, -apple-system, sans-serif'
  const badgeText = 'TARJETA DIGITAL'
  const badgeWidth = ctx.measureText(badgeText).width
  ctx.fillText(badgeText, INNER_X + INNER_W - contentPadX - badgeWidth, OUTER_PAD + 52)
  ctx.restore()

  // 4. Avatar + Identidad
  let cursorY = OUTER_PAD + 142
  const avatarSize = 140
  const avatarX = INNER_X + contentPadX
  const avatarY = cursorY

  const loadedPhoto = card.photo_url ? await loadImageWithCors(card.photo_url) : null

  ctx.save()
  ctx.beginPath()
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()

  if (loadedPhoto) {
    const scale = Math.max(avatarSize / loadedPhoto.width, avatarSize / loadedPhoto.height)
    const drawW = loadedPhoto.width * scale
    const drawH = loadedPhoto.height * scale
    ctx.drawImage(
      loadedPhoto,
      avatarX + (avatarSize - drawW) / 2,
      avatarY + (avatarSize - drawH) / 2,
      drawW,
      drawH
    )
  } else {
    ctx.fillStyle = '#121324'
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize)
    const initials = (card.name || 'L')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '800 48px Inter, system-ui, -apple-system, sans-serif'
    const textW = ctx.measureText(initials).width
    ctx.fillText(initials, avatarX + (avatarSize - textW) / 2, avatarY + avatarSize / 2 + 17)
  }
  ctx.restore()

  ctx.beginPath()
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
  ctx.strokeStyle = '#E5E5DF'
  ctx.lineWidth = 3
  ctx.stroke()

  const textStartX = avatarX + avatarSize + 36
  let headerTextY = avatarY + 42

  ctx.fillStyle = '#1A1A2E'
  ctx.font = '800 44px Inter, system-ui, -apple-system, sans-serif'
  for (const line of nameLines) {
    ctx.fillText(line, textStartX, headerTextY)
    headerTextY += 50
  }

  if (headlineLines.length > 0) {
    ctx.fillStyle = '#D97706'
    ctx.font = '700 28px Inter, system-ui, -apple-system, sans-serif'
    for (const line of headlineLines) {
      ctx.fillText(line, textStartX, headerTextY)
      headerTextY += 36
    }
  }

  if (locationText) {
    ctx.fillStyle = '#52525B'
    ctx.font = '500 23px Inter, system-ui, -apple-system, sans-serif'
    ctx.fillText(`📍 ${locationText}`, textStartX, headerTextY + 4)
    headerTextY += 34
  }

  if (card.whatsapp_verified) {
    ctx.fillStyle = '#047857'
    ctx.font = '700 20px Inter, system-ui, -apple-system, sans-serif'
    ctx.fillText('✓ WhatsApp verificado en LABURANTE', textStartX, headerTextY + 6)
    headerTextY += 28
  }

  cursorY = Math.max(avatarY + avatarSize, headerTextY) + 34

  // 5. Bio opcional
  if (bioLines.length > 0) {
    ctx.fillStyle = '#3F3F46'
    ctx.font = '400 24px Inter, system-ui, -apple-system, sans-serif'
    for (const line of bioLines) {
      ctx.fillText(line, INNER_X + contentPadX, cursorY)
      cursorY += 34
    }
    cursorY += 18
  }

  // 6. Especialidades
  if (skills.length > 0) {
    let chipX = INNER_X + contentPadX
    let chipY = cursorY
    ctx.font = '600 21px Inter, system-ui, -apple-system, sans-serif'

    for (const skill of skills) {
      const label = skill.trim()
      const chipW = ctx.measureText(label).width + 32
      if (chipX + chipW > INNER_X + INNER_W - contentPadX) {
        chipX = INNER_X + contentPadX
        chipY += 48
      }
      roundRectPath(ctx, chipX, chipY - 28, chipW, 38, 19)
      ctx.fillStyle = '#F4F4F0'
      ctx.fill()
      ctx.strokeStyle = '#E5E5DF'
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.fillStyle = '#1A1A2E'
      ctx.fillText(label, chipX + 16, chipY - 2)
      chipX += chipW + 12
    }
    cursorY = chipY + 42
  }

  // 7. Contactos autorizados
  if (contacts.length > 0) {
    const boxH = contacts.length * 46 + 32
    roundRectPath(ctx, INNER_X + contentPadX, cursorY, contentMaxW, boxH, 24)
    ctx.fillStyle = '#FAFAF7'
    ctx.fill()
    ctx.strokeStyle = '#E5E5DF'
    ctx.lineWidth = 1.5
    ctx.stroke()

    let contactY = cursorY + 42
    ctx.font = '600 23px Inter, system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#1A1A2E'
    for (const contact of contacts) {
      const line = formatContactLine(contact.type, contact.value)
      const [clipped] = wrapText(ctx, line, contentMaxW - 48, 1)
      ctx.fillText(clipped || line, INNER_X + contentPadX + 24, contactY)
      contactY += 46
    }
    cursorY += boxH + 34
  }

  // 8. Bloque inferior de QR
  const qrBlockY = Math.max(cursorY, OUTER_PAD + cardH - 365)
  roundRectPath(ctx, INNER_X + contentPadX, qrBlockY, contentMaxW, 300, 28)
  ctx.fillStyle = '#F8FAFC'
  ctx.fill()
  ctx.strokeStyle = '#E2E8F0'
  ctx.lineWidth = 2
  ctx.stroke()

  const qrSize = 236
  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, cardUrl, {
    width: qrSize,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#121324',
      light: '#FFFFFF',
    },
  })

  const qrX = INNER_X + contentPadX + 32
  const qrY = qrBlockY + 32
  roundRectPath(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 18)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

  const qrTextX = qrX + qrSize + 36
  ctx.fillStyle = '#121324'
  ctx.font = '800 28px Inter, system-ui, -apple-system, sans-serif'
  ctx.fillText('Escaneá mi código QR', qrTextX, qrBlockY + 94)

  ctx.fillStyle = '#52525B'
  ctx.font = '500 22px Inter, system-ui, -apple-system, sans-serif'
  const qrDescLines = wrapText(
    ctx,
    'Abrí mi tarjeta digital actualizada y guardá mis datos de contacto al instante.',
    INNER_X + INNER_W - contentPadX - qrTextX - 24,
    3
  )
  let qrDescY = qrBlockY + 134
  for (const line of qrDescLines) {
    ctx.fillText(line, qrTextX, qrDescY)
    qrDescY += 32
  }

  const shortUrl = cardUrl.replace(/^https?:\/\//i, '')
  ctx.fillStyle = '#D97706'
  ctx.font = '700 20px Inter, system-ui, -apple-system, sans-serif'
  const [urlLine] = wrapText(ctx, shortUrl, INNER_X + INNER_W - contentPadX - qrTextX - 24, 1)
  ctx.fillText(urlLine || shortUrl, qrTextX, qrBlockY + 250)

  return canvas.toDataURL('image/png')
}

export async function downloadDigitalCardAsPng(
  card: PublicDigitalCardData,
  cardUrl: string,
  filenameSlug?: string
): Promise<void> {
  const dataUrl = await generateDigitalCardPngDataUrl(card, cardUrl)
  const cleanSlug = (filenameSlug || card.slug || card.card_key || 'profesional')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const link = document.createElement('a')
  link.download = `tarjeta-laburante-${cleanSlug || 'contacto'}.png`
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
