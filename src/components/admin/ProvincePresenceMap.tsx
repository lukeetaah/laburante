import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, LoaderCircle, MapPinned } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ARGENTINA_JURISDICTIONS, type PresenceJurisdiction } from '@/lib/profile-presence'

type GeoJSONGeometry = {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}
type GeoJSONFeature = {
  type: 'Feature'
  geometry: GeoJSONGeometry
  properties?: { id?: string; iso_id?: string; nombre?: string }
}

type GeoJSONCollection = {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

type PresenceRow = PresenceJurisdiction & { count: number }

const VIEW_BOX = { width: 1000, height: 1300, minLon: -75, maxLon: -53, minLat: -56, maxLat: -21 }

function project([longitude, latitude]: number[]) {
  return [
    ((longitude - VIEW_BOX.minLon) / (VIEW_BOX.maxLon - VIEW_BOX.minLon)) * VIEW_BOX.width,
    ((VIEW_BOX.maxLat - latitude) / (VIEW_BOX.maxLat - VIEW_BOX.minLat)) * VIEW_BOX.height,
  ] as const
}

function ringPath(ring: number[][]) {
  return ring.map((coordinate, index) => {
    const [x, y] = project(coordinate)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ') + ' Z'
}

function geometryPath(geometry: GeoJSONGeometry) {
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as number[][][]).map(ringPath).join(' ')
  }
  return (geometry.coordinates as number[][][][]).flatMap((polygon) => polygon.map(ringPath)).join(' ')
}

function featureCode(feature: GeoJSONFeature) {
  return feature.properties?.iso_id || feature.properties?.id || ''
}

export default function ProvincePresenceMap() {
  const [features, setFeatures] = useState<GeoJSONFeature[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [unmappedCount, setUnmappedCount] = useState(0)
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [mapResponse, presenceResponse] = await Promise.all([
          fetch('/argentina-provinces.geojson'),
          supabase.functions.invoke('admin-profile-presence'),
        ])
        if (!mapResponse.ok) throw new Error('No se pudo cargar la geometría del mapa.')
        const mapData = await mapResponse.json() as GeoJSONCollection
        const { data, error: presenceError } = presenceResponse
        if (presenceError || data?.error || !Array.isArray(data?.jurisdictions)) {
          throw new Error(data?.error || presenceError?.message || 'No se pudo cargar la presencia geográfica.')
        }
        if (mapData.type !== 'FeatureCollection' || mapData.features.length !== 24) {
          throw new Error('El recurso geográfico no contiene las 24 jurisdicciones esperadas.')
        }
        if (mounted) {
          setFeatures(mapData.features)
          setCounts(Object.fromEntries(data.jurisdictions.map((row: { code: string; count: number }) => [row.code, row.count])))
          setUnmappedCount(Number(data.unmapped_profiles || 0))
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el mapa.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [])

  const rows = useMemo<PresenceRow[]>(() => ARGENTINA_JURISDICTIONS.map((jurisdiction) => ({
    ...jurisdiction,
    count: counts[jurisdiction.code] || 0,
  })), [counts])
  const activeRows = rows.filter((row) => row.count > 0)
  const hovered = rows.find((row) => row.code === hoveredCode) || null

  return (
    <section className="space-y-4" aria-labelledby="province-presence-title">
      <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-5 text-orange-950">
        <div className="flex items-center gap-2"><MapPinned size={19} className="text-orange-600" /><h2 id="province-presence-title" className="font-heading text-lg font-bold">Presencia de LABURANTE en Argentina</h2></div>
        <p className="mt-1 text-xs leading-relaxed">Cuenta perfiles profesionales publicados y activos, con intención de ofrecer servicios y una provincia canónica válida. Las cuentas Empresa se muestran en su módulo específico y no se mezclan en este indicador.</p>
      </div>

      {loading && <div className="flex min-h-64 items-center justify-center rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] text-sm text-[var(--color-laburante-text-secondary)]"><LoaderCircle size={18} className="mr-2 animate-spin" />Cargando presencia…</div>}
      {!loading && error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900"><AlertCircle size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
      {!loading && !error && (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-3 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-laburante-text-secondary)]">
                <span><span className="mr-2 inline-block h-3 w-3 rounded-sm bg-orange-500 align-[-1px]" />Con presencia</span>
                <span><span className="mr-2 inline-block h-3 w-3 rounded-sm bg-slate-200 align-[-1px]" />Sin presencia</span>
              </div>
              <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl bg-sky-50/60">
                <svg viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`} className="h-auto w-full" role="img" aria-labelledby="province-map-title province-map-description">
                  <title id="province-map-title">Mapa de presencia por jurisdicción</title>
                  <desc id="province-map-description">Las jurisdicciones naranjas tienen al menos un perfil profesional contabilizado.</desc>
                  {features.map((feature) => {
                    const code = featureCode(feature)
                    const row = rows.find((item) => item.code === code)
                    if (!row) return null
                    const active = row.count > 0
                    return <path key={code} d={geometryPath(feature.geometry)} fill={active ? '#f97316' : '#e2e8f0'} stroke="#ffffff" strokeWidth="1.4" tabIndex={0} role="img" aria-label={`${row.name}: ${row.count} perfiles`} onMouseEnter={() => setHoveredCode(code)} onMouseLeave={() => setHoveredCode(null)} onFocus={() => setHoveredCode(code)} onBlur={() => setHoveredCode(null)}><title>{row.name}: {row.count} perfiles</title></path>
                  })}
                </svg>
                {hovered && <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-orange-200 bg-white/95 px-3 py-2 text-xs shadow-md"><p className="font-bold text-[var(--color-laburante-text)]">{hovered.name}</p><p className="text-[var(--color-laburante-text-secondary)]">{hovered.count} {hovered.count === 1 ? 'perfil' : 'perfiles'}</p></div>}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--color-laburante-border)] bg-[var(--color-laburante-surface)] p-4">
              <p className="text-xs font-semibold text-[var(--color-laburante-text-secondary)]">Resumen real</p>
              <p className="mt-1 font-heading text-3xl font-extrabold text-orange-600">{activeRows.length}<span className="ml-1 text-base font-semibold text-[var(--color-laburante-text-muted)]">/ 24</span></p>
              <p className="text-xs text-[var(--color-laburante-text-secondary)]">jurisdicciones con presencia</p>
              <div className="mt-4 space-y-1 border-t border-[var(--color-laburante-border)] pt-3 text-xs">
                {rows.map((row) => <div key={row.code} className="flex items-center justify-between gap-3"><span className={row.count ? 'font-semibold text-[var(--color-laburante-text)]' : 'text-[var(--color-laburante-text-muted)]'}>{row.name}</span><span className="font-mono text-[var(--color-laburante-text-secondary)]">{row.count}</span></div>)}
              </div>
              {unmappedCount > 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">{unmappedCount} perfil(es) activo(s) no se asignaron porque su provincia no coincide exactamente con una jurisdicción canónica.</p>}
            </div>
          </div>
          <p className="text-[11px] text-[var(--color-laburante-text-muted)]">Fuente de geometría local: API GeoRef / IGN. La consulta devuelve únicamente conteos agregados y se autoriza en el servidor para administradores.</p>
        </>
      )}
    </section>
  )
}
