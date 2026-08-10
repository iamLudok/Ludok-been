/**
 * Verificación de la Fase 2: que crear/migrar el esquema es idempotente.
 *
 * Con MIGRATIONS vacío (esquema nace en v1) esto es fino de momento, pero es
 * la red de seguridad que hace falta tener puesta ANTES de que MIGRATIONS
 * tenga su primer paso real — igual que en Ludok Time.
 */
import { createClient } from '@libsql/client'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { CREATE_SQL, MIGRATIONS, DB_VERSION } from '../src/lib/schemaSql'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}
function eq<T>(label: string, actual: T, expected: T) {
  check(label, actual === expected, actual === expected ? '' : `esperado ${expected}, salió ${actual}`)
}

async function main() {
  const path = join(tmpdir(), `ludok-been-migration-${process.pid}.db`)
  rmSync(path, { force: true })
  const client = createClient({ url: `file:${path}` })

  console.log('\n=== 1. Crear el esquema en una base nueva ===')
  await client.executeMultiple(CREATE_SQL)
  await client.execute('INSERT INTO visits (code, status, addedAt, updatedAt) VALUES (?, ?, ?, ?)', [
    'ESP',
    'been',
    1700000000000,
    1700000000000,
  ])
  const rows1 = await client.execute('SELECT * FROM visits')
  eq('una fila insertada', rows1.rows.length, 1)

  console.log('\n=== 2. Re-ejecutar CREATE_SQL no destruye datos (IF NOT EXISTS) ===')
  await client.executeMultiple(CREATE_SQL)
  const rows2 = await client.execute('SELECT * FROM visits')
  eq('la fila sigue ahí', rows2.rows.length, 1)

  console.log('\n=== 3. DB_VERSION coincide con MIGRATIONS.length + 1 ===')
  eq('DB_VERSION', DB_VERSION, MIGRATIONS.length + 1)

  console.log('\n=== 4. user_version se puede fijar y volver a leer ===')
  await client.execute(`PRAGMA user_version = ${DB_VERSION}`)
  const uv = await client.execute('PRAGMA user_version')
  eq('user_version guardado', Number(uv.rows[0]?.user_version ?? -1), DB_VERSION)

  console.log(
    failures === 0
      ? '\n✅ TODO CORRECTO — el esquema se crea de forma idempotente\n'
      : `\n❌ ${failures} COMPROBACIONES FALLIDAS\n`,
  )
  for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true })
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\nEl test se rompió:', e)
  process.exit(1)
})
