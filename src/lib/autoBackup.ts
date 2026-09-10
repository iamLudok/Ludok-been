import * as Network from 'expo-network'
import { exportAll } from './backup'
import { getSettings, updateSettings } from './settings'
import { configFrom, uploadFile } from './nextcloud'

/**
 * Copia automática al Nextcloud propio.
 *
 * Se dispara al abrir la app (y al volver a ella), no con una tarea en segundo
 * plano: Android mata esas tareas de forma agresiva y encima serían invisibles.
 * Como la app se abre a menudo para marcar países, en la práctica la copia
 * acaba siendo frecuente sin que haya que acordarse de nada.
 *
 * Solo por WiFi, que es lo que se pidió: en datos móviles ni se intenta.
 */

/** Tiempo mínimo entre subidas automáticas. */
const EVERY_MS = 12 * 60 * 60 * 1000

export type AutoBackupResult =
  | { status: 'ok'; filename: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; message: string }

function filenameFor(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  // Un fichero por día: se reemplaza dentro del mismo día y queda un histórico
  // de días, que es justo lo que sirve si un día metes la pata con los datos.
  return `ludok-been-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

/** Sube la copia ahora mismo, sin mirar WiFi ni cuánto hace de la última. */
export async function backupNow(): Promise<AutoBackupResult> {
  const settings = await getSettings()
  const config = configFrom(settings)
  if (!config) return { status: 'skipped', reason: 'Falta configurar el servidor.' }

  try {
    const data = await exportAll()
    const filename = filenameFor()
    await uploadFile(config, filename, JSON.stringify(data, null, 2))
    const now = Date.now()
    // `lastBackup` también, para que el aviso de «llevas X días sin copia» se
    // entere: una copia subida a tu servidor cuenta como copia.
    await updateSettings({ lastAutoBackupAt: now, lastBackup: now })
    return { status: 'ok', filename }
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

/**
 * La llama la app al arrancar y al volver del segundo plano. Comprueba ella
 * misma si toca, así que se puede invocar sin miedo tantas veces como haga falta.
 */
export async function maybeAutoBackup(): Promise<AutoBackupResult> {
  const settings = await getSettings()
  if (!settings.autoBackup) return { status: 'skipped', reason: 'Desactivada.' }
  if (!configFrom(settings)) return { status: 'skipped', reason: 'Falta configurar el servidor.' }

  const since = Date.now() - (settings.lastAutoBackupAt ?? 0)
  if (since < EVERY_MS) return { status: 'skipped', reason: 'Ya se hizo hace poco.' }

  const net = await Network.getNetworkStateAsync()
  if (net.type !== Network.NetworkStateType.WIFI) {
    return { status: 'skipped', reason: 'No estás en WiFi.' }
  }
  if (net.isInternetReachable === false) {
    return { status: 'skipped', reason: 'La red no llega a ningún sitio.' }
  }

  return backupNow()
}
