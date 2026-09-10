import { useMemo, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from '../../src/ui/ThemeProvider'
import { Txt } from '../../src/ui/Text'
import { useVisits } from '../../src/hooks/useVisits'
import { computeStats } from '../../src/lib/library'
import WorldMap from '../../src/components/WorldMap'
import CountrySheet from '../../src/components/CountrySheet'
import BackupBanner from '../../src/components/BackupBanner'
import { radius, space } from '../../src/ui/theme'
import type { CountryStatus } from '../../src/types'

export default function MapaScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { data: visits } = useVisits()
  const [selected, setSelected] = useState<string | null>(null)

  const statusByCode = useMemo(
    () => new Map<string, CountryStatus>(visits.map((v) => [v.code, v.status])),
    [visits],
  )
  const stats = useMemo(() => computeStats(visits), [visits])
  const current = selected ? visits.find((v) => v.code === selected) : undefined

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <WorldMap statusByCode={statusByCode} onSelect={setSelected} selected={selected} />

      {/* Flotando sobre el mapa: el resumen y, si toca, el aviso de copia. */}
      <View style={[styles.overlay, { top: insets.top + space.md }]} pointerEvents="box-none">
        <View style={[styles.pill, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <Txt variant="data">
            {stats.been} · {stats.percent}% del mundo
          </Txt>
        </View>
        <BackupBanner />
      </View>

      {selected && (
        <CountrySheet code={selected} current={current} onClose={() => setSelected(null)} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
