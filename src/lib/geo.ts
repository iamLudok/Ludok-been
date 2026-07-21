// Carga el mapa mundial (topojson de world-atlas) y expone las geometrías ya
// resueltas a código de país, más ayudantes de proyección compartidos por el
// mapa SVG y por el render de la imagen a compartir.
import { geoEqualEarth, geoPath, type GeoProjection } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, Geometry } from 'geojson'
import topology from 'world-atlas/countries-110m.json'
import { getByCcn3, nameOf } from './countries'

// Territorios de world-atlas sin ISO numérico que sí queremos poder marcar.
const NAME_FALLBACK: Record<string, string> = { Kosovo: 'UNK' }

interface AtlasFeature extends Feature<Geometry> {
  id?: string | number
  properties: { name?: string } | null
}

const fc = feature(
  // El JSON importado no trae los tipos estrictos de topojson; el cast es seguro.
  topology as unknown as Parameters<typeof feature>[0],
  (topology as unknown as { objects: { countries: never } }).objects.countries,
) as unknown as { features: AtlasFeature[] }

export interface MapCountry {
  /** código cca3 resuelto, o null si el territorio no casa con ningún país. */
  cca3: string | null
  name: string
  feature: AtlasFeature
}

export const MAP_COUNTRIES: MapCountry[] = fc.features.map((f) => {
  const meta = f.id != null ? getByCcn3(f.id) : undefined
  const fallback = f.properties?.name ? NAME_FALLBACK[f.properties.name] : undefined
  const cca3 = meta?.cca3 ?? fallback ?? null
  return {
    cca3,
    name: cca3 ? nameOf(cca3) : (f.properties?.name ?? '—'),
    feature: f,
  }
})

/** Dimensiones de diseño del mapa (relación ~Equal Earth). */
export const MAP_WIDTH = 800
export const MAP_HEIGHT = 400

/** Proyección Equal Earth ajustada al lienzo del mapa. */
export function makeProjection(width = MAP_WIDTH, height = MAP_HEIGHT): GeoProjection {
  return geoEqualEarth().fitSize(
    [width, height],
    fc as unknown as Parameters<GeoProjection['fitSize']>[1],
  )
}

/** Genera las cadenas `d` de cada país para un SVG. */
export function svgPaths(width = MAP_WIDTH, height = MAP_HEIGHT) {
  const path = geoPath(makeProjection(width, height))
  return MAP_COUNTRIES.map((c) => ({
    cca3: c.cca3,
    name: c.name,
    d: path(c.feature) ?? '',
  }))
}