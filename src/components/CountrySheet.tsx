import { useEffect, useState } from 'react'
import { Modal, View, TextInput, Pressable, ScrollView, StyleSheet, BackHandler } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette } from '../ui/ThemeProvider'
import { Txt } from '../ui/Text'
import { Button } from '../ui/Button'
import { TransportIcon } from '../ui/TransportIcon'
import { nameOf, getByCca3, contextOf, territoriesOf } from '../lib/countries'
import { rarityLine } from '../lib/rarity'
import { setStatus, clearStatus, setTransports, setYear as saveYear } from '../lib/library'
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
  /**
   * Incrustada sobre el mapa en vez de en un `Modal` con velo. Así el mapa
   * sigue a la vista (con el país encuadrado y resaltado encima de la
   * ficha) y se puede tocar otro país sin cerrarla antes.
   */
  inline?: boolean
  /** Alto de la ficha incrustada, para que el mapa encuadre por encima. */
  onHeight?: (height: number) => void
  /** Todas las visitas, para enseñar el estado de los territorios del país. */
  visits?: Visit[]
  /** Abrir la ficha de otro sitio (un territorio del país, o su país). */
  onOpen?: (code: string) => void
}

/** Hoja inferior con las acciones para un país (estado, año, transportes). */
export default function CountrySheet({ code, current, onClose, inline, onHeight, visits, onOpen }: Props) {
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

  // En un sitio ya marcado, el año se guarda en cuanto es un año completo
  // (o se borra), igual que los transportes: antes solo se guardaba al
  // pulsar «Visitado» otra vez, y quien lo escribía y cerraba la ficha lo
  // perdía sin aviso. Con 4 cifras y no a cada tecla, para no guardar «20»
  // camino de «2023».
  const changeYear = (text: string) => {
    setYear(text)
    if (!current) return
    const t = text.trim()
    if (t === '') saveYear(code, undefined).catch(() => {})
    else if (/^\d{4}$/.test(t)) saveYear(code, parseInt(t, 10)).catch(() => {})
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

  // Sin `Modal` no hay `onRequestClose`: el botón atrás de Android cerraría
  // la pantalla entera en vez de la ficha.
  useEffect(() => {
    if (!inline) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [inline, onClose])

  const meta = getByCca3(code)
  const inside = territoriesOf(code)
  const statusOf = (c: string) => visits?.find((v) => v.code === c)?.status

  const field = [
    styles.input,
    { borderColor: palette.line, color: palette.fg, backgroundColor: palette.surface2 },
  ]

  const sheetStyle = [
    styles.sheet,
    {
      backgroundColor: palette.surface,
      borderColor: palette.line,
      paddingBottom: space.lg + (inline ? 0 : insets.bottom),
    },
  ]
  const content = (
    <>
      <View style={[styles.handle, { backgroundColor: palette.surface2 }]} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Txt variant="title">{nameOf(code)}</Txt>
          {meta && (
            <Pressable
              onPress={meta.parent && onOpen ? () => onOpen(meta.parent!) : undefined}
              disabled={!meta.parent || !onOpen}
              accessibilityRole={meta.parent && onOpen ? 'link' : undefined}
            >
              <Txt variant="small" tone="muted">
                {contextOf(meta)}
                {meta.parent && onOpen ? '  ›' : ''}
              </Txt>
            </Pressable>
          )}
          {rarityLine(code) && (
            <Txt variant="small" tone="faint">
              {rarityLine(code)}
            </Txt>
          )}
        </View>

        <View style={styles.row}>
          <Txt variant="small" tone="muted" style={{ flex: 1 }}>
            Año (opcional)
          </Txt>
          <TextInput
            value={year}
            onChangeText={changeYear}
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

        {inside.length > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: palette.line }]} />
            <Txt variant="label" tone="faint">
              Territorios
            </Txt>
            <View style={styles.transportGrid}>
              {inside.map((t) => {
                const st = statusOf(t.cca3)
                return (
                  <Pressable
                    key={t.cca3}
                    onPress={onOpen ? () => onOpen(t.cca3) : undefined}
                    disabled={!onOpen}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.name}${st === 'been' ? ', visitado' : st === 'want' ? ', quiero ir' : ''}`}
                    style={({ pressed }) => [
                      styles.chip,
                      { borderColor: palette.line, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    {/* Mismo punto que en la Lista: lleno = visitado,
                        aro ámbar = quiero ir, aro gris = sin marcar. */}
                    <View
                      style={[
                        styles.mark,
                        st === 'been'
                          ? { backgroundColor: palette.fg, borderColor: palette.fg }
                          : { borderColor: st === 'want' ? palette.warn : palette.line },
                      ]}
                    />
                    <Txt variant="small" style={{ color: palette.muted, fontWeight: '600' }}>
                      {t.name}
                    </Txt>
                  </Pressable>
                )
              })}
            </View>
          </>
        )}

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
    </>
  )

  if (inline) {
    return (
      <View
        style={[sheetStyle, styles.inline]}
        onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
      >
        {content}
      </View>
    )
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: palette.scrim }]} onPress={onClose}>
        <Pressable style={sheetStyle} onPress={(e) => e.stopPropagation()}>
          {content}
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
  // Encima del mapa, pegada abajo. La barra de pestañas ya deja el hueco de
  // la barra de gestos, así que aquí no se suma `insets.bottom`.
  // Con el 60 % como mucho queda sitio para el país encuadrado por encima.
  inline: { position: 'absolute', left: 0, right: 0, bottom: 0, borderBottomWidth: 0, maxHeight: '60%' },
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
  mark: { width: 10, height: 10, borderRadius: radius.pill, borderWidth: 2 },
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
