// Único punto donde se toca expo-sqlite. El resto de la lógica pide la base
// de datos a `dbRef`, para que se pueda ejecutar también en el escritorio.
import * as SQLite from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import * as schema from './schema'
import { CREATE_SQL, MIGRATIONS, DB_VERSION } from './schemaSql'
import { setDb } from './dbRef'

export { SCHEMA_VERSION } from './version'

/**
 * `enableChangeListener` es imprescindible: es lo que hace que `useLiveQuery`
 * de Drizzle se entere de los cambios y vuelva a pintar las pantallas solo.
 */
export const sqlite = SQLite.openDatabaseSync('ludok-been.db', {
  enableChangeListener: true,
})

export const db = drizzle(sqlite, { schema })

setDb(db)

/**
 * El esquema se crea de forma SÍNCRONA al importar este módulo, no en un
 * efecto: si las tablas se crearan en un efecto, la primera vez que se abre la
 * app recién instalada cualquier consulta hecha antes de que corriera el
 * efecto fallaría con «no such table».
 */
function migrateSync(): void {
  sqlite.execSync('PRAGMA journal_mode = WAL;')
  const row = sqlite.getFirstSync<{ user_version: number }>('PRAGMA user_version')
  const current = row?.user_version ?? 0
  if (current >= DB_VERSION) return

  sqlite.execSync(CREATE_SQL)

  if (current > 0) {
    for (const step of MIGRATIONS.slice(current - 1)) {
      sqlite.execSync(step)
    }
  }

  sqlite.execSync(`PRAGMA user_version = ${DB_VERSION}`)
}

migrateSync()
