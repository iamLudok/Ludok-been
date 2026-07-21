import Dexie, { type Table } from 'dexie'
import type { Visit, Settings } from '../types'

export const SCHEMA_VERSION = 1

export class LudokBeenDB extends Dexie {
  visits!: Table<Visit, string>
  settings!: Table<Settings, string>

  constructor() {
    super('ludok-been')
    this.version(1).stores({
      // La clave primaria de visits es el código de país (cca3).
      // Solo se indexan los campos por los que consultamos/ordenamos.
      visits: 'code, status, addedAt',
      settings: 'id',
    })
  }
}

export const db = new LudokBeenDB()

/** Genera un id único (usa crypto.randomUUID cuando está disponible). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  theme: 'system',
  lastBackup: 0,
  schemaVersion: SCHEMA_VERSION,
}

/**
 * Lee la configuración SIN escribir. Apto para usar dentro de useLiveQuery
 * (que se ejecuta en una transacción de solo lectura). Si aún no existe la
 * fila, devuelve los valores por defecto en memoria.
 */
export async function readSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? DEFAULT_SETTINGS
}

/** Crea la fila de ajustes por defecto si no existe. Llamar al arrancar. */
export async function ensureSettings(): Promise<Settings> {
  const existing = await db.settings.get('app')
  if (existing) return existing
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

/** Aplica cambios parciales a los ajustes (crea la fila si hace falta). */
export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = (await db.settings.get('app')) ?? DEFAULT_SETTINGS
  await db.settings.put({ ...current, ...patch, id: 'app' })
}
