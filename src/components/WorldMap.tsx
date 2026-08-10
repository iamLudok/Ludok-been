import { useMemo, useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
} from 'react-native-reanimated'
import { svgPaths, MAP_WIDTH, MAP_HEIGHT } from '../lib/geo'
import { usePalette } from '../ui/ThemeProvider'
import type { CountryStatus } from '../types'

interface Props {
  /** estado actual por país (cca3 → estado). */
  statusByCode: Map<string, CountryStatus>
  onSelect?: (cca3: string) => void
  selected?: string | null
}

const MIN_SCALE = 1
const MAX_SCALE = 8
const MAP_ASPECT = MAP_HEIGHT / MAP_WIDTH

const AnimatedPath = Animated.createAnimatedComponent(Path)

/**
 * Encaja siempre por ancho (todo el mundo visible de lado a lado, sin
 * recortar países) y centra verticalmente lo que sobre. Misma fórmula que se
 * depuró para la versión web: si el contenido cabe en ese eje, se centra; si
 * no, se acota el paneo para no dejar ver fuera del mapa.
 */
function clampTransform(
  nextScale: number,
  nextX: number,
  nextY: number,
  containerW: number,
  containerH: number,
) {
  'worklet'
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale))
  const w = containerW * scale
  const h = containerW * MAP_ASPECT * scale
  const x = w <= containerW ? (containerW - w) / 2 : Math.min(0, Math.max(containerW - w, nextX))
  const y = h <= containerH ? (containerH - h) / 2 : Math.min(0, Math.max(containerH - h, nextY))
  return { scale, x, y }
}

export default function WorldMap({ statusByCode, onSelect, selected }: Props) {
  const palette = usePalette()
  const paths = useMemo(() => svgPaths(), [])
  const [svgWidth, setSvgWidth] = useState(0)

  const containerWidth = useSharedValue(0)
  const containerHeight = useSharedValue(0)
  const scale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const startScale = useSharedValue(1)
  const startFocalX = useSharedValue(0)
  const startFocalY = useSharedValue(0)

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout
    setSvgWidth(width)
    containerWidth.value = width
    containerHeight.value = height
    const c = clampTransform(1, 0, 0, width, height)
    scale.value = c.scale
    translateX.value = c.x
    translateY.value = c.y
  }

  // minDistance: por debajo de eso el gesto de pan nunca se activa, así que
  // el onPress nativo de cada <Path> sigue sirviendo para el tap — no hace
  // falta reimplementar a mano la distinción tap-vs-arrastre.
  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onStart(() => {
      startX.value = translateX.value
      startY.value = translateY.value
    })
    .onUpdate((e) => {
      const c = clampTransform(
        scale.value,
        startX.value + e.translationX,
        startY.value + e.translationY,
        containerWidth.value,
        containerHeight.value,
      )
      translateX.value = c.x
      translateY.value = c.y
    })

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      startScale.value = scale.value
      startX.value = translateX.value
      startY.value = translateY.value
      startFocalX.value = e.focalX
      startFocalY.value = e.focalY
    })
    .onUpdate((e) => {
      const newScale = startScale.value * e.scale
      // El punto del contenido que estaba bajo el foco inicial se mantiene
      // bajo el foco actual (que puede moverse si los dedos se desplazan
      // mientras se pellizca).
      const c0x = (startFocalX.value - startX.value) / startScale.value
      const c0y = (startFocalY.value - startY.value) / startScale.value
      const c = clampTransform(
        newScale,
        e.focalX - c0x * newScale,
        e.focalY - c0y * newScale,
        containerWidth.value,
        containerHeight.value,
      )
      scale.value = c.scale
      translateX.value = c.x
      translateY.value = c.y
    })

  const gesture = Gesture.Simultaneous(panGesture, pinchGesture)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    transformOrigin: '0 0',
  }))

  const highlightProps = useAnimatedProps(() => ({
    strokeWidth: 1.4 / scale.value,
  }))

  function fillFor(status: CountryStatus | undefined): string {
    if (status === 'been') return palette.accent
    if (status === 'want') return palette.want
    return palette.mapEmpty
  }

  const selectedD = selected ? paths.find((p) => p.cca3 === selected)?.d : undefined

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1, overflow: 'hidden' }} onLayout={onLayout}>
        {svgWidth > 0 && (
        <Animated.View style={[{ width: svgWidth, height: svgWidth * MAP_ASPECT }, animatedStyle]}>
          <Svg width={svgWidth} height={svgWidth * MAP_ASPECT} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
            {paths.map((p, i) => {
              const status = p.cca3 ? statusByCode.get(p.cca3) : undefined
              const cca3 = p.cca3
              return (
                <Path
                  key={cca3 ?? `x${i}`}
                  d={p.d}
                  fill={fillFor(status)}
                  stroke={palette.mapStroke}
                  strokeWidth={0.4}
                  onPress={cca3 && onSelect ? () => onSelect(cca3) : undefined}
                />
              )
            })}
            {selectedD && (
              <AnimatedPath
                d={selectedD}
                fill="none"
                stroke={palette.text}
                animatedProps={highlightProps}
              />
            )}
          </Svg>
        </Animated.View>
        )}
      </View>
    </GestureDetector>
  )
}
