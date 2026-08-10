import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { usePalette } from '../ui/ThemeProvider'
import { useSettings } from '../hooks/useSettings'
import { useVisits } from '../hooks/useVisits'
import { daysSinceBackup } from '../lib/backup'
import { space, radius } from '../ui/theme'

// Umbral de días sin copia a partir del cual avisamos.
const WARN_AFTER_DAYS = 7

export default function BackupBanner() {
  const router = useRouter()
  const palette = usePalette()
  const settings = useSettings()
  const { data: visits } = useVisits()

  if (visits.length === 0) return null

  const days = daysSinceBackup(settings.lastBackup)
  const never = days === null
  if (!never && days < WARN_AFTER_DAYS) return null

  const text = never
    ? 'Aún no has hecho ninguna copia de seguridad.'
    : `Llevas ${days} días sin hacer copia.`

  const styles = StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.sm,
      backgroundColor: palette.wantDim,
      borderWidth: 1,
      borderColor: palette.want,
      borderRadius: radius.lg,
      paddingVertical: 10,
      paddingHorizontal: space.md,
      margin: space.lg,
      marginBottom: 0,
    },
    text: { color: palette.text, flexShrink: 1, fontSize: 13.5 },
    btn: {
      backgroundColor: palette.accent,
      borderRadius: radius.md,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    btnText: { color: '#052e16', fontWeight: '700', fontSize: 13 },
  })

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>⚠️ {text}</Text>
      <Pressable style={styles.btn} onPress={() => router.push('/ajustes')}>
        <Text style={styles.btnText}>Hacer copia</Text>
      </Pressable>
    </View>
  )
}
