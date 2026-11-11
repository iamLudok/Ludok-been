import { Tabs } from 'expo-router'
import AchievementToast from '../../src/components/AchievementToast'
import { View, StyleSheet, type ColorValue } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from '../../src/ui/ThemeProvider'
import { radius } from '../../src/ui/theme'

/**
 * Las cuatro pestañas. Los iconos son formas geométricas dibujadas con vistas
 * en vez de emojis: en «Sala oscura» la interfaz es monocroma, y un emoji a
 * color rompería justo eso.
 */
type Shape = 'map' | 'list' | 'challenges' | 'stats' | 'settings'

function Icon({ shape, color }: { shape: Shape; color: ColorValue }) {
  if (shape === 'map') {
    return (
      <View style={styles.box}>
        <View style={[styles.globe, { borderColor: color }]} />
        <View style={[styles.meridian, { borderColor: color }]} />
      </View>
    )
  }
  if (shape === 'list') {
    return (
      <View style={styles.col}>
        <View style={[styles.line, { backgroundColor: color }]} />
        <View style={[styles.line, { backgroundColor: color }]} />
        <View style={[styles.line, { backgroundColor: color, width: 10 }]} />
      </View>
    )
  }
  if (shape === 'challenges') {
    // Un rombo: el mismo signo que marca los territorios en el mapa, que son
    // el corazón de los retos.
    return (
      <View style={styles.box}>
        <View style={[styles.diamond, { borderColor: color }]} />
        <View style={[styles.diamondDot, { backgroundColor: color }]} />
      </View>
    )
  }
  if (shape === 'stats') {
    return (
      <View style={[styles.row, { alignItems: 'flex-end' }]}>
        <View style={[styles.bar, { backgroundColor: color, height: 7 }]} />
        <View style={[styles.bar, { backgroundColor: color, height: 14 }]} />
        <View style={[styles.bar, { backgroundColor: color, height: 18 }]} />
      </View>
    )
  }
  return (
    <View style={styles.box}>
      <View style={[styles.ring, { borderColor: color }]} />
    </View>
  )
}

export default function TabsLayout() {
  const palette = usePalette()
  // La barra de gestos del sistema se come el texto de las pestañas si no se
  // deja hueco por debajo (se ve en móviles con navegación por gestos).
  const insets = useSafeAreaInsets()

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: palette.bg },
          tabBarActiveTintColor: palette.fg,
          tabBarInactiveTintColor: palette.faint,
          tabBarStyle: {
            backgroundColor: palette.bg,
            borderTopColor: palette.line,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 62 + insets.bottom,
            paddingTop: 6,
            paddingBottom: 8 + insets.bottom,
          },
          tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Mapa', tabBarIcon: ({ color }) => <Icon shape="map" color={color} /> }}
        />
        <Tabs.Screen
          name="lista"
          options={{ title: 'Lista', tabBarIcon: ({ color }) => <Icon shape="list" color={color} /> }}
        />
        <Tabs.Screen
          name="retos"
          options={{ title: 'Retos', tabBarIcon: ({ color }) => <Icon shape="challenges" color={color} /> }}
        />
        <Tabs.Screen
          name="stats"
          options={{ title: 'Stats', tabBarIcon: ({ color }) => <Icon shape="stats" color={color} /> }}
        />
        <Tabs.Screen
          name="ajustes"
          options={{ title: 'Ajustes', tabBarIcon: ({ color }) => <Icon shape="settings" color={color} /> }}
        />
      </Tabs>
      {/* Encima de todas las pestañas: un logro puede desbloquearse en
          cualquiera de ellas. */}
      <AchievementToast />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 20 },
  col: { justifyContent: 'center', gap: 3, height: 20 },
  bar: { width: 3.5, borderRadius: 1.5 },
  line: { width: 15, height: 2.5, borderRadius: 1.25 },
  globe: { position: 'absolute', width: 18, height: 18, borderRadius: radius.pill, borderWidth: 2 },
  meridian: { position: 'absolute', width: 8, height: 18, borderRadius: radius.pill, borderWidth: 2 },
  diamond: { position: 'absolute', width: 13, height: 13, borderWidth: 2, borderRadius: 2, transform: [{ rotate: '45deg' }] },
  diamondDot: { width: 4, height: 4, borderRadius: radius.pill },
  ring: { width: 17, height: 17, borderRadius: radius.pill, borderWidth: 3 },
})
