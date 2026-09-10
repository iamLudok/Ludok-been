import { Pressable, ScrollView, StyleSheet } from 'react-native'
import { usePalette } from './ThemeProvider'
import { Txt } from './Text'
import { radius, space } from './theme'

export interface ChipOption<T extends string> {
  key: T
  label: string
}

/**
 * Fila de opciones deslizable. Sin color de acento: el seleccionado se marca
 * invirtiendo el contraste, que es la única jerarquía disponible en «Sala oscura».
 */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly ChipOption<T>[]
  value: T
  onChange: (v: T) => void
}) {
  const palette = usePalette()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((o) => {
        const on = o.key === value
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: on ? palette.fg : 'transparent',
                borderColor: on ? palette.fg : palette.line,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Txt variant="small" style={{ color: on ? palette.onFg : palette.muted, fontWeight: '600' }}>
              {o.label}
            </Txt>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingRight: space.lg },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
})
