// Acceso a los metadatos estáticos de países (src/data/countries.json).
import raw from '../data/countries.json'
import type { Country } from '../types'

export const COUNTRIES = raw as Country[]

/** Países soberanos = denominador del "% del mundo". */
export const SOVEREIGN = COUNTRIES.filter((c) => c.independent)
export const WORLD_TOTAL = SOVEREIGN.length

const byCca3 = new Map(COUNTRIES.map((c) => [c.cca3, c]))
const byCcn3 = new Map(COUNTRIES.map((c) => [c.ccn3, c]))

export function getByCca3(code: string): Country | undefined {
  return byCca3.get(code)
}

/** Busca por ISO numérico (los id de world-atlas vienen como "724" o 724). */
export function getByCcn3(ccn3: string | number): Country | undefined {
  return byCcn3.get(String(ccn3).padStart(3, '0'))
}

/** Nombre legible de un país, o el propio código si no se encuentra. */
export function nameOf(code: string): string {
  return byCca3.get(code)?.name ?? code
}

/** Lista de continentes presentes, ordenada. */
export function continents(): string[] {
  return [...new Set(COUNTRIES.map((c) => c.continent))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
}

/** Nº de países soberanos por continente (denominadores del desglose). */
export function sovereignByContinent(): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of SOVEREIGN) m.set(c.continent, (m.get(c.continent) ?? 0) + 1)
  return m
}
