import { useEffect, useState } from 'react'
import { Modal, View, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from '../ui/ThemeProvider'
import { Txt } from '../ui/Text'
import { Button } from '../ui/Button'
import { TransportIcon } from '../ui/TransportIcon'
import { nameOf } from '../lib/countries'
import { setStatus, clearStatus, setTransports } from '../lib/library'
import {
  TRANSPORTS,
  isKnownTransport,
  normalizeCustom,
  toggleTransport,
  removeTransport,
  transportLabel,
} from '../lib/transports'
import { radius, space } from '../ui/theme'
import type { CountryStatus, Visit } from '../types'

interface Props {
  code: string
  current?: Visit
  onClose: () => void
}

/** Hoja inferior con las acciones para un país (estado, año, transportes). */
export default function CountrySheet({ code, current, onClose }: Props) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const [year, setYear] = useState<string>(current?.year ? String(current.year) : '')
  const [custom, setCustom] = useState('')

  useEffect(() => {
    setYear(current?.year ? String(current.year) : '')
  }, [current?.year, code])

  // Lo marcado ahora mismo. Se guarda al instante en cada toque, así que la
  // hoja se puede cerrar sin botón de «guardar».
  const marked = current?.transports ?? []
  // Los escritos a mano son los que no están en la lista de siempre.
  const customs = marked.filter((t) => !isKnownTransport(t))

  const parsedYear = () => {
    const n = parseInt(year, 10)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }

  const choose = async (status: CountryStatus) => {
    await setStatus(code, status, parsedYear())
    onClose()
  }

  const remove = async () => {
    await clearStatus(code)
    onClose()
  }

  const toggle = async (value: string) => {
    await setTransports(code, toggleTransport(marked, value))
  }

  const addCustom = async () => {
    const value = normalizeCustom(custom)
    if (!value) return
    setCustom('')
    if (marked.includes(value)) return
    await setTransports(code, [...marked, value])
  }

  const dropCustom = async (value: string) => {
    await setTransports(code, removeTransport(marked, value))
  }

  const field = [
    styles.input,
    { borderColor: palette.line, color: palette.fg, backgroundColor: palette.surface2 },
  ]

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: palette.scrim }]} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: palette.surface,
              borderColor: palette.line,
              paddingBottom: space.lg + insets.bottom,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: palette.surface2 }]} />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <Txt variant="title">{nameOf(code)}</Txt>

          <View style={styles.row}>
            <Txt variant="small" tone="muted" style={{ flex: 1 }}>
              Año (opcional)
            </Txt>
            <TextInput
              value={year}
              onChangeText={setYear}
              placeholder="p.ej. 2023"
              placeholderTextColor={palette.faint}
              keyboardType="numeric"
              style={[...field, { width: 110 }]}
            />
          </View>

          <View style={styles.actions}>
            <Button
              title="Visitado"
              kind={current?.status === 'been' ? 'primary' : 'secondary'}
              onPress={() => choose('been')}
            />
            <Button
              title="Quiero ir"
              kind={current?.status === 'want' ? 'warn' : 'secondary'}
              onPress={() => choose('want')}
            />
            {current && <Button title="Quitar" kind="danger" onPress={remove} />}
          </View>

          <View style={[styles.divider, { backgroundColor: palette.line }]} />

          <Txt variant="label" tone="faint">
            Cómo te moviste
          </Txt>
          <View style={styles.transportGrid}>
            {TRANSPORTS.map((t) => {
              const on = marked.includes(t.key)
              return (
                <Pressable
                  key={t.key}
                  onPress={() => toggle(t.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t.label}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: on ? palette.fg : 'transparent',
                      borderColor: on ? palette.fg : palette.line,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <TransportIcon value={t.key} color={on ? palette.onFg : palette.muted} size={15} />
                  <Txt
                    variant="small"
                    style={{ color: on ? palette.onFg : palette.muted, fontWeight: '600' }}
                  >
                    {t.label}
                  </Txt>
                </Pressable>
              )
            })}
          </View>

          {customs.length > 0 && (
            <View style={styles.transportGrid}>
              {customs.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => dropCustom(value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${transportLabel(value)}`}
                  style={({ pressed }) => [
                    styles.chip,
                    { backgroundColor: palette.fg, borderColor: palette.fg, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <TransportIcon value={value} color={palette.onFg} size={15} />
                  <Txt variant="small" style={{ color: palette.onFg, fontWeight: '600' }}>
                    {value} ×
                  </Txt>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.row}>
            <TextInput
              value={custom}
              onChangeText={setCustom}
              onSubmitEditing={addCustom}
              returnKeyType="done"
              placeholder="Otro (helicóptero, camello…)"
              placeholderTextColor={palette.faint}
              autoCapitalize="sentences"
              style={[...field, { flex: 1 }]}
            />
            <Button title="Añadir" small onPress={addCustom} disabled={!custom.trim()} />
          </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    // Deja siempre ver algo de mapa por arriba, aunque la ficha crezca.
    maxHeight: '85%',
  },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: space.md, paddingBottom: space.xs },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 14,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  divider: { height: StyleSheet.hairlineWidth, marginTop: space.xs },
  transportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
})
