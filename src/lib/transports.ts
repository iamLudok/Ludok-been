// Medios de transporte que se pueden marcar en cada país.
//
// La lista de siempre va por clave, para que no dependa del idioma ni de cómo
// se escriba. Además se puede añadir cualquier otro a mano (helicóptero,
// camello, lo que sea): esos se guardan con su texto tal cual, y todo lo que
// no esté en esta lista se trata como «otro».

export type TransportKey = 'plane' | 'train' | 'car' | 'bus' | 'boat' | 'moto' | 'bike' | 'walk'

export interface Transport {
  key: TransportKey
  label: string
}

export const TRANSPORTS: readonly Transport[] = [
  { key: 'plane', label: 'Avión' },
  { key: 'train', label: 'Tren' },
  { key: 'car', label: 'Coche' },
  { key: 'bus', label: 'Bus' },
  { key: 'boat', label: 'Barco' },
  { key: 'moto', label: 'Moto' },
  { key: 'bike', label: 'Bici' },
  { key: 'walk', label: 'A pie' },
]

const BY_KEY = new Map<string, Transport>(TRANSPORTS.map((t) => [t.key, t]))

/** True si es uno de la lista de siempre (y no uno escrito a mano). */
export function isKnownTransport(value: string): value is TransportKey {
  return BY_KEY.has(value)
}

/** Nombre legible: el de la lista, o el propio texto si es uno a mano. */
export function transportLabel(value: string): string {
  return BY_KEY.get(value)?.label ?? value
}

/**
 * Normaliza lo que se escribe a mano: recorta espacios y evita que se cuele
 * un duplicado de los de la lista escribiendo «avión» en el campo libre.
 */
export function normalizeCustom(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return null
  const lower = text.toLowerCase()
  const known = TRANSPORTS.find((t) => t.label.toLowerCase() === lower || t.key === lower)
  return known ? known.key : text
}

/** Añade uno a la lista, sin repetir. */
export function addTransport(list: string[] | undefined, value: string): string[] {
  const current = list ?? []
  return current.includes(value) ? current : [...current, value]
}

/** Quita uno de la lista. */
export function removeTransport(list: string[] | undefined, value: string): string[] {
  return (list ?? []).filter((t) => t !== value)
}

/** Marca/desmarca. */
export function toggleTransport(list: string[] | undefined, value: string): string[] {
  return (list ?? []).includes(value)
    ? removeTransport(list, value)
    : addTransport(list, value)
}

export interface TransportStat {
  /** clave de la lista, o el texto tal cual si es uno a mano. */
  value: string
  label: string
  known: boolean
  /** en cuántos países se ha usado. */
  count: number
}

/** Cuántos países por transporte, de más usado a menos. */
export function countByTransport(visits: { transports?: string[] }[]): TransportStat[] {
  const counts = new Map<string, number>()
  for (const v of visits) {
    // Un país cuenta una sola vez por transporte aunque esté repetido.
    for (const t of new Set(v.transports ?? [])) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: transportLabel(value),
      known: isKnownTransport(value),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))
}
