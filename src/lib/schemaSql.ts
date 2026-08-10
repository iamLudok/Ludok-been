export const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS visits (
  code TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL,
  year INTEGER,
  addedAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY NOT NULL,
  theme TEXT NOT NULL DEFAULT 'system',
  lastBackup INTEGER NOT NULL DEFAULT 0,
  schemaVersion INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS visits_status_idx ON visits (status);
CREATE INDEX IF NOT EXISTS visits_addedAt_idx ON visits (addedAt);
`

/** Sin migraciones todavía: el esquema nace en v1. */
export const MIGRATIONS: string[] = []

export const DB_VERSION = MIGRATIONS.length + 1
