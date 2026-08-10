import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { svgPaths, MAP_WIDTH, MAP_HEIGHT } from '../lib/geo'
import { usePalette } from '../ui/ThemeProvider'
import type { Stats } from '../lib/library'
import type { CountryStatus } from '../types'

interface Props {
  stats: Stats
  statusByCode: Map<string, CountryStatus>
}

const CARD_W = 1000
const CARD_H = 1200
const MAP_W = 920
const MAP_H = MAP_W * (MAP_HEIGHT / MAP_WIDTH)

/**
 * Tarjeta de estadísticas para capturar como imagen (react-native-view-shot).
 * Tamaño fijo, sin gestos: es solo para renderizar y fotografiar.
 */
export default function StatsShareCard({ stats, statusByCode }: Props) {
  const palette = usePalette()
  const paths = useMemo(() => svgPaths(MAP_WIDTH, MAP_HEIGHT), [])

  function fillFor(status: CountryStatus | undefined): string {
    if (status === 'been') return palette.accent
    if (status === 'want') return palette.want
    return palette.mapEmpty
  }

  return (
    <View
      collapsable={false}
      style={[styles.card, { width: CARD_W, height: CARD_H, backgroundColor: palette.bg }]}
    >
      <View style={styles.mapWrap}>
        <Svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
          {paths.map((p, i) => (
            <Path
              key={p.cca3 ?? `x${i}`}
              d={p.d}
              fill={fillFor(p.cca3 ? statusByCode.get(p.cca3) : undefined)}
              stroke={palette.mapStroke}
              strokeWidth={0.6}
            />
          ))}
        </Svg>
      </View>

      <Text style={[styles.percent, { color: palette.accent }]}>{stats.percent}%</Text>
      <Text style={[styles.subtitle, { color: palette.text }]}>del mundo visitado</Text>
      <Text style={[styles.detail, { color: palette.muted }]}>
        {stats.been} de {stats.worldTotal} países · {stats.continentsVisited} continentes
      </Text>
      <Text style={[styles.brand, { color: palette.muted }]}>Ludok Been</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingTop: 60 },
  mapWrap: { marginBottom: 40 },
  percent: { fontSize: 180, fontWeight: '800' },
  subtitle: { fontSize: 34, fontWeight: '600', marginTop: 8 },
  detail: { fontSize: 26, marginTop: 16 },
  brand: { fontSize: 22, fontWeight: '600', marginTop: 40 },
})
