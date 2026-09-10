export const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS visits (
  code TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL,
  year INTEGER,
  transports TEXT,
  addedAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY NOT NULL,
  theme TEXT NOT NULL DEFAULT 'system',
  lastBackup INTEGER NOT NULL DEFAULT 0,
  schemaVersion INTEGER NOT NULL,
  nextcloudUrl TEXT,
  nextcloudUser TEXT,
  nextcloudPassword TEXT,
  nextcloudFolder TEXT,
  autoBackup INTEGER,
  lastAutoBackupAt INTEGER
);

CREATE INDEX IF NOT EXISTS visits_status_idx ON visits (status);
CREATE INDEX IF NOT EXISTS visits_addedAt_idx ON visits (addedAt);
`

/**
 * Un paso por cada versión desde la 1. `MIGRATIONS[0]` lleva de v1 a v2, etc.
 * Van con `ADD COLUMN` porque CREATE_SQL ya describe el esquema final para
 * instalaciones nuevas: esto es solo para poner al día las que ya existían.
 */
export const MIGRATIONS: string[] = [
  `
  ALTER TABLE settings ADD COLUMN nextcloudUrl TEXT;
  ALTER TABLE settings ADD COLUMN nextcloudUser TEXT;
  ALTER TABLE settings ADD COLUMN nextcloudPassword TEXT;
  ALTER TABLE settings ADD COLUMN nextcloudFolder TEXT;
  ALTER TABLE settings ADD COLUMN autoBackup INTEGER;
  ALTER TABLE settings ADD COLUMN lastAutoBackupAt INTEGER;
  `,
  // v2 → v3: medios de transporte por país.
  `
  ALTER TABLE visits ADD COLUMN transports TEXT;
  `,
]

export const DB_VERSION = MIGRATIONS.length + 1
