import { useMemo, useState } from 'react'
import { View, Pressable, FlatList, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '../src/ui/Screen'
import { Txt } from '../src/ui/Text'
import { Chips } from '../src/ui/Chips'
import { usePalette } from '../src/ui/ThemeProvider'
import { useVisits } from '../src/hooks/useVisits'
import { mapStatuses } from '../src/lib/library'
import { ranking, formatCount, SOURCES, type RankingKey } from '../src/lib/rarity'
import CountrySheet from '../src/components/CountrySheet'
import { radius, space } from '../src/ui/theme'

type Sort = RankingKey | 'rarity-all'
type Filter = 'all' | 'been' | 'missing'

const SORTS = [
  { key: 'rarity', label: 'Rareza' },
  { key: 'rarity-all', label: 'Rareza + territorios' },
  { key: 'area', label: 'Superficie' },
  { key: 'population', label: 'Población' },
] as const

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'been', label: 'Visitados' },
  { key: 'missing', label: 'Me faltan' },
] as const

function formatValue(sort: Sort, value: number): string {
  if (sort === 'area') return `${formatCount(value)} km²`
  if (sort === 'population') return formatCount(value)
  return String(value)
}

/**
 * Ranking de países: por rareza (puntos de aventura), superficie o
 * población, con filtro de visitados / pendientes. «Me faltan» por rareza es
 * la lista de los retos más gordos que te quedan.
 */
export default function RankingScreen() {
  const palette = usePalette()
  // Fuera de las pestañas no hay barra que deje el hueco de la barra de
  // gestos: sin esto, el final de la lista quedaba debajo.
  const insets = useSafeAreaInsets()
  const { data: visits } = useVisits()
  const [sort, setSort] = useState<Sort>('rarity')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<string | null>(null)

  // Con `mapStatuses`, un país cuenta como visitado también si fuiste a una
  // región suya (Escocia → Reino Unido), igual que en el mapa y en el %.
  const statuses = useMemo(() => mapStatuses(visits), [visits])

  const rows = useMemo(() => {
    const all = sort === 'rarity-all' ? ranking('rarity', true) : ranking(sort)
    // La posición es la del ranking completo, no la de la lista filtrada:
    // «eres el nº 12 en rareza» no debe cambiar por mirar solo lo visitado.
    const ranked = all.map((r, i) => ({ ...r, position: i + 1 }))
    if (filter === 'all') return ranked
    const isBeen = (code: string) => statuses.get(code) === 'been'
    return ranked.filter((r) => (filter === 'been' ? isBeen(r.country.cca3) : !isBeen(r.country.cca3)))
  }, [sort, filter, statuses])

  const current = selected ? visits.find((v) => v.code === selected) : undefined

  return (
    <Screen
      title="Ranking"
      padded={false}
      right={
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={space.md}>
          <Txt variant="small" tone="muted" style={{ fontWeight: '600' }}>
            Cerrar
          </Txt>
        </Pressable>
      }
    >
      <View style={styles.controls}>
        <Chips options={SORTS} value={sort} onChange={setSort} />
        <Chips options={FILTERS} value={filter} onChange={setFilter} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.country.cca3}
        contentContainerStyle={{ paddingBottom: space.xxl + insets.bottom }}
        ListEmptyComponent={
          <Txt variant="body" tone="muted" style={styles.empty}>
            {filter === 'been' ? 'Aún no has marcado ninguno como visitado.' : 'Los tienes todos. Enhorabuena.'}
          </Txt>
        }
        ListFooterComponent={
          <View style={styles.sources}>
            <Txt variant="small" tone="faint">
              Turistas: {SOURCES.tourists}.
            </Txt>
            <Txt variant="small" tone="faint">
              Población: {SOURCES.population}. Superficie: {SOURCES.area}.
            </Txt>
          </View>
        }
        renderItem={({ item: r }) => {
          const st = statuses.get(r.country.cca3)
          return (
            <Pressable
              onPress={() => setSelected(r.country.cca3)}
              style={({ pressed }) => [styles.row, { borderBottomColor: palette.line, opacity: pressed ? 0.6 : 1 }]}
            >
              <Txt variant="data" tone="faint" style={styles.position}>
                {r.position}
              </Txt>
              <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                {r.country.name}
                {r.country.kind === 'territory' ? (
                  <Txt variant="small" tone="faint">
                    {'  territorio'}
                  </Txt>
                ) : null}
              </Txt>
              <Txt variant="data" tone="muted">
                {formatValue(sort, r.value)}
              </Txt>
              <View
                style={[
                  styles.mark,
                  st === 'been'
                    ? { backgroundColor: palette.fg, borderColor: palette.fg }
                    : { borderColor: st === 'want' ? palette.warn : palette.line },
                ]}
              />
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
  controls: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  position: { width: 28, textAlign: 'right' },
  mark: { width: 14, height: 14, borderRadius: radius.pill, borderWidth: 2 },
  empty: { padding: space.xl, textAlign: 'center' },
  sources: { padding: space.lg, gap: space.xs },
})
