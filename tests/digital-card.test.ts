import assert from 'node:assert/strict'
import test from 'node:test'
import { generateQrPngDataUrl, generateQrSvgString } from '../src/lib/qr-service.ts'
import { generateVCardString } from '../src/lib/vcard.ts'

test('generateQrSvgString produces valid SVG with viewBox and quiet zone margin', async () => {
  const url = 'https://laburante.ar/tarjeta/k8m2p9x4w7'
  const svg = await generateQrSvgString(url, { margin: 4, width: 512 })
  assert.ok(svg.startsWith('<svg'), 'Expected SVG root tag')
  assert.ok(svg.includes('viewBox="'), 'Expected viewBox attribute for print scalability')
  assert.ok(svg.includes('<path'), 'Expected QR path modules')
})

test('generateQrPngDataUrl produces valid PNG data URL at multiple sizes', async () => {
  const url = 'https://laburante.ar/tarjeta/k8m2p9x4w7'
  const smallPng = await generateQrPngDataUrl(url, 220)
  const printPng = await generateQrPngDataUrl(url, 1024)

  assert.ok(smallPng.startsWith('data:image/png;base64,'), 'Expected PNG data URL for 220px')
  assert.ok(printPng.startsWith('data:image/png;base64,'), 'Expected PNG data URL for 1024px')
  assert.ok(printPng.length > smallPng.length, 'Expected 1024px PNG to contain more image data than 220px')
})

test('vCard includes WhatsApp and excludes disabled email (Scenario A)', () => {
  const vcf = generateVCardString({
    name: 'María López',
    title: 'Electricista matriculada',
    org: 'LABURANTE',
    whatsapp: '+54 9 11 5555-1234',
    email: undefined,
    url: 'https://laburante.ar/tarjeta/k8m2p9x4w7',
  })

  assert.ok(vcf.includes('BEGIN:VCARD'))
  assert.ok(vcf.includes('VERSION:3.0'))
  assert.ok(vcf.includes('TEL;TYPE=WORK,MSG:+54 9 11 5555-1234'))
  assert.equal(vcf.includes('EMAIL;'), false)
})

test('vCard includes email and excludes disabled WhatsApp (Scenario B)', () => {
  const vcf = generateVCardString({
    name: 'María López',
    org: 'LABURANTE',
    whatsapp: undefined,
    email: 'maria@ejemplo.ar',
    url: 'https://laburante.ar/tarjeta/k8m2p9x4w7',
  })

  assert.ok(vcf.includes('EMAIL;TYPE=INTERNET,HOME:maria@ejemplo.ar'))
  assert.equal(vcf.includes('TEL;'), false)
})

test('vCard omits all phone and email fields when all contacts are disabled (Scenario C)', () => {
  const vcf = generateVCardString({
    name: 'María López',
    org: 'LABURANTE',
    url: 'https://laburante.ar/tarjeta/k8m2p9x4w7',
  })

  assert.ok(vcf.includes('FN:María López'))
  assert.equal(vcf.includes('TEL;'), false)
  assert.equal(vcf.includes('EMAIL;'), false)
})
