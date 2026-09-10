import { useMemo, useState } from 'react'
import { View, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native'
import Svg, { G, Path } from 'react-native-svg'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { svgPaths, countryAt, MAP_WIDTH, MAP_HEIGHT } from '../lib/geo'
import {
  initialTransform,
  panTransform,
  centerZoomTransform,
  screenToContent,
  originCompensatedTranslate,
  tiledTranslateX,
  OVERSAMPLE,
  MIN_SCALE,
  MAX_SCALE,
} from '../lib/mapTransform'
import { usePalette } from '../ui/ThemeProvider'
import { Txt } from '../ui/Text'
import { radius, space } from '../ui/theme'
import type { CountryStatus } from '../types'

interface Props {
  /** estado actual por país (cca3 → estado). */
  statusByCode: Map<string, CountryStatus>
  onSelect?: (cca3: string) => void
  selected?: string | null
}

const MAP_ASPECT = MAP_HEIGHT / MAP_WIDTH
/** Movimiento máximo (px) para que un toque cuente como tap y no como arrastre. */
const TAP_THRESHOLD = 10
/** Cuánto amplía o reduce cada pulsación de los botones +/-. */
const ZOOM_STEP = 1.6

export default function WorldMap({ statusByCode, onSelect, selected }: Props) {
  const palette = usePalette()
  const paths = useMemo(() => svgPaths(), [])
  const [size, setSize] = useState({ width: 0, height: 0 })
  // Espejo en React del zoom actual: SOLO para pintar los botones +/- como
  // deshabilitados en los límites. El valor que de verdad manda para dibujar
  // el mapa sigue siendo el shared value de abajo.
  const [currentScale, setCurrentScale] = useState(1)

  const containerWidth = useSharedValue(0)
  const containerHeight = useSharedValue(0)
  // El tamaño del lienzo también vive en shared values, no solo en el estado
  // de React: así el estilo animado no depende de nada que cambie por un
  // re-render, que es de donde salían los saltos.
  //
  // El mapa se dibuja TRES veces seguidas en horizontal (izquierda, centro,
  // derecha) para poder dar la vuelta sin fin al arrastrar — por eso
  // `canvasW` es el ancho de las TRES copias juntas, no de una sola.
  const canvasW = useSharedValue(0)
  const canvasH = useSharedValue(0)

  const scale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  // Estado al empezar el arrastre.
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const moved = useSharedValue(false)
  // Desplazamiento que el gesto de arrastre YA acumulaba en el momento de
  // activarse. Ver el comentario de `panGesture`.
  const startPanTX = useSharedValue(0)
  const startPanTY = useSharedValue(0)

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout
    if (width === size.width && height === size.height) return
    setSize({ width, height })
    containerWidth.value = width
    containerHeight.value = height
    canvasW.value = width * OVERSAMPLE * 3
    canvasH.value = width * MAP_ASPECT * OVERSAMPLE
    const init = initialTransform(width, height, MAP_ASPECT)
    scale.value = init.scale
    translateX.value = init.x
    translateY.value = init.y
    setCurrentScale(init.scale)
  }

  /**
   * Qué país hay bajo un punto, en coordenadas del contenido sin transformar.
   * Corre en el hilo de JS: `countryAt` invierte la proyección y prueba contra
   * ~180 países, no es apto para un worklet.
   *
   * Como el paneo da la vuelta, `contentX` puede caer fuera de
   * [0, containerWidth) — puede tocarse en cualquiera de las tres copias
   * dibujadas. Se envuelve a la copia canónica antes de convertir a
   * coordenadas del mapa, o `countryAt` fallaría (o acertaría el país
   * equivocado) para toques en la copia izquierda o derecha.
   */
  function handleTap(contentX: number, contentY: number) {
    if (!onSelect || containerWidth.value === 0) return
    const cw = containerWidth.value
    const wrappedX = ((contentX % cw) + cw) % cw
    const ratio = MAP_WIDTH / cw
    const cca3 = countryAt(wrappedX * ratio, contentY * ratio)
    if (cca3) onSelect(cca3)
  }

  /**
   * Ampliar/reducir con los botones, centrado siempre en el centro de la
   * pantalla — nada de gestos: sin dedos que coordinar no hay estado de
   * gesto que se pueda desincronizar. Corre en el hilo de JS (es la
   * respuesta a un `onPress` normal), así que puede leer y escribir los
   * shared values directamente.
   */
  function zoomBy(factor: number) {
    const next = centerZoomTransform(
      { scale: scale.value, x: translateX.value, y: translateY.value },
      factor,
      containerWidth.value,
      containerHeight.value,
      MAP_ASPECT,
    )
    scale.value = withTiming(next.scale, { duration: 200 })
    translateX.value = withTiming(next.x, { duration: 200 })
    translateY.value = withTiming(next.y, { duration: 200 })
    setCurrentScale(next.scale)
  }

  /**
   * Arrastrar con un dedo, para moverte por el mapa. El zoom ya no es un
   * gesto (son los botones +/- de abajo), así que este es el ÚNICO gesto que
   * queda en el mapa: sin pellizco con el que coordinarse.
   *
   * `maxPointers(1)` se mantiene aunque ya no haya pellizco: si apoyas un
   * segundo dedo sin querer, es mejor que el arrastre se cancele a que
   * intente seguir con dos punteros y vuelva a dar saltos raros.
   *
   * Detalle importante que sigue aplicando: `translationX/Y` se miden desde
   * que apoyaste el dedo, y por eso se guarda el valor de partida y se resta
   * en vez de usarlo tal cual.
   */
  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .minDistance(1)
    .onBegin((e) => {
      // Se guarda YA, no en `onStart`: un toque limpio (sin nada de
      // desplazamiento) puede no llegar nunca a `onStart` — ver el
      // comentario largo en `onFinalize`, más abajo — y sin esto
      // `handleTap` usaría un `translateX/Y` desactualizado de la vez
      // anterior.
      startX.value = translateX.value
      startY.value = translateY.value
      startPanTX.value = e.translationX
      startPanTY.value = e.translationY
      moved.value = false
    })
    .onUpdate((e) => {
      const dx = e.translationX - startPanTX.value
      const dy = e.translationY - startPanTY.value
      if (!moved.value && Math.hypot(dx, dy) > TAP_THRESHOLD) {
        moved.value = true
      }
      const next = panTransform(
        { scale: scale.value, x: startX.value, y: startY.value },
        e.translationX,
        e.translationY,
        startPanTX.value,
        startPanTY.value,
        containerWidth.value,
        containerHeight.value,
        MAP_ASPECT,
      )
      translateX.value = next.x
      translateY.value = next.y
    })
    // `onFinalize` y no `onEnd`: un toque limpio, sin nada de desplazamiento
    // de por medio, puede no llegar nunca a activarse como gesto (no supera
    // el umbral de `minDistance`). Cuando eso pasa, el gesto termina en
    // FAILED en vez de en END, y `onEnd` NO se llama —solo se llama si el
    // gesto llegó a estar activo— así que un toque así no hacía nada. Este
    // era justo el fallo: «al clickar en un país, no hace nada».
    // `onFinalize` sí se llama siempre, haya o no llegado a activarse.
    .onFinalize((e) => {
      // Apenas se movió: era un toque, no un arrastre.
      if (moved.value) return
      const contentX = screenToContent(e.x, scale.value, translateX.value)
      const contentY = screenToContent(e.y, scale.value, translateY.value)
      scheduleOnRN(handleTap, contentX, contentY)
    })

  /**
   * El SVG se dibuja OVERSAMPLE veces más grande de lo que se ve, así que se
   * encoge esa misma cantidad. Y como React Native escala respecto al CENTRO
   * de la vista, el desplazamiento se corrige para que cuadre con la
   * convención «desde la esquina» que usa toda la matemática (ver
   * `mapTransform.ts`, probado en `verify/map.ts`).
   *
   * En X hay una corrección extra: el lienzo tiene las tres copias del mapa
   * (para poder dar la vuelta), así que además de la compensación de
   * siempre hay que tener en cuenta que el lienzo empieza una copia antes de
   * donde la matemática considera el origen. Los dos ajustes van juntos en
   * `tiledTranslateX`.
   */
  const animatedStyle = useAnimatedStyle(() => {
    const k = scale.value / OVERSAMPLE
    return {
      transform: [
        {
          translateX: tiledTranslateX(
            translateX.value,
            containerWidth.value,
            scale.value,
            canvasW.value,
            k,
          ),
        },
        { translateY: originCompensatedTranslate(translateY.value, canvasH.value, k) },
        { scale: k },
      ],
    }
  })

  function fillFor(status: CountryStatus | undefined): string {
    if (status === 'been') return palette.on
    if (status === 'want') return palette.warn
    return palette.mapEmpty
  }

  // Ancho de las tres copias juntas — ver el comentario en `canvasW` más arriba.
  const canvasWidth = size.width * OVERSAMPLE * 3
  const canvasHeight = size.width * MAP_ASPECT * OVERSAMPLE
  const canZoomIn = currentScale < MAX_SCALE - 1e-6
  const canZoomOut = currentScale > MIN_SCALE + 1e-6

  const styles = StyleSheet.create({
    controls: {
      position: 'absolute',
      right: space.lg,
      bottom: space.lg,
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

  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={panGesture}>
        <View style={{ flex: 1, overflow: 'hidden' }} onLayout={onLayout}>
          {size.width > 0 && (
            <Animated.View style={[{ width: canvasWidth, height: canvasHeight }, animatedStyle]}>
              <Svg
                width={canvasWidth}
                height={canvasHeight}
                viewBox={`${-MAP_WIDTH} 0 ${MAP_WIDTH * 3} ${MAP_HEIGHT}`}
              >
                {/* Tres copias del mapa una junto a otra (izquierda, centro,
                    derecha), para dar la vuelta sin fin al arrastrar. Ver
                    `tiledTranslateX` en mapTransform.ts. */}
                {[-1, 0, 1].map((tile) => (
                  <G key={tile} transform={`translate(${tile * MAP_WIDTH} 0)`}>
                    {paths.map((p, i) => {
                      const status = p.cca3 ? statusByCode.get(p.cca3) : undefined
                      const isSelected = p.cca3 != null && p.cca3 === selected
                      return (
                        <Path
                          key={p.cca3 ?? `x${i}`}
                          d={p.d}
                          fill={fillFor(status)}
                          stroke={isSelected ? palette.fg : palette.mapStroke}
                          strokeWidth={isSelected ? 1.6 : 0.3}
                        />
                      )
                    })}
                  </G>
                ))}
              </Svg>
            </Animated.View>
          )}
        </View>
      </GestureDetector>

      <View style={[styles.controls, { backgroundColor: palette.surface, borderColor: palette.line }]}>
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
