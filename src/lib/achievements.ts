// Logros: retos que salen solos de lo que has marcado.
//
// Cada logro es una función pura sobre las visitas, así que no se guarda
// nada aparte (si quitas un país, el logro se va con él). Lo único que se
// guarda es de cuáles ya se te ha avisado (`seenAchievements` en ajustes).
//
// Los `id` son PARA SIEMPRE: van en las copias de seguridad. Se puede
// cambiar el título o la descripción, nunca el id.
import { getByCca3, sovereignSlot } from './countries'
import type { Visit } from '../types'

export interface Progress {
  /** Cuántos llevas. */
  progress: number
  /** Cuántos hay en total (para enseñar «3 de 5»). */
  total: number
  /** Cuántos hacen falta para desbloquearlo. */
  goal: number
}

export type AchievementGroup = 'Rarezas' | 'Colecciones' | 'Regiones' | 'Viajero'

export interface Achievement {
  id: string
  title: string
  description: string
  group: AchievementGroup
  check: (ctx: Context) => Progress
}

/** Lo que necesitan los logros, calculado una vez por todas las visitas. */
interface Context {
  /** ¿Has estado en este sitio? Un país también cuenta si fuiste a una región suya. */
  visited: (code: string) => boolean
  /** Países visitados (los 195), contando los que se suman por una región. */
  countries: Set<string>
  /** Visitas «been», para mirar transportes. */
  been: Visit[]
}

function contextOf(visits: Visit[]): Context {
  const been = visits.filter((v) => v.status === 'been')
  const direct = new Set(been.map((v) => v.code))
  const countries = new Set<string>()
  for (const v of been) {
    const c = getByCca3(v.code)
    const slot = c ? sovereignSlot(c) : undefined
    if (slot) countries.add(slot)
  }
  return { visited: (code) => direct.has(code) || countries.has(code), countries, been }
}

/**
 * Todos los códigos que usan los logros de colección. Un test comprueba que
 * existen: una errata («GBI» por «GIB») dejaría un logro imposible.
 */
export const USED_CODES: string[] = []

/** Logro de colección: haber estado en `goal` de una lista de sitios. */
function collection(codes: string[], goal = codes.length) {
  USED_CODES.push(...codes)
  return (ctx: Context): Progress => ({
    progress: codes.filter((c) => ctx.visited(c)).length,
    total: codes.length,
    goal,
  })
}

/** Logro por transporte: `goal` sitios donde te moviste así. */
function byTransport(key: string, goal: number) {
  return (ctx: Context): Progress => ({
    progress: ctx.been.filter((v) => v.transports?.includes(key)).length,
    total: goal,
    goal,
  })
}

/**
 * La cadena de fronteras más larga: el grupo más grande de países visitados
 * que se tocan entre sí (puedes ir de uno a otro por tierra sin pisar un
 * país que no hayas visitado). Búsqueda por anchura en el grafo de fronteras.
 */
export function longestBorderChain(countries: Set<string>): number {
  const seen = new Set<string>()
  let best = 0
  for (const start of countries) {
    if (seen.has(start)) continue
    let size = 0
    const queue = [start]
    seen.add(start)
    while (queue.length) {
      const code = queue.shift()!
      size++
      for (const n of getByCca3(code)?.borders ?? []) {
        if (countries.has(n) && !seen.has(n)) {
          seen.add(n)
          queue.push(n)
        }
      }
    }
    best = Math.max(best, size)
  }
  return best
}

/** Los 6 continentes: los 5 habitados (por sus países) más la Antártida. */
function continents(ctx: Context): Progress {
  const set = new Set<string>()
  for (const code of ctx.countries) {
    const c = getByCca3(code)
    if (c) set.add(c.continent)
  }
  if (ctx.visited('ATA')) set.add('Antártida')
  return { progress: set.size, total: 6, goal: 6 }
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'no-existen',
    title: 'Un país que no existe',
    description: 'Pisa un estado de facto: Transnistria, Abjasia, Osetia del Sur, Chipre del Norte o Somalilandia.',
    group: 'Rarezas',
    check: collection(['x-transnistria', 'x-abjasia', 'x-osetia-sur', 'x-chipre-norte', 'x-somalilandia'], 1),
  },
  {
    id: 'nagorno',
    title: 'Ya no se puede',
    description: 'Estuviste en Nagorno Karabaj antes de que desapareciera en 2024.',
    group: 'Rarezas',
    check: collection(['x-nagorno-karabaj']),
  },
  {
    id: 'penon',
    title: 'El Peñón',
    description: 'Cruza la verja de Gibraltar.',
    group: 'Rarezas',
    check: collection(['GIB']),
  },
  {
    id: 'artico',
    title: 'Ártico',
    description: 'Llega a Svalbard o a Groenlandia.',
    group: 'Rarezas',
    check: collection(['SJM', 'GRL'], 1),
  },
  {
    id: 'microestados',
    title: 'Microestados de Europa',
    description: 'Andorra, Mónaco, San Marino, Liechtenstein, Vaticano, Malta y Luxemburgo.',
    group: 'Colecciones',
    check: collection(['AND', 'MCO', 'SMR', 'LIE', 'VAT', 'MLT', 'LUX']),
  },
  {
    id: 'islas-corona',
    title: 'Islas de la Corona',
    description: 'Jersey, Guernsey e Isla de Man: ni Reino Unido ni colonias.',
    group: 'Colecciones',
    check: collection(['JEY', 'GGY', 'IMN']),
  },
  {
    id: 'cuatro-naciones',
    title: 'Las cuatro naciones',
    description: 'Inglaterra, Escocia, Gales e Irlanda del Norte.',
    group: 'Colecciones',
    check: collection(['ENG', 'SCT', 'WLS', 'NIR']),
  },
  {
    id: 'balcanes',
    title: 'Los Balcanes',
    description: 'Todos los países de los Balcanes, Kosovo incluido.',
    group: 'Regiones',
    check: collection(['ALB', 'BIH', 'BGR', 'HRV', 'GRC', 'MNE', 'MKD', 'SRB', 'SVN', 'UNK']),
  },
  {
    id: 'balticos',
    title: 'Los Bálticos',
    description: 'Estonia, Letonia y Lituania.',
    group: 'Regiones',
    check: collection(['EST', 'LVA', 'LTU']),
  },
  {
    id: 'caucaso',
    title: 'El Cáucaso',
    description: 'Armenia, Azerbaiyán y Georgia.',
    group: 'Regiones',
    check: collection(['ARM', 'AZE', 'GEO']),
  },
  {
    id: 'stanes',
    title: 'Los -stán',
    description: 'Kazajistán, Kirguistán, Tayikistán, Turkmenistán, Uzbekistán, Afganistán y Pakistán.',
    group: 'Regiones',
    check: collection(['KAZ', 'KGZ', 'TJK', 'TKM', 'UZB', 'AFG', 'PAK']),
  },
  {
    id: 'continentes',
    title: 'Todos los continentes',
    description: 'Los cinco habitados y la Antártida.',
    group: 'Viajero',
    check: continents,
  },
  {
    id: 'cadena',
    title: 'Cadena de fronteras',
    description: '10 países visitados seguidos, de frontera en frontera.',
    group: 'Viajero',
    check: (ctx) => {
      const n = longestBorderChain(new Set([...ctx.countries]))
      return { progress: Math.min(n, 10), total: 10, goal: 10 }
    },
  },
  {
    id: 'tren',
    title: 'Sobre raíles',
    description: 'Muévete en tren por 10 sitios.',
    group: 'Viajero',
    check: byTransport('train', 10),
  },
  {
    id: 'barco',
    title: 'Por mar',
    description: 'Llega en barco a algún sitio.',
    group: 'Viajero',
    check: byTransport('boat', 1),
  },
  {
    id: 'a-pie',
    title: 'Paso a paso',
    description: 'Recorre a pie algún sitio.',
    group: 'Viajero',
    check: byTransport('walk', 1),
  },
]

export interface AchievementState extends Achievement, Progress {
  unlocked: boolean
}

/** Estado de todos los logros para unas visitas. */
export function achievementsOf(visits: Visit[]): AchievementState[] {
  const ctx = contextOf(visits)
  return ACHIEVEMENTS.map((a) => {
    const p = a.check(ctx)
    return { ...a, ...p, unlocked: p.progress >= p.goal }
  })
}

/** Lista guardada en ajustes → ids. Tolerante: si está rota, como vacía. */
export function parseSeen(raw: string | null | undefined): string[] | null {
  if (raw == null) return null
  try {
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * De qué logros avisar, y qué guardar como vistos.
 *
 * Sin nada guardado (`null`: quien actualiza desde una versión sin logros),
 * todo lo que ya tenía desbloqueado se da por visto SIN avisar: si no, al
 * actualizar le saltarían de golpe todos los logros de viajes de hace años.
 * Una instalación nueva arranca con `[]` (ver DEFAULT_SETTINGS), así que esa
 * sí recibe el aviso desde el primer logro.
 */
export function pendingNotices(
  unlockedIds: string[],
  seenRaw: string | null | undefined,
): { notify: string[]; nextSeen: string[] } {
  const seen = parseSeen(seenRaw)
  if (seen === null) return { notify: [], nextSeen: unlockedIds }
  const notify = unlockedIds.filter((id) => !seen.includes(id))
  return { notify, nextSeen: notify.length ? [...seen, ...notify] : seen }
}
