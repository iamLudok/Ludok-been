import { useMemo, useState } from 'react'
import { View, TextInput, Pressable, SectionList, StyleSheet } from 'react-native'
import { Screen } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { usePalette } from '../../src/ui/ThemeProvider'
import { useVisits } from '../../src/hooks/useVisits'
import { COUNTRIES } from '../../src/lib/countries'
import CountrySheet from '../../src/components/CountrySheet'
import { TransportIcon } from '../../src/ui/TransportIcon'
import { radius, space } from '../../src/ui/theme'
import type { Country, Visit } from '../../src/types'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

interface Section {
  title: string
  data: Country[]
}

export default function ListaScreen() {
  const palette = usePalette()
  const { data: visits } = useVisits()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const visitByCode = useMemo(() => new Map<string, Visit>(visits.map((v) => [v.code, v])), [visits])

  const sections = useMemo<Section[]>(() => {
    const q = normalize(query.trim())
    const filtered = q ? COUNTRIES.filter((c) => normalize(c.name).includes(q)) : COUNTRIES
    const byContinent = new Map<string, Country[]>()
    for (const c of filtered) {
      const arr = byContinent.get(c.continent) ?? []
      arr.push(c)
      byContinent.set(c.continent, arr)
    }
    return [...byContinent.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'es'))
      .map(([title, data]) => ({ title, data }))
  }, [query])

  const current = selected ? visitByCode.get(selected) : undefined

  return (
    <Screen title="Lista" padded={false}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar país…"
        placeholderTextColor={palette.faint}
        style={[
          styles.search,
          { borderColor: palette.line, color: palette.fg, backgroundColor: palette.surface },
        ]}
      />
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
              <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                {c.name}
              </Txt>
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
        <CountrySheet code={selected} current={current} onClose={() => setSelected(null)} />
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
