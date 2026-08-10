import { Tabs } from 'expo-router'
import { Text, type ColorValue } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from '../../src/ui/ThemeProvider'

const ICONS = { mapa: '🗺️', lista: '📋', stats: '📊', ajustes: '⚙️' } as const

function TabIcon({ name, color }: { name: keyof typeof ICONS; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{ICONS[name]}</Text>
}

export default function TabsLayout() {
  const palette = usePalette()
  // La barra de gestos del sistema se come el texto de las pestañas si no se
  // deja hueco por debajo (se ve en móviles con navegación por gestos).
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.bg },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Mapa', tabBarIcon: ({ color }) => <TabIcon name="mapa" color={color} /> }}
      />
      <Tabs.Screen
        name="lista"
        options={{ title: 'Lista', tabBarIcon: ({ color }) => <TabIcon name="lista" color={color} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: ({ color }) => <TabIcon name="stats" color={color} /> }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{ title: 'Ajustes', tabBarIcon: ({ color }) => <TabIcon name="ajustes" color={color} /> }}
      />
    </Tabs>
  )
}
