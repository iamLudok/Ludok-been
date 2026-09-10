/**
 * Tokens de diseño — dirección «Sala oscura», la misma de Ludok Time.
 *
 * La interfaz es monocroma a propósito. Lo que en otras apps sería el color de
 * marca aquí es simplemente el contraste (`fg` sobre `bg`). El color solo
 * aparece con significado: `danger` para borrar y `warn` para los avisos de
 * copia de seguridad y para «quiero ir» (lo único que en Been necesita
 * distinguirse de un vistazo de lo ya visitado).
 */

export interface Palette {
  /** Fondo de la pantalla. */
  bg: string
  /** Tarjetas y superficies elevadas. */
  surface: string
  /** Superficie un paso más marcada (pistas de progreso, campos). */
  surface2: string
  /** Líneas y separadores. */
  line: string
  /** Texto principal. */
  fg: string
  /** Texto secundario. */
  muted: string
  /** Texto muy secundario (fechas, contadores). */
  faint: string
  /** Relleno de lo marcado como visitado (y su texto encima). */
  on: string
  onFg: string
  /** Solo para acciones destructivas. */
  danger: string
  /** Avisos de copia y «quiero ir». */
  warn: string
  /** Sombra/velo. */
  scrim: string
  /** País sin marcar en el mapa. */
  mapEmpty: string
  /** Frontera entre países. */
  mapStroke: string
}

/** La identidad elegida: negro de sala de cine, interfaz monocroma. */
export const dark: Palette = {
  bg: '#0a0a0c',
  surface: '#141419',
  surface2: '#1e1e24',
  line: '#22222a',
  fg: '#f3f1ec',
  muted: '#85838d',
  faint: '#615f69',
  on: '#f3f1ec',
  onFg: '#0a0a0c',
  danger: '#e2564d',
  warn: '#d9a34a',
  scrim: 'rgba(0,0,0,0.55)',
  mapEmpty: '#2c2c35',
  mapStroke: '#0a0a0c',
}

/**
 * La misma idea con la luz encendida: los grises se eligen para que el
 * contraste aguante igual sobre blanco, no es el oscuro invertido sin más.
 */
export const light: Palette = {
  bg: '#f6f5f3',
  surface: '#ffffff',
  surface2: '#e8e6e2',
  line: '#dcd9d4',
  fg: '#16151a',
  muted: '#6b6873',
  faint: '#928f99',
  on: '#16151a',
  onFg: '#f6f5f3',
  danger: '#c2382f',
  warn: '#8a5c12',
  scrim: 'rgba(0,0,0,0.35)',
  mapEmpty: '#d5d2cc',
  mapStroke: '#f6f5f3',
}

/** Escala de espaciado (múltiplos de 4, sin valores a ojo). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  sm: 4,
  md: 8,
  lg: 14,
  pill: 999,
} as const

/** Escala tipográfica. `data` se usa donde hay cifras que deben cuadrar. */
export const type = {
  display: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  section: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 14, fontWeight: '500' },
  small: { fontSize: 12.5, fontWeight: '500' },
  label: { fontSize: 10.5, fontWeight: '600', letterSpacing: 1.1, textTransform: 'uppercase' },
  data: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
} as const
