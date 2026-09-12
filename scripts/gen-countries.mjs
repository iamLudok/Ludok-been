// Genera src/data/countries.json a partir del paquete `world-countries`.
// Se ejecuta una sola vez (o cuando se quiera regenerar): `npm run gen:countries`.
// El JSON resultante se versiona en el repo; en runtime no se depende de world-countries.
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import countries from 'world-countries/countries.json' with { type: 'json' }

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'src', 'data')

// `region` de world-countries: Africa, Americas, Antarctic, Asia, Europe, Oceania.
const REGION_ES = {
  Africa: 'África',
  Americas: 'América',
  Antarctic: 'Antártida',
  Asia: 'Asia',
  Europe: 'Europa',
  Oceania: 'Oceanía',
}

const list = countries
  .map((c) => ({
    cca3: c.cca3,
    cca2: c.cca2,
    // ccn3 (ISO numérico) casa con los `id` de world-atlas para pintar el mapa.
    ccn3: c.ccn3,
    name: c.translations?.spa?.common || c.name.common,
    continent: REGION_ES[c.region] || c.region || 'Otros',
    subregion: c.subregion || '',
    // Países soberanos = denominador del "% del mundo".
    independent: c.independent === true,
  }))
  // `world-countries` no cuenta Palestina como soberana; la ONU sí la trata
  // como estado observador (junto con la Santa Sede), así que el total de
  // soberanos coherente con la ONU es 195, no 194.
  .map((c) => (c.cca3 === 'PSE' ? { ...c, independent: true } : c))
  // El Reino Unido se trata como 4 naciones separadas (Inglaterra, Escocia,
  // Gales, Irlanda del Norte) para el conteo de países visitados: se pueden
  // marcar por separado en la Lista y en el mapa (ver src/lib/geo.ts, que
  // sustituye el único polígono de world-atlas por las 4 formas de
  // src/data/uk-nations.json). Ninguna cuenta por sí sola como soberana
  // (`independent: false`); `sovereignCode: "GBR"` hace que el Reino Unido
  // siga sumando 1 solo país al "% del mundo" si se visita cualquiera de
  // las 4 (ver sovereignByContinent/WORLD_TOTAL en src/lib/countries.ts).
  .filter((c) => c.cca3 !== 'GBR')
  .concat([
    { cca3: 'ENG', cca2: 'GB', ccn3: '', name: 'Inglaterra', continent: 'Europa', subregion: 'Northern Europe', independent: false, sovereignCode: 'GBR' },
    { cca3: 'SCT', cca2: 'GB', ccn3: '', name: 'Escocia', continent: 'Europa', subregion: 'Northern Europe', independent: false, sovereignCode: 'GBR' },
    { cca3: 'WLS', cca2: 'GB', ccn3: '', name: 'Gales', continent: 'Europa', subregion: 'Northern Europe', independent: false, sovereignCode: 'GBR' },
    { cca3: 'NIR', cca2: 'GB', ccn3: '', name: 'Irlanda del Norte', continent: 'Europa', subregion: 'Northern Europe', independent: false, sovereignCode: 'GBR' },
  ])
  .sort((a, b) => a.name.localeCompare(b.name, 'es'))

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'countries.json'), JSON.stringify(list, null, 2) + '\n')

const sovereign = list.filter((c) => c.independent).length
console.log(`countries.json: ${list.length} territorios, ${sovereign} soberanos`)
