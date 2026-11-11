// Genera src/data/countries.json a partir del paquete `world-countries` más
// los territorios escritos a mano en src/data/territories.json.
// Se ejecuta una sola vez (o cuando se quiera regenerar): `npm run gen:countries`.
// El JSON resultante se versiona en el repo; en runtime no se depende de world-countries.
//
// El modelo tiene dos capas:
// - PAÍSES (`kind: "country"`): los 193 de la ONU + sus 2 observadores
//   (Vaticano y Palestina) = 195. Son el único denominador del «% del
//   mundo». Criterio que nadie puede discutir: «los de la ONU».
// - TERRITORIOS (`kind: "territory"`): todo lo demás que vale la pena marcar
//   (Gibraltar, Feroe, Transnistria, País Vasco…). Contador aparte. Cada uno
//   tiene un tipo y, si lo hay, el país del que depende (`parent`).
//
// Un territorio solo suma a su país (`sovereignCode`) si es una región o una
// nación que FORMA PARTE de él: Escocia suma Reino Unido, Canarias suma
// España. Una dependencia, el ultramar o un estado de facto no: ir a
// Gibraltar no es ir al Reino Unido, ni el Sáhara Occidental es Marruecos.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import countries from 'world-countries/countries.json' with { type: 'json' }

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'src', 'data')
const territories = JSON.parse(readFileSync(join(outDir, 'territories.json'), 'utf8'))

// `region` de world-countries: Africa, Americas, Antarctic, Asia, Europe, Oceania.
const REGION_ES = {
  Africa: 'África',
  Americas: 'América',
  Antarctic: 'Antártida',
  Asia: 'Asia',
  Europe: 'Europa',
  Oceania: 'Oceanía',
}

/**
 * Territorios de world-countries: su tipo y de qué país dependen.
 * `world-countries` no trae esta relación, así que va a mano.
 */
const ISO_TERRITORIES = {
  // Estados de facto o disputados. Sin `parent` cuando ni siquiera eso es
  // pacífico (a Kosovo lo reconocen ~100 países; Taiwán y el Sáhara, ídem).
  UNK: { type: 'de-facto' },
  TWN: { type: 'de-facto' },
  ESH: { type: 'de-facto' },
  // Dependencias: territorios con gobierno propio que no son parte del país.
  ALA: { type: 'dependencia', parent: 'FIN' },
  AIA: { type: 'dependencia', parent: 'GBR' },
  ABW: { type: 'dependencia', parent: 'NLD' },
  BMU: { type: 'dependencia', parent: 'GBR' },
  BES: { type: 'dependencia', parent: 'NLD' },
  CUW: { type: 'dependencia', parent: 'NLD' },
  GIB: { type: 'dependencia', parent: 'GBR' },
  GRL: { type: 'dependencia', parent: 'DNK' },
  GUM: { type: 'dependencia', parent: 'USA' },
  GGY: { type: 'dependencia', parent: 'GBR' },
  HKG: { type: 'dependencia', parent: 'CHN' },
  IMN: { type: 'dependencia', parent: 'GBR' },
  NFK: { type: 'dependencia', parent: 'AUS' },
  CYM: { type: 'dependencia', parent: 'GBR' },
  COK: { type: 'dependencia', parent: 'NZL' },
  FRO: { type: 'dependencia', parent: 'DNK' },
  FLK: { type: 'dependencia', parent: 'GBR' },
  MNP: { type: 'dependencia', parent: 'USA' },
  PCN: { type: 'dependencia', parent: 'GBR' },
  SJM: { type: 'dependencia', parent: 'NOR' },
  TKL: { type: 'dependencia', parent: 'NZL' },
  TCA: { type: 'dependencia', parent: 'GBR' },
  VIR: { type: 'dependencia', parent: 'USA' },
  VGB: { type: 'dependencia', parent: 'GBR' },
  JEY: { type: 'dependencia', parent: 'GBR' },
  MAC: { type: 'dependencia', parent: 'CHN' },
  MSR: { type: 'dependencia', parent: 'GBR' },
  NIU: { type: 'dependencia', parent: 'NZL' },
  NCL: { type: 'dependencia', parent: 'FRA' },
  PYF: { type: 'dependencia', parent: 'FRA' },
  PRI: { type: 'dependencia', parent: 'USA' },
  MAF: { type: 'dependencia', parent: 'FRA' },
  ASM: { type: 'dependencia', parent: 'USA' },
  BLM: { type: 'dependencia', parent: 'FRA' },
  SPM: { type: 'dependencia', parent: 'FRA' },
  SHN: { type: 'dependencia', parent: 'GBR' },
  SXM: { type: 'dependencia', parent: 'NLD' },
  WLF: { type: 'dependencia', parent: 'FRA' },
  // Ultramar: legalmente son Francia, pero ir a Martinica no es ir a París.
  // No suman a Francia.
  GLP: { type: 'ultramar', parent: 'FRA' },
  MTQ: { type: 'ultramar', parent: 'FRA' },
  REU: { type: 'ultramar', parent: 'FRA' },
  MYT: { type: 'ultramar', parent: 'FRA' },
  GUF: { type: 'ultramar', parent: 'FRA' },
  // Remotos: deshabitados o casi inaccesibles. Se quedan como reto extremo
  // (y porque quitarlos dejaría huérfano a quien ya los hubiera marcado).
  ATA: { type: 'remoto' },
  BVT: { type: 'remoto', parent: 'NOR' },
  HMD: { type: 'remoto', parent: 'AUS' },
  SGS: { type: 'remoto', parent: 'GBR' },
  ATF: { type: 'remoto', parent: 'FRA' },
  IOT: { type: 'remoto', parent: 'GBR' },
  CXR: { type: 'remoto', parent: 'AUS' },
  CCK: { type: 'remoto', parent: 'AUS' },
  UMI: { type: 'remoto', parent: 'USA' },
}

// Nombres de world-countries que en castellano de a pie suenan raros.
const NAME_FIX = {
  ALA: 'Åland',
  FRO: 'Islas Feroe',
  MAF: 'San Martín',
  SJM: 'Svalbard',
  SHN: 'Santa Elena',
  CCK: 'Islas Cocos',
  UMI: 'Islas menores de EE. UU.',
  VGB: 'Islas Vírgenes Británicas',
  VIR: 'Islas Vírgenes de EE. UU.',
  ESH: 'Sáhara Occidental',
  PCN: 'Pitcairn',
  TKL: 'Tokelau',
  SGS: 'Georgias del Sur',
  HMD: 'Islas Heard y McDonald',
  ATF: 'Tierras Australes Francesas',
  TCA: 'Islas Turcas y Caicos',
  IRN: 'Irán',
  BHR: 'Baréin',
}

/**
 * Centro aproximado [lat, lon] con 2 decimales (~1 km): sobra para los
 * extremos y la distancia a casa, y no engorda el JSON.
 */
const round = ([lat, lon]) => [Math.round(lat * 100) / 100, Math.round(lon * 100) / 100]

/**
 * Sitios cuyo «centro» de world-countries no es donde se va de verdad.
 * La Antártida viene en el Polo Sur, pero casi todos los viajes llegan a la
 * península Antártica: con el polo, cualquiera que fuera en crucero saldría
 * «a 90° S» y a 3.000 km más de casa de lo que estuvo.
 */
const LATLNG_FIX = {
  ATA: [-64.5, -62],
}

const base = countries.map((c) => {
  const name = NAME_FIX[c.cca3] || c.translations?.spa?.common || c.name.common
  if (!c.latlng?.length) throw new Error(`${c.cca3} no trae coordenadas.`)
  const common = {
    cca3: c.cca3,
    cca2: c.cca2,
    // ccn3 (ISO numérico) casa con los `id` de world-atlas para pintar el mapa.
    ccn3: c.ccn3,
    name,
    continent: REGION_ES[c.region] || c.region || 'Otros',
    subregion: c.subregion || '',
    latlng: round(LATLNG_FIX[c.cca3] || c.latlng),
  }
  // `world-countries` no cuenta Palestina como soberana; la ONU sí la trata
  // como estado observador, igual que a la Santa Sede.
  if (c.independent === true || c.cca3 === 'PSE') {
    // Fronteras terrestres entre países, para el logro de la cadena de
    // fronteras. Solo hacia otros países (no hacia territorios: Kosovo).
    const borders = (c.borders || []).filter((b) => countries.find((x) => x.cca3 === b)?.independent === true || b === 'PSE')
    return { ...common, kind: 'country', ...(borders.length ? { borders } : {}) }
  }
  const t = ISO_TERRITORIES[c.cca3]
  if (!t) throw new Error(`Territorio sin clasificar: ${c.cca3} (${name}). Añádelo a ISO_TERRITORIES.`)
  return { ...common, kind: 'territory', type: t.type, ...(t.parent ? { parent: t.parent } : {}) }
})

// Las 4 naciones del Reino Unido: territorios que SÍ suman al Reino Unido.
// Mantienen sus códigos de siempre (ENG, SCT…): ya están en copias guardadas.
// Las coordenadas son el centro de cada nación (el mismo que sale de su forma
// en gen-map.mjs), escritas a mano para no meter d3 en este script.
const ukNations = [
  ['ENG', 'Inglaterra', [52.57, -1.46]],
  ['SCT', 'Escocia', [56.66, -3.99]],
  ['WLS', 'Gales', [52.3, -3.73]],
  ['NIR', 'Irlanda del Norte', [54.61, -6.7]],
].map(([cca3, name, latlng]) => ({
  cca3,
  cca2: 'GB',
  ccn3: '',
  name,
  continent: 'Europa',
  subregion: 'Northern Europe',
  latlng,
  kind: 'territory',
  type: 'nacion',
  parent: 'GBR',
  sovereignCode: 'GBR',
}))

const manual = territories.map((t) => ({
  cca3: t.code,
  cca2: '',
  ccn3: '',
  name: t.name,
  continent: t.continent,
  subregion: t.subregion,
  latlng: round(t.latlng),
  kind: 'territory',
  type: t.type,
  ...(t.parent ? { parent: t.parent } : {}),
  ...(t.countsFor ? { sovereignCode: t.countsFor } : {}),
  ...(t.defunct ? { defunct: true } : {}),
}))

const list = [...base, ...ukNations, ...manual].sort((a, b) => a.name.localeCompare(b.name, 'es'))

// Comprobaciones que, si fallan, dejarían datos incoherentes en la app.
const codes = new Set(list.map((c) => c.cca3))
if (codes.size !== list.length) throw new Error('Hay códigos repetidos.')
for (const c of list) {
  for (const ref of [c.parent, c.sovereignCode]) {
    if (ref && list.find((x) => x.cca3 === ref)?.kind !== 'country') {
      throw new Error(`${c.cca3} apunta a ${ref}, que no es un país.`)
    }
  }
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'countries.json'), JSON.stringify(list, null, 2) + '\n')

const nCountries = list.filter((c) => c.kind === 'country').length
console.log(`countries.json: ${nCountries} países y ${list.length - nCountries} territorios`)
if (nCountries !== 195) {
  console.error(`¡Deberían ser 195 países (193 ONU + Vaticano + Palestina) y son ${nCountries}!`)
  process.exit(1)
}
