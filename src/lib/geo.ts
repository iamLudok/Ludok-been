// Carga el mapa mundial (topojson de world-atlas) y expone las geometrías ya
// resueltas a código de país, más ayudantes de proyección compartidos por el
// mapa SVG y por la tarjeta de estadísticas para compartir.
import { geoMercator, geoPath, geoContains, type GeoProjection } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, Geometry } from 'geojson'
import topology from 'world-atlas/countries-110m.json'
import ukNations from '../data/uk-nations.json'
import { getByCcn3, nameOf } from './countries'

// Territorios de world-atlas sin ISO numérico que sí queremos poder marcar.
const NAME_FALLBACK: Record<string, string> = { Kosovo: 'UNK' }

// El atlas mundial (resolución 110m) trae el Reino Unido como una sola forma:
// no distingue Inglaterra/Escocia/Gales/Irlanda del Norte. Como esas 4
// naciones se cuentan como países separados (ver countries.json), se
// descarta ese polígono único y se sustituye por las 4 formas propias de
// `uk-nations.json` (recortadas de Natural Earth 1:50m `admin_0_map_subunits`,
// dominio público, ver scripts/gen-countries.mjs).
const UK_ATLAS_ID = '826'

interface AtlasFeature extends Feature<Geometry> {
  id?: string | number
  properties: { name?: string } | null
}

const fc = feature(
  // El JSON importado no trae los tipos estrictos de topojson; el cast es seguro.
  topology as unknown as Parameters<typeof feature>[0],
  (topology as unknown as { objects: { countries: never } }).objects.countries,
) as unknown as { features: AtlasFeature[] }

const worldFeatures = fc.features.filter((f) => String(f.id) !== UK_ATLAS_ID)

const ukFeatures: AtlasFeature[] = (
  ukNations as { cca3: string; geometry: Geometry }[]
).map((n) => ({
  type: 'Feature',
  id: n.cca3,
  properties: { name: nameOf(n.cca3) },
  geometry: n.geometry,
}))

export interface MapCountry {
  /** código cca3 resuelto, o null si el territorio no casa con ningún país. */
  cca3: string | null
  name: string
  feature: AtlasFeature
}

export const MAP_COUNTRIES: MapCountry[] = [
  ...worldFeatures.map((f) => {
    const meta = f.id != null ? getByCcn3(f.id) : undefined
    const fallback = f.properties?.name ? NAME_FALLBACK[f.properties.name] : undefined
    const cca3 = meta?.cca3 ?? fallback ?? null
    return {
      cca3,
      name: cca3 ? nameOf(cca3) : (f.properties?.name ?? '—'),
      feature: f,
    }
  }),
  ...ukFeatures.map((f) => ({ cca3: String(f.id), name: nameOf(String(f.id)), feature: f })),
]

/**
 * Dimensiones de diseño del mapa. La relación sale de recortar Mercator entre
 * las latitudes de abajo: 800 × 535.
 */
export const MAP_WIDTH = 800
export const MAP_HEIGHT = 535

/**
 * Franja de latitudes que se dibuja. Mercator estira infinito hacia los polos,
 * así que hay que cortar por algún sitio; estos son los límites que usan los
 * mapas web de toda la vida — deja fuera la Antártida (que saldría deformada y
 * ocupando media pantalla) y conserva todo lo demás.
 */
const CLIP = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-180, -58],
      [180, -58],
      [180, 84],
      [-180, 84],
      [-180, -58],
    ],
  ],
}

/**
 * Proyección Mercator ajustada al lienzo. Se usa Mercator y no Equal Earth
 * porque esta dibuja los meridianos curvos y el mundo con forma de óvalo, que
 * se lee como «un globo aplastado»; Mercator da el rectángulo recto al que
 * está acostumbrado cualquiera que haya abierto un mapa en el móvil.
 */
export function makeProjection(width = MAP_WIDTH, height = MAP_HEIGHT): GeoProjection {
  const projection = geoMercator().fitSize(
    [width, height],
    CLIP as unknown as Parameters<GeoProjection['fitSize']>[1],
  )
  // Recorta lo que se salga del lienzo (si no, la Antártida se estira sin fin).
  projection.clipExtent([
    [0, 0],
    [width, height],
  ])
  return projection
}

// Proyección por defecto, calculada una sola vez: la reutilizan tanto
// `svgPaths()` (con las dimensiones por defecto) como `countryAt()`, para no
// recalcular el ajuste de encaje (`fitSize`) en cada tap.
const defaultProjection = makeProjection()

/** Genera las cadenas `d` de cada país para un SVG. */
export function svgPaths(width = MAP_WIDTH, height = MAP_HEIGHT) {
  const isDefault = width === MAP_WIDTH && height === MAP_HEIGHT
  const path = geoPath(isDefault ? defaultProjection : makeProjection(width, height))
  return MAP_COUNTRIES.map((c) => ({
    cca3: c.cca3,
    name: c.name,
    d: path(c.feature) ?? '',
  }))
}

/**
 * Código del país bajo un punto en coordenadas del viewBox por defecto
 * (0..MAP_WIDTH, 0..MAP_HEIGHT), o null si no hay ninguno ahí (mar, hielo…).
 *
 * Se usa en vez de `onPress` por país: con ~250 países cubriendo casi todo el
 * mapa, un segundo dedo del gesto de pellizco casi siempre cae encima de
 * alguno, y el sistema de touch nativo de RN puede robarle ese puntero al
 * reconocedor de gestos y corromper el pellizco. Invertir la proyección y
 * mirar qué país contiene el punto evita depender de eso.
 */
export function countryAt(x: number, y: number): string | null {
  const lonLat = defaultProjection.invert?.([x, y])
  if (!lonLat) return null
  for (const c of MAP_COUNTRIES) {
    if (c.cca3 && geoContains(c.feature, lonLat)) return c.cca3
  }
  return null
}
