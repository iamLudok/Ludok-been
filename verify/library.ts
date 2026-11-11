/**
 * Verificación de la Fase 2: que las reglas de negocio portadas de la web
 * siguen comportándose igual.
 *
 * Ejecuta el `library.ts` real (el mismo que corre en el móvil) contra un
 * SQLite de escritorio, gracias a que la base de datos se pide por `dbRef`.
 */
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import * as schema from '../src/lib/schema'
import { CREATE_SQL } from '../src/lib/schemaSql'
import { setDb } from '../src/lib/dbRef'
import type { LudokDb } from '../src/lib/backupCore'
import { setStatus, setYear, clearStatus, computeStats, setTransports, mapStatuses } from '../src/lib/library'
import { WORLD_TOTAL, sovereignByContinent, COUNTRIES, TERRITORIES, getByCca3, territoriesOf, contextOf } from '../src/lib/countries'
import { countByTransport } from '../src/lib/transports'
import { exportAll, importAll, SCHEMA_VERSION } from '../src/lib/backupCore'
import type { Visit } from '../src/types'
import { rarityOf, pointsFromTourists, adventureOf, footprintOf, ranking, LEVELS, MANUAL_POINTS } from '../src/lib/rarity'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}
function eq<T>(label: string, actual: T, expected: T) {
  check(label, actual === expected, actual === expected ? '' : `esperado ${expected}, salió ${actual}`)
}

const tempFiles: string[] = []
let seq = 0
async function useFreshDb(): Promise<void> {
  const path = join(tmpdir(), `ludok-been-lib-${process.pid}-${seq++}.db`)
  rmSync(path, { force: true })
  tempFiles.push(path)
  const client = createClient({ url: `file:${path}` })
  await client.executeMultiple(CREATE_SQL)
  setDb(drizzle(client, { schema }) as unknown as LudokDb)
}
function cleanup() {
  for (const f of tempFiles) for (const s of ['', '-wal', '-shm']) rmSync(f + s, { force: true })
}

async function main() {
  console.log('\n=== 1. setStatus crea y actualiza ===')
  await useFreshDb()
  await setStatus('ESP', 'been', 2019)
  let out = await exportAll(await currentDb())
  let esp = out.visits.find((v) => v.code === 'ESP')
  eq('ESP creado como been', esp?.status, 'been')
  eq('ESP con año 2019', esp?.year, 2019)
  const firstAddedAt = esp!.addedAt

  await new Promise((r) => setTimeout(r, 5))
  await setStatus('ESP', 'want')
  out = await exportAll(await currentDb())
  esp = out.visits.find((v) => v.code === 'ESP')
  eq('ESP pasa a want', esp?.status, 'want')
  eq('el año se conserva si no se pasa uno nuevo', esp?.year, 2019)
  eq('addedAt no cambia al re-marcar', esp?.addedAt, firstAddedAt)
  check('updatedAt avanza al re-marcar', (esp?.updatedAt ?? 0) > firstAddedAt)

  console.log('\n=== 2. setYear solo toca países existentes ===')
  await setYear('ESP', 2023)
  out = await exportAll(await currentDb())
  eq('año actualizado', out.visits.find((v) => v.code === 'ESP')?.year, 2023)

  await setYear('FRA', 2020) // FRA no existe: no debe crear nada
  out = await exportAll(await currentDb())
  check('setYear sobre país inexistente no crea fila', !out.visits.some((v) => v.code === 'FRA'))

  console.log('\n=== 3. clearStatus borra ===')
  await clearStatus('ESP')
  out = await exportAll(await currentDb())
  check('ESP ya no está', !out.visits.some((v) => v.code === 'ESP'))

  console.log('\n=== 3b. Transportes ===')
  await useFreshDb()
  await setStatus('ESP', 'been', 2019)
  await setTransports('ESP', ['plane', 'train'])
  let espOut = (await exportAll(await currentDb())).visits.find((v) => v.code === 'ESP')
  eq('se guardan', espOut?.transports?.join(','), 'plane,train')

  // Cambiar de estado NO puede llevarse por delante los transportes: son dos
  // acciones distintas de la misma ficha y es fácil que se pisen.
  await setStatus('ESP', 'want')
  espOut = (await exportAll(await currentDb())).visits.find((v) => v.code === 'ESP')
  eq('sobreviven a un cambio de estado', espOut?.transports?.join(','), 'plane,train')
  eq('y el estado sí cambia', espOut?.status, 'want')

  // Marcar transporte en un país sin marcar lo crea como visitado.
  await setTransports('ITA', ['boat'])
  const itaOut = (await exportAll(await currentDb())).visits.find((v) => v.code === 'ITA')
  eq('marcar transporte en un país nuevo lo crea', itaOut?.status, 'been')
  eq('con su transporte', itaOut?.transports?.join(','), 'boat')

  // Vaciar la lista la deja ausente, no como lista vacía.
  await setTransports('ITA', [])
  const itaEmpty = (await exportAll(await currentDb())).visits.find((v) => v.code === 'ITA')
  check('vaciar deja el campo ausente', itaEmpty?.transports === undefined)

  console.log('\n=== 3c. Recuento por transporte ===')
  const counts = countByTransport([
    { transports: ['plane', 'train'] },
    { transports: ['plane'] },
    { transports: ['plane', 'plane'] }, // repetido: cuenta una vez
    { transports: undefined },
  ])
  eq('avión en 3 países', counts.find((c) => c.value === 'plane')?.count, 3)
  eq('tren en 1', counts.find((c) => c.value === 'train')?.count, 1)
  eq('ordenado de más a menos', counts[0]?.value, 'plane')

  console.log('\n=== 4. computeStats: los países cuentan como países, los territorios aparte ===')
  await useFreshDb()
  await setStatus('ESP', 'been', 2019) // soberano, Europa
  await setStatus('FRA', 'been', 2018) // soberano, Europa
  await setStatus('ATA', 'been') // Antártida: territorio, no suma países
  await setStatus('JPN', 'want') // por ir, no cuenta como "been"
  const visits = (await exportAll(await currentDb())).visits
  const stats = computeStats(visits)
  eq('been = 2 países (ESP y FRA; la Antártida es territorio)', stats.been, 2)
  eq('territorios visitados = 1 (la Antártida)', stats.territories.been, 1)
  eq('want = 1', stats.want, 1)
  check('percent > 0', stats.percent > 0)
  eq('continentsVisited = 1 (solo Europa cuenta, ATA no es país)', stats.continentsVisited, 1)
  const europa = stats.byContinent.find((c) => c.continent === 'Europa')
  eq('Europa tiene 2 been (ESP+FRA, no ATA)', europa?.been, 2)

  console.log('\n=== 5. Reino Unido: es un país, y sus 4 naciones son territorios que le suman ===')
  // Inglaterra/Escocia/Gales/Irlanda del Norte se marcan por separado, como
  // territorios, pero para el «% del mundo» suman 1 solo país: el Reino
  // Unido (GBR vía sovereignCode).
  eq('195 países (193 de la ONU + Vaticano + Palestina)', WORLD_TOTAL, 195)
  eq('el Reino Unido vuelve a ser un país', getByCca3('GBR')?.kind, 'country')
  eq('Europa tiene 45 países', sovereignByContinent().get('Europa'), 45)

  await useFreshDb()
  await setStatus('ENG', 'been', 2019)
  const onlyEngland = computeStats((await exportAll(await currentDb())).visits)
  eq('been = 1 país (el Reino Unido, vía Inglaterra)', onlyEngland.been, 1)
  eq('Europa: 1 soberano visitado (el Reino Unido, vía Inglaterra)', onlyEngland.byContinent.find((c) => c.continent === 'Europa')?.been, 1)

  await setStatus('SCT', 'been', 2022) // Escocia, misma sovereignCode "GBR"
  const englandAndScotland = computeStats((await exportAll(await currentDb())).visits)
  eq('Inglaterra y Escocia: sigue siendo 1 país', englandAndScotland.been, 1)
  eq('y 2 territorios', englandAndScotland.territories.been, 2)
  eq(
    'pero Europa sigue en 1 soberano (no se cuenta el Reino Unido dos veces)',
    englandAndScotland.byContinent.find((c) => c.continent === 'Europa')?.been,
    1,
  )

  console.log('\n=== 6. Territorios: cuáles suman a su país y cuáles no ===')
  await useFreshDb()
  await setStatus('GIB', 'been')
  let st = computeStats((await exportAll(await currentDb())).visits)
  eq('Gibraltar no suma el Reino Unido', st.been, 0)
  eq('pero es 1 territorio', st.territories.been, 1)
  await setStatus('x-transnistria', 'been')
  st = computeStats((await exportAll(await currentDb())).visits)
  eq('Transnistria no suma Moldavia', st.been, 0)
  await setStatus('x-canarias', 'been')
  st = computeStats((await exportAll(await currentDb())).visits)
  eq('Canarias sí suma España', st.been, 1)
  eq('3 territorios en total', st.territories.been, 3)
  await setStatus('ESP', 'been')
  st = computeStats((await exportAll(await currentDb())).visits)
  eq('Canarias + España: España cuenta una sola vez', st.been, 1)
  eq('el total de territorios es el de la lista', st.territories.total, TERRITORIES.length)
  await setStatus('MTQ', 'been')
  st = computeStats((await exportAll(await currentDb())).visits)
  eq('Martinica (ultramar) no suma Francia', st.been, 1)

  console.log('\n=== 7. Colores del mapa ===')
  const statuses = mapStatuses([
    { code: 'SCT', status: 'been', addedAt: 0, updatedAt: 0 },
    { code: 'GIB', status: 'been', addedAt: 0, updatedAt: 0 },
    { code: 'x-pais-vasco', status: 'been', addedAt: 0, updatedAt: 0 },
    { code: 'ESP', status: 'want', addedAt: 0, updatedAt: 0 },
    { code: 'x-tibet', status: 'want', addedAt: 0, updatedAt: 0 },
  ])
  eq('Escocia pinta el Reino Unido como visitado', statuses.get('GBR'), 'been')
  eq('Gibraltar no pinta nada más (dependencia)', statuses.get('DNK'), undefined)
  eq('País Vasco visitado gana a «quiero ir» de España', statuses.get('ESP'), 'been')
  eq('un «quiero ir» de una región no pinta su país', statuses.get('CHN'), undefined)
  eq('cada territorio conserva su propio estado', statuses.get('GIB'), 'been')

  console.log('\n=== 8. Copias antiguas: lo marcado sigue valiendo ===')
  // Copias hechas con la versión en la que el Reino Unido eran 4 países:
  // ENG/SCT siguen existiendo con el mismo código, así que importan tal cual
  // y siguen sumando 1 país.
  await useFreshDb()
  await importAll(
    await currentDb(),
    JSON.stringify({
      app: 'ludok-been',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 0,
      settings: null,
      visits: [
        { code: 'ENG', status: 'been', addedAt: 1, updatedAt: 1 },
        { code: 'WLS', status: 'been', addedAt: 1, updatedAt: 1 },
        { code: 'ESP', status: 'been', addedAt: 1, updatedAt: 1 },
      ],
    }),
  )
  st = computeStats((await exportAll(await currentDb())).visits)
  eq('copia antigua con Inglaterra y Gales: 2 países (Reino Unido y España)', st.been, 2)
  eq('y el % no cambia respecto a antes', st.percent, Math.round((2 / 195) * 1000) / 10)

  console.log('\n=== 9. Coherencia de la lista ===')
  check('ningún código repetido', new Set(COUNTRIES.map((c) => c.cca3)).size === COUNTRIES.length)
  check(
    'los códigos propios llevan el prefijo x- (nunca chocan con un ISO)',
    COUNTRIES.every((c) => /^[A-Z]{3}$/.test(c.cca3) || /^x-[a-z-]+$/.test(c.cca3)),
  )
  check('todo territorio tiene tipo', TERRITORIES.every((t) => !!t.type))
  check(
    'solo naciones y regiones suman a su país',
    TERRITORIES.every((t) => !t.sovereignCode || t.type === 'nacion' || t.type === 'region'),
  )
  check(
    'España tiene sus territorios dentro',
    ['x-pais-vasco', 'x-canarias', 'x-ceuta', 'x-melilla'].every((c) => territoriesOf('ESP').some((t) => t.cca3 === c)),
  )
  eq('línea de contexto de Gibraltar', contextOf(getByCca3('GIB')!), 'Dependencia de Reino Unido')
  eq('Nagorno Karabaj marcado como desaparecido', contextOf(getByCca3('x-nagorno-karabaj')!), 'Estado de facto · reclamado por Azerbaiyán · ya no existe')

  console.log('\n=== 10. Rareza y puntos de aventura ===')
  const been = (...codes: string[]): Visit[] => codes.map((code) => ({ code, status: 'been', addedAt: 0, updatedAt: 0 }))
  check('todos los sitios tienen rareza', COUNTRIES.every((c) => rarityOf(c.cca3) !== undefined), COUNTRIES.filter((c) => !rarityOf(c.cca3)).map((c) => c.cca3).join(' '))
  check('puntos entre 1 y 100', COUNTRIES.every((c) => { const p = rarityOf(c.cca3)!.points; return p >= 1 && p <= 100 }))
  eq('Francia (el más visitado) vale 1', rarityOf('FRA')?.points, 1)
  eq('Tuvalu vale 100', rarityOf('TUV')?.points, 100)
  check('más turistas = menos puntos', pointsFromTourists(1_000_000) < pointsFromTourists(10_000))
  check('Islandia es más rara que España', rarityOf('ISL')!.points > rarityOf('ESP')!.points)
  check('Liechtenstein (de excursión) no es más raro que Islandia', rarityOf('LIE')!.points < rarityOf('ISL')!.points)
  check('ni Mónaco', rarityOf('MCO')!.points < rarityOf('ISL')!.points)
  check('los puntos a mano solo se usan para sitios que existen', Object.keys(MANUAL_POINTS).every((c) => !!getByCca3(c)))
  eq('sin visitas: 0 puntos y primer nivel', adventureOf([]).points, 0)
  eq('primer nivel', adventureOf([]).level.name, LEVELS[0].name)
  {
    const a = adventureOf(been('ESP', 'TUV'))
    eq('España + Tuvalu = 6 + 100', a.points, rarityOf('ESP')!.points + 100)
    eq('lo más raro primero', a.top[0].code, 'TUV')
  }
  {
    // Escocia puntúa por sí misma Y da el Reino Unido; marcar además
    // Inglaterra no vuelve a sumar el Reino Unido.
    const a = adventureOf(been('SCT', 'ENG'))
    eq('Escocia + Inglaterra = Reino Unido una vez + las dos naciones', a.points, rarityOf('GBR')!.points + rarityOf('SCT')!.points + rarityOf('ENG')!.points)
  }
  {
    const a = adventureOf([{ code: 'TUV', status: 'want', addedAt: 0, updatedAt: 0 }])
    eq('«quiero ir» no puntúa', a.points, 0)
  }
  {
    const a = adventureOf(been(...COUNTRIES.map((c) => c.cca3)))
    eq('con todo visitado, último nivel', a.level.name, LEVELS[LEVELS.length - 1].name)
    eq('y la barra llena', a.progress, 1)
  }

  console.log('\n=== 11. Huella: superficie y población ===')
  {
    const all = footprintOf(been(...COUNTRIES.map((c) => c.cca3)))
    eq('todo visitado = 100 % de la superficie', all.areaPct, 100)
    eq('y 100 % de la población', all.populationPct, 100)
    const none = footprintOf([])
    eq('nada visitado = 0 %', none.areaPct, 0)
    const ru = footprintOf(been('RUS'))
    check('Rusia sola es más del 10 % de la superficie', ru.areaPct > 10, `${ru.areaPct}`)
    const gib = footprintOf(been('GIB'))
    eq('Gibraltar (dependencia) no suma superficie de país', gib.areaPct, 0)
    const sct = footprintOf(been('SCT'))
    eq('Escocia cuenta el Reino Unido entero', sct.areaPct, footprintOf(been('GBR')).areaPct)
  }

  console.log('\n=== 12. Rankings ===')
  {
    const r = ranking('rarity')
    eq('el ranking de países tiene los 195', r.length, 195)
    check('ordenado de más a menos', r.every((x, i) => i === 0 || r[i - 1].value >= x.value))
    eq('el país más grande es Rusia', ranking('area')[0].country.cca3, 'RUS')
    check('el más poblado es India o China', ['IND', 'CHN'].includes(ranking('population')[0].country.cca3))
    check('con territorios, el ranking de rareza es más largo', ranking('rarity', true).length > 195)
  }

  console.log(
    failures === 0
      ? '\n✅ TODO CORRECTO — las reglas de negocio se comportan igual\n'
      : `\n❌ ${failures} COMPROBACIONES FALLIDAS\n`,
  )
  cleanup()
  process.exit(failures === 0 ? 0 : 1)
}

// Pequeño atajo: como `getDb()` no se expone aquí directamente (se pide vía
// dbRef dentro de cada función de library.ts), re-exportamos para leer el
// estado actual en las comprobaciones de este script.
import { getDb } from '../src/lib/dbRef'
async function currentDb(): Promise<LudokDb> {
  return getDb()
}

main().catch((e) => {
  console.error('\nEl test se rompió:', e)
  process.exit(1)
})
