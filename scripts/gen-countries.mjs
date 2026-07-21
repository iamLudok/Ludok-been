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
  .sort((a, b) => a.name.localeCompare(b.name, 'es'))

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'countries.json'), JSON.stringify(list, null, 2) + '\n')

const sovereign = list.filter((c) => c.independent).length
console.log(`countries.json: ${list.length} territorios, ${sovereign} soberanos`)
