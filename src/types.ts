// Modelo de datos de Ludok Been.
// Todo vive en local (SQLite privado de la app). Un país solo puede tener un
// estado a la vez, así que la clave primaria de una visita es su código ISO
// alfa-3 (cca3).

/** Estado de un país: visitado o en la lista de deseos. */
export type CountryStatus = 'been' | 'want'

export interface Visit {
  /** código ISO 3166-1 alfa-3 (p.ej. "ESP"). Clave primaria. */
  code: string
  status: CountryStatus
  /** año de la visita (opcional). undefined = sin fecha. */
  year?: number
  /**
   * Medios de transporte usados en ese país. Los de la lista de siempre van
   * por su clave ('plane', 'train'…); cualquier otro valor es uno escrito a
   * mano y se guarda tal cual. Ausente = no se ha marcado ninguno.
   */
  transports?: string[]
  addedAt: number
  updatedAt: number
}

export interface Settings {
  id: 'app'
  theme: 'dark' | 'light' | 'system'
  lastBackup: number
  schemaVersion: number
  /** Copia automática a un Nextcloud propio (opcional). */
  nextcloudUrl?: string
  nextcloudUser?: string
  /** Contraseña de aplicación de Nextcloud. Nunca se incluye en las copias exportadas. */
  nextcloudPassword?: string
  nextcloudFolder?: string
  autoBackup?: boolean
  lastAutoBackupAt?: number
}

/** Metadato estático de país (empaquetado en src/data/countries.json). */
export interface Country {
  cca3: string
  cca2: string
  /** ISO numérico (string, p.ej. "724"). Casa con los id de world-atlas. */
  ccn3: string
  name: string
  continent: string
  subregion: string
  /** true si es un país soberano (cuenta para el "% del mundo"). */
  independent: boolean
  /**
   * Para territorios no soberanos que deben seguir sumando 1 solo país al
   * "% del mundo" entre varios (p.ej. Inglaterra/Escocia/Gales/Irlanda del
   * Norte comparten "GBR"): cca3 del país al que cuentan. Ver WORLD_TOTAL y
   * sovereignByContinent en lib/countries.ts.
   */
  sovereignCode?: string
}

/** Estructura del fichero de copia de seguridad (export/import). */
export interface BackupFile {
  app: 'ludok-been'
  schemaVersion: number
  exportedAt: number
  visits: Visit[]
  settings: Settings | null
}
