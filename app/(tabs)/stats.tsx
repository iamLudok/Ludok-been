import { useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from '../../src/ui/ThemeProvider'
import { useVisits } from '../../src/hooks/useVisits'
import { computeStats } from '../../src/lib/library'
import { space, radius } from '../../src/ui/theme'
import StatsShareCard from '../../src/components/StatsShareCard'
import { shareStatsImage } from '../../src/lib/shareImage'
import type { CountryStatus } from '../../src/types'

export default function StatsScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { data: visits } = useVisits()
  const stats = useMemo(() => computeStats(visits), [visits])
  const statusByCode = useMemo(
    () => new Map<string, CountryStatus>(visits.map((v) => [v.code, v.status])),
    [visits],
  )
  const shareCardRef = useRef<View>(null)
  const [sharing, setSharing] = useState(false)

  async function handleShare() {
    setSharing(true)
    try {
      await shareStatsImage(shareCardRef)
    } finally {
      setSharing(false)
    }
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.bg },
    content: { padding: space.lg, paddingBottom: space.lg + insets.bottom },
    h1: { fontSize: 22, fontWeight: '700', color: palette.text, marginBottom: space.md },
    h2: { fontSize: 16, fontWeight: '600', color: palette.text, marginTop: space.lg, marginBottom: space.sm },
    card: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.lg,
      padding: space.lg,
      alignItems: 'center',
    },
    percent: { fontSize: 48, fontWeight: '800', color: palette.accent },
    percentLabel: { color: palette.muted, marginTop: 2 },
    countsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: space.md },
    countBlock: { alignItems: 'center' },
    countNum: { fontSize: 22, fontWeight: '700', color: palette.text },
    countNumWant: { fontSize: 22, fontWeight: '700', color: palette.want },
    countLabel: { color: palette.muted, fontSize: 12.5, marginTop: 2, textAlign: 'center' },
    continentRow: { marginBottom: space.md },
    continentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    continentName: { color: palette.text },
    continentMeta: { color: palette.muted },
    bar: { height: 10, borderRadius: 6, backgroundColor: palette.surface2, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: palette.accent },
    shareBtn: {
      backgroundColor: palette.accent,
      borderRadius: radius.md,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: space.md,
    },
    shareBtnText: { color: '#052e16', fontWeight: '700' },
  })

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Estadísticas</Text>

      {/* Fuera de pantalla: solo existe para poder fotografiarla. */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={shareCardRef} collapsable={false}>
          <StatsShareCard stats={stats} statusByCode={statusByCode} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.percent}>{stats.percent}%</Text>
        <Text style={styles.percentLabel}>del mundo visitado</Text>
        <View style={styles.countsRow}>
          <View style={styles.countBlock}>
            <Text style={styles.countNum}>{stats.been}</Text>
            <Text style={styles.countLabel}>de {stats.worldTotal} países</Text>
          </View>
          <View style={styles.countBlock}>
            <Text style={styles.countNumWant}>{stats.want}</Text>
            <Text style={styles.countLabel}>por visitar</Text>
          </View>
          <View style={styles.countBlock}>
            <Text style={styles.countNum}>{stats.continentsVisited}</Text>
            <Text style={styles.countLabel}>continentes</Text>
          </View>
        </View>
        <Pressable style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
          <Text style={styles.shareBtnText}>{sharing ? 'Generando…' : '📸 Compartir imagen'}</Text>
        </Pressable>
      </View>

      <Text style={styles.h2}>Por continente</Text>
      {stats.byContinent.map((c) => {
        const pct = c.total ? Math.round((c.been / c.total) * 100) : 0
        return (
          <View key={c.continent} style={styles.continentRow}>
            <View style={styles.continentHeader}>
              <Text style={styles.continentName}>{c.continent}</Text>
              <Text style={styles.continentMeta}>
                {c.been}/{c.total} · {pct}%
              </Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}
