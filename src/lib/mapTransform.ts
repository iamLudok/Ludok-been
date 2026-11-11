// Matemática del zoom y el paneo del mapa.
//
// Está fuera del componente a propósito: son funciones puras y por tanto se
// pueden probar en el escritorio (`npm run verify:map`). Esta parte ya se ha
// roto varias veces de formas que no se ven leyendo el código —el zoom
// anclándose donde no toca—, y un test es mucho más barato que compilar un
// APK y probarlo a mano.

export const MIN_SCALE = 1
/**
 * 60× deja ver el Vaticano entero en pantalla. Con el SVG de antes el tope
 * era 10× porque Android lo pintaba como imagen y a partir de ahí se veía
 * borroso; Skia dibuja vectorial a cualquier zoom.
 */
export const MAX_SCALE = 60

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
 * Desplazamiento vertical acotado para una escala dada: el mismo criterio que
 * `clampTransform`, pero sin tocar X. Lo usan las animaciones de cámara, que
 * necesitan X SIN envolver (ver `zoomAround`).
 */
export function clampY(scale: number, y: number, containerW: number, containerH: number, aspect: number): number {
  'worklet'
  const h = containerW * aspect * scale
  return h <= containerH ? (containerH - h) / 2 : Math.min(0, Math.max(containerH - h, y))
}

/**
 * Ampliar/reducir alrededor de un punto de la pantalla, para ANIMARLO (botones
 * +/-, doble toque).
 *
 * Es la misma cuenta que `pinchTransform`, con una diferencia a propósito: X
 * no se envuelve. Si el destino se envolviera, podría quedar una vuelta
 * entera más allá del origen, y la animación recorrería el mundo entero de
 * lado a lado para llegar a un sitio que se ve idéntico. Sin envolver, el
 * destino es el más cercano; al dibujar ya se envuelve (`wrapTranslateX`).
 */
export function zoomAround(
  current: Transform,
  px: number,
  py: number,
  factor: number,
  containerW: number,
  containerH: number,
  aspect: number,
): Transform {
  'worklet'
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor))
  const anchorX = screenToContent(px, current.scale, current.x)
  const anchorY = screenToContent(py, current.scale, current.y)
  return {
    scale,
    x: px - anchorX * scale,
    y: clampY(scale, py - anchorY * scale, containerW, containerH, aspect),
  }
}

/** Un dedo apoyado en la pantalla, en coordenadas de la vista del mapa. */
export interface Finger {
  id: number
  x: number
  y: number
}

/**
 * Estado del gesto de dedos: la transformación y los dedos que había cuando
 * se fijó el ancla. Todo movimiento se mide contra este momento.
 */
export interface TouchAnchor {
  t: Transform
  fingers: Finger[]
  /** Dónde estaban los dedos en el evento anterior (ver `MAX_FINGER_STEP`). */
  last: Finger[]
}

/**
 * Lo máximo (dp) que puede moverse un dedo de un evento al siguiente. Entre
 * dos eventos pasan ~8-16 ms: ni un barrido rápido llega a tanto. Más que
 * esto no es un dedo moviéndose, es la pantalla confundiendo dos dedos muy
 * juntos o un identificador reutilizado.
 * Tomarlo por movimiento real hacía saltar el mapa.
 */
export const MAX_FINGER_STEP = 200

/** Los dedos que cuentan: como mucho dos, siempre los mismos (por id). */
export function activeFingers(all: Finger[]): Finger[] {
  'worklet'
  const sorted = all.slice().sort((a, b) => a.id - b.id)
  return sorted.slice(0, 2)
}

function sameFingers(a: Finger[], b: Finger[]): boolean {
  'worklet'
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id) return false
  return true
}

/**
 * Un paso del gesto de dedos: con el ancla y los dedos de ahora, la
 * transformación nueva.
 *
 * Es UN SOLO gesto que lee los dedos en crudo, y no un arrastre y un
 * pellizco simultáneos como antes. Con dos gestos, cada uno tenía su propio
 * «desde dónde mido»: al poner o quitar un dedo, uno se activaba tarde con
 * el recorrido del otro ya acumulado, y el mapa saltaba. Aquí la regla es
 * una: **cada vez que cambia qué dedos hay, se vuelve a anclar** en la
 * transformación actual. En ese instante el resultado es exactamente la
 * transformación actual, así que no hay salto posible por construcción.
 *
 * - 1 dedo: arrastre.
 * - 2 dedos: pellizco (zoom anclado al punto medio) más arrastre del punto medio.
 */
export function touchUpdate(
  anchor: TouchAnchor | null,
  fingers: Finger[],
  current: Transform,
  containerW: number,
  containerH: number,
  aspect: number,
): { anchor: TouchAnchor | null; t: Transform } {
  'worklet'
  const now = activeFingers(fingers)
  if (now.length === 0) return { anchor: null, t: current }
  if (!anchor || !sameFingers(anchor.fingers, now)) {
    return { anchor: { t: current, fingers: now, last: now }, t: current }
  }
  for (let i = 0; i < now.length; i++) {
    if (Math.hypot(now[i].x - anchor.last[i].x, now[i].y - anchor.last[i].y) > MAX_FINGER_STEP) {
      // Un dedo «teletransportado»: se vuelve a anclar aquí en vez de
      // mover el mapa todo ese trecho de golpe.
      return { anchor: { t: current, fingers: now, last: now }, t: current }
    }
  }
  const next = { t: anchor.t, fingers: anchor.fingers, last: now }
  const start = anchor.t
  if (now.length === 1) {
    const a = anchor.fingers[0]
    return {
      anchor: next,
      t: panTransform(start, now[0].x, now[0].y, a.x, a.y, containerW, containerH, aspect),
    }
  }
  const [a0, a1] = anchor.fingers
  const [f0, f1] = now
  const startDist = Math.hypot(a1.x - a0.x, a1.y - a0.y)
  const dist = Math.hypot(f1.x - f0.x, f1.y - f0.y)
  // Dos dedos casi en el mismo punto: la razón entre distancias se dispara
  // con cualquier temblor. Se trata como arrastre puro.
  const gestureScale = startDist < 8 ? 1 : dist / startDist
  return {
    anchor: next,
    t: pinchTransform(
      start,
      (a0.x + a1.x) / 2,
      (a0.y + a1.y) / 2,
      (f0.x + f1.x) / 2,
      (f0.y + f1.y) / 2,
      gestureScale,
      containerW,
      containerH,
      aspect,
    ),
  }
}

/**
 * Hasta dónde se acerca la cámara al encuadrar un país. Sin tope, tocar el
 * Vaticano pondría el zoom al máximo y perderías toda referencia de dónde
 * estás.
 */
export const FRAME_MAX_SCALE = 12

/**
 * Transformación que encuadra una caja del contenido en una franja de la
 * pantalla (de `areaTop` a `areaBottom`: el hueco que deja la ficha del país).
 *
 * - Si ya estabas más cerca de lo necesario y la caja cabe, no se aleja: que
 *   la cámara se mueva lo mínimo.
 * - X sin envolver y hacia la copia del país más cercana a lo que ves, por el
 *   mismo motivo que en `zoomAround`.
 */
export function fitBoundsTransform(
  box: [number, number, number, number],
  current: Transform,
  areaTop: number,
  areaBottom: number,
  padding: number,
  containerW: number,
  containerH: number,
  aspect: number,
): Transform {
  'worklet'
  const [x0, y0, x1, y1] = box
  const availW = Math.max(1, containerW - 2 * padding)
  const availH = Math.max(1, areaBottom - areaTop - 2 * padding)
  const bw = Math.max(x1 - x0, 1e-6)
  const bh = Math.max(y1 - y0, 1e-6)
  const fit = Math.min(availW / bw, availH / bh, FRAME_MAX_SCALE)
  const fitsNow = bw * current.scale <= availW && bh * current.scale <= availH
  const wanted = current.scale > fit && fitsNow ? current.scale : fit
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, wanted))

  const centerX = containerW / 2
  const centerY = (areaTop + areaBottom) / 2
  // De las copias del país (una por vuelta al mundo), la que ahora mismo
  // está más cerca del centro de la pantalla.
  const cx = (x0 + x1) / 2
  const k = Math.round((centerX - current.x - cx * current.scale) / (containerW * current.scale))
  const nearestCx = cx + k * containerW
  return {
    scale,
    x: centerX - nearestCx * scale,
    y: clampY(scale, centerY - ((y0 + y1) / 2) * scale, containerW, containerH, aspect),
  }
}
