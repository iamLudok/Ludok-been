import { useEffect, useState } from 'react'
import { View, StyleSheet, TextInput, Pressable, Alert } from 'react-native'
import { useSettings } from '../hooks/useSettings'
import { updateSettings } from '../lib/settings'
import { testConnection, configFrom } from '../lib/nextcloud'
import { backupNow } from '../lib/autoBackup'
import { usePalette } from '../ui/ThemeProvider'
import { Card } from '../ui/Screen'
import { Txt } from '../ui/Text'
import { Button } from '../ui/Button'
import { radius, space } from '../ui/theme'

function cuando(ts?: number): string {
  if (!ts) return 'nunca'
  const d = new Date(ts)
  return (
    d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) +
    ' a las ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  )
}

/**
 * Copia automática al Nextcloud propio.
 *
 * La contraseña que se pide aquí es una **de aplicación** de Nextcloud, no la
 * de la cuenta: se revoca desde el servidor sin tocar nada más, y si el móvil
 * se pierde no expone la cuenta entera.
 */
export function NextcloudSettings() {
  const settings = useSettings()
  const palette = usePalette()

  const [url, setUrl] = useState('')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [folder, setFolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => setUrl(settings.nextcloudUrl ?? ''), [settings.nextcloudUrl])
  useEffect(() => setUser(settings.nextcloudUser ?? ''), [settings.nextcloudUser])
  useEffect(() => setPassword(settings.nextcloudPassword ?? ''), [settings.nextcloudPassword])
  useEffect(() => setFolder(settings.nextcloudFolder ?? ''), [settings.nextcloudFolder])

  const draft = {
    nextcloudUrl: url,
    nextcloudUser: user,
    nextcloudPassword: password,
    nextcloudFolder: folder,
  }
  const config = configFrom(draft)

  const save = async () => {
    await updateSettings({
      nextcloudUrl: url.trim(),
      nextcloudUser: user.trim(),
      nextcloudPassword: password,
      nextcloudFolder: folder.trim() || 'Ludok Been',
    })
    setStatus({ ok: true, text: 'Guardado.' })
  }

  const probe = async () => {
    if (!config) return
    setBusy(true)
    setStatus(null)
    try {
      await testConnection(config)
      setStatus({ ok: true, text: 'Conecta bien.' })
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : 'No se pudo conectar' })
    } finally {
      setBusy(false)
    }
  }

  const uploadNow = async () => {
    setBusy(true)
    setStatus(null)
    try {
      await save()
      const res = await backupNow()
      if (res.status === 'ok') {
        setStatus({ ok: true, text: `Subida: ${res.filename}` })
      } else if (res.status === 'error') {
        setStatus({ ok: false, text: res.message })
      } else {
        setStatus({ ok: false, text: res.reason })
      }
    } finally {
      setBusy(false)
    }
  }

  const toggleAuto = async () => {
    const next = !settings.autoBackup
    if (next && !configFrom(settings)) {
      Alert.alert('Falta configurar', 'Rellena servidor, usuario y contraseña, y guarda.')
      return
    }
    await updateSettings({ autoBackup: next })
  }

  const field = [
    styles.input,
    { borderColor: palette.line, color: palette.fg, backgroundColor: palette.surface },
  ]

  return (
    <Card>
      <Txt variant="title">Copia automática a Nextcloud</Txt>
      <Txt variant="small" tone="muted">
        Al abrir la app estando en WiFi, sube sola una copia a tu servidor, como mucho una vez cada
        12 horas. Se guarda un fichero por día, así que te queda un histórico.
      </Txt>

      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://tu-nextcloud.example.com"
        placeholderTextColor={palette.faint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={field}
      />
      <TextInput
        value={user}
        onChangeText={setUser}
        placeholder="Usuario"
        placeholderTextColor={palette.faint}
        autoCapitalize="none"
        autoCorrect={false}
        style={field}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Contraseña de aplicación"
        placeholderTextColor={palette.faint}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={field}
      />
      <TextInput
        value={folder}
        onChangeText={setFolder}
        placeholder="Carpeta (por defecto: Ludok Been)"
        placeholderTextColor={palette.faint}
        autoCapitalize="none"
        autoCorrect={false}
        style={field}
      />

      <View style={styles.actions}>
        <Button title="Guardar" kind="primary" small onPress={save} disabled={busy} />
        <Button title="Probar conexión" small onPress={probe} disabled={!config || busy} />
        <Button title="Subir ahora" small onPress={uploadNow} disabled={!config || busy} />
      </View>

      {status ? (
        <Txt variant="small" tone={status.ok ? 'muted' : 'danger'}>
          {status.text}
        </Txt>
      ) : null}

      <Pressable
        onPress={toggleAuto}
        accessibilityRole="switch"
        accessibilityState={{ checked: !!settings.autoBackup }}
        style={({ pressed }) => [styles.toggle, { borderColor: palette.line, opacity: pressed ? 0.6 : 1 }]}
      >
        <View
          style={[
            styles.dot,
            {
              borderColor: settings.autoBackup ? palette.fg : palette.line,
              backgroundColor: settings.autoBackup ? palette.fg : 'transparent',
            },
          ]}
        />
        <View style={{ flex: 1 }}>
          <Txt variant="small" style={{ fontWeight: '600' }}>
            Subir sola al abrir, con WiFi
          </Txt>
          <Txt variant="data" tone="faint">
            Última subida: {cuando(settings.lastAutoBackupAt)}
          </Txt>
        </View>
      </Pressable>

      <Txt variant="small" tone="faint">
        Usa una contraseña de aplicación (Nextcloud → Ajustes personales → Seguridad), no la de tu
        cuenta: se puede revocar sola. Esa contraseña no se incluye en las copias exportadas.
        {url.trim().toLowerCase().startsWith('http://')
          ? ' Con http:// la contraseña y la copia viajan sin cifrar por tu red; con un servidor casero en tu propia WiFi es asumible, pero no lo dejes abierto a internet así.'
          : ''}
      </Txt>
    </Card>
  )
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 14,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: space.md,
  },
  dot: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 2 },
})
