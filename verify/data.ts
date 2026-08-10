/**
 * Verificación de la Fase 2: la ida y vuelta de los datos.
 *
 * Ejecuta el MISMO `backupCore` que corre en el móvil, pero contra un SQLite de
 * escritorio, y el mismo DDL que crea la app. Comprueba que un JSON con el
 * formato exacto de la PWA entra intacto y vuelve a salir igual.
 *
 * Fichero de verificación temporal, no forma parte de la app.
 */
// libsql y no better-sqlite3: better-sqlite3 es sincrónico y no admite
// transacciones asíncronas, mientras expo-sqlite (el del móvil) sí. Con libsql
// la semántica async coincide con la real y se ejecuta el mismo código.
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import * as schema from '../src/lib/schema'
import { CREATE_SQL } from '../src/lib/schemaSql'
import { exportAll, importAll, type LudokDb } from '../src/lib/backupCore'
import type { BackupFile, Visit } from '../src/types'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}
function eq<T>(label: string, actual: T, expected: T) {
  check(label, actual === expected, actual === expected ? '' : `esperado ${expected}, salió ${actual}`)
}

// Fichero temporal en vez de ':memory:': una base en memoria NO se comparte
// entre conexiones, y las transacciones abren la suya, así que las tablas
// desaparecían dentro de la transacción. Con fichero se comporta como en el
// móvil, que también usa un fichero.
let dbSeq = 0
const tempFiles: string[] = []
async function freshDb(): Promise<LudokDb> {
  const path = join(tmpdir(), `ludok-been-verify-${process.pid}-${dbSeq++}.db`)
  rmSync(path, { force: true })
  tempFiles.push(path)
  const client = createClient({ url: `file:${path}` })
  await client.executeMultiple(CREATE_SQL)
  return drizzle(client, { schema }) as unknown as LudokDb
}
function cleanupTempFiles() {
  for (const f of tempFiles) {
    for (const suffix of ['', '-wal', '-shm']) rmSync(f + suffix, { force: true })
  }
}

/* --- Una copia con la forma EXACTA que exporta la PWA -------------------- */

const visits: Visit[] = [
  { code: 'ESP', status: 'been', year: 2019, addedAt: 1700000000000, updatedAt: 1700000000000 },
  { code: 'FRA', status: 'been', addedAt: 1700000100000, updatedAt: 1700000100000 }, // sin año
  { code: 'JPN', status: 'want', addedAt: 1700000200000, updatedAt: 1700000200000 },
]

const pwaBackup: BackupFile = {
  app: 'ludok-been',
  schemaVersion: 1,
  exportedAt: 1700001000000,
  visits,
  settings: { id: 'app', theme: 'dark', lastBackup: 1700000900000, schemaVersion: 1 },
}

async function main() {
  console.log('\n=== 1. Importar el JSON de la PWA ===')
  const db = await freshDb()
  const res = await importAll(db, JSON.stringify(pwaBackup))
  eq('países importados', res.visits, 3)

  console.log('\n=== 2. Los datos cuadran ===')
  const out = await exportAll(db)
  eq('nº de países', out.visits.length, 3)
  eq('visitados', out.visits.filter((v) => v.status === 'been').length, 2)
  eq('por ir', out.visits.filter((v) => v.status === 'want').length, 1)
  eq('tema restaurado', out.settings?.theme, 'dark')

  console.log('\n=== 3. Campo a campo, sin pérdidas ===')
  for (const original of visits) {
    const back = out.visits.find((v) => v.code === original.code)
    if (!back) {
      check(`país ${original.code} presente`, false)
      continue
    }
    const same = JSON.stringify(sorted(original)) === JSON.stringify(sorted(back))
    check(
      `${original.code} idéntico`,
      same,
      same ? '' : `\n    antes: ${JSON.stringify(sorted(original))}\n    ahora: ${JSON.stringify(sorted(back))}`,
    )
  }

  console.log('\n=== 4. Los huecos siguen siendo huecos (año ausente, no 0/null) ===')
  const fra = out.visits.find((v) => v.code === 'FRA')!
  check('FRA sin año', !('year' in stripUndef(fra)))

  console.log('\n=== 5. Reemplaza en vez de acumular ===')
  const second: BackupFile = {
    ...pwaBackup,
    visits: [{ code: 'ITA', status: 'been', addedAt: 1700002000000, updatedAt: 1700002000000 }],
  }
  await importAll(db, JSON.stringify(second))
  const afterSecond = await exportAll(db)
  eq('solo queda lo de la segunda copia', afterSecond.visits.length, 1)
  eq('el país es ITA', afterSecond.visits[0]?.code, 'ITA')

  console.log('\n=== 6. Volumen grande ===')
  const db3 = await freshDb()
  const many: Visit[] = Array.from({ length: 250 }, (_, i) => ({
    code: `Z${String(i).padStart(2, '0')}`,
    status: i % 2 === 0 ? ('been' as const) : ('want' as const),
    addedAt: 1700000000000 + i,
    updatedAt: 1700000000000 + i,
  }))
  const t0 = Date.now()
  const big = await importAll(db3, JSON.stringify({ ...pwaBackup, visits: many }))
  const ms = Date.now() - t0
  eq('250 países importados', big.visits, 250)
  const bigOut = await exportAll(db3)
  eq('250 países leídos de vuelta', bigOut.visits.length, 250)
  console.log(`        (${ms} ms)`)

  console.log('\n=== 7. Rechaza lo que no debe aceptar ===')
  await rejects('un JSON inválido', async () => importAll(await freshDb(), '{no es json'))
  await rejects('un JSON que no es de Ludok Been', async () =>
    importAll(await freshDb(), JSON.stringify({ app: 'otra-cosa', visits: [] })),
  )
  await rejects('una copia de una versión más nueva', async () =>
    importAll(await freshDb(), JSON.stringify({ ...pwaBackup, schemaVersion: 99 })),
  )

  console.log('\n=== 8. La versión del formato sigue siendo la de la web ===')
  eq('schemaVersion exportada', out.schemaVersion, 1)

  console.log(
    failures === 0
      ? '\n✅ TODO CORRECTO — los datos entran y salen sin perder nada\n'
      : `\n❌ ${failures} COMPROBACIONES FALLIDAS\n`,
  )
  cleanupTempFiles()
  process.exit(failures === 0 ? 0 : 1)
}

/** Quita las claves undefined, para comparar solo lo que llega al JSON. */
function stripUndef<T extends object>(o: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(o))
}
/** Normaliza el orden de claves para poder comparar dos objetos como texto. */
function sorted(o: object): Record<string, unknown> {
  const plain = stripUndef(o)
  return Object.fromEntries(Object.keys(plain).sort().map((k) => [k, plain[k]]))
}

async function rejects(label: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    check(`rechaza ${label}`, false, 'no lanzó error')
  } catch {
    check(`rechaza ${label}`, true)
  }
}

main().catch((e) => {
  console.error('\nEl test se rompió:', e)
  process.exit(1)
})
