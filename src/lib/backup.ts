// Copia de seguridad: exportar/importar todas las tablas en un único JSON.
// Es una función de primera clase: la prioridad es no perder los datos nunca.
import { db, SCHEMA_VERSION, updateSettings } from './db'
import type { BackupFile, Settings } from '../types'

const APP_ID = 'ludok-been'

/** Serializa todas las tablas a un objeto BackupFile. */
export async function exportAll(): Promise<BackupFile> {
  const [visits, settings] = await Promise.all([
    db.visits.toArray(),
    db.settings.get('app'),
  ])
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    visits,
    settings: settings ?? null,
  }
}

/** Nombre de fichero sugerido: ludok-been-2026-07-21.json */
export function backupFilename(date = new Date()): string {
  const iso = date.toISOString().slice(0, 10)
  return `${APP_ID}-${iso}.json`
}

function isBackupFile(data: unknown): data is BackupFile {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return d.app === APP_ID && typeof d.schemaVersion === 'number' && Array.isArray(d.visits)
}

export interface ImportResult {
  visits: number
}

/**
 * Importa un JSON de copia, reemplazando el contenido actual.
 * Valida el formato y el schemaVersion antes de tocar nada.
 */
export async function importAll(json: string): Promise<ImportResult> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('El fichero no es un JSON válido.')
  }
  if (!isBackupFile(data)) {
    throw new Error('Este fichero no es una copia de Ludok Been.')
  }
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `La copia es de una versión más nueva (v${data.schemaVersion}). Actualiza la app antes de importar.`,
    )
  }

  await db.transaction('rw', db.visits, db.settings, async () => {
    await db.visits.clear()
    await db.visits.bulkPut(data.visits)
    if (data.settings) {
      const merged: Settings = { ...data.settings, id: 'app', schemaVersion: SCHEMA_VERSION }
      await db.settings.put(merged)
    }
  })

  return { visits: data.visits.length }
}

/** Marca que se acaba de hacer una copia (para el aviso de "días sin copia"). */
export async function markBackupDone(): Promise<void> {
  await updateSettings({ lastBackup: Date.now() })
}

/** Días transcurridos desde la última copia. null si nunca se hizo. */
export function daysSinceBackup(lastBackup: number): number | null {
  if (!lastBackup) return null
  return Math.floor((Date.now() - lastBackup) / 86_400_000)
}

/**
 * Descarga la copia como fichero. En móvil intenta la Web Share API (para
 * mandarla a Archivos/Nextcloud/Drive); en escritorio, descarga normal.
 */
export async function shareOrDownloadBackup(): Promise<void> {
  const backup = await exportAll()
  const json = JSON.stringify(backup, null, 2)
  const filename = backupFilename()
  const file = new File([json], filename, { type: 'application/json' })

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Copia de Ludok Been' })
      await markBackupDone()
      return
    } catch (err) {
      // Cancelado por el usuario: no es un error real.
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Si compartir falla por otro motivo, caemos a la descarga.
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  await markBackupDone()
}
