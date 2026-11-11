import { useMemo } from 'react'
import { ScrollView, View, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Screen, Card } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { usePalette } from '../../src/ui/ThemeProvider'
import { useVisits } from '../../src/hooks/useVisits'
import { achievementsOf, type AchievementGroup, type AchievementState } from '../../src/lib/achievements'
import { radius, space } from '../../src/ui/theme'

const GROUPS: AchievementGroup[] = ['Rarezas', 'Colecciones', 'Regiones', 'Viajero']

/**
 * Retos: los logros como sellos de pasaporte, y el ranking de países.
 *
 * Sin color ni emojis, en la línea de «Sala oscura»: un sello conseguido es
 * de trazo sólido y va un poco girado, como estampado a mano; uno pendiente
 * es de trazo discontinuo, con su progreso.
 */
export default function RetosScreen() {
  const palette = usePalette()
  const { data: visits } = useVisits()
  const all = useMemo(() => achievementsOf(visits), [visits])
  const done = all.filter((a) => a.unlocked).length

  return (
    <Screen title="Retos" padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.row}>
            <Txt variant="title">Logros</Txt>
            <Txt variant="data" tone="muted">
              {done} de {all.length}
            </Txt>
          </View>
          <View style={[styles.bar, { backgroundColor: palette.surface2 }]}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.round((done / all.length) * 100)}%`, backgroundColor: palette.mapBeen },
              ]}
            />
          </View>
          <Pressable
            onPress={() => router.push('/ranking')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.link, { borderColor: palette.line, opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={{ flex: 1 }}>
              <Txt variant="section">Ranking de países</Txt>
              <Txt variant="small" tone="muted">
                Por rareza, superficie o población. Y los más raros que te faltan.
              </Txt>
            </View>
            <Txt variant="title" tone="muted">
              ›
            </Txt>
          </Pressable>
        </Card>

        {GROUPS.map((group) => (
          <View key={group} style={{ gap: space.sm }}>
            <Txt variant="label" tone="faint" style={{ paddingHorizontal: space.xs }}>
              {group}
            </Txt>
            <View style={styles.grid}>
              {all
                .filter((a) => a.group === group)
                .map((a, i) => (
                  <Stamp key={a.id} a={a} tilt={i % 2 === 0 ? -2 : 1.5} />
                ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}

function Stamp({ a, tilt }: { a: AchievementState; tilt: number }) {
  const palette = usePalette()
  const pct = a.goal ? Math.min(1, a.progress / a.goal) : 0
  return (
    <View
      accessible
      accessibilityLabel={`${a.title}. ${a.unlocked ? 'Conseguido' : `${a.progress} de ${a.total}`}. ${a.description}`}
      style={[
        styles.stamp,
        a.unlocked
          ? { borderColor: palette.fg, borderStyle: 'solid', transform: [{ rotate: `${tilt}deg` }] }
          : { borderColor: palette.line, borderStyle: 'dashed' },
        { backgroundColor: palette.surface },
      ]}
    >
      <Txt variant="section" tone={a.unlocked ? undefined : 'muted'} numberOfLines={2}>
        {a.title}
      </Txt>
      <Txt variant="small" tone="faint" numberOfLines={4}>
        {a.description}
      </Txt>
      <View style={{ flex: 1 }} />
      {a.unlocked ? (
        <Txt variant="label" style={{ color: palette.fg }}>
          Conseguido
          {a.goal < a.total ? ` · ${a.progress} de ${a.total}` : ''}
        </Txt>
      ) : (
        <View style={{ gap: space.xs }}>
          <Txt variant="data" tone="muted">
            {a.progress} de {a.goal}
          </Txt>
          <View style={[styles.bar, { backgroundColor: palette.surface2 }]}>
            <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: palette.muted }]} />
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  bar: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  stamp: {
    width: '47.5%',
    minHeight: 150,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.xs,
  },
})
