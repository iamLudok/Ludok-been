import { useMemo, useState } from 'react'
import { TextInput, Pressable, FlatList, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '../src/ui/Screen'
import { Txt } from '../src/ui/Text'
import { usePalette } from '../src/ui/ThemeProvider'
import { useSettings } from '../src/hooks/useSettings'
import { updateSettings } from '../src/lib/settings'
import { ONLY_COUNTRIES, normalizeName } from '../src/lib/countries'
import { radius, space } from '../src/ui/theme'

/**
 * Elegir tu país, para medir «lo más lejos de casa».
 *
 * Solo los 195 países: «casa» en un territorio (Canarias, Escocia…) daría
 * distancias raras contra su propio país, y para medir a qué distancia del
 * mundo estás basta con el país.
 */
export default function CasaScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const settings = useSettings()
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = normalizeName(query.trim())
    return q ? ONLY_COUNTRIES.filter((c) => normalizeName(c.name).includes(q)) : ONLY_COUNTRIES
  }, [query])

  const choose = (code: string | null) => {
    updateSettings({ homeCode: code })
      .then(() => router.back())
      .catch(() => {})
  }

  return (
    <Screen
      title="Tu país"
      padded={false}
      right={
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={space.md}>
          <Txt variant="small" tone="muted" style={{ fontWeight: '600' }}>
            Cerrar
          </Txt>
        </Pressable>
      }
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar país…"
        placeholderTextColor={palette.faint}
        autoFocus
        style={[styles.search, { borderColor: palette.line, color: palette.fg, backgroundColor: palette.surface }]}
      />
      <FlatList
        data={list}
        keyExtractor={(c) => c.cca3}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: space.xxl + insets.bottom }}
        ListHeaderComponent={
          settings.homeCode ? (
            <Pressable
              onPress={() => choose(null)}
              style={({ pressed }) => [styles.row, { borderBottomColor: palette.line, opacity: pressed ? 0.6 : 1 }]}
            >
              <Txt variant="body" tone="muted">
                Quitar mi país
              </Txt>
            </Pressable>
          ) : null
        }
        renderItem={({ item: c }) => {
          const mine = c.cca3 === settings.homeCode
          return (
            <Pressable
              onPress={() => choose(c.cca3)}
              accessibilityState={{ selected: mine }}
              style={({ pressed }) => [styles.row, { borderBottomColor: palette.line, opacity: pressed ? 0.6 : 1 }]}
            >
              <Txt variant="body" style={{ flex: 1, fontWeight: mine ? '700' : undefined }}>
                {c.name}
              </Txt>
              {mine && (
                <Txt variant="small" tone="muted">
                  tu país
                </Txt>
              )}
            </Pressable>
          )
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  search: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
