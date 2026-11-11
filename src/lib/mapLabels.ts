// Nombres de países sobre el mapa: cuáles se ven a cada zoom y dónde.
//
// Puro y sin Skia: recibe una función que mide el texto, para poder probarlo
// en Node (`verify/map.ts`) con una medida aproximada y en el móvil con la
// fuente de verdad.
import { MAP_SITES, markerVisible, type MapSite } from './geo'
import { getByCca3 } from './countries'

/** Por debajo de este zoom no hay nombres: el mundo entero se lee por las formas. */
export const LABELS_FROM_SCALE = 1.5

/**
 * Cuánto puede salirse un nombre de su país por los lados, respecto al
 * ancho libre que hay. Sin margen, los países estrechos (Chile, Croacia,
 * Italia) no tendrían nombre hasta un zoom enorme; con margen, el nombre
 * pisa un poco la frontera, como en cualquier mapa de papel.
 */
const OVERFLOW = 1.4

/**
 * Zoom (píxeles por unidad del mapa) desde el que los sitios con marcador
 * (Andorra, Gibraltar, Escocia…) llevan nombre al lado. Antes serían
 * decenas de nombres apelotonados en Europa.
 */
export const POINT_LABELS_MIN_PPU = 3

/**
 * Un sitio por código: Australia tiene dos formas en el atlas (el continente
 * y unas islas), y su nombre solo debe salir en la grande.
 */
const LABEL_SITES: MapSite[] = (() => {
  const biggest = new Map<string, MapSite>()
  for (const s of MAP_SITES) {
    const prev = biggest.get(s.code)
    if (!prev || s.size > prev.size) biggest.set(s.code, s)
  }
  return [...biggest.values()]
})()

/** Hueco mínimo entre dos nombres, en dp. */
const GAP = 3

export interface PlacedLabel {
  code: string
  text: string
  /** Punto del mapa al que va pegado, en unidades del lienzo. */
  x: number
  y: number
  /** Desde ese punto ya en pantalla, dónde empieza el texto (dp, línea base). */
  dx: number
  dy: number
  territory: boolean
}

interface Options {
  /** Píxeles de pantalla por unidad del lienzo, ya con el zoom. */
  ppu: number
  /** Ancho del texto en dp con la fuente de los nombres. */
  measure: (text: string) => number
  fontSize: number
  /** Separación entre el centro del marcador y su nombre, en dp. */
  markerGap: number
  /** El seleccionado va primero: si cabe, su nombre siempre se ve. */
  selected?: string | null
}

/**
 * Qué nombres se ven y dónde, a un zoom dado.
 *
 * Dos clases:
 * - Países que se ven grandes: el nombre centrado en su punto más alejado
 *   del borde, si cabe (con algo de holgura, ver `OVERFLOW`).
 * - Los que llevan marcador (diminutos, o territorios sin forma): el nombre
 *   a la derecha del punto, solo con bastante zoom.
 *
 * Luego se colocan de más importante a menos (el seleccionado, los países
 * por tamaño, y al final los marcadores) y se descarta el que pise a uno ya
 * puesto. Como al hacer zoom todo se escala por igual y al arrastrar todo se
 * desplaza por igual, que dos nombres se pisen solo depende del zoom: por
 * eso basta con calcularlo al terminar cada gesto, no en cada fotograma.
 */
export function placeLabels({ ppu, measure, fontSize, markerGap, selected }: Options): PlacedLabel[] {
  if (ppu <= 0) return []
  type Candidate = PlacedLabel & { rank: number }
  const candidates: Candidate[] = []

  for (const site of LABEL_SITES) {
    const country = getByCca3(site.code)
    if (!country) continue
    const text = country.name
    const territory = country.kind === 'territory'
    const isSelected = site.code === selected
    if (markerVisible(site, ppu)) {
      if (ppu < POINT_LABELS_MIN_PPU && !isSelected) continue
      candidates.push({
        code: site.code,
        text,
        x: site.anchor[0],
        y: site.anchor[1],
        dx: markerGap,
        dy: fontSize * 0.35,
        territory,
        rank: isSelected ? Infinity : -1,
      })
      continue
    }
    if (!site.label || !fits(site, text, ppu, measure, fontSize)) continue
    const w = measure(text)
    candidates.push({
      code: site.code,
      text,
      x: site.label[0],
      y: site.label[1],
      dx: -w / 2,
      dy: fontSize * 0.35,
      territory,
      rank: isSelected ? Infinity : site.size,
    })
  }

  candidates.sort((a, b) => b.rank - a.rank || a.code.localeCompare(b.code))

  const placed: PlacedLabel[] = []
  const boxes: [number, number, number, number][] = []
  for (const c of candidates) {
    const left = c.x * ppu + c.dx - GAP
    const right = left + measure(c.text) + 2 * GAP
    // Caja de la letra: de la línea base, ~0,8 hacia arriba y ~0,25 hacia abajo.
    const base = c.y * ppu + c.dy
    const top = base - fontSize * 0.8 - GAP
    const bottom = base + fontSize * 0.25 + GAP
    if (boxes.some(([l, t, r, b]) => left < r && right > l && top < b && bottom > t)) continue
    boxes.push([left, top, right, bottom])
    const { rank: _rank, ...label } = c
    placed.push(label)
  }
  return placed
}

/** ¿Cabe el nombre dentro de su país (con holgura) a este zoom? */
function fits(site: MapSite, text: string, ppu: number, measure: (t: string) => number, fontSize: number): boolean {
  const [, , run, room] = site.label!
  return measure(text) <= run * ppu * OVERFLOW && fontSize <= 2 * room * ppu * OVERFLOW
}
