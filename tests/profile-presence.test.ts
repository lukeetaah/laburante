import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { ARGENTINA_JURISDICTIONS, canonicalProvinceCode, isEligiblePresenceProfile } from '../src/lib/profile-presence.ts'

test('representa las 24 jurisdicciones argentinas sin duplicados', () => {
  assert.equal(ARGENTINA_JURISDICTIONS.length, 24)
  assert.equal(new Set(ARGENTINA_JURISDICTIONS.map((item) => item.code)).size, 24)
})
test('el recurso geográfico local contiene las mismas 24 jurisdicciones', () => {
  const geoJson = JSON.parse(fs.readFileSync(new URL('../public/argentina-provinces.geojson', import.meta.url), 'utf8')) as {
    type: string
    features: Array<{ properties?: { iso_id?: string } }>
  }
  assert.equal(geoJson.type, 'FeatureCollection')
  assert.deepEqual(
    geoJson.features.map((feature) => feature.properties?.iso_id).sort(),
    ARGENTINA_JURISDICTIONS.map((item) => item.code).sort(),
  )
})

test('el mapa dibuja CABA por encima de Buenos Aires y mantiene un tamaño contenido', () => {
  const mapSource = fs.readFileSync(new URL('../src/components/admin/ProvincePresenceMap.tsx', import.meta.url), 'utf8')
  assert.ok(mapSource.includes("featureCode(left) === 'AR-C'"))
  assert.ok(mapSource.includes('orderedFeatures.map('))
  assert.ok(mapSource.includes('max-w-2xl'))
})

test('normaliza solo nombres provinciales canónicos', () => {
  assert.equal(canonicalProvinceCode('Córdoba'), 'AR-X')
  assert.equal(canonicalProvinceCode('CIUDAD AUTÓNOMA DE BUENOS AIRES'), 'AR-C')
  assert.equal(canonicalProvinceCode('Tierra del Fuego, Antártida e Islas del Atlántico Sur'), 'AR-V')
  assert.equal(canonicalProvinceCode('Buenos Aires Norte'), null)
})

test('cuenta únicamente profesionales activos con intención de ofrecer', () => {
  assert.equal(isEligiblePresenceProfile({ status: 'activo', account_type: 'persona', intent: 'ofrecer' }), true)
  assert.equal(isEligiblePresenceProfile({ status: 'activo', account_type: 'persona', intent: 'ambas' }), true)
  assert.equal(isEligiblePresenceProfile({ status: 'oculto', account_type: 'persona', intent: 'ofrecer' }), false)
  assert.equal(isEligiblePresenceProfile({ status: 'activo', account_type: 'empresa', intent: 'ofrecer' }), false)
  assert.equal(isEligiblePresenceProfile({ status: 'activo', account_type: 'persona', intent: 'buscar' }), false)
})
