// Extremos: hasta dónde has llegado hacia cada punto cardinal, y lo más
// lejos de casa.
//
// Se mide con el CENTRO de cada sitio (`latlng` en countries.json), no con
// su punto más extremo: haber estado en Rusia no es haber pisado el Ártico.
// Por eso cuentan también los territorios: Svalbard sí te lleva a 78° N.
import { getByCca3 } from './countries'
import type { Visit } from '../types'

/** Radio medio de la Tierra, en km. */
const EARTH_KM = 6371

export interface Extreme {
  code: string
  /** Grados: latitud para norte y sur, longitud para este y oeste. */
  degrees: number
}

export interface Extremes {
  north: Extreme
  south: Extreme
  east: Extreme
  west: Extreme
  /** Solo si has elegido tu país y has estado en algún otro sitio. */
  farthest?: { code: string; km: number }
}

/** Distancia por la superficie (círculo máximo) entre dos [lat, lon], en km. */
export function distanceKm([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Los extremos de lo visitado («quiero ir» no cuenta). `undefined` si aún no
 * has marcado nada.
 *
 * Este y oeste van por longitud sin más, como en un mapa: Fiyi queda al
 * este y Samoa al oeste aunque estén cerca, porque la línea de cambio de
 * fecha pasa entre ellas. Es lo que cualquiera espera al mirar el mapa.
 */
export function extremesOf(visits: Visit[], homeCode?: string | null): Extremes | undefined {
  const places = visits
    .filter((v) => v.status === 'been')
    .map((v) => getByCca3(v.code))
    .filter((c) => !!c)
  if (!places.length) return undefined

  const pick = (axis: 0 | 1, sign: 1 | -1): Extreme => {
    let best = places[0]
    for (const c of places) if (sign * c.latlng[axis] > sign * best.latlng[axis]) best = c
    return { code: best.cca3, degrees: best.latlng[axis] }
  }

  const result: Extremes = {
    north: pick(0, 1),
    south: pick(0, -1),
    east: pick(1, 1),
    west: pick(1, -1),
  }

  const home = homeCode ? getByCca3(homeCode) : undefined
  if (home) {
    let far: { code: string; km: number } | undefined
    for (const c of places) {
      if (c.cca3 === home.cca3) continue
      const km = distanceKm(home.latlng, c.latlng)
      if (!far || km > far.km) far = { code: c.cca3, km }
    }
    if (far) result.farthest = { code: far.code, km: Math.round(far.km) }
  }
  return result
}

/** «78° N», «34° S», «2° O»… sin decimales: más precisión no significa nada con centros. */
export function formatDegrees(degrees: number, axis: 'lat' | 'lon'): string {
  const n = Math.round(Math.abs(degrees))
  if (n === 0) return '0°'
  const letter = axis === 'lat' ? (degrees > 0 ? 'N' : 'S') : degrees > 0 ? 'E' : 'O'
  return `${n}° ${letter}`
}
