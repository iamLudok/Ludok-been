/** Tokens de diseño de Ludok Been: paleta dark/light + escalas de espaciado. */

export interface Palette {
  bg: string
  surface: string
  surface2: string
  border: string
  text: string
  muted: string
  /** "visitado" */
  accent: string
  accentDim: string
  /** "quiero ir" */
  want: string
  wantDim: string
  danger: string
  mapEmpty: string
  mapStroke: string
}

export const dark: Palette = {
  bg: '#0f172a',
  surface: '#1e293b',
  surface2: '#334155',
  border: '#334155',
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#22c55e',
  accentDim: '#166534',
  want: '#f59e0b',
  wantDim: '#92400e',
  danger: '#ef4444',
  mapEmpty: '#273449',
  mapStroke: '#0f172a',
}

export const light: Palette = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surface2: '#eef2f7',
  border: '#d9e0ea',
  text: '#0f172a',
  muted: '#64748b',
  accent: '#22c55e',
  accentDim: '#bbf7d0',
  want: '#f59e0b',
  wantDim: '#fde68a',
  danger: '#ef4444',
  mapEmpty: '#dfe6ef',
  mapStroke: '#ffffff',
}

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  pill: 999,
} as const
