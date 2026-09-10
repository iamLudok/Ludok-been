import { useState } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { useSettings } from '../hooks/useSettings'
import { useVisits } from '../hooks/useVisits'
import { daysSinceBackup, shareBackup } from '../lib/backup'
import { usePalette } from '../ui/ThemeProvider'
import { Txt } from '../ui/Text'
import { Button } from '../ui/Button'
import { radius, space } from '../ui/theme'

/**
 * Aviso cuando llevas mucho sin copia. Es la red de seguridad principal contra
 * perder datos, así que se ve en el mapa y no escondido en Ajustes.
 */
export default function BackupBanner() {
  const settings = useSettings()
  const palette = usePalette()
  const { data: visits } = useVisits()
  const [busy, setBusy] = useState(false)

  // Sin datos aún no hay nada que respaldar.
  if (visits.length === 0) return null

  const days = daysSinceBackup(settings.lastBackup)
  const never = days === null
  // Solo molestamos si nunca has hecho copia o hace más de una semana.
  if (!never && days < 7) return null

  const doBackup = async () => {
    setBusy(true)
    try {
      await shareBackup()
    } catch {
      Alert.alert('No se pudo crear la copia')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.wrap, { borderColor: never ? palette.danger : palette.warn }]}>
      <Txt variant="small" tone={never ? 'danger' : 'warn'} style={styles.text}>
        {never
          ? 'Aún no has hecho ninguna copia. Guárdala para no perder tus datos.'
          : `Llevas ${days} días sin copia de seguridad.`}
      </Txt>
      <Button title={busy ? '…' : 'Hacer copia'} small onPress={doBackup} disabled={busy} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    margin: space.lg,
    marginBottom: 0,
  },
  text: { flex: 1 },
})
