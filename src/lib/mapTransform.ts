// Matemática del zoom y el paneo del mapa.
//
// Está fuera del componente a propósito: son funciones puras y por tanto se
// pueden probar en el escritorio (`npm run verify:map`). Esta parte ya se ha
// roto varias veces de formas que no se ven leyendo el código —el zoom
// anclándose donde no toca—, y un test es mucho más barato que compilar un
// APK y probarlo a mano.

export const MIN_SCALE = 1
export const MAX_SCALE = 10

/**
 * Cuántas veces más grande que su tamaño en pantalla se dibuja el SVG.
 *
 * Es una constante y no un valor que se ajuste según el zoom: cambiarlo sobre
 * la marcha obliga a re-medir la vista animada a mitad de interacción, y el
 * tamaño nuevo y la transformación nueva no llegan a la pantalla en el mismo
 * fotograma — el mapa daba un salto justo al levantar los dedos. Fijo, el
 * lienzo no cambia nunca de tamaño y no hay salto posible.
 *
 * 2× es el equilibrio: cuadruplica los píxeles del lienzo (asumible), y a 8×
 * eran 64 veces y por eso iba a tirones.
 */
export const OVERSAMPLE = 2

export interface Transform {
  scale: number
  x: number
  y: number
}

/**
 * Envuelve un desplazamiento horizontal para que el mapa dé la vuelta en vez
 * de toparse con un borde, como en cualquier app de mapas.
 *
 * El período es el ancho de UNA copia del mapa en pantalla a la escala
 * actual (`containerW * scale`). El mapa se dibuja TRES veces seguidas (ver
 * `WorldMap.tsx`), así que mover el desplazamiento por un período entero deja
 * el resultado visualmente IDÉNTICO — es la copia de al lado, que es igual a
 * la que había. Por eso este ajuste, aunque cambie el número, no se nota.
 */
export function wrapTranslateX(x: number, period: number): number {
  'worklet'
  if (period <= 0) return x
  return x - period * Math.round(x / period)
}

/**
 * Acota una transformación: el zoom entre los límites; el paneo vertical de
 * forma que nunca se vea fuera del mapa (o se centra, si el contenido cabe
 * entero en ese eje); y el paneo horizontal da la vuelta en vez de topar,
 * para poder rodear el mundo sin fin.
 *
 * Las coordenadas del contenido van de 0 a `containerW` a escala 1 (o sea, a
 * escala 1 el mapa ocupa justo el ancho del contenedor).
 */
export function clampTransform(
  nextScale: number,
  nextX: number,
  nextY: number,
  containerW: number,
  containerH: number,
  aspect: number,
): Transform {
  'worklet'
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale))
  const w = containerW * scale
  const h = containerW * aspect * scale
  const x = wrapTranslateX(nextX, w)
  const y = h <= containerH ? (containerH - h) / 2 : Math.min(0, Math.max(containerH - h, nextY))
  return { scale, x, y }
}

/**
 * Vista inicial: el mapa llenando el alto del contenedor y centrado — un mapa
 * al que te mueves con el dedo, no el mundo entero en miniatura.
 */
export function initialTransform(containerW: number, containerH: number, aspect: number): Transform {
  'worklet'
  const fitHeight = containerH / (containerW * aspect)
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitHeight))
  const w = containerW * scale
  const h = containerW * aspect * scale
  return clampTransform(scale, (containerW - w) / 2, (containerH - h) / 2, containerW, containerH, aspect)
}

/**
 * Dónde cae en pantalla un punto del contenido. Es la definición de la que
 * salen todas las demás: pantalla = contenido × escala + desplazamiento.
 */
export function contentToScreen(content: number, scale: number, translate: number): number {
  'worklet'
  return content * scale + translate
}

/** La inversa: de un punto de la pantalla al contenido sin transformar. */
export function screenToContent(screen: number, scale: number, translate: number): number {
  'worklet'
  return (screen - translate) / scale
}

/**
 * Nueva transformación durante un pellizco, manteniendo bajo los dedos el
 * mismo punto del mapa que había al empezar. `start` es la transformación al
 * inicio del gesto y `startFocal`/`focal` el punto medio entre los dedos
 * entonces y ahora (el foco se mueve si además arrastras mientras pellizcas).
 */
export function pinchTransform(
  start: Transform,
  startFocalX: number,
  startFocalY: number,
  focalX: number,
  focalY: number,
  gestureScale: number,
  containerW: number,
  containerH: number,
  aspect: number,
): Transform {
  'worklet'
  // La escala se acota AQUÍ, antes de calcular el desplazamiento.
  //
  // Es la parte delicada: si se calculara el desplazamiento con la escala sin
  // acotar y se dejara que `clampTransform` la recortara después, el
  // desplazamiento se habría calculado para una escala distinta de la que
  // acaba aplicándose, y el punto que tienes bajo los dedos se iría de sitio
  // justo al topar con el límite de zoom.
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, start.scale * gestureScale))
  const anchorX = screenToContent(startFocalX, start.scale, start.x)
  const anchorY = screenToContent(startFocalY, start.scale, start.y)
  return clampTransform(
    scale,
    focalX - anchorX * scale,
    focalY - anchorY * scale,
    containerW,
    containerH,
    aspect,
  )
}

/**
 * Nueva transformación mientras arrastras con un dedo.
 *
 * `translation` es el desplazamiento que reporta el gesto, medido desde que
 * apoyaste el PRIMER dedo. `startTranslation` es cuánto valía eso en el
 * momento en que el arrastre se activó. Restarlos es lo que evita el salto al
 * soltar un pellizco: ahí el arrastre se activa tarde (cuando queda un solo
 * dedo) y llega con todo el recorrido del pellizco ya acumulado.
 */
export function panTransform(
  start: Transform,
  translationX: number,
  translationY: number,
  startTranslationX: number,
  startTranslationY: number,
  containerW: number,
  containerH: number,
  aspect: number,
): Transform {
  'worklet'
  return clampTransform(
    start.scale,
    start.x + (translationX - startTranslationX),
    start.y + (translationY - startTranslationY),
    containerW,
    containerH,
    aspect,
  )
}

/**
 * Nueva transformación al pulsar el botón de ampliar/reducir.
 *
 * Es la misma idea que `pinchTransform` (el punto anclado no se mueve), pero
 * SIN ningún dedo de por medio: no hay `onStart`/`onUpdate` que coordinar, no
 * hay un segundo puntero que pueda interferir, no hay un desplazamiento
 * acumulado que arrastrar de un gesto anterior. Es una función pura que se
 * llama una vez por pulsación, con el centro de la pantalla como punto fijo
 * de anclaje — así tampoco hace falta rastrear dónde tocaste.
 */
export function centerZoomTransform(
  current: Transform,
  factor: number,
  containerW: number,
  containerH: number,
  aspect: number,
): Transform {
  'worklet'
  const centerX = containerW / 2
  const centerY = containerH / 2
  // La escala se acota AQUÍ, antes de calcular el desplazamiento — el mismo
  // orden que en `pinchTransform`, por el mismo motivo: si se usara la escala
  // sin acotar para calcular dónde debe quedar el punto anclado, y luego se
  // recortara la escala, el desplazamiento ya no correspondería a la escala
  // final.
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor))
  const anchorX = screenToContent(centerX, current.scale, current.x)
  const anchorY = screenToContent(centerY, current.scale, current.y)
  return clampTransform(
    scale,
    centerX - anchorX * scale,
    centerY - anchorY * scale,
    containerW,
    containerH,
    aspect,
  )
}

/**
 * React Native escala las vistas respecto a su CENTRO, no a su esquina.
 *
 * Toda la matemática de arriba asume esquina superior izquierda (pantalla =
 * contenido × escala + desplazamiento), así que hay que corregir el
 * desplazamiento que se le pasa al estilo. Se hace con esta cuenta en vez de
 * con `transformOrigin` porque esa propiedad no está garantizada por la vía
 * de `useAnimatedStyle`, y si se ignora en silencio el mapa hace zoom hacia
 * un sitio distinto del que estás tocando — que es justo el fallo que se
 * arrastraba.
 *
 * @param logicalTranslate desplazamiento en la convención "desde la esquina"
 * @param canvasSize       tamaño de la vista animada en ese eje
 * @param k                escala que se le pasa al estilo
 */
export function originCompensatedTranslate(
  logicalTranslate: number,
  canvasSize: number,
  k: number,
): number {
  'worklet'
  return logicalTranslate - (canvasSize / 2) * (1 - k)
}

/**
 * Desplazamiento final en X para el estilo animado, cuando el mapa se dibuja
 * TRES veces seguidas (para poder dar la vuelta sin fin, ver `WorldMap.tsx`).
 *
 * Combina dos correcciones en una, porque si se aplican por separado es fácil
 * dejarse alguna o hacerlo en el orden que no es:
 *
 * 1. El lienzo, con las tres copias, empieza UNA COPIA ANTES de donde nuestra
 *    matemática considera el origen (para tener la copia de la izquierda de
 *    sobra). Eso desplaza todo lo dibujado exactamente `containerW * scale`
 *    px hacia la izquierda respecto a lo que se espera, y hay que
 *    compensarlo restando esa cantidad.
 * 2. Encima de eso, la corrección de siempre por cómo React Native escala
 *    las vistas desde su centro (`originCompensatedTranslate`).
 *
 * La demostración de que el orden es «restar la copia, LUEGO compensar el
 * centro» y no al revés está en `verify/map.ts`: se simula el render real
 * para un punto de cada una de las tres copias y se comprueba que cae
 * exactamente donde dice `contentToScreen`.
 */
export function tiledTranslateX(
  translateX: number,
  containerW: number,
  scale: number,
  canvasWidth: number,
  k: number,
): number {
  'worklet'
  const tileWidth = containerW * scale
  return originCompensatedTranslate(translateX - tileWidth, canvasWidth, k)
}
