/**
 * Verificación de la Fase 2: que las reglas de negocio portadas de la web
 * siguen comportándose igual.
 *
 * Ejecuta el `library.ts` real (el mismo que corre en el móvil) contra un
 * SQLite de escritorio, gracias a que la base de datos se pide por `dbRef`.
 */
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import * as schema from '../src/lib/schema'
import { CREATE_SQL } from '../src/lib/schemaSql'
import { setDb } from '../src/lib/dbRef'
import type { LudokDb } from '../src/lib/backupCore'
import { setStatus, setYear, clearStatus, computeStats } from '../src/lib/library'
import { exportAll } from '../src/lib/backupCore'
import type { Visit } from '../src/types'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}
function eq<T>(label: string, actual: T, expected: T) {
  check(label, actual === expected, actual === expected ? '' : `esperado ${expected}, salió ${actual}`)
}

const tempFiles: string[] = []
let seq = 0
async function useFreshDb(): Promise<void> {
  const path = join(tmpdir(), `ludok-been-lib-${process.pid}-${seq++}.db`)
  rmSync(path, { force: true })
  tempFiles.push(path)
  const client = createClient({ url: `file:${path}` })
  await client.executeMultiple(CREATE_SQL)
  setDb(drizzle(client, { schema }) as unknown as LudokDb)
}
function cleanup() {
  for (const f of tempFiles) for (const s of ['', '-wal', '-shm']) rmSync(f + s, { force: true })
}

async function main() {
  console.log('\n=== 1. setStatus crea y actualiza ===')
  await useFreshDb()
  await setStatus('ESP', 'been', 2019)
  let out = await exportAll(await currentDb())
  let esp = out.visits.find((v) => v.code === 'ESP')
  eq('ESP creado como been', esp?.status, 'been')
  eq('ESP con año 2019', esp?.year, 2019)
  const firstAddedAt = esp!.addedAt

  await new Promise((r) => setTimeout(r, 5))
  await setStatus('ESP', 'want')
  out = await exportAll(await currentDb())
  esp = out.visits.find((v) => v.code === 'ESP')
  eq('ESP pasa a want', esp?.status, 'want')
  eq('el año se conserva si no se pasa uno nuevo', esp?.year, 2019)
  eq('addedAt no cambia al re-marcar', esp?.addedAt, firstAddedAt)
  check('updatedAt avanza al re-marcar', (esp?.updatedAt ?? 0) > firstAddedAt)

  console.log('\n=== 2. setYear solo toca países existentes ===')
  await setYear('ESP', 2023)
  out = await exportAll(await currentDb())
  eq('año actualizado', out.visits.find((v) => v.code === 'ESP')?.year, 2023)

  await setYear('FRA', 2020) // FRA no existe: no debe crear nada
  out = await exportAll(await currentDb())
  check('setYear sobre país inexistente no crea fila', !out.visits.some((v) => v.code === 'FRA'))

  console.log('\n=== 3. clearStatus borra ===')
  await clearStatus('ESP')
  out = await exportAll(await currentDb())
  check('ESP ya no está', !out.visits.some((v) => v.code === 'ESP'))

  console.log('\n=== 4. computeStats: solo cuentan los soberanos ===')
  await useFreshDb()
  await setStatus('ESP', 'been', 2019) // soberano, Europa
  await setStatus('FRA', 'been', 2018) // soberano, Europa
  await setStatus('ATA', 'been') // Antártida: no soberano, no debe contar
  await setStatus('JPN', 'want') // por ir, no cuenta como "been"
  const visits = (await exportAll(await currentDb())).visits
  const stats = computeStats(visits)
  eq('been = 3 (cuenta también el no soberano en el recuento bruto)', stats.been, 3)
  eq('want = 1', stats.want, 1)
  check('percent > 0', stats.percent > 0)
  eq('continentsVisited = 1 (solo Europa cuenta, ATA no es soberano)', stats.continentsVisited, 1)
  const europa = stats.byContinent.find((c) => c.continent === 'Europa')
  eq('Europa tiene 2 been (ESP+FRA, no ATA)', europa?.been, 2)

  console.log(
    failures === 0
      ? '\n✅ TODO CORRECTO — las reglas de negocio se comportan igual\n'
      : `\n❌ ${failures} COMPROBACIONES FALLIDAS\n`,
  )
  cleanup()
  process.exit(failures === 0 ? 0 : 1)
}

// Pequeño atajo: como `getDb()` no se expone aquí directamente (se pide vía
// dbRef dentro de cada función de library.ts), re-exportamos para leer el
// estado actual en las comprobaciones de este script.
import { getDb } from '../src/lib/dbRef'
async function currentDb(): Promise<LudokDb> {
  return getDb()
}

main().catch((e) => {
  console.error('\nEl test se rompió:', e)
  process.exit(1)
})
