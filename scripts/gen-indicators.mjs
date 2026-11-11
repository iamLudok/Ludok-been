// Genera src/data/indicators.json: turistas, población y superficie por sitio.
// Se ejecuta a mano cuando se quieran datos más nuevos: `npm run gen:indicators`
// (necesita conexión: descarga del Banco Mundial). El resultado se versiona;
// en el móvil no hay red de por medio.
//
// Fuentes:
// - Turistas internacionales por año: Banco Mundial, World Development
//   Indicators, `ST.INT.ARVL` (datos de ONU Turismo). CC BY 4.0.
// - Población: Banco Mundial, WDI, `SP.POP.TOTL`. CC BY 4.0.
// - Superficie: world-countries (ODbL), el mismo paquete de countries.json.
//
// Turistas: el último año disponible HASTA 2019. La serie llega a 2020, pero
// 2020 es el año del COVID y hunde a todo el mundo por igual: Francia
// parecería tan «rara» como Kiribati. Se redondea a 2 cifras significativas:
// para la rareza basta, y no se redistribuye la serie en bruto.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import worldCountries from 'world-countries/countries.json' with { type: 'json' }

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'src', 'data')
const countries = JSON.parse(readFileSync(join(dataDir, 'countries.json'), 'utf8'))

const LAST_TOURISM_YEAR = 2019

/**
 * Países sin dato de turistas en el Banco Mundial: estimación a mano del
 * orden de magnitud, que es lo único que usa la rareza. La app los marca
 * como estimados.
 */
const TOURISM_ESTIMATE = {
  AFG: 20000,
  VAT: 6000000, // los Museos Vaticanos: entrar en el Vaticano es lo normal en Roma
  PRK: 100000, // casi todos desde China; occidentales, unos pocos miles
  GAB: 150000,
  GNQ: 50000,
  LBR: 30000,
  LBY: 50000,
  MRT: 50000,
  NRU: 2000,
  SOM: 30000,
  SSD: 10000,
  TKM: 10000,
}

/** Población de los que el Banco Mundial no recoge. */
const POPULATION_FALLBACK = {
  VAT: 800,
}

async function fetchIndicator(id, from, to) {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${id}?format=json&per_page=20000&date=${from}:${to}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`)
  const [, rows] = await res.json()
  // Por país, el valor del año más reciente que tenga dato.
  const best = new Map()
  for (const r of rows) {
    if (r.value == null) continue
    const year = Number(r.date)
    const prev = best.get(r.countryiso3code)
    if (!prev || year > prev.year) best.set(r.countryiso3code, { year, value: r.value })
  }
  return best
}

const twoSig = (n) => {
  if (n <= 0) return 0
  const p = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / p) * p
}

const tourism = await fetchIndicator('ST.INT.ARVL', 2010, LAST_TOURISM_YEAR)
const population = await fetchIndicator('SP.POP.TOTL', 2015, 2030)
const areaByCca3 = new Map(worldCountries.map((c) => [c.cca3, c.area]))

const out = {}
const missing = []
for (const c of countries) {
  const t = tourism.get(c.cca3)
  const est = TOURISM_ESTIMATE[c.cca3]
  const p = population.get(c.cca3)
  const area = areaByCca3.get(c.cca3)
  const entry = {}
  if (t) {
    entry.tourists = twoSig(t.value)
    entry.touristsYear = t.year
  } else if (est) {
    entry.tourists = est
    entry.touristsEstimated = true
  }
  if (p) entry.population = Math.round(p.value)
  else if (POPULATION_FALLBACK[c.cca3]) entry.population = POPULATION_FALLBACK[c.cca3]
  // Con decimales por debajo de 10 km²: el Vaticano (0,44) se quedaba en 0.
  if (area) entry.area = area < 10 ? Math.round(area * 100) / 100 : Math.round(area)
  if (Object.keys(entry).length) out[c.cca3] = entry
  if (c.kind === 'country' && (!entry.tourists || !entry.population || !entry.area)) missing.push(c.name)
}

writeFileSync(
  join(dataDir, 'indicators.json'),
  JSON.stringify(
    {
      sources: {
        tourists: `Banco Mundial (WDI, ST.INT.ARVL, datos de ONU Turismo), último año hasta ${LAST_TOURISM_YEAR}. CC BY 4.0`,
        population: 'Banco Mundial (WDI, SP.POP.TOTL). CC BY 4.0',
        area: 'world-countries (ODbL)',
      },
      bySite: out,
    },
    null,
    1,
  ) + '\n',
)

console.log(`indicators.json: ${Object.keys(out).length} sitios con algún dato`)
if (missing.length) {
  console.error(`Países a los que les falta algún dato: ${missing.join(', ')}`)
  process.exit(1)
}
