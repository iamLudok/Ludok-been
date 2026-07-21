// Modelo de datos de Ludok Been.
// Todo vive en local (IndexedDB). Un país solo puede tener un estado a la vez,
// así que la clave primaria de una visita es su código ISO alfa-3 (cca3).

/** Estado de un país: visitado o en la lista de deseos. */
export type CountryStatus = 'been' | 'want'

export interface Visit {
  /** código ISO 3166-1 alfa-3 (p.ej. "ESP"). Clave primaria. */
  code: string
  status: CountryStatus
  /** año de la visita (opcional). 0/undefined = sin fecha. */
  year?: number
  addedAt: number
  updatedAt: number
}

export interface Settings {
  id: 'app'
  theme: 'dark' | 'light' | 'system'
  lastBackup: number
  schemaVersion: number
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
}

/** Estructura del fichero de copia de seguridad (export/import). */
export interface BackupFile {
  app: 'ludok-been'
  schemaVersion: number
  exportedAt: number
  visits: Visit[]
  settings: Settings | null
}
