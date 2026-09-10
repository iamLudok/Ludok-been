// Conversión entre las filas de SQLite y los objetos del dominio.
//
// Está centralizado a propósito: la lista de transportes se guarda como JSON
// en una columna de texto, y si ese ida y vuelta estuviera repetido en cada
// sitio que lee visitas (las consultas reactivas, las copias, la lógica de
// negocio) acabaría leyéndose bien en unos y mal en otros en cuanto se añada
// un campo nuevo.
import type { VisitRow } from './schema'
import type { Visit } from '../types'

/** Fila de SQLite → objeto de dominio. */
export function rowToVisit(row: VisitRow): Visit {
  return {
    code: row.code,
    status: row.status,
    year: row.year ?? undefined,
    transports: parseTransports(row.transports),
    addedAt: row.addedAt,
    updatedAt: row.updatedAt,
  }
}

/** Objeto de dominio → fila de SQLite. */
export function visitToRow(visit: Visit): VisitRow {
  return {
    code: visit.code,
    status: visit.status,
    year: visit.year ?? null,
    transports: serializeTransports(visit.transports),
    addedAt: visit.addedAt,
    updatedAt: visit.updatedAt,
  }
}

/**
 * Texto de la columna → lista. Devuelve `undefined` cuando no hay nada, para
 * que el campo simplemente no aparezca en el JSON de la copia en vez de salir
 * como `null` o como lista vacía.
 */
export function parseTransports(raw: string | null | undefined): string[] | undefined {
  if (!raw) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return undefined
    const list = parsed.filter((t): t is string => typeof t === 'string' && t.length > 0)
    return list.length ? list : undefined
  } catch {
    return undefined
  }
}

/** Lista → texto de la columna (null si está vacía). */
export function serializeTransports(list: string[] | undefined): string | null {
  if (!list || list.length === 0) return null
  return JSON.stringify(list)
}
