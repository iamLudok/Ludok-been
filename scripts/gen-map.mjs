// Genera src/data/map.json: la geometría del mapa YA PROYECTADA.
// Se ejecuta cuando cambien los datos de países: `npm run gen:map`.
//
// Por qué se proyecta aquí y no en el móvil: antes la app cargaba el topojson
// y lo pasaba por d3-geo al arrancar. Eso obligaba a meter d3 y world-atlas en
// el APK, y a invertir la proyección en cada toque. Con las coordenadas ya en
// el sistema del lienzo (0..MAP_WIDTH × 0..MAP_HEIGHT), el móvil solo dibuja y
// hace un punto-en-polígono, que además se puede probar en Node tal cual.
//
// Se usa el atlas 1:50m y no el 1:110m: en el de 110m faltan 29 países
// soberanos (Vaticano, Andorra, Malta, Singapur…), que por eso no se podían
// tocar. En el de 50m solo falta Tuvalu, que va como punto.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { geoMercator, geoPath, geoArea, geoCentroid } from 'd3-geo'
import { feature } from 'topojson-client'
import worldCountries from 'world-countries/countries.json' with { type: 'json' }

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'src', 'data')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const topology = readJson(join(here, '..', 'node_modules', 'world-atlas', 'countries-50m.json'))
const countries = readJson(join(dataDir, 'countries.json'))
const ukNations = readJson(join(dataDir, 'uk-nations.json'))
const territories = readJson(join(dataDir, 'territories.json'))

// Deben coincidir con MAP_WIDTH/MAP_HEIGHT de src/lib/geo.ts.
const MAP_WIDTH = 800
const MAP_HEIGHT = 535
// Franja de latitudes que se dibuja (Mercator estira sin fin hacia los polos).
const CLIP = {
  type: 'Polygon',
  coordinates: [[[-180, -58], [180, -58], [180, 84], [-180, 84], [-180, -58]]],
}
// Dos decimales en un lienzo de 800 de ancho: a zoom máximo (60×) un error de
// 0,005 unidades es menos de un píxel, y el fichero no se dispara.
const round = (n) => Math.round(n * 100) / 100

const projection = geoMercator().fitSize([MAP_WIDTH, MAP_HEIGHT], CLIP)
projection.clipExtent([[0, 0], [MAP_WIDTH, MAP_HEIGHT]])

const byCcn3 = new Map(countries.map((c) => [c.ccn3, c]))
const known = new Set(countries.map((c) => c.cca3))
// Formas del atlas sin ISO numérico que sí se pueden marcar: Kosovo, y los
// territorios de territories.json que el atlas ya dibuja aparte (Chipre del
// Norte, Somalilandia). Antes eran tierra gris que no se podía tocar.
const NAME_FALLBACK = { Kosovo: 'UNK' }
for (const t of territories) if (t.atlasName) NAME_FALLBACK[t.atlasName] = t.code

/**
 * Convierte una geometría proyectada en anillos planos [x0, y0, x1, y1, …].
 * Se reutiliza el camino SVG que genera d3 (que ya aplica el recorte) y se
 * trocea por sus comandos M/L/Z: es lo único que emite geoPath para
 * polígonos.
 */
function ringsOf(geo) {
  const d = geoPath(projection)(geo)
  if (!d) return []
  const rings = []
  for (const part of d.split('M').filter(Boolean)) {
    const nums = part
      .replace(/Z/g, '')
      .split(/[L,]/)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .map(round)
    if (nums.length >= 6) rings.push(nums)
  }
  return rings
}

function bboxOf(rings) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const r of rings) {
    for (let i = 0; i < r.length; i += 2) {
      x0 = Math.min(x0, r[i])
      x1 = Math.max(x1, r[i])
      y0 = Math.min(y0, r[i + 1])
      y1 = Math.max(y1, r[i + 1])
    }
  }
  return [round(x0), round(y0), round(x1), round(y1)]
}

/**
 * El trozo principal de un país (la península, no las islas) para encuadrar
 * la cámara y poner el marcador: con la caja de TODO el país, Francia
 * incluiría la Guayana y Estados Unidos Alaska y Hawái, y la cámara acabaría
 * enseñando medio océano.
 */
function mainPolygon(geo) {
  if (geo.type === 'Polygon') return geo
  if (geo.type !== 'MultiPolygon') return geo
  let best = null
  let bestArea = -1
  for (const coords of geo.coordinates) {
    const poly = { type: 'Polygon', coordinates: coords }
    const a = geoArea(poly)
    if (a > bestArea) {
      bestArea = a
      best = poly
    }
  }
  return best
}

const project = (lonLat) => {
  const p = projection(lonLat)
  return p ? [round(p[0]), round(p[1])] : null
}

const fc = feature(topology, topology.objects.countries)
// El Reino Unido es UNA forma (es un país); sus 4 naciones son territorios y
// van como puntos (ver abajo), igual que el País Vasco dentro de España.
const atlas = fc.features.map((f) => ({
  code: byCcn3.get(String(f.id ?? '').padStart(3, '0'))?.cca3 ?? NAME_FALLBACK[f.properties?.name] ?? null,
  geometry: f.geometry,
}))

const shapes = []
const drawn = new Set()
for (const { code, geometry } of atlas) {
  const rings = ringsOf(geometry)
  if (!rings.length) continue // fuera de la franja dibujada (Antártida…)
  const main = mainPolygon(geometry)
  const mainRings = ringsOf(main)
  const anchor = project(geoCentroid(main))
  shapes.push({
    code: code && known.has(code) ? code : null,
    rings,
    bbox: bboxOf(rings),
    main: mainRings.length ? bboxOf(mainRings) : bboxOf(rings),
    anchor,
  })
  if (code) drawn.add(code)
}

// Los que no tienen forma propia en el atlas (Tuvalu, Gibraltar, Escocia,
// Transnistria…): solo un punto. Se tocan por el marcador. Coordenadas de
// world-countries, de territories.json, o el centro de la forma de cada
// nación del Reino Unido.
const latlngByCca3 = new Map(worldCountries.map((c) => [c.cca3, c.latlng]))
for (const t of territories) latlngByCca3.set(t.code, t.latlng)
for (const n of ukNations) {
  const [lon, lat] = geoCentroid(mainPolygon(n.geometry))
  latlngByCca3.set(n.cca3, [lat, lon])
}
const points = []
const unplaced = []
for (const c of countries) {
  if (drawn.has(c.cca3)) continue
  const latlng = latlngByCca3.get(c.cca3)
  const p = latlng ? project([latlng[1], latlng[0]]) : null
  if (p && p[0] >= 0 && p[0] <= MAP_WIDTH && p[1] >= 0 && p[1] <= MAP_HEIGHT) {
    points.push({ code: c.cca3, anchor: p })
  } else {
    unplaced.push(c.name)
  }
}

writeFileSync(join(dataDir, 'map.json'), JSON.stringify({ width: MAP_WIDTH, height: MAP_HEIGHT, shapes, points }))

const sovereignMissing = countries.filter(
  (c) => c.kind === 'country' && !drawn.has(c.cca3) && !points.some((p) => p.code === c.cca3),
)
console.log(`map.json: ${shapes.length} formas, ${points.length} puntos`)
console.log(`fuera del mapa (polos/Antártida): ${unplaced.join(', ') || 'ninguno'}`)
if (sovereignMissing.length) {
  console.error(`¡Países sin forma ni punto!: ${sovereignMissing.map((c) => c.name).join(', ')}`)
  process.exit(1)
}
