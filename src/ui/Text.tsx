import { Text as RNText, type TextProps, type TextStyle } from 'react-native'
import { usePalette } from './ThemeProvider'
import { type } from './theme'

type Variant = keyof typeof type
type Tone = 'fg' | 'muted' | 'faint' | 'danger' | 'warn' | 'onFg'

interface Props extends TextProps {
  variant?: Variant
  tone?: Tone
}

/**
 * Único punto donde se decide tamaño y color del texto. Evita que cada pantalla
 * invente su propio tamaño y que la escala tipográfica se vaya desmontando.
 */
export function Txt({ variant = 'body', tone = 'fg', style, ...rest }: Props) {
  const palette = usePalette()
  return <RNText {...rest} style={[type[variant] as TextStyle, { color: palette[tone] }, style]} />
}
