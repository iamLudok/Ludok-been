import { useMemo, useState } from 'react'
import { View, TextInput, Pressable, SectionList, StyleSheet } from 'react-native'
import { Screen } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { usePalette } from '../../src/ui/ThemeProvider'
import { useVisits } from '../../src/hooks/useVisits'
import { ONLY_COUNTRIES, TERRITORIES, TERRITORY_TYPE_LABEL, nameOf, normalizeName } from '../../src/lib/countries'
import { Chips } from '../../src/ui/Chips'
import CountrySheet from '../../src/components/CountrySheet'
import { TransportIcon } from '../../src/ui/TransportIcon'
import { radius, space } from '../../src/ui/theme'
import type { Country, TerritoryType, Visit } from '../../src/types'

interface Section {
  title: string
  data: Country[]
}

type Tab = 'countries' | 'territories'

/** Orden de los grupos de territorios: de lo más «reto» a lo más remoto. */
const TYPE_ORDER: TerritoryType[] = ['de-facto', 'nacion', 'region', 'dependencia', 'ultramar', 'remoto']

/** Agrupa por una clave y ordena los grupos con `order` (o alfabéticamente). */
function groupBy(list: Country[], key: (c: Country) => string, order?: string[]): Section[] {
  const groups = new Map<string, Country[]>()
  for (const c of list) {
    const k = key(c)
    groups.set(k, [...(groups.get(k) ?? []), c])
  }
  const rank = (k: string) => (order ? order.indexOf(k) : 0)
  return [...groups.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'es'))
    .map(([title, data]) => ({ title, data }))
}

export default function ListaScreen() {
  const palette = usePalette()
  const { data: visits } = useVisits()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('countries')
  const [selected, setSelected] = useState<string | null>(null)

  const visitByCode = useMemo(() => new Map<string, Visit>(visits.map((v) => [v.code, v])), [visits])

  const sections = useMemo<Section[]>(() => {
    const q = normalizeName(query.trim())
    const source = tab === 'countries' ? ONLY_COUNTRIES : TERRITORIES
    const filtered = q ? source.filter((c) => normalizeName(c.name).includes(q)) : source
    if (tab === 'countries') return groupBy(filtered, (c) => c.continent)
    return groupBy(
      filtered,
      (c) => TERRITORY_TYPE_LABEL[c.type ?? 'dependencia'],
      TYPE_ORDER.map((t) => TERRITORY_TYPE_LABEL[t]),
    )
  }, [query, tab])

  const beenIn = (list: Country[]) => list.filter((c) => visitByCode.get(c.cca3)?.status === 'been').length

  const current = selected ? visitByCode.get(selected) : undefined

  return (
    <Screen title="Lista" padded={false}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={tab === 'countries' ? 'Buscar país…' : 'Buscar territorio…'}
        placeholderTextColor={palette.faint}
        style={[
          styles.search,
          { borderColor: palette.line, color: palette.fg, backgroundColor: palette.surface },
        ]}
      />
      <View style={styles.tabs}>
        <Chips
          options={[
            { key: 'countries', label: `Países · ${beenIn(ONLY_COUNTRIES)}/${ONLY_COUNTRIES.length}` },
            { key: 'territories', label: `Territorios · ${beenIn(TERRITORIES)}/${TERRITORIES.length}` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.cca3}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space.xxl }}
        renderSectionHeader={({ section }) => (
          <Txt variant="label" tone="faint" style={[styles.sectionHeader, { backgroundColor: palette.bg }]}>
            {section.title}
          </Txt>
        )}
        renderItem={({ item: c }) => {
          const v = visitByCode.get(c.cca3)
          return (
            <Pressable
              onPress={() => setSelected(c.cca3)}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: palette.line, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Txt variant="body" numberOfLines={1}>
                  {c.name}
                </Txt>
                {c.parent ? (
                  <Txt variant="small" tone="faint" numberOfLines={1}>
                    {nameOf(c.parent)}
                    {c.defunct ? ' · ya no existe' : ''}
                  </Txt>
                ) : c.defunct ? (
                  <Txt variant="small" tone="faint">
                    ya no existe
                  </Txt>
                ) : null}
              </View>
              {v?.transports?.length ? (
                <View style={styles.transports}>
                  {v.transports.slice(0, 4).map((t) => (
                    <TransportIcon key={t} value={t} color={palette.faint} size={14} />
                  ))}
                  {v.transports.length > 4 && (
                    <Txt variant="data" tone="faint">
                      +{v.transports.length - 4}
                    </Txt>
                  )}
                </View>
              ) : null}
              {v?.year ? (
                <Txt variant="data" tone="faint">
                  {v.year}
                </Txt>
              ) : null}
              {v ? (
                <View
                  style={[
                    styles.mark,
                    v.status === 'been'
                      ? { backgroundColor: palette.fg, borderColor: palette.fg }
                      : { borderColor: palette.warn },
                  ]}
                />
              ) : (
                <View style={[styles.mark, { borderColor: palette.line }]} />
              )}
            </Pressable>
          )
        }}
      />

      {selected && (
        <CountrySheet
          code={selected}
          current={current}
          visits={visits}
          onClose={() => setSelected(null)}
          onOpen={setSelected}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  search: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 14,
  },
  tabs: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  sectionHeader: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  transports: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  mark: { width: 14, height: 14, borderRadius: radius.pill, borderWidth: 2 },
})
