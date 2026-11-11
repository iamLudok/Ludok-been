// Línea de tiempo: lo que has visitado, año a año.
//
// Sale del año de cada visita (opcional), sin nada guardado aparte. Hoy cada
// sitio tiene UN año: si fuiste a Italia en 2015 y en 2023, sale en el que
// pusiste.
import { getByCca3, sovereignSlot } from './countries'
import type { Visit } from '../types'

export interface TimelineYear {
  year: number
  /** Sitios marcados con este año, ordenados por nombre. */
  codes: string[]
  /**
   * Países que estrenaste ese año: los que no tenías de un año anterior.
   * Escocia en 2019 estrena el Reino Unido, salvo que ya estuvieras en
   * Inglaterra en 2015.
   */
  newCountries: number
  /** Territorios de ese año (cada uno es único: siempre se estrena). */
  territories: number
  /** Países acumulados al acabar ese año (solo con lo que tiene año). */
  totalCountries: number
}

export interface Timeline {
  /** Del más antiguo al más reciente. */
  years: TimelineYear[]
  /** Sitios visitados sin año, ordenados por nombre. */
  undated: string[]
}

const byName = (a: string, b: string) =>
  (getByCca3(a)?.name ?? a).localeCompare(getByCca3(b)?.name ?? b, 'es')

/** Línea de tiempo de lo visitado («quiero ir» no cuenta: no ha pasado). */
export function timelineOf(visits: Visit[]): Timeline {
  const byYear = new Map<number, string[]>()
  const undated: string[] = []
  for (const v of visits) {
    if (v.status !== 'been' || !getByCca3(v.code)) continue
    if (v.year == null) undated.push(v.code)
    else byYear.set(v.year, [...(byYear.get(v.year) ?? []), v.code])
  }

  const seen = new Set<string>()
  const years: TimelineYear[] = [...byYear.keys()]
    .sort((a, b) => a - b)
    .map((year) => {
      const codes = byYear.get(year)!.sort(byName)
      let newCountries = 0
      let territories = 0
      for (const code of codes) {
        const c = getByCca3(code)!
        if (c.kind === 'territory') territories++
        const slot = sovereignSlot(c)
        if (slot && !seen.has(slot)) {
          seen.add(slot)
          newCountries++
        }
      }
      return { year, codes, newCountries, territories, totalCountries: seen.size }
    })

  return { years, undated: undated.sort(byName) }
}

/** «+3 países · 1 territorio», o «Ningún país nuevo» si todo eran repetidos. */
export function yearSummary(newCountries: number, territories: number): string {
  const parts: string[] = []
  if (newCountries) parts.push(`+${newCountries} ${newCountries === 1 ? 'país' : 'países'}`)
  if (territories) parts.push(`${territories} ${territories === 1 ? 'territorio' : 'territorios'}`)
  return parts.join(' · ') || 'Ningún país nuevo'
}
