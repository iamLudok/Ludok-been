import { useMemo, useState } from 'react'
import { View, Pressable, FlatList, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '../src/ui/Screen'
import { Txt } from '../src/ui/Text'
import { usePalette } from '../src/ui/ThemeProvider'
import { useVisits } from '../src/hooks/useVisits'
import { timelineOf, yearSummary } from '../src/lib/timeline'
import { getByCca3, nameOf } from '../src/lib/countries'
import CountrySheet from '../src/components/CountrySheet'
import { radius, space } from '../src/ui/theme'

/**
 * Línea de tiempo: cada año con lo que visitaste, del más reciente al más
 * antiguo, y al final lo que no tiene año. Tocar un sitio abre su ficha, y
 * desde ahí se le pone o se le cambia el año.
 */
export default function LineaScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { data: visits } = useVisits()
  const [selected, setSelected] = useState<string | null>(null)
  const timeline = useMemo(() => timelineOf(visits), [visits])
  const years = useMemo(() => [...timeline.years].reverse(), [timeline])
  const current = selected ? visits.find((v) => v.code === selected) : undefined

  const place = (code: string, muted = false) => {
    const territory = getByCca3(code)?.kind === 'territory'
    return (
      <Pressable
        key={code}
        onPress={() => setSelected(code)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.place,
          {
            borderColor: palette.line,
            borderStyle: territory ? 'dashed' : 'solid',
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Txt variant="small" tone={muted ? 'muted' : undefined}>
          {nameOf(code)}
        </Txt>
      </Pressable>
    )
  }

  return (
    <Screen
      title="Línea de tiempo"
      padded={false}
      right={
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={space.md}>
          <Txt variant="small" tone="muted" style={{ fontWeight: '600' }}>
            Cerrar
          </Txt>
        </Pressable>
      }
    >
      <FlatList
        data={years}
        keyExtractor={(y) => String(y.year)}
        contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxl + insets.bottom }}
        ListEmptyComponent={
          <Txt variant="body" tone="muted" style={styles.empty}>
            Aún no hay nada con año. Ponle el año a cada sitio desde su ficha y aquí verás tus viajes ordenados.
          </Txt>
        }
        renderItem={({ item: y }) => (
          <View style={styles.year}>
            {/* El hilo de la línea de tiempo: un punto por año. */}
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: palette.mapBeen }]} />
              <View style={[styles.line, { backgroundColor: palette.line }]} />
            </View>
            <View style={{ flex: 1, gap: space.sm }}>
              <View style={styles.head}>
                <Txt variant="title">{y.year}</Txt>
                <Txt variant="data" tone="faint">
                  {y.totalCountries} en total
                </Txt>
              </View>
              <Txt variant="small" tone="muted">
                {yearSummary(y.newCountries, y.territories)}
              </Txt>
              <View style={styles.places}>{y.codes.map((c) => place(c))}</View>
            </View>
          </View>
        )}
        ListFooterComponent={
          timeline.undated.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <Txt variant="label" tone="faint">
                Sin año · {timeline.undated.length}
              </Txt>
              <Txt variant="small" tone="faint">
                Toca uno para ponerle el año.
              </Txt>
              <View style={styles.places}>{timeline.undated.map((c) => place(c, true))}</View>
            </View>
          ) : null
        }
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
  year: { flexDirection: 'row', gap: space.md },
  rail: { width: 12, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: radius.pill, marginTop: 9 },
  line: { flex: 1, width: StyleSheet.hairlineWidth, marginTop: space.xs, marginBottom: -space.xl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  places: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  place: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
  },
  empty: { padding: space.xl, textAlign: 'center' },
})
