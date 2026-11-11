import { useCallback, useMemo, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from '../../src/ui/ThemeProvider'
import { Txt } from '../../src/ui/Text'
import { useVisits } from '../../src/hooks/useVisits'
import { computeStats, mapStatuses } from '../../src/lib/library'
import WorldMap from '../../src/components/WorldMap'
import CountrySheet from '../../src/components/CountrySheet'
import BackupBanner from '../../src/components/BackupBanner'
import { radius, space } from '../../src/ui/theme'

/** Alto aproximado de la píldora de resumen, para no encuadrar debajo de ella. */
const PILL_HEIGHT = 32

export default function MapaScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { data: visits } = useVisits()
  const [selected, setSelected] = useState<string | null>(null)
  const [sheetHeight, setSheetHeight] = useState(0)

  // Con las regiones sumando a su país: si fuiste a Escocia, el Reino Unido
  // se ve visitado (ver `mapStatuses`).
  const statusByCode = useMemo(() => mapStatuses(visits), [visits])
  const stats = useMemo(() => computeStats(visits), [visits])
  const current = selected ? visits.find((v) => v.code === selected) : undefined
  // Estable: la ficha lo usa como dependencia de su manejador del botón atrás.
  const close = useCallback(() => setSelected(null), [])

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <WorldMap
        statusByCode={statusByCode}
        onSelect={setSelected}
        selected={selected}
        bottomInset={selected ? sheetHeight : 0}
        topInset={insets.top + space.md + PILL_HEIGHT}
      />

      {/* Flotando sobre el mapa: el resumen y, si toca, el aviso de copia. */}
      <View style={[styles.overlay, { top: insets.top + space.md }]} pointerEvents="box-none">
        <View style={[styles.pill, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <Txt variant="data">
            {stats.been} {stats.been === 1 ? 'país' : 'países'}
            {stats.territories.been > 0
              ? ` · ${stats.territories.been} ${stats.territories.been === 1 ? 'territorio' : 'territorios'}`
              : ''}
            {` · ${stats.percent}%`}
          </Txt>
        </View>
        <BackupBanner />
      </View>

      {selected && (
        <CountrySheet
          code={selected}
          current={current}
          onClose={close}
          inline
          onHeight={setSheetHeight}
          visits={visits}
          onOpen={setSelected}
        />
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
