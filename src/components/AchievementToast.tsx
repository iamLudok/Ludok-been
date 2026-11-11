import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated'
import { useVisits } from '../hooks/useVisits'
import { useSettingsQuery } from '../hooks/useSettings'
import { achievementsOf, pendingNotices, ACHIEVEMENTS } from '../lib/achievements'
import { updateSettings } from '../lib/settings'
import { usePalette } from '../ui/ThemeProvider'
import { Txt } from '../ui/Text'
import { radius, space } from '../ui/theme'

/** Cuánto se queda el aviso en pantalla. */
const VISIBLE_MS = 4500

/**
 * Aviso de logro desbloqueado, flotando arriba en cualquier pestaña.
 *
 * Vive en el layout de las pestañas y no en la ficha del país: un logro
 * puede desbloquearse desde el mapa, la Lista o el ranking, y así el aviso
 * sale igual venga de donde venga.
 */
export default function AchievementToast() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const { data: visits, ready: visitsReady } = useVisits()
  const { data: settings, ready: settingsReady } = useSettingsQuery()
  const [shown, setShown] = useState<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const unlocked = useMemo(
    () => achievementsOf(visits).filter((a) => a.unlocked).map((a) => a.id),
    [visits],
  )
  const unlockedKey = unlocked.join(',')

  useEffect(() => {
    // Hasta que las dos consultas respondan, `visits` está vacío y los
    // ajustes son los de por defecto: decidir con eso daría por vistos
    // logros que no lo están, o avisaría de más.
    if (!visitsReady || !settingsReady) return
    const { notify, nextSeen } = pendingNotices(unlocked, settings.seenAchievements)
    const nextRaw = JSON.stringify(nextSeen)
    if (nextRaw !== settings.seenAchievements) {
      updateSettings({ seenAchievements: nextRaw }).catch(() => {})
    }
    if (notify.length) {
      setShown(notify)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setShown([]), VISIBLE_MS)
    }
    // `unlocked` va por su clave de texto: el array es nuevo en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitsReady, settingsReady, unlockedKey, settings.seenAchievements])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  if (!shown.length) return null
  const first = ACHIEVEMENTS.find((a) => a.id === shown[0])
  if (!first) return null

  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutUp}
      style={[styles.wrap, { top: insets.top + space.md }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => {
          setShown([])
          router.navigate('/retos')
        }}
        accessibilityRole="button"
        accessibilityLabel={`Logro desbloqueado: ${first.title}`}
        style={[styles.toast, { backgroundColor: palette.fg }]}
      >
        <Txt variant="label" style={{ color: palette.onFg, opacity: 0.7 }}>
          Logro desbloqueado
        </Txt>
        <Txt variant="section" style={{ color: palette.onFg }}>
          {first.title}
          {shown.length > 1 ? ` y ${shown.length - 1} más` : ''}
        </Txt>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    gap: 2,
  },
})
