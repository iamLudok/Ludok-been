// Rareza, puntos de aventura y huella (superficie y población).
//
// Todo puro: sale de src/data/indicators.json y de las visitas, sin tocar la
// base de datos, y se prueba en `verify/library.ts`.
import raw from '../data/indicators.json'
import { COUNTRIES, ONLY_COUNTRIES, getByCca3, sovereignSlot } from './countries'
import type { Country, Visit } from '../types'

interface Indicator {
  tourists?: number
  touristsYear?: number
  touristsEstimated?: boolean
  population?: number
  area?: number
}

const data = raw as unknown as { sources: Record<string, string>; bySite: Record<string, Indicator> }

/** De dónde sale cada dato, para enseñarlo en la app. */
export const SOURCES = data.sources

export function indicatorOf(code: string): Indicator | undefined {
  return data.bySite[code]
}

/**
 * Los extremos de la escala de turistas al año: Francia (el país más
 * visitado, ~220 millones) vale 1 punto y Tuvalu (~3.600) vale 100.
 */
const MOST_VISITED = 220_000_000
const LEAST_VISITED = 3_600

/**
 * Puntos de rareza a partir de los turistas al año. En escala LOGARÍTMICA: lo
 * que importa es el orden de magnitud. De 200 a 100 millones casi no cambia
 * nada (Francia y España son igual de «normales»); de 100.000 a 10.000 sí.
 */
export function pointsFromTourists(tourists: number): number {
  const span = Math.log10(MOST_VISITED) - Math.log10(LEAST_VISITED)
  const p = 1 + (99 * (Math.log10(MOST_VISITED) - Math.log10(Math.max(1, tourists)))) / span
  return Math.round(Math.min(100, Math.max(1, p)))
}

/**
 * Puntos puestos a mano: los territorios sin cifra de turistas comparable,
 * y unos pocos países en los que la cifra oficial engaña (ver abajo). En las regiones, además, la cifra que hay es casi toda de
 * turismo del propio país (Alaska recibe millones de estadounidenses), así
 * que no sirve para medir lo raro que es llegar desde fuera.
 *
 * Misma escala que los países: 1 = como ir a Francia, 100 = como ir a Tuvalu.
 */
export const MANUAL_POINTS: Record<string, number> = {
  // Microestados que se visitan de excursión. La cifra oficial solo cuenta
  // a quien DUERME allí, y casi todo el mundo va y vuelve en el día (a
  // Mónaco desde Niza, a Liechtenstein desde Zúrich): con la cifra,
  // Liechtenstein salía más raro que Bután.
  MCO: 15,
  LIE: 20,
  SMR: 20,
  VAT: 10,
  // Estados de facto
  'x-abjasia': 60,
  'x-osetia-sur': 85,
  'x-transnistria': 55,
  'x-chipre-norte': 25,
  'x-somalilandia': 80,
  'x-nagorno-karabaj': 90,
  UNK: 40,
  TWN: 15,
  ESH: 80,
  // Naciones del Reino Unido
  ENG: 3,
  SCT: 10,
  WLS: 15,
  NIR: 20,
  // Regiones singulares
  'x-pais-vasco': 5,
  'x-canarias': 5,
  'x-ceuta': 30,
  'x-melilla': 35,
  'x-azores': 30,
  'x-madeira': 15,
  'x-corcega': 15,
  'x-kaliningrado': 55,
  'x-monte-athos': 70,
  'x-tibet': 55,
  'x-kurdistan-irak': 55,
  'x-zanzibar': 30,
  'x-socotra': 90,
  'x-galapagos': 45,
  'x-isla-pascua': 60,
  'x-tierra-fuego': 40,
  'x-hawai': 10,
  'x-alaska': 30,
  // Dependencias
  ALA: 25,
  AIA: 50,
  BES: 50,
  GIB: 15,
  GRL: 55,
  GGY: 30,
  IMN: 30,
  NFK: 70,
  COK: 50,
  FRO: 40,
  FLK: 75,
  JEY: 25,
  MSR: 70,
  NIU: 85,
  PCN: 98,
  SPM: 75,
  SHN: 90,
  SJM: 60,
  TKL: 99,
  BLM: 40,
  MAF: 35,
  WLF: 95,
  // Ultramar
  GLP: 25,
  GUF: 55,
  MTQ: 25,
  MYT: 65,
  REU: 35,
  // Remotos
  ATA: 85,
  BVT: 100,
  SGS: 95,
  HMD: 100,
  CXR: 85,
  CCK: 85,
  UMI: 100,
  IOT: 100,
  ATF: 100,
}

export interface Rarity {
  points: number
  /** Turistas al año, si la rareza sale de esa cifra. */
  tourists?: number
  touristsYear?: number
  /** La cifra de turistas es una estimación (no hay dato oficial). */
  estimated: boolean
  /** Los puntos están puestos a mano (territorios sin cifra comparable). */
  manual: boolean
}

/** Rareza de un sitio, o undefined si no se sabe (no debería pasar). */
export function rarityOf(code: string): Rarity | undefined {
  if (MANUAL_POINTS[code] !== undefined) {
    return { points: MANUAL_POINTS[code], estimated: false, manual: true }
  }
  const ind = data.bySite[code]
  if (!ind?.tourists) return undefined
  return {
    points: pointsFromTourists(ind.tourists),
    tourists: ind.tourists,
    touristsYear: ind.touristsYear,
    estimated: !!ind.touristsEstimated,
    manual: false,
  }
}

/** Niveles de aventurero por puntos acumulados. */
export const LEVELS = [
  { name: 'Turista', from: 0 },
  { name: 'Viajero', from: 100 },
  { name: 'Trotamundos', from: 300 },
  { name: 'Explorador', from: 700 },
  { name: 'Aventurero', from: 1500 },
  { name: 'Nómada', from: 3000 },
  { name: 'Leyenda', from: 6000 },
] as const

export interface Adventure {
  points: number
  level: (typeof LEVELS)[number]
  next?: (typeof LEVELS)[number]
  /** Cuánto llevas del nivel actual al siguiente (0–1; 1 en el último). */
  progress: number
  /** Lo más raro que has visitado, de más a menos. */
  top: { code: string; points: number }[]
}

/**
 * Los sitios que puntúan: los países visitados (también los que cuentan por
 * una región suya: Escocia da el Reino Unido) y los territorios visitados.
 * Cada uno una vez.
 */
function scoredSites(visits: Visit[]): string[] {
  const sites = new Set<string>()
  for (const v of visits) {
    if (v.status !== 'been') continue
    const c = getByCca3(v.code)
    if (!c) continue
    const slot = sovereignSlot(c)
    if (slot) sites.add(slot)
    if (c.kind === 'territory') sites.add(c.cca3)
  }
  return [...sites]
}

export function adventureOf(visits: Visit[]): Adventure {
  const top = scoredSites(visits)
    .map((code) => ({ code, points: rarityOf(code)?.points ?? 0 }))
    .sort((a, b) => b.points - a.points)
  const points = top.reduce((sum, s) => sum + s.points, 0)
  let i = 0
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1].from) i++
  const level = LEVELS[i]
  const next = LEVELS[i + 1]
  const progress = next ? (points - level.from) / (next.from - level.from) : 1
  return { points, level, next, progress, top }
}

export interface Footprint {
  /** % de la superficie de los 195 países que has pisado (0–100, un decimal). */
  areaPct: number
  /** % de la población mundial que vive en los países donde has estado. */
  populationPct: number
}

const totalOf = (key: 'area' | 'population') =>
  ONLY_COUNTRIES.reduce((sum, c) => sum + (data.bySite[c.cca3]?.[key] ?? 0), 0)
const TOTAL_AREA = totalOf('area')
const TOTAL_POPULATION = totalOf('population')

/**
 * Tu huella: qué parte del mundo representan los países donde has estado.
 * Por PAÍSES enteros (pisar Escocia cuenta el Reino Unido entero), igual que
 * el «% del mundo»: no se sabe qué parte de cada país has recorrido.
 */
export function footprintOf(visits: Visit[]): Footprint {
  const countries = scoredSites(visits).filter((code) => getByCca3(code)?.kind === 'country')
  const sum = (key: 'area' | 'population') =>
    countries.reduce((s, code) => s + (data.bySite[code]?.[key] ?? 0), 0)
  const pct = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0)
  return {
    areaPct: pct(sum('area'), TOTAL_AREA),
    populationPct: pct(sum('population'), TOTAL_POPULATION),
  }
}

export type RankingKey = 'rarity' | 'area' | 'population'

/** Valor de un sitio para un criterio de ranking (undefined si no se sabe). */
export function rankValue(code: string, key: RankingKey): number | undefined {
  if (key === 'rarity') return rarityOf(code)?.points
  return data.bySite[code]?.[key]
}

/**
 * Los sitios ordenados por un criterio, de más a menos. Por defecto solo
 * países; con `includeTerritories`, también los territorios (solo tiene
 * sentido en rareza: superficie y población de un territorio no se comparan
 * con las de un país).
 */
export function ranking(key: RankingKey, includeTerritories = false): { country: Country; value: number }[] {
  const pool = includeTerritories ? COUNTRIES : ONLY_COUNTRIES
  return pool
    .map((country) => ({ country, value: rankValue(country.cca3, key) }))
    .filter((r): r is { country: Country; value: number } => r.value !== undefined)
    .sort((a, b) => b.value - a.value || a.country.name.localeCompare(b.country.name, 'es'))
}

/** «220 M», «1,2 M», «35.000», «800»: cifras grandes legibles de un vistazo. */
export function formatCount(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace('.', ',')} M`
  }
  // A mano y no con `toLocaleString('es-ES')`: según cómo se compile Hermes,
  // trae o no los datos de idioma, y sin ellos salía «35000». Punto de miles
  // a partir de 5 cifras, como manda la RAE (3600, pero 35.000).
  const s = String(Math.round(n))
  return s.length <= 4 ? s : s.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * La línea de rareza de la ficha de un sitio: «Rareza 34/100 · 1,2 M
 * turistas al año (2019)». Dice de dónde sale: dato oficial, estimación o
 * puntos puestos a mano.
 */
export function rarityLine(code: string): string | undefined {
  const r = rarityOf(code)
  if (!r) return undefined
  const head = `Rareza ${r.points}/100`
  if (r.manual) return `${head} · valorada a mano`
  if (!r.tourists) return head
  const when = r.estimated ? 'estimado' : String(r.touristsYear)
  return `${head} · ${formatCount(r.tourists)} turistas al año (${when})`
}
