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

  console.log('\n=== 5. Subida real de v1 a v2 (lo que le toca a una instalación ya existente) ===')
  // Esquema tal cual estaba en v1, ANTES de las columnas de Nextcloud —
  // simula el móvil que ya tiene la app instalada.
  const V1_SQL = `
    CREATE TABLE IF NOT EXISTS visits (
      code TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL, year INTEGER,
      addedAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY NOT NULL, theme TEXT NOT NULL DEFAULT 'system',
      lastBackup INTEGER NOT NULL DEFAULT 0, schemaVersion INTEGER NOT NULL
    );
  `
  const path2 = join(tmpdir(), `ludok-been-migration-v1-${process.pid}.db`)
  rmSync(path2, { force: true })
  const client2 = createClient({ url: `file:${path2}` })
  await client2.executeMultiple(V1_SQL)
  await client2.execute(`PRAGMA user_version = 1`)
  await client2.execute('INSERT INTO settings (id, theme, lastBackup, schemaVersion) VALUES (?, ?, ?, ?)', [
    'app',
    'dark',
    1700000000000,
    1,
  ])
  await client2.execute('INSERT INTO visits (code, status, addedAt, updatedAt) VALUES (?, ?, ?, ?)', [
    'ESP',
    'been',
    1700000000000,
    1700000000000,
  ])

  // Mismo procedimiento que `migrateSync()` de src/lib/db.ts.
  const row = await client2.execute('PRAGMA user_version')
  const current = Number(row.rows[0]?.user_version ?? 0)
  check('arranca en v1', current === 1)
  await client2.executeMultiple(CREATE_SQL)
  if (current > 0) {
    for (const step of MIGRATIONS.slice(current - 1)) await client2.executeMultiple(step)
  }
  await client2.execute(`PRAGMA user_version = ${DB_VERSION}`)

  const uv2 = await client2.execute('PRAGMA user_version')
  eq('queda en la versión actual', Number(uv2.rows[0]?.user_version ?? -1), DB_VERSION)

  const settingsRow = await client2.execute('SELECT * FROM settings WHERE id = ?', ['app'])
  check('el ajuste de tema sigue ahí (no se perdió nada)', settingsRow.rows[0]?.theme === 'dark')
  check(
    'las columnas nuevas existen y están vacías, no rompen la fila vieja',
    'nextcloudUrl' in (settingsRow.rows[0] ?? {}) && settingsRow.rows[0]?.nextcloudUrl == null,
  )
  const visitsRow2 = await client2.execute('SELECT * FROM visits')
  eq('el país guardado antes de migrar sigue ahí', visitsRow2.rows.length, 1)

  // Se puede escribir en las columnas nuevas tras la migración.
  await client2.execute('UPDATE settings SET nextcloudUrl = ?, autoBackup = ? WHERE id = ?', [
    'https://cloud.example.com',
    1,
    'app',
  ])
  const afterWrite = await client2.execute('SELECT nextcloudUrl, autoBackup FROM settings WHERE id = ?', ['app'])
  eq('se puede escribir en las columnas nuevas', afterWrite.rows[0]?.nextcloudUrl, 'https://cloud.example.com')
  eq('incluido el booleano', Number(afterWrite.rows[0]?.autoBackup), 1)
  check(
    'la columna de transportes también llegó (v1 recorre TODAS las migraciones)',
    'transports' in (visitsRow2.rows[0] ?? {}) && visitsRow2.rows[0]?.transports == null,
  )

  for (const suffix of ['', '-wal', '-shm']) rmSync(path2 + suffix, { force: true })

  console.log('\n=== 6. Subida de v2 a v3 (el móvil que ya tiene la versión con Nextcloud) ===')
  // Esquema tal cual quedó en v2: ya con las columnas de Nextcloud, pero sin
  // la de transportes. Es el estado real de una instalación al día de ayer.
  const V2_SQL = `
    CREATE TABLE IF NOT EXISTS visits (
      code TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL, year INTEGER,
      addedAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY NOT NULL, theme TEXT NOT NULL DEFAULT 'system',
      lastBackup INTEGER NOT NULL DEFAULT 0, schemaVersion INTEGER NOT NULL,
      nextcloudUrl TEXT, nextcloudUser TEXT, nextcloudPassword TEXT,
      nextcloudFolder TEXT, autoBackup INTEGER, lastAutoBackupAt INTEGER
    );
  `
  const path3 = join(tmpdir(), `ludok-been-migration-v2-${process.pid}.db`)
  rmSync(path3, { force: true })
  const client3 = createClient({ url: `file:${path3}` })
  await client3.executeMultiple(V2_SQL)
  await client3.execute(`PRAGMA user_version = 2`)
  await client3.execute(
    'INSERT INTO settings (id, theme, lastBackup, schemaVersion, nextcloudUrl) VALUES (?, ?, ?, ?, ?)',
    ['app', 'dark', 1700000000000, 2, 'https://cloud.example.com'],
  )
  for (const code of ['ESP', 'FRA', 'JPN']) {
    await client3.execute('INSERT INTO visits (code, status, year, addedAt, updatedAt) VALUES (?, ?, ?, ?, ?)', [
      code,
      'been',
      2019,
      1700000000000,
      1700000000000,
    ])
  }

  const row3 = await client3.execute('PRAGMA user_version')
  const current3 = Number(row3.rows[0]?.user_version ?? 0)
  check('arranca en v2', current3 === 2)
  await client3.executeMultiple(CREATE_SQL)
  for (const step of MIGRATIONS.slice(current3 - 1)) await client3.executeMultiple(step)
  await client3.execute(`PRAGMA user_version = ${DB_VERSION}`)

  const visits3 = await client3.execute('SELECT * FROM visits ORDER BY code')
  eq('los 3 países siguen ahí', visits3.rows.length, 3)
  eq('con su año intacto', Number(visits3.rows[0]?.year), 2019)
  check('y ahora tienen columna de transportes, vacía', visits3.rows[0]?.transports == null)
  const settings3 = await client3.execute('SELECT nextcloudUrl FROM settings WHERE id = ?', ['app'])
  eq('los ajustes de Nextcloud no se tocan', settings3.rows[0]?.nextcloudUrl, 'https://cloud.example.com')

  // Y se puede escribir la lista de transportes tras migrar.
  await client3.execute('UPDATE visits SET transports = ? WHERE code = ?', [
    JSON.stringify(['plane', 'train']),
    'ESP',
  ])
  const esp = await client3.execute('SELECT transports FROM visits WHERE code = ?', ['ESP'])
  eq('se puede guardar la lista', esp.rows[0]?.transports, '["plane","train"]')

  for (const suffix of ['', '-wal', '-shm']) rmSync(path3 + suffix, { force: true })

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
