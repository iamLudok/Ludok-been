import { Pressable, StyleSheet, type ViewStyle } from 'react-native'
import { usePalette } from './ThemeProvider'
import { Txt } from './Text'
import { radius, space } from './theme'

type Kind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warn'

interface Props {
  title: string
  onPress: () => void
  kind?: Kind
  disabled?: boolean
  small?: boolean
  style?: ViewStyle
}

/**
 * En una interfaz sin color de acento, la jerarquía de los botones la marca el
 * contraste: el principal es un bloque sólido, el secundario solo lleva borde y
 * el fantasma es texto. `danger` y `warn` son las excepciones con color, y solo
 * porque significan algo (borrar / «quiero ir»).
 */
export function Button({ title, onPress, kind = 'secondary', disabled, small, style }: Props) {
  const palette = usePalette()

  const bg = kind === 'primary' ? palette.fg : 'transparent'
  const border =
    kind === 'primary'
      ? palette.fg
      : kind === 'danger'
        ? palette.danger
        : kind === 'warn'
          ? palette.warn
          : kind === 'ghost'
            ? 'transparent'
            : palette.line
  const fg =
    kind === 'primary'
      ? palette.onFg
      : kind === 'danger'
        ? palette.danger
        : kind === 'warn'
          ? palette.warn
          : palette.fg

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        small ? styles.small : styles.normal,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <Txt variant={small ? 'small' : 'body'} style={{ color: fg, fontWeight: '600' }}>
        {title}
      </Txt>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  normal: { paddingVertical: space.md, paddingHorizontal: space.lg },
  small: { paddingVertical: space.sm, paddingHorizontal: space.md },
})
