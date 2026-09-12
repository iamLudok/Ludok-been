// Acceso a los metadatos estáticos de países (src/data/countries.json).
import raw from '../data/countries.json'
import type { Country } from '../types'

export const COUNTRIES = raw as Country[]

/** cca3 al que cuenta cada país para el "% del mundo": el suyo propio si es
 * soberano, o `sovereignCode` si es una de varias naciones que comparten un
 * solo país soberano (p.ej. las 4 del Reino Unido comparten "GBR"). */
export function sovereignSlot(c: Country): string | undefined {
  return c.independent ? c.cca3 : c.sovereignCode
}

/** Nº de países soberanos = denominador del "% del mundo". */
export const WORLD_TOTAL = new Set(COUNTRIES.map(sovereignSlot).filter((s): s is string => !!s))
  .size

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
  const slotsByContinent = new Map<string, Set<string>>()
  for (const c of COUNTRIES) {
    const slot = sovereignSlot(c)
    if (!slot) continue
    const slots = slotsByContinent.get(c.continent) ?? new Set<string>()
    slots.add(slot)
    slotsByContinent.set(c.continent, slots)
  }
  const m = new Map<string, number>()
  for (const [continent, slots] of slotsByContinent) m.set(continent, slots.size)
  return m
}
