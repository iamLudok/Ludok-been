import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native'
import {
  Canvas,
  Fill,
  Group,
  Path,
  Picture,
  Points,
  Skia,
  FillType,
  PaintStyle,
  createPicture,
  type SkPath,
} from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withDecay,
  cancelAnimation,
  Easing,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import {
  MAP_SHAPES,
  MAP_SITES,
  MAP_WIDTH,
  MAP_HEIGHT,
  siteAt,
  siteOf,
  markerVisible,
  pxPerUnit,
} from '../lib/geo'
import {
  initialTransform,
  touchUpdate,
  zoomAround,
  fitBoundsTransform,
  screenToContent,
  wrapTranslateX,
  MIN_SCALE,
  MAX_SCALE,
  type Finger,
  type TouchAnchor,
} from '../lib/mapTransform'
import { getByCca3 } from '../lib/countries'
import { usePalette } from '../ui/ThemeProvider'
import { Txt } from '../ui/Text'
import { mapMarks, radius, space } from '../ui/theme'
import type { Palette } from '../ui/theme'
import type { CountryStatus } from '../types'

interface Props {
  /** estado actual por país (cca3 → estado). */
  statusByCode: Map<string, CountryStatus>
  /** País tocado, o null si se tocó el mar (para cerrar la ficha). */
  onSelect?: (cca3: string | null) => void
  selected?: string | null
  /** Alto que tapa la ficha por abajo: la cámara encuadra en lo que queda. */
  bottomInset?: number
  /** Alto que tapan los avisos flotantes de arriba. */
  topInset?: number
}

const MAP_ASPECT = MAP_HEIGHT / MAP_WIDTH
/** Movimiento máximo (dp) para que un toque cuente como tap y no como arrastre. */
const TAP_THRESHOLD = 10
/** Un toque más largo que esto ya no es un tap (es el dedo apoyado pensando). */
const TAP_MAX_MS = 400
/** Cuánto amplía o reduce cada pulsación de los botones +/-. */
const ZOOM_STEP = 1.6
/** Por debajo de esta velocidad (dp/s) al soltar no hay inercia. */
const FLING_MIN_SPEED = 250
/** Margen alrededor del país al encuadrarlo. */
const FRAME_PADDING = space.xl
/** Las tres copias del mapa en horizontal, para dar la vuelta sin fin. */
const TILES = [-1, 0, 1] as const

/**
 * Los caminos de Skia de cada forma, construidos UNA vez por arranque de la
 * app. Son ~93.000 vértices: rehacerlos en cada render se notaría.
 *
 * Par-impar porque los agujeros (San Marino dentro de Italia) vienen como un
 * anillo más, sin orientación garantizada.
 */
let pathCache: { code: string | null; path: SkPath }[] | null = null
function shapePaths() {
  if (pathCache) return pathCache
  pathCache = MAP_SHAPES.map((s) => {
    // PathBuilder y no mutar un SkPath: desde Skia 2.6 los caminos son
    // inmutables y `SkPath.moveTo()` y compañía están obsoletos.
    const b = Skia.PathBuilder.Make()
    for (const r of s.rings) {
      b.moveTo(r[0], r[1])
      for (let i = 2; i < r.length; i += 2) b.lineTo(r[i], r[i + 1])
      b.close()
    }
    b.setFillType(FillType.EvenOdd)
    return { code: s.code, path: b.detach() }
  })
  return pathCache
}

function fillFor(status: CountryStatus | undefined, palette: Palette): string {
  if (status === 'been') return palette.mapBeen
  if (status === 'want') return palette.mapWant
  return palette.mapEmpty
}

/**
 * Una copia del mapa, GRABADA como imagen vectorial (`SkPicture`): todos los
 * países con su relleno y su frontera.
 *
 * Grabada una vez y no como un nodo de Skia por país, a propósito: con
 * nodos, cada fotograma del gesto recorría desde JavaScript ~1.460 nodos
 * (243 países × relleno y frontera × 3 copias) y el pellizco no iba fino.
 * Grabada, cada fotograma son 3 dibujos que se reproducen en nativo. Sigue
 * siendo vectorial (nítida a cualquier zoom), y Skia descarta de golpe una
 * copia entera cuando cae fuera de la pantalla, y cada país que cae fuera
 * dentro de la que sí se ve.
 *
 * Las fronteras van con grosor 0, que en Skia es «una línea de un píxel
 * físico a cualquier zoom»: la frontera fina de los mapas de verdad.
 *
 * Se vuelve a grabar solo cuando cambia lo marcado o el tema.
 */
function recordTile(statusByCode: Map<string, CountryStatus>, palette: Palette) {
  const shapes = shapePaths()
  const paints = new Map<string, ReturnType<typeof Skia.Paint>>()
  const fillPaint = (color: string) => {
    let p = paints.get(color)
    if (!p) {
      p = Skia.Paint()
      p.setAntiAlias(true)
      p.setColor(Skia.Color(color))
      paints.set(color, p)
    }
    return p
  }
  const border = Skia.Paint()
  border.setAntiAlias(true)
  border.setStyle(PaintStyle.Stroke)
  border.setStrokeWidth(0)
  border.setColor(Skia.Color(palette.mapStroke))
  return createPicture(
    (canvas) => {
      for (const s of shapes) {
        canvas.drawPath(s.path, fillPaint(fillFor(s.code ? statusByCode.get(s.code) : undefined, palette)))
      }
      for (const s of shapes) canvas.drawPath(s.path, border)
    },
    // Con margen: Fiyi y Rusia tocan los bordes del lienzo, y la frontera
    // sobresale medio píxel.
    Skia.XYWHRect(-10, -10, MAP_WIDTH + 20, MAP_HEIGHT + 20),
  )
}

type MarkerShape = 'circle' | 'diamond'

/** Lo que necesita un marcador para saber dónde cae en pantalla. */
interface Camera {
  k: SharedValue<number>
  translateX: SharedValue<number>
  translateY: SharedValue<number>
  scale: SharedValue<number>
  containerW: SharedValue<number>
  containerH: SharedValue<number>
}

/**
 * Lado del cuadrado de un rombo respecto al diámetro de un círculo: girado,
 * su diagonal mide un 15 % más que el círculo, para que a la vista pesen
 * parecido (un rombo del mismo ancho se ve más pequeño).
 */
const DIAMOND_SIDE = 1.15 / Math.SQRT2

/**
 * Una capa de marcadores del mismo color y forma.
 *
 * Se dibujan en coordenadas de PANTALLA, fuera del lienzo que escala: así
 * miden siempre lo mismo a cualquier zoom. Las posiciones se recalculan en
 * cada fotograma en el hilo de la interfaz, y se descartan las que caen
 * fuera para no mandar a dibujar cientos de puntos invisibles.
 *
 * Skia solo sabe dibujar puntos redondos o cuadrados. El rombo es un
 * cuadrado girado 45°: se gira la capa entera y, para que cada punto siga
 * cayendo en su sitio, sus posiciones se giran antes en sentido contrario.
 */
function MarkerLayer({
  flat,
  shape,
  size,
  color,
  camera,
}: {
  flat: number[]
  shape: MarkerShape
  size: number
  color: string
  camera: Camera
}) {
  const { k, translateX, translateY, scale, containerW, containerH } = camera
  const diamond = shape === 'diamond'
  const points = useDerivedValue(() => {
    const kk = k.value
    const x0 = wrapTranslateX(translateX.value, containerW.value * scale.value)
    const y0 = translateY.value
    const w = containerW.value
    const h = containerH.value
    const out: { x: number; y: number }[] = []
    for (let i = 0; i < flat.length; i += 2) {
      for (let t = -1; t <= 1; t++) {
        const x = (flat[i] + t * MAP_WIDTH) * kk + x0
        const y = flat[i + 1] * kk + y0
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue
        // Giro de -45°: al girar después la capa +45°, vuelve a (x, y).
        out.push(diamond ? { x: (x + y) / Math.SQRT2, y: (y - x) / Math.SQRT2 } : { x, y })
      }
    }
    return out
  }, [flat, diamond])
  if (flat.length === 0) return null
  const dots = (
    <Points
      points={points}
      mode="points"
      strokeWidth={diamond ? size * DIAMOND_SIDE : size}
      strokeCap={diamond ? 'square' : 'round'}
      color={color}
    />
  )
  return diamond ? <Group transform={[{ rotate: Math.PI / 4 }]}>{dots}</Group> : dots
}

export default function WorldMap({ statusByCode, onSelect, selected, bottomInset = 0, topInset = 0 }: Props) {
  const palette = usePalette()
  const [size, setSize] = useState({ width: 0, height: 0 })
  // Espejo en React de la escala, SOLO para lo que no puede calcularse en
  // cada fotograma: qué países llevan marcador y si los botones +/- están en
  // su tope. Se pone al día al terminar cada gesto o animación.
  const [settledScale, setSettledScale] = useState(1)

  const containerW = useSharedValue(0)
  const containerH = useSharedValue(0)
  const inset = useSharedValue(0)
  const scale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  // Estado del gesto de dedos (ver `touchUpdate`).
  const anchor = useSharedValue<TouchAnchor | null>(null)
  const downAt = useSharedValue(0)
  const downX = useSharedValue(0)
  const downY = useSharedValue(0)
  const moved = useSharedValue(false)
  const maxFingers = useSharedValue(0)
  // Para la inercia: última posición y velocidad estimada con un dedo.
  const lastX = useSharedValue(0)
  const lastY = useSharedValue(0)
  const lastT = useSharedValue(0)
  const velX = useSharedValue(0)
  const velY = useSharedValue(0)

  // Lo que se ve del mapa: el alto del contenedor menos lo que tapa la ficha.
  // Toda la matemática de acotar usa ESTE alto, no el total: así, con la
  // ficha abierta, se puede subir el sur de Chile hasta verlo por encima.
  const viewH = useDerivedValue(() => Math.max(1, containerH.value - inset.value))

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout
    if (width === size.width && height === size.height) return
    setSize({ width, height })
    containerW.value = width
    containerH.value = height
    const init = initialTransform(width, height, MAP_ASPECT)
    scale.value = init.scale
    translateX.value = init.x
    translateY.value = init.y
    setSettledScale(init.scale)
  }

  useEffect(() => {
    inset.value = bottomInset
  }, [bottomInset, inset])

  /** Lleva la cámara a un destino con una animación suave. */
  function animateTo(t: { scale: number; x: number; y: number }, duration = 350) {
    const cfg = { duration, easing: Easing.out(Easing.cubic) }
    scale.value = withTiming(t.scale, cfg)
    translateX.value = withTiming(t.x, cfg)
    translateY.value = withTiming(t.y, cfg)
    // El espejo en React se pone ya con el valor final: los marcadores
    // aparecen mientras la cámara llega, en vez de saltar al final.
    setSettledScale(t.scale)
  }

  // Encuadrar el país seleccionado en el hueco que deja la ficha. Se repite
  // cuando la ficha mide su alto (llega un instante después de abrirse).
  useEffect(() => {
    if (!selected || size.width === 0) return
    const site = siteOf(selected)
    if (!site) return
    const k = size.width / MAP_WIDTH
    const box = site.frame.map((v) => v * k) as [number, number, number, number]
    const visibleH = Math.max(1, size.height - bottomInset)
    const t = fitBoundsTransform(
      box,
      { scale: scale.value, x: translateX.value, y: translateY.value },
      Math.min(topInset, visibleH / 3),
      visibleH,
      FRAME_PADDING,
      size.width,
      visibleH,
      MAP_ASPECT,
    )
    animateTo(t, 450)
    // `animateTo` y los shared values son estables; solo importa qué país y
    // cuánto hueco queda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, bottomInset, size.width, size.height])

  /**
   * Qué hay bajo un toque. Corre en el hilo de JS: recorre ~250 sitios y
   * hace punto-en-polígono, no es trabajo para un worklet.
   *
   * Como el mapa da la vuelta, el punto puede caer en cualquiera de las tres
   * copias: se lleva a la copia central antes de buscar.
   */
  function handleTap(contentX: number, contentY: number, atScale: number) {
    if (!onSelect || size.width === 0) return
    const ratio = MAP_WIDTH / size.width
    const mx = (((contentX * ratio) % MAP_WIDTH) + MAP_WIDTH) % MAP_WIDTH
    const my = contentY * ratio
    onSelect(siteAt(mx, my, pxPerUnit(atScale, size.width)))
  }

  function zoomBy(factor: number) {
    const w = containerW.value
    const h = viewH.value
    animateTo(
      zoomAround(
        { scale: scale.value, x: translateX.value, y: translateY.value },
        w / 2,
        h / 2,
        factor,
        w,
        h,
        MAP_ASPECT,
      ),
      220,
    )
  }

  /**
   * Aplica un paso del gesto con la lista de dedos de ahora.
   *
   * SOLO con un dedo. El pellizco se probó (con `touchUpdate` leyendo dos
   * dedos) y en el móvil se sentía raro, así que el zoom va únicamente con
   * los botones +/-. Con dos o más dedos el mapa se queda quieto: se suelta
   * el ancla y, al volver a quedar uno, se ancla de nuevo donde esté, sin
   * salto.
   */
  function step(fingers: Finger[]) {
    'worklet'
    const r = touchUpdate(
      anchor.value,
      fingers.length === 1 ? fingers : [],
      { scale: scale.value, x: translateX.value, y: translateY.value },
      containerW.value,
      viewH.value,
      MAP_ASPECT,
    )
    anchor.value = r.anchor
    scale.value = r.t.scale
    translateX.value = r.t.x
    translateY.value = r.t.y
  }

  /**
   * UN solo gesto que lee los dedos en crudo: arrastre, inercia y toque
   * salen de aquí. Ver `touchUpdate` en mapTransform.ts para el porqué (en
   * corto: con dos gestos, cada uno con su propio «desde dónde mido», el
   * mapa saltaba al poner o quitar un dedo).
   */
  const gesture = Gesture.Manual()
    .onTouchesDown((e, manager) => {
      const fingers = e.allTouches as Finger[]
      // ¿Es el primer dedo de un gesto nuevo? Se mira por los dedos y no por
      // `anchor === null`: si el gesto anterior acabó sin que llegara su
      // último «levantar» (lo corta el sistema), quedaba un ancla vieja, y
      // si el dedo nuevo reutilizaba el mismo id, el mapa saltaba desde
      // donde estaba aquel dedo.
      if (fingers.length === e.changedTouches.length) {
        anchor.value = null
        // Primer dedo: para en seco cualquier animación (inercia, encuadre),
        // como cuando pones la mano sobre un mapa que se desliza.
        cancelAnimation(scale)
        cancelAnimation(translateX)
        cancelAnimation(translateY)
        const f = e.changedTouches[0]
        downAt.value = Date.now()
        downX.value = f.x
        downY.value = f.y
        lastX.value = f.x
        lastY.value = f.y
        lastT.value = Date.now()
        velX.value = 0
        velY.value = 0
        moved.value = false
        maxFingers.value = 0
      }
      maxFingers.value = Math.max(maxFingers.value, fingers.length)
      step(fingers)
      manager.activate()
    })
    .onTouchesMove((e) => {
      const fingers = e.allTouches as Finger[]
      if (fingers.length === 1) {
        const f = fingers[0]
        if (!moved.value && Math.hypot(f.x - downX.value, f.y - downY.value) > TAP_THRESHOLD) {
          moved.value = true
        }
        const now = Date.now()
        const dt = now - lastT.value
        if (dt > 0) {
          // Media móvil: un solo evento suelto no decide la inercia.
          velX.value = 0.2 * velX.value + 0.8 * (((f.x - lastX.value) / dt) * 1000)
          velY.value = 0.2 * velY.value + 0.8 * (((f.y - lastY.value) / dt) * 1000)
        }
        lastX.value = f.x
        lastY.value = f.y
        lastT.value = now
      } else {
        moved.value = true
      }
      step(fingers)
    })
    .onTouchesUp((e, manager) => {
      // En Android, el evento de levantar un dedo puede traerlo todavía en
      // `allTouches`; los que quedan son los que NO acaban de levantarse.
      const lifted = new Set(e.changedTouches.map((t) => t.id))
      const remaining = (e.allTouches as Finger[]).filter((t) => !lifted.has(t.id))
      step(remaining)
      if (remaining.length > 0) {
        // Al volver a quedar un dedo, la velocidad que había no vale.
        velX.value = 0
        velY.value = 0
        lastT.value = Date.now()
        return
      }
      manager.end()
      const now = Date.now()
      if (!moved.value && maxFingers.value === 1 && now - downAt.value < TAP_MAX_MS) {
        const s = scale.value
        scheduleOnRN(
          handleTap,
          screenToContent(downX.value, s, translateX.value),
          screenToContent(downY.value, s, translateY.value),
          s,
        )
        return
      }
      // Inercia: solo si el dedo seguía moviéndose al soltar.
      const speed = Math.hypot(velX.value, velY.value)
      if (now - lastT.value < 80 && speed > FLING_MIN_SPEED) {
        const s = scale.value
        const h = containerW.value * MAP_ASPECT * s
        translateX.value = withDecay({ velocity: velX.value, deceleration: 0.996 })
        if (h > viewH.value) {
          translateY.value = withDecay({
            velocity: velY.value,
            deceleration: 0.996,
            clamp: [viewH.value - h, 0],
          })
        }
      }
      scheduleOnRN(setSettledScale, scale.value)
    })
    .onTouchesCancelled((_e, manager) => {
      anchor.value = null
      manager.end()
      scheduleOnRN(setSettledScale, scale.value)
    })
    // Acabe como acabe el gesto (incluso si el sistema lo cancela sin pasar
    // por los eventos de dedos), no se deja un ancla vieja para el siguiente.
    .onFinalize(() => {
      anchor.value = null
    })

  // Escala del lienzo: unidades del mapa → dp de pantalla.
  const k = useDerivedValue(() => (scale.value * containerW.value) / MAP_WIDTH)

  /**
   * La transformación de todo el mapa. X se envuelve AQUÍ, al dibujar, y no
   * en el valor guardado: así las animaciones (inercia, encuadre) pueden
   * llevar X tan lejos como quieran sin que se vea ninguna costura.
   */
  const mapTransform = useDerivedValue(() => [
    { translateX: wrapTranslateX(translateX.value, containerW.value * scale.value) },
    { translateY: translateY.value },
    { scale: k.value },
  ])
  // Medidas que deben verse siempre igual en pantalla, a cualquier zoom.
  const haloWidth = useDerivedValue(() => mapMarks.halo / k.value)
  const selectedWidth = useDerivedValue(() => mapMarks.selected / k.value)

  const tilePicture = useMemo(() => recordTile(statusByCode, palette), [statusByCode, palette])

  const selectedShape = useMemo(
    () => (selected ? shapePaths().find((s) => s.code === selected) : undefined),
    [selected],
  )

  // Marcadores de los sitios diminutos, por forma (país o territorio) y por
  // estado. Se recalcula solo al terminar un gesto (`settledScale`), no en
  // cada fotograma.
  const markers = useMemo(() => {
    const ppu = size.width ? pxPerUnit(settledScale, size.width) : 0
    const empty = () => ({ been: [] as number[], want: [] as number[], none: [] as number[], all: [] as number[] })
    const byShape: Record<MarkerShape, ReturnType<typeof empty>> = { circle: empty(), diamond: empty() }
    let selectedAnchor: number[] = []
    let selectedMarkerShape: MarkerShape = 'circle'
    if (!ppu) return { byShape, selectedAnchor, selectedMarkerShape }
    for (const s of MAP_SITES) {
      if (!markerVisible(s, ppu)) continue
      const shape: MarkerShape = getByCca3(s.code)?.kind === 'territory' ? 'diamond' : 'circle'
      const g = byShape[shape]
      const st = statusByCode.get(s.code)
      const bucket = st === 'been' ? g.been : st === 'want' ? g.want : g.none
      bucket.push(s.anchor[0], s.anchor[1])
      g.all.push(s.anchor[0], s.anchor[1])
      if (s.code === selected) {
        selectedAnchor = [s.anchor[0], s.anchor[1]]
        selectedMarkerShape = shape
      }
    }
    return { byShape, selectedAnchor, selectedMarkerShape }
  }, [settledScale, size.width, statusByCode, selected])

  const camera = { k, translateX, translateY, scale, containerW, containerH }

  const canZoomIn = settledScale < MAX_SCALE - 1e-6
  const canZoomOut = settledScale > MIN_SCALE + 1e-6
  const selectedFill = selected ? fillFor(statusByCode.get(selected), palette) : palette.mapEmpty

  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={gesture}>
        <View style={{ flex: 1, overflow: 'hidden' }} onLayout={onLayout}>
          {size.width > 0 && (
            <Canvas style={{ flex: 1 }}>
              <Fill color={palette.mapSea} />
              <Group transform={mapTransform}>
                {TILES.map((tile) => (
                  <Group key={tile} transform={[{ translateX: tile * MAP_WIDTH }]}>
                    <Picture picture={tilePicture} />
                    {selectedShape && (
                      <>
                        {/* Halo, el país otra vez encima (para que el halo
                            quede solo por fuera) y un borde nítido. */}
                        <Path
                          path={selectedShape.path}
                          style="stroke"
                          strokeWidth={haloWidth}
                          strokeJoin="round"
                          color={palette.mapSelected}
                          opacity={0.22}
                        />
                        <Path path={selectedShape.path} color={selectedFill} />
                        <Path
                          path={selectedShape.path}
                          style="stroke"
                          strokeWidth={selectedWidth}
                          strokeJoin="round"
                          color={palette.mapSelected}
                        />
                      </>
                    )}
                  </Group>
                ))}
              </Group>
              {/* El seleccionado, con un aro claro más grande por debajo. */}
              <MarkerLayer
                flat={markers.selectedAnchor}
                shape={markers.selectedMarkerShape}
                size={2 * (mapMarks.dot + mapMarks.dotRing * 2)}
                color={palette.mapSelected}
                camera={camera}
              />
              {/* Círculo = país diminuto, rombo = territorio. El color sigue
                  siendo el estado, igual que en las formas: si los
                  territorios tuvieran su propio color, uno visitado dejaría
                  de verse morado. Debajo, un aro del color del mar para
                  separarlos de lo que tengan detrás. */}
              {(['circle', 'diamond'] as const).map((shape) => (
                <Group key={shape}>
                  <MarkerLayer
                    flat={markers.byShape[shape].all}
                    shape={shape}
                    size={2 * (mapMarks.dot + mapMarks.dotRing)}
                    color={palette.mapStroke}
                    camera={camera}
                  />
                  <MarkerLayer flat={markers.byShape[shape].none} shape={shape} size={2 * mapMarks.dot} color={palette.faint} camera={camera} />
                  <MarkerLayer flat={markers.byShape[shape].want} shape={shape} size={2 * mapMarks.dot} color={palette.mapWant} camera={camera} />
                  <MarkerLayer flat={markers.byShape[shape].been} shape={shape} size={2 * mapMarks.dot} color={palette.mapBeen} camera={camera} />
                </Group>
              ))}
            </Canvas>
          )}
        </View>
      </GestureDetector>

      <View
        style={[
          styles.controls,
          { backgroundColor: palette.surface, borderColor: palette.line, bottom: bottomInset + space.lg },
        ]}
      >
        <Pressable
          onPress={() => zoomBy(ZOOM_STEP)}
          disabled={!canZoomIn}
          style={({ pressed }) => [styles.btn, { opacity: !canZoomIn ? 0.35 : pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Ampliar mapa"
        >
          <Txt variant="title">+</Txt>
        </Pressable>
        <View style={[styles.sep, { backgroundColor: palette.line }]} />
        <Pressable
          onPress={() => zoomBy(1 / ZOOM_STEP)}
          disabled={!canZoomOut}
          style={({ pressed }) => [styles.btn, { opacity: !canZoomOut ? 0.35 : pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Reducir mapa"
        >
          <Txt variant="title">−</Txt>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  controls: {
    position: 'absolute',
    right: space.lg,
    gap: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sep: { height: StyleSheet.hairlineWidth },
})
