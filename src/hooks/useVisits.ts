import { useLiveQuery } from 'drizzle-orm/expo-sqlite'
import { db } from '../lib/db'
import { visits as visitsTable } from '../lib/schema'
import { rowToVisit } from '../lib/rows'
import type { Visit } from '../types'

/** Todas las visitas, reactivo. */
export function useVisits(): { data: Visit[]; ready: boolean } {
  const { data, updatedAt } = useLiveQuery(db.select().from(visitsTable))
  return {
    data: (data ?? []).map(rowToVisit),
    ready: updatedAt !== undefined,
  }
}
