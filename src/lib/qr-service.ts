import QRCode from 'qrcode'

export interface QrOptions {
  margin?: number
  width?: number
  darkColor?: string
  lightColor?: string
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
}

const DEFAULT_OPTIONS: Required<QrOptions> = {
  margin: 4,
  width: 1024,
  darkColor: '#121324', // LABURANTE dark slate
  lightColor: '#FFFFFF', // High-contrast crisp white background
  errorCorrectionLevel: 'M', // 15% error correction, optimal balance between density and scan speed
}

/**
 * Genera el código QR en formato SVG vectorial estándar (apto para impresión física de alta fidelidad).
 */
export async function generateQrSvgString(text: string, options?: QrOptions): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  return QRCode.toString(text, {
    type: 'svg',
    margin: opts.margin,
    width: opts.width,
    errorCorrectionLevel: opts.errorCorrectionLevel,
    color: {
      dark: opts.darkColor,
      light: opts.lightColor,
    },
  })
}

/**
 * Genera el código QR en PNG de alta resolución como Data URL base64.
 */
export async function generateQrPngDataUrl(text: string, width = 1024): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: DEFAULT_OPTIONS.margin,
    width,
    errorCorrectionLevel: DEFAULT_OPTIONS.errorCorrectionLevel,
    color: {
      dark: DEFAULT_OPTIONS.darkColor,
      light: DEFAULT_OPTIONS.lightColor,
    },
  })
}

/**
 * Descarga el código QR como archivo PNG de 1024x1024 px en el navegador.
 */
export async function downloadQrAsPng(text: string, filename = 'mi-qr-laburante.png', width = 1024): Promise<void> {
  const dataUrl = await generateQrPngDataUrl(text, width)
  const link = document.createElement('a')
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Descarga el código QR como archivo SVG vectorial en el navegador.
 */
export async function downloadQrAsSvg(text: string, filename = 'mi-qr-laburante.svg'): Promise<void> {
  const svgString = await generateQrSvgString(text)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`
  link.href = url
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
