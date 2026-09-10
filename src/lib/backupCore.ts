// Núcleo de las copias de seguridad: solo consultas Drizzle, sin nada nativo.
//
// Está separado de `backup.ts` a propósito. Aquí no se importa expo-file-system
// ni expo-sqlite, así que este código se puede ejecutar tal cual en Node contra
// un SQLite de escritorio para probarlo. Como recibe la base de datos por
// parámetro, el test ejecuta EXACTAMENTE el mismo código que corre en el móvil.
import { eq } from 'drizzle-orm'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { visits as visitsTable, settings as settingsTable } from './schema'
import { rowToVisit, visitToRow } from './rows'
import { SCHEMA_VERSION } from './version'
import type { BackupFile, Settings } from '../types'

export { SCHEMA_VERSION }

/** Cualquier base de datos SQLite de Drizzle (expo-sqlite en el móvil, libsql en los tests). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LudokDb = BaseSQLiteDatabase<any, any, any>

const APP_ID = 'ludok-been'

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  theme: 'system',
  lastBackup: 0,
  schemaVersion: SCHEMA_VERSION,
  autoBackup: false,
}

export async function readSettings(database: LudokDb): Promise<Settings> {
  const rows = await database
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, 'app'))
    .limit(1)
  return rows[0] ? (rows[0] as Settings) : DEFAULT_SETTINGS
}

export async function writeSettings(database: LudokDb, next: Settings): Promise<void> {
  await database
    .insert(settingsTable)
    .values(next)
    .onConflictDoUpdate({ target: settingsTable.id, set: next })
}

/** Serializa toda la base de datos a un objeto de copia. */
export async function exportAll(database: LudokDb): Promise<BackupFile> {
  const visitRows = await database.select().from(visitsTable)
  const settings = await readSettings(database)
  // La contraseña de Nextcloud NO se exporta. Una copia se comparte y se mueve
  // de sitio, y esa contraseña da permiso de ESCRITURA sobre tus ficheros; la
  // propia copia acaba subida ahí, así que además viajaría con su propia llave
  // dentro. Al restaurar en otro móvil hay que volver a escribirla, y punto.
  const { nextcloudPassword: _omitted, ...safeSettings } = settings
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    visits: visitRows.map(rowToVisit),
    settings: safeSettings,
  }
}

export interface ImportResult {
  visits: number
}

function isBackupFile(data: unknown): data is BackupFile {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return d.app === APP_ID && typeof d.schemaVersion === 'number' && Array.isArray(d.visits)
}

/**
 * Importa una copia, reemplazando el contenido actual. Valida el formato y el
 * schemaVersion antes de tocar nada. Todo dentro de una transacción: si algo
 * falla a mitad no se queda la base de datos a medias.
 */
export async function importAll(database: LudokDb, raw: string): Promise<ImportResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('El fichero no es un JSON válido.')
  }
  if (!isBackupFile(parsed)) {
    throw new Error('Este fichero no es una copia de Ludok Been.')
  }
  if (parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `La copia es de una versión más nueva (v${parsed.schemaVersion}). Actualiza la app antes de importar.`,
    )
  }

  await database.transaction(async (tx: LudokDb) => {
    await tx.delete(visitsTable)
    if (parsed.visits.length) {
      await tx.insert(visitsTable).values(parsed.visits.map(visitToRow))
    }
    if (parsed.settings) {
      // La contraseña de Nextcloud no viene en la copia (no se exporta), así
      // que se mantiene la que ya hubiera en este móvil.
      const current = await readSettings(tx)
      await writeSettings(tx, {
        ...current,
        ...parsed.settings,
        nextcloudPassword: current.nextcloudPassword,
        id: 'app',
        schemaVersion: SCHEMA_VERSION,
      })
    }
  })

  return { visits: parsed.visits.length }
}

/** Días transcurridos desde la última copia. null si nunca se hizo. */
export function daysSinceBackup(lastBackup: number): number | null {
  if (!lastBackup) return null
  return Math.floor((Date.now() - lastBackup) / 86_400_000)
}
