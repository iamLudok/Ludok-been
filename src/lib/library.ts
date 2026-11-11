// Altas/bajas de países y cálculo de estadísticas.
import { eq } from 'drizzle-orm'
import { getDb } from './dbRef'
import { visits as visitsTable } from './schema'
import { getByCca3, WORLD_TOTAL, TERRITORIES, sovereignByContinent, sovereignSlot } from './countries'
import { serializeTransports } from './rows'
import type { CountryStatus, Visit } from '../types'

/**
 * Marca o actualiza el estado de un país. Los transportes ya marcados se
 * conservan: no están en el `set`, así que un cambio de estado no los pisa.
 */
export async function setStatus(code: string, status: CountryStatus, year?: number): Promise<void> {
  const db = getDb()
  const now = Date.now()
  const existing = (await db.select().from(visitsTable).where(eq(visitsTable.code, code)).limit(1))[0]
  const visit = {
    code,
    status,
    year: year ?? existing?.year ?? null,
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
  }
  await db.insert(visitsTable).values(visit).onConflictDoUpdate({ target: visitsTable.code, set: visit })
}

/**
 * Guarda los medios de transporte de un país. Si el país aún no estaba
 * marcado, lo crea como visitado: marcar «llegué en avión» a un sitio donde no
 * has estado no tendría sentido, y así no se pierde lo que acabas de tocar.
 */
export async function setTransports(code: string, transports: string[]): Promise<void> {
  const db = getDb()
  const now = Date.now()
  const existing = (await db.select().from(visitsTable).where(eq(visitsTable.code, code)).limit(1))[0]
  const row = {
    code,
    status: existing?.status ?? ('been' as CountryStatus),
    year: existing?.year ?? null,
    transports: serializeTransports(transports),
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
  }
  await db.insert(visitsTable).values(row).onConflictDoUpdate({ target: visitsTable.code, set: row })
}

/** Actualiza solo el año de una visita existente. */
export async function setYear(code: string, year?: number): Promise<void> {
  const db = getDb()
  const existing = (await db.select().from(visitsTable).where(eq(visitsTable.code, code)).limit(1))[0]
  if (!existing) return
  await db
    .update(visitsTable)
    .set({ year: year ?? null, updatedAt: Date.now() })
    .where(eq(visitsTable.code, code))
}

/** Quita el país (vuelve a "no marcado"). */
export async function clearStatus(code: string): Promise<void> {
  await getDb().delete(visitsTable).where(eq(visitsTable.code, code))
}

export interface ContinentStat {
  continent: string
  been: number
  total: number
}

export interface Stats {
  /** Países visitados (de los 195). Escocia y Gales juntos suman 1: el Reino Unido. */
  been: number
  /** Todo lo marcado como «quiero ir», países y territorios. */
  want: number
  /** Territorios visitados, y cuántos hay. Contador aparte de los países. */
  territories: { been: number; total: number }
  worldTotal: number
  /** porcentaje del mundo visitado (0–100, un decimal). */
  percent: number
  /** continentes con al menos un país visitado. */
  continentsVisited: number
  byContinent: ContinentStat[]
}

/** Calcula las estadísticas a partir de las visitas. Pura: no toca la base. */
export function computeStats(visits: Visit[]): Stats {
  const been = visits.filter((v) => v.status === 'been')
  const want = visits.filter((v) => v.status === 'want')

  const totals = sovereignByContinent()
  // Un set de slots (no un contador) para que, si se visitan varias naciones
  // que comparten el mismo `sovereignCode` (p.ej. Escocia y Gales), el país
  // soberano solo sume 1 vez, igual que en sovereignByContinent/WORLD_TOTAL.
  const beenByContinent = new Map<string, Set<string>>()
  for (const v of been) {
    const c = getByCca3(v.code)
    const slot = c ? sovereignSlot(c) : undefined
    // El continente es el del PAÍS al que suma, no el del sitio visitado:
    // Canarias está en África pero suma España, que está en Europa. Con el
    // del sitio, Canarias + España contaban España dos veces.
    const continent = slot ? getByCca3(slot)?.continent : undefined
    if (!slot || !continent) continue
    const slots = beenByContinent.get(continent) ?? new Set<string>()
    slots.add(slot)
    beenByContinent.set(continent, slots)
  }

  const byContinent: ContinentStat[] = [...totals.entries()]
    .map(([continent, total]) => ({
      continent,
      total,
      been: beenByContinent.get(continent)?.size ?? 0,
    }))
    .sort((a, b) => b.been - a.been || a.continent.localeCompare(b.continent, 'es'))

  const beenSovereign = [...beenByContinent.values()].reduce((a, s) => a + s.size, 0)

  const territoriesBeen = been.filter((v) => getByCca3(v.code)?.kind === 'territory').length

  return {
    been: beenSovereign,
    want: want.length,
    territories: { been: territoriesBeen, total: TERRITORIES.length },
    worldTotal: WORLD_TOTAL,
    percent: WORLD_TOTAL ? Math.round((beenSovereign / WORLD_TOTAL) * 1000) / 10 : 0,
    continentsVisited: [...beenByContinent.keys()].length,
    byContinent,
  }
}

/**
 * Estado con el que se pinta cada sitio en el mapa: el suyo, y además un país
 * sale como visitado si has estado en una región o nación que forma parte de
 * él (`sovereignCode`). Si fuiste a Escocia, el Reino Unido se ve visitado,
 * igual que ya suma en el «% del mundo». Una dependencia no tiñe a su país:
 * Gibraltar no pinta el Reino Unido.
 */
export function mapStatuses(visits: Visit[]): Map<string, CountryStatus> {
  const m = new Map<string, CountryStatus>(visits.map((v) => [v.code, v.status]))
  for (const v of visits) {
    if (v.status !== 'been') continue
    const owner = getByCca3(v.code)?.sovereignCode
    if (owner) m.set(owner, 'been')
  }
  return m
}
