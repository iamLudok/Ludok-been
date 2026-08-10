import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { useSettings } from '../hooks/useSettings'
import { dark, light, type Palette } from './theme'

const PaletteContext = createContext<Palette>(dark)

/**
 * Resuelve el tema a partir del ajuste guardado. 'system' sigue al del móvil,
 * igual que hacía la versión web con `prefers-color-scheme`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const settings = useSettings()
  const system = useColorScheme()

  const palette = useMemo(() => {
    const wantsDark = settings.theme === 'dark' || (settings.theme === 'system' && system !== 'light')
    return wantsDark ? dark : light
  }, [settings.theme, system])

  return <PaletteContext.Provider value={palette}>{children}</PaletteContext.Provider>
}

/** Paleta activa. Todos los componentes leen los colores de aquí. */
export function usePalette(): Palette {
  return useContext(PaletteContext)
}

/** True si el tema activo es el oscuro (para la barra de estado). */
export function useIsDark(): boolean {
  return usePalette() === dark
}
