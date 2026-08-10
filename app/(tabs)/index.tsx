import { useState } from 'react'
import { View, Text } from 'react-native'
import { usePalette } from '../../src/ui/ThemeProvider'
import { useVisits } from '../../src/hooks/useVisits'
import WorldMap from '../../src/components/WorldMap'
import CountrySheet from '../../src/components/CountrySheet'
import { space } from '../../src/ui/theme'
import type { CountryStatus } from '../../src/types'

export default function MapaScreen() {
  const palette = usePalette()
  const { data: visits } = useVisits()
  const [selected, setSelected] = useState<string | null>(null)

  const statusByCode = new Map<string, CountryStatus>(visits.map((v) => [v.code, v.status]))
  const current = selected ? visits.find((v) => v.code === selected) : undefined

  return (
    <View style={{ flex: 1, backgroundColor: palette.mapEmpty }}>
      <WorldMap statusByCode={statusByCode} onSelect={setSelected} selected={selected} />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 14,
          alignItems: 'center',
        }}
        pointerEvents="none"
      >
        <View
          style={{
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: 999,
            paddingVertical: 6,
            paddingHorizontal: space.md,
          }}
        >
          <Text style={{ color: palette.muted, fontSize: 12 }}>
            Toca un país para marcarlo · usa Lista para islas pequeñas
          </Text>
        </View>
      </View>

      {selected && (
        <CountrySheet code={selected} current={current} onClose={() => setSelected(null)} />
      )}
    </View>
  )
}
