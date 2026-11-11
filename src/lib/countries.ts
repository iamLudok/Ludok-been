// Acceso a los metadatos estáticos de países (src/data/countries.json).
import raw from '../data/countries.json'
import type { Country, TerritoryType } from '../types'

export const COUNTRIES = raw as Country[]

/**
 * País al que suma un sitio al visitarlo, para el «% del mundo»: el propio si
 * es un país, `sovereignCode` si es una región o nación que forma parte de
 * uno (Escocia → Reino Unido), o ninguno (Gibraltar, Transnistria).
 */
export function sovereignSlot(c: Country): string | undefined {
  return c.kind === 'country' ? c.cca3 : c.sovereignCode
}

export const ONLY_COUNTRIES = COUNTRIES.filter((c) => c.kind === 'country')
export const TERRITORIES = COUNTRIES.filter((c) => c.kind === 'territory')

/** Nº de países = denominador del «% del mundo» (195). */
export const WORLD_TOTAL = ONLY_COUNTRIES.length

/** Nombres de cada tipo de territorio, para la interfaz. */
export const TERRITORY_TYPE_LABEL: Record<TerritoryType, string> = {
  'de-facto': 'Estados de facto',
  nacion: 'Naciones',
  region: 'Regiones singulares',
  dependencia: 'Dependencias',
  ultramar: 'Ultramar',
  remoto: 'Remotos',
}

/** Una línea de contexto para la ficha: «Dependencia de Reino Unido». */
export function contextOf(c: Country): string {
  if (c.kind === 'country') return 'País'
  const parent = c.parent ? byCca3.get(c.parent)?.name : undefined
  const label: Record<TerritoryType, string> = {
    'de-facto': parent ? `Estado de facto · reclamado por ${parent}` : 'Estado de facto',
    nacion: `Nación de ${parent}`,
    region: `Región de ${parent}`,
    dependencia: parent ? `Dependencia de ${parent}` : 'Dependencia',
    ultramar: `Ultramar de ${parent}`,
    remoto: parent ? `Territorio remoto de ${parent}` : 'Territorio remoto',
  }
  const text = c.type ? label[c.type] : 'Territorio'
  return c.defunct ? `${text} · ya no existe` : text
}

/** Territorios de un país (los que dependen de él o forman parte de él). */
export function territoriesOf(code: string): Country[] {
  return TERRITORIES.filter((t) => t.parent === code)
}

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

/** Para buscar sin que importen mayúsculas ni tildes: «japon» encuentra Japón. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Lista de continentes presentes, ordenada. */
export function continents(): string[] {
  return [...new Set(COUNTRIES.map((c) => c.continent))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
}

/** Nº de países por continente (denominadores del desglose). */
export function sovereignByContinent(): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of ONLY_COUNTRIES) m.set(c.continent, (m.get(c.continent) ?? 0) + 1)
  return m
}
