// Definición de tablas para Drizzle. Solo describe las columnas: las tablas y
// los índices se crean con SQL explícito en `db.ts` (migraciones por
// PRAGMA user_version), igual que la web usaba versiones de Dexie.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import type { CountryStatus } from '../types'

export const visits = sqliteTable('visits', {
  code: text('code').primaryKey(),
  status: text('status').$type<CountryStatus>().notNull(),
  year: integer('year'),
  addedAt: integer('addedAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
})

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  theme: text('theme').$type<'dark' | 'light' | 'system'>().notNull().default('system'),
  lastBackup: integer('lastBackup').notNull().default(0),
  schemaVersion: integer('schemaVersion').notNull(),
})

export type VisitRow = typeof visits.$inferSelect
export type SettingsRow = typeof settings.$inferSelect
