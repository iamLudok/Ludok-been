import { useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from '../../src/ui/ThemeProvider'
import { useSettings } from '../../src/hooks/useSettings'
import { useVisits } from '../../src/hooks/useVisits'
import { space, radius } from '../../src/ui/theme'
import { shareBackup, pickJsonFile, importAll, daysSinceBackup } from '../../src/lib/backup'
import { updateSettings } from '../../src/lib/settings'
import type { Settings } from '../../src/types'

type Msg = { kind: 'ok' | 'err'; text: string } | null

export default function AjustesScreen() {
  const palette = usePalette()
  const insets = useSafeAreaInsets()
  const settings = useSettings()
  const { data: visits } = useVisits()
  const [msg, setMsg] = useState<Msg>(null)
  const [busy, setBusy] = useState(false)

  const days = daysSinceBackup(settings.lastBackup)

  async function handleExport() {
    setBusy(true)
    setMsg(null)
    try {
      await shareBackup()
      setMsg({ kind: 'ok', text: 'Copia generada.' })
    } catch {
      setMsg({ kind: 'err', text: 'No se pudo generar la copia.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    setBusy(true)
    setMsg(null)
    try {
      const raw = await pickJsonFile()
      if (raw === null) return // cancelado
      const res = await importAll(raw)
      setMsg({ kind: 'ok', text: `Importados ${res.visits} países.` })
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Error al importar.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleTheme(theme: Settings['theme']) {
    await updateSettings({ theme })
  }

  const styles = makeStyles(palette)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.lg + insets.bottom }}
    >
      <Text style={styles.h1}>Ajustes</Text>

      <Text style={styles.h2}>Copia de seguridad</Text>
      <View style={styles.card}>
        <Text style={styles.muted}>
          {days === null
            ? 'Aún no has hecho ninguna copia.'
            : days === 0
              ? 'Última copia: hoy.'
              : `Última copia hace ${days} día${days === 1 ? '' : 's'}.`}{' '}
          Tienes {visits.length} países guardados.
        </Text>

        <View style={styles.row}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleExport}
            disabled={busy}
          >
            <Text style={styles.btnPrimaryText}>⬇️ Exportar copia</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={handleImport} disabled={busy}>
            <Text style={styles.btnText}>⬆️ Importar copia</Text>
          </Pressable>
        </View>

        {msg && (
          <Text style={{ color: msg.kind === 'ok' ? palette.accent : palette.danger, marginTop: space.sm }}>
            {msg.text}
          </Text>
        )}

        <Text style={[styles.muted, { fontSize: 12.5, marginTop: space.sm }]}>
          Importar reemplaza los datos actuales. Guarda el fichero en un sitio seguro (Nextcloud,
          Drive, un USB…).
        </Text>
      </View>

      <Text style={styles.h2}>Tema</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          {(['system', 'dark', 'light'] as const).map((t) => (
            <Pressable
              key={t}
              style={[styles.btn, settings.theme === t && styles.btnPrimary]}
              onPress={() => handleTheme(t)}
            >
              <Text style={settings.theme === t ? styles.btnPrimaryText : styles.btnText}>
                {t === 'system' ? 'Sistema' : t === 'dark' ? 'Oscuro' : 'Claro'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function makeStyles(palette: ReturnType<typeof usePalette>) {
  return StyleSheet.create({
    h1: { fontSize: 22, fontWeight: '700', color: palette.text, marginBottom: space.sm },
    h2: { fontSize: 16, fontWeight: '600', color: palette.text, marginTop: space.lg, marginBottom: space.sm },
    muted: { color: palette.muted, fontSize: 14 },
    card: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radius.lg,
      padding: space.md,
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
    btn: {
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface2,
      borderRadius: radius.md,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    btnText: { color: palette.text, fontWeight: '600' },
    btnPrimary: { backgroundColor: palette.accent, borderColor: palette.accent },
    btnPrimaryText: { color: '#052e16', fontWeight: '700' },
  })
}
