// Altas/bajas de países y cálculo de estadísticas.
import { db } from './db'
import { getByCca3, WORLD_TOTAL, sovereignByContinent } from './countries'
import type { CountryStatus, Visit } from '../types'

/** Marca o actualiza el estado de un país. */
export async function setStatus(
  code: string,
  status: CountryStatus,
  year?: number,
): Promise<void> {
  const now = Date.now()
  const existing = await db.visits.get(code)
  const visit: Visit = {
    code,
    status,
    year: year ?? existing?.year,
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
  }
  await db.visits.put(visit)
}

/** Actualiza solo el año de una visita existente. */
export async function setYear(code: string, year?: number): Promise<void> {
  const existing = await db.visits.get(code)
  if (!existing) return
  await db.visits.put({ ...existing, year, updatedAt: Date.now() })
}

/** Quita el país (vuelve a "no marcado"). */
export async function clearStatus(code: string): Promise<void> {
  await db.visits.delete(code)
}

export interface ContinentStat {
  continent: string
  been: number
  total: number
}

export interface Stats {
  been: number
  want: number
  worldTotal: number
  /** porcentaje del mundo visitado (0–100, un decimal). */
  percent: number
  /** continentes con al menos un país visitado. */
  continentsVisited: number
  byContinent: ContinentStat[]
}

/** Calcula las estadísticas a partir de las visitas. */
export function computeStats(visits: Visit[]): Stats {
  const been = visits.filter((v) => v.status === 'been')
  const want = visits.filter((v) => v.status === 'want')

  const totals = sovereignByContinent()
  const beenByContinent = new Map<string, number>()
  for (const v of been) {
    const c = getByCca3(v.code)
    // Solo cuentan los soberanos para el % (coherente con WORLD_TOTAL).
    if (!c?.independent) continue
    beenByContinent.set(c.continent, (beenByContinent.get(c.continent) ?? 0) + 1)
  }

  const byContinent: ContinentStat[] = [...totals.entries()]
    .map(([continent, total]) => ({
      continent,
      total,
      been: beenByContinent.get(continent) ?? 0,
    }))
    .sort((a, b) => b.been - a.been || a.continent.localeCompare(b.continent, 'es'))

  const beenSovereign = [...beenByContinent.values()].reduce((a, b) => a + b, 0)

  return {
    been: been.length,
    want: want.length,
    worldTotal: WORLD_TOTAL,
    percent: WORLD_TOTAL ? Math.round((beenSovereign / WORLD_TOTAL) * 1000) / 10 : 0,
    continentsVisited: [...beenByContinent.keys()].length,
    byContinent,
  }
}
