import { useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, SectionList, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from '../../src/ui/ThemeProvider'
import { useVisits } from '../../src/hooks/useVisits'
import { COUNTRIES } from '../../src/lib/countries'
import CountrySheet from '../../src/components/CountrySheet'
import { space, radius } from '../../src/ui/theme'
import type { Country, Visit } from '../../src/types'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const STATUS_ICON = { been: '✅', want: '⭐' } as const

interface Section {
  title: string
  data: Country[]
}

export default function ListaScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { data: visits } = useVisits()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const visitByCode = useMemo(
    () => new Map<string, Visit>(visits.map((v) => [v.code, v])),
    [visits],
  )

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

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.bg },
    h1: { fontSize: 22, fontWeight: '700', color: palette.text, padding: space.lg, paddingBottom: space.sm },
    search: {
      marginHorizontal: space.lg,
      marginBottom: space.sm,
      padding: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface2,
      color: palette.text,
    },
    sectionHeader: {
      backgroundColor: palette.bg,
      paddingHorizontal: space.lg,
      paddingTop: space.md,
      paddingBottom: space.xs,
      fontSize: 15,
      fontWeight: '600',
      color: palette.text,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: space.lg,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    rowFirst: { borderTopWidth: 0 },
    rowText: { color: palette.text, fontWeight: '500' },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    year: { color: palette.muted },
    plus: { color: palette.muted },
  })

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Text style={styles.h1}>Lista</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar país…"
        placeholderTextColor={palette.muted}
        style={styles.search}
      />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.cca3}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item: c, index }) => {
          const v = visitByCode.get(c.cca3)
          return (
            <Pressable
              style={[styles.row, index === 0 && styles.rowFirst]}
              onPress={() => setSelected(c.cca3)}
            >
              <Text style={styles.rowText}>{c.name}</Text>
              <View style={styles.rowMeta}>
                {v?.year ? <Text style={styles.year}>{v.year}</Text> : null}
                {v ? <Text>{STATUS_ICON[v.status]}</Text> : <Text style={styles.plus}>＋</Text>}
              </View>
            </Pressable>
          )
        }}
        contentContainerStyle={{ paddingBottom: space.xl }}
        stickySectionHeadersEnabled
      />

      {selected && (
        <CountrySheet code={selected} current={current} onClose={() => setSelected(null)} />
      )}
    </View>
  )
}
