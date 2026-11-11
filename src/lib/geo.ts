// Geometría del mapa, ya proyectada por `scripts/gen-map.mjs` al sistema del
// lienzo (0..MAP_WIDTH × 0..MAP_HEIGHT). Aquí no hay d3 ni proyecciones: solo
// datos y cuentas puras, para poder probarlas en Node (`verify/map.ts`) con
// el mismo código que corre en el móvil.
import raw from '../data/map.json'

export interface MapShape {
  /** cca3 del país, o null si la forma no casa con ninguno (Somalilandia…). */
  code: string | null
  /** Anillos planos [x0, y0, x1, y1, …]; los agujeros son anillos más. */
  rings: number[][]
  /** Caja de toda la forma [x0, y0, x1, y1]. */
  bbox: [number, number, number, number]
  /** Caja del trozo principal (sin islas lejanas), para encuadrar la cámara. */
  main: [number, number, number, number]
  /** Dónde va su marcador (centro del trozo principal). */
  anchor: [number, number] | null
  /**
   * Dónde va su nombre: [x, y, ancho libre en horizontal, distancia al
   * borde]. Es el punto de dentro más alejado del borde (ver gen-map.mjs).
   */
  label: [number, number, number, number]
}

interface MapData {
  width: number
  height: number
  shapes: MapShape[]
  points: { code: string; anchor: [number, number] }[]
}

const data = raw as unknown as MapData

/** Dimensiones de diseño del mapa: Mercator recortado entre 58°S y 84°N. */
export const MAP_WIDTH = data.width
export const MAP_HEIGHT = data.height
export const MAP_SHAPES: MapShape[] = data.shapes

/**
 * Un sitio que se puede marcar en el mapa, tenga forma o no. `size` es el
 * lado mayor de su trozo principal en unidades del lienzo: 0 para los que
 * solo son un punto (Tuvalu, Gibraltar…).
 */
export interface MapSite {
  code: string
  anchor: [number, number]
  size: number
  /** Caja para encuadrar la cámara al seleccionarlo. */
  frame: [number, number, number, number]
  /** Solo los que tienen forma: dónde va el nombre (ver `MapShape.label`). */
  label?: [number, number, number, number]
}

export const MAP_SITES: MapSite[] = [
  ...data.shapes
    .filter((s): s is MapShape & { code: string; anchor: [number, number] } => !!s.code && !!s.anchor)
    .map((s) => ({
      code: s.code,
      anchor: s.anchor,
      size: Math.max(s.main[2] - s.main[0], s.main[3] - s.main[1]),
      frame: s.main,
      label: s.label,
    })),
  ...data.points.map((p) => ({
    code: p.code,
    anchor: p.anchor,
    size: 0,
    frame: [p.anchor[0], p.anchor[1], p.anchor[0], p.anchor[1]] as [number, number, number, number],
  })),
]

/**
 * Por debajo de este tamaño en pantalla (dp), un país lleva marcador: más
 * pequeño no se puede tocar con el dedo, y algunos (el Vaticano) ni siquiera
 * llegan a un píxel.
 */
export const MARKER_MIN_PX = 12

/**
 * Radio de toque de un marcador (dp). Es pequeño a propósito: con uno
 * generoso, a vista de mundo tocar el centro de Italia abría el Vaticano,
 * porque esos 24 dp eran unas 18 unidades del mapa. Si apuntas al punto, lo
 * aciertas; si tocas el país grande de alrededor, abres ese.
 */
export const MARKER_HIT_PX = 14

/** Píxeles de pantalla por unidad del lienzo, para una escala y un ancho. */
export function pxPerUnit(scale: number, containerW: number): number {
  'worklet'
  return (scale * containerW) / MAP_WIDTH
}

const siteByCode = new Map(MAP_SITES.map((s) => [s.code, s]))

export function siteOf(code: string): MapSite | undefined {
  return siteByCode.get(code)
}

/**
 * Regla par-impar sobre todos los anillos de la forma: así los agujeros
 * (Lesoto dentro de Sudáfrica, San Marino dentro de Italia) quedan fuera sin
 * tener que distinguir qué anillo es exterior y cuál es hueco.
 */
export function shapeContains(shape: MapShape, x: number, y: number): boolean {
  const [x0, y0, x1, y1] = shape.bbox
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  let inside = false
  for (const r of shape.rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i]
      const yi = r[i + 1]
      const xj = r[j]
      const yj = r[j + 1]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

/** Código del país cuya forma contiene el punto, o null (mar, hielo…). */
export function shapeAt(x: number, y: number): string | null {
  for (const s of MAP_SHAPES) {
    if (s.code && shapeContains(s, x, y)) return s.code
  }
  return null
}

/**
 * ¿Lleva marcador este sitio a esta escala? Sí cuando su forma se vería más
 * pequeña que `minPx` en pantalla.
 *
 * @param ppu píxeles de pantalla por unidad del lienzo, ya con el zoom.
 */
export function needsMarker(site: MapSite, ppu: number, minPx: number = MARKER_MIN_PX): boolean {
  return site.size * ppu < minPx
}

/**
 * Un marcador dentro de otro país (el Vaticano y San Marino en Italia,
 * Lesoto en Sudáfrica) no se enseña hasta que ese país se ve al menos así de
 * grande. Si no, a vista de mundo el punto del Vaticano tapa media Italia y
 * tocar Italia abre el Vaticano.
 */
export const HOST_MIN_PX = 48

/**
 * Para cada sitio, el país grande que lo rodea, si lo hay: uno al menos 3
 * veces mayor cuyo trozo principal contiene su punto.
 *
 * Se mira la caja del trozo principal y no el polígono a propósito:
 * - el Vaticano y San Marino son AGUJEROS en la forma de Italia, así que un
 *   punto-en-polígono diría que no están dentro;
 * - Guadalupe o Reunión sí caen dentro de la forma de Francia (el atlas los
 *   mete en ella), pero lejos de la Francia continental, y no deben
 *   esconderse cuando Francia se ve pequeña.
 */
const hostOf = new Map<string, string>()
for (const site of MAP_SITES) {
  const [x, y] = site.anchor
  let best: MapSite | undefined
  for (const other of MAP_SITES) {
    if (other.code === site.code || other.size < 3 * Math.max(site.size, 0.1)) continue
    const [x0, y0, x1, y1] = other.frame
    if (x < x0 || x > x1 || y < y0 || y > y1) continue
    if (!best || other.size < best.size) best = other
  }
  if (best) hostOf.set(site.code, best.code)
}

/** País que rodea a este sitio (ver `hostOf`), si lo hay. */
export function hostCode(code: string): string | undefined {
  return hostOf.get(code)
}

/** ¿Se dibuja (y se puede tocar) el marcador de este sitio a esta escala? */
export function markerVisible(site: MapSite, ppu: number): boolean {
  if (!needsMarker(site, ppu)) return false
  const host = hostOf.get(site.code)
  const hostSite = host ? siteByCode.get(host) : undefined
  return !hostSite || hostSite.size * ppu >= HOST_MIN_PX
}

/**
 * Si tocas DENTRO de un país que se ve grande, un marcador solo gana si das
 * casi encima del punto (dp). Fuera de eso, manda el país que tienes bajo el
 * dedo: sin esta regla, a vista de mundo los puntos de Eslovenia,
 * Liechtenstein y compañía tapaban Austria entera.
 */
export const MARKER_HIT_INSIDE_PX = 8

/**
 * Qué se ha tocado en (x, y), en unidades del lienzo, con `ppu` píxeles de
 * pantalla por unidad.
 *
 * Se mira el marcador más cercano ANTES que la forma: el Vaticano está dentro
 * de Italia, y mirando primero la forma, tocar su punto abriría Italia
 * siempre. Pero el radio depende de qué hay bajo el dedo (ver
 * `MARKER_HIT_INSIDE_PX`).
 */
export function siteAt(x: number, y: number, ppu: number): string | null {
  const under = shapeAt(x, y)
  const underSite = under ? siteByCode.get(under) : undefined
  const underIsBig = !!underSite && !needsMarker(underSite, ppu)
  let bestDist = (underIsBig ? MARKER_HIT_INSIDE_PX : MARKER_HIT_PX) / ppu
  let best: string | null = null
  for (const s of MAP_SITES) {
    if (!markerVisible(s, ppu)) continue
    const d = Math.hypot(s.anchor[0] - x, s.anchor[1] - y)
    if (d <= bestDist) {
      bestDist = d
      best = s.code
    }
  }
  return best ?? under
}
