import { useEffect, useState } from 'react'
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from '../ui/ThemeProvider'
import { nameOf } from '../lib/countries'
import { setStatus, clearStatus } from '../lib/library'
import { space, radius } from '../ui/theme'
import type { CountryStatus, Visit } from '../types'

interface Props {
  code: string
  current?: Visit
  onClose: () => void
}

/** Hoja inferior con las acciones para un país (marcar estado, año, quitar). */
export default function CountrySheet({ code, current, onClose }: Props) {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const [year, setYear] = useState<string>(current?.year ? String(current.year) : '')

  useEffect(() => {
    setYear(current?.year ? String(current.year) : '')
  }, [current?.year, code])

  const parsedYear = () => {
    const n = parseInt(year, 10)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }

  async function choose(status: CountryStatus) {
    await setStatus(code, status, parsedYear())
    onClose()
  }

  async function remove() {
    await clearStatus(code)
    onClose()
  }

  const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderWidth: 1,
      borderColor: palette.border,
      padding: space.lg,
      paddingBottom: space.lg + insets.bottom,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: palette.surface2,
      alignSelf: 'center',
      marginBottom: space.md,
    },
    title: { fontSize: 19, fontWeight: '700', color: palette.text, marginBottom: space.md },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
    label: { color: palette.muted, flex: 1 },
    input: {
      width: 110,
      padding: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface2,
      color: palette.text,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    btn: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface2,
      borderRadius: radius.md,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    btnText: { color: palette.text, fontWeight: '600' },
    btnBeen: { backgroundColor: palette.accent, borderColor: palette.accent },
    btnBeenText: { color: '#052e16', fontWeight: '700' },
    btnWant: { backgroundColor: palette.want, borderColor: palette.want },
    btnWantText: { color: '#422006', fontWeight: '700' },
    btnDanger: { backgroundColor: 'transparent', borderColor: palette.danger },
    btnDangerText: { color: palette.danger, fontWeight: '600' },
  })

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{nameOf(code)}</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Año (opcional)</Text>
            <TextInput
              value={year}
              onChangeText={setYear}
              placeholder="p.ej. 2023"
              placeholderTextColor={palette.muted}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, current?.status === 'been' && styles.btnBeen]}
              onPress={() => choose('been')}
            >
              <Text style={current?.status === 'been' ? styles.btnBeenText : styles.btnText}>
                ✅ Visitado
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btn, current?.status === 'want' && styles.btnWant]}
              onPress={() => choose('want')}
            >
              <Text style={current?.status === 'want' ? styles.btnWantText : styles.btnText}>
                ⭐ Quiero ir
              </Text>
            </Pressable>
            {current && (
              <Pressable style={[styles.btn, styles.btnDanger]} onPress={remove}>
                <Text style={styles.btnDangerText}>🗑️ Quitar</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
