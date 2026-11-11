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
  /**
   * Logros de los que ya se ha avisado, como lista JSON de ids (tal cual va
   * en la columna). Ausente = ninguno: al actualizar, la app no te avisa de
   * golpe de todo lo que ya tenías (ver `achievements.ts`).
   */
  seenAchievements?: string | null
}

/**
 * Tipo de territorio. Ver scripts/gen-countries.mjs para el criterio.
 * - de-facto: estados que funcionan como tales pero casi nadie reconoce.
 * - nacion: naciones que forman un país (las 4 del Reino Unido).
 * - region: regiones que se sienten otro sitio (País Vasco, Canarias…).
 * - dependencia: territorios con gobierno propio (Gibraltar, Feroe…).
 * - ultramar: legalmente parte del país pero lejísimos (Martinica…).
 * - remoto: deshabitados o casi inaccesibles (Bouvet…).
 */
export type TerritoryType = 'de-facto' | 'nacion' | 'region' | 'dependencia' | 'ultramar' | 'remoto'

/**
 * Metadato estático de un sitio marcable: un país o un territorio
 * (empaquetado en src/data/countries.json).
 */
export interface Country {
  /** ISO alfa-3, o un código propio con prefijo `x-` para los que no tienen. */
  cca3: string
  cca2: string
  /** ISO numérico (string, p.ej. "724"). Casa con los id de world-atlas. */
  ccn3: string
  name: string
  continent: string
  subregion: string
  /** País (los 195 de la ONU: cuentan para el «% del mundo») o territorio. */
  kind: 'country' | 'territory'
  /** Solo territorios. */
  type?: TerritoryType
  /** Solo territorios: el país del que forma parte o depende, si lo hay. */
  parent?: string
  /**
   * Solo territorios que FORMAN PARTE de su país (naciones y regiones): el
   * país al que suman al visitarlos. Escocia → GBR, Canarias → ESP. Una
   * dependencia (Gibraltar) no lo tiene: ir allí no es ir al Reino Unido.
   */
  sovereignCode?: string
  /** Ya no existe como tal (Nagorno Karabaj): solo lo tiene quien fue. */
  defunct?: boolean
  /** Solo países: los países con los que tiene frontera terrestre. */
  borders?: string[]
}

/** Estructura del fichero de copia de seguridad (export/import). */
export interface BackupFile {
  app: 'ludok-been'
  schemaVersion: number
  exportedAt: number
  visits: Visit[]
  settings: Settings | null
}
