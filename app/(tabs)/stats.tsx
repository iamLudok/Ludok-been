import { useMemo } from 'react'
import { ScrollView, View, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Screen, Card } from '../../src/ui/Screen'
import { Txt } from '../../src/ui/Text'
import { usePalette } from '../../src/ui/ThemeProvider'
import { useVisits } from '../../src/hooks/useVisits'
import { computeStats } from '../../src/lib/library'
import { adventureOf, footprintOf } from '../../src/lib/rarity'
import { nameOf } from '../../src/lib/countries'
import { countByTransport } from '../../src/lib/transports'
import { TransportIcon } from '../../src/ui/TransportIcon'
import { radius, space } from '../../src/ui/theme'

export default function StatsScreen() {
  const palette = usePalette()
  const { data: visits } = useVisits()
  const stats = useMemo(() => computeStats(visits), [visits])
  const transports = useMemo(() => countByTransport(visits), [visits])
  const adventure = useMemo(() => adventureOf(visits), [visits])
  const footprint = useMemo(() => footprintOf(visits), [visits])
  const maxTransport = transports[0]?.count ?? 0

  return (
    <Screen title="Stats" padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.hero}>
            <Txt style={[styles.percent, { color: palette.fg }]}>{stats.percent}%</Txt>
            <Txt variant="small" tone="muted">
              del mundo visitado
            </Txt>
          </View>
          <View style={[styles.stat, { borderColor: palette.line }]}>
            <Row label="Visitados" value={`${stats.been} de ${stats.worldTotal}`} />
            <Row label="Territorios" value={`${stats.territories.been} de ${stats.territories.total}`} />
            <Row label="Quiero ir" value={String(stats.want)} />
            <Row label="Continentes" value={String(stats.continentsVisited)} />
          </View>
        </Card>

        <Card>
          <View style={styles.row}>
            <Txt variant="title">Aventura</Txt>
            <Txt variant="data" tone="muted">
              {adventure.points} pts
            </Txt>
          </View>
          <View style={{ gap: space.xs }}>
            <View style={styles.row}>
              <Txt variant="section">{adventure.level.name}</Txt>
              {adventure.next && (
                <Txt variant="data" tone="faint">
                  {adventure.next.from - adventure.points} pts para {adventure.next.name}
                </Txt>
              )}
            </View>
            <View style={[styles.bar, { backgroundColor: palette.surface2 }]}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.round(adventure.progress * 100)}%`, backgroundColor: palette.mapBeen },
                ]}
              />
            </View>
          </View>
          {adventure.top.length > 0 && (
            <View style={[styles.stat, { borderColor: palette.line }]}>
              <Txt variant="label" tone="faint">
                Lo más raro que has visto
              </Txt>
              {adventure.top.slice(0, 5).map((s) => (
                <Row key={s.code} label={nameOf(s.code)} value={`${s.points}`} />
              ))}
            </View>
          )}
          <Pressable
            onPress={() => router.push('/ranking')}
            accessibilityRole="button"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Txt variant="small" style={{ fontWeight: '600' }}>
              Ver ranking de países ›
            </Txt>
          </Pressable>
        </Card>

        <Card>
          <Txt variant="title">Tu huella</Txt>
          <View style={styles.footprint}>
            <View style={styles.footprintItem}>
              <Txt style={[styles.big, { color: palette.fg }]}>{footprint.areaPct}%</Txt>
              <Txt variant="small" tone="muted">
                de la superficie de los 195 países
              </Txt>
            </View>
            <View style={styles.footprintItem}>
              <Txt style={[styles.big, { color: palette.fg }]}>{footprint.populationPct}%</Txt>
              <Txt variant="small" tone="muted">
                de la humanidad vive donde has estado
              </Txt>
            </View>
          </View>
        </Card>

        {transports.length > 0 && (
          <Card>
            <Txt variant="title">Cómo te has movido</Txt>
            {transports.map((t) => {
              const pct = maxTransport ? Math.round((t.count / maxTransport) * 100) : 0
              return (
                <View key={t.value} style={{ gap: space.xs }}>
                  <View style={styles.row}>
                    <View style={styles.transportLabel}>
                      <TransportIcon value={t.value} color={palette.muted} size={15} />
                      <Txt variant="small">{t.label}</Txt>
                    </View>
                    <Txt variant="data" tone="muted">
                      {t.count} {t.count === 1 ? 'país' : 'países'}
                    </Txt>
                  </View>
                  <View style={[styles.bar, { backgroundColor: palette.surface2 }]}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: palette.fg }]} />
                  </View>
                </View>
              )
            })}
          </Card>
        )}

        <Card>
          <Txt variant="title">Por continente</Txt>
          {stats.byContinent.map((c) => {
            const pct = c.total ? Math.round((c.been / c.total) * 100) : 0
            return (
              <View key={c.continent} style={{ gap: space.xs }}>
                <View style={styles.row}>
                  <Txt variant="small">{c.continent}</Txt>
                  <Txt variant="data" tone="muted">
                    {c.been}/{c.total} · {pct}%
                  </Txt>
                </View>
                <View style={[styles.bar, { backgroundColor: palette.surface2 }]}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: palette.fg }]} />
                </View>
              </View>
            )
          })}
        </Card>
      </ScrollView>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Txt variant="small" tone="muted">
        {label}
      </Txt>
      <Txt variant="data">{value}</Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  hero: { alignItems: 'center', gap: space.xs },
  percent: { fontSize: 56, fontWeight: '800', letterSpacing: -2 },
  stat: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: space.xs,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  footprint: { flexDirection: 'row', gap: space.lg },
  footprintItem: { flex: 1, gap: space.xs },
  big: { fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  transportLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bar: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
})
