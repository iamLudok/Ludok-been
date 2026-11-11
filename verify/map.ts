/**
 * Verificación de la matemática del mapa.
 *
 * El fallo que se arrastraba —«hago zoom en una parte y se zoomea en otra»—
 * es invisible leyendo el código y carísimo de probar a mano (compilar APK,
 * instalar, pellizcar). Aquí se comprueba la propiedad que define un pellizco
 * correcto: el punto del mapa que tienes bajo los dedos NO se mueve.
 */
import {
  clampTransform,
  initialTransform,
  pinchTransform,
  panTransform,
  centerZoomTransform,
  contentToScreen,
  screenToContent,
  wrapTranslateX,
  zoomAround,
  touchUpdate,
  fitBoundsTransform,
  FRAME_MAX_SCALE,
  MIN_SCALE,
  MAX_SCALE,
  type Finger,
  type TouchAnchor,
  type Transform,
} from '../src/lib/mapTransform'
import {
  MAP_SITES,
  MAP_WIDTH,
  MAP_HEIGHT,
  siteAt,
  siteOf,
  shapeAt,
  needsMarker,
  hostCode,
} from '../src/lib/geo'
import { COUNTRIES } from '../src/lib/countries'
import { MAP_SHAPES, shapeContains } from '../src/lib/geo'
import { placeLabels, POINT_LABELS_MIN_PPU } from '../src/lib/mapLabels'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}
function near(label: string, actual: number, expected: number, tol = 0.01) {
  const ok = Math.abs(actual - expected) <= tol
  check(label, ok, ok ? '' : `esperado ${expected.toFixed(2)}, salió ${actual.toFixed(2)}`)
}
/**
 * Como `near`, pero perdona diferencias de un múltiplo entero de `period`:
 * con el mapa dando la vuelta, dos posiciones que difieren en una copia
 * entera son la MISMA posición visual (hay una copia justo al lado). El
 * paneo en X ya no topa con nada, así que la propiedad que importa no es
 * «coincide exacto» sino «coincide módulo una copia».
 */
function nearMod(label: string, actual: number, expected: number, period: number, tol = 0.01) {
  let diff = actual - expected
  if (period > 0) diff = diff - period * Math.round(diff / period)
  const ok = Math.abs(diff) <= tol
  check(label, ok, ok ? '' : `esperado ${expected.toFixed(2)} (mód. ${period.toFixed(2)}), salió ${actual.toFixed(2)}`)
}

// Pantalla tipo Pixel 7a y el mapa recortado de la app.
const W = 412
const H = 700
const ASPECT = MAP_HEIGHT / MAP_WIDTH

async function main() {
  console.log('\n=== 1. Vista inicial ===')
  const init = initialTransform(W, H, ASPECT)
  check('llena el alto del contenedor', Math.abs(W * ASPECT * init.scale - H) < 0.5)
  near('centrada en horizontal', init.x + (W * init.scale) / 2, W / 2)
  check('dentro de los límites de zoom', init.scale >= MIN_SCALE && init.scale <= MAX_SCALE)

  console.log('\n=== 2. El paneo vertical no deja ver fuera del mapa (el horizontal da la vuelta) ===')
  const pannedDown = clampTransform(init.scale, 0, 99999, W, H, ASPECT)
  check('no se puede arrastrar más allá del borde superior', pannedDown.y <= 0.001)
  const pannedUp = clampTransform(init.scale, 0, -99999, W, H, ASPECT)
  const contentH = W * ASPECT * init.scale
  near('ni del inferior', pannedUp.y, Math.min(0, H - contentH))
  // El horizontal, en cambio, nunca topa: cualquier arrastre, por lejos que
  // llegue, devuelve un valor finito y acotado (envuelto), no un tope.
  const pannedFarRight = clampTransform(init.scale, 99999, 0, W, H, ASPECT)
  const pannedFarLeft = clampTransform(init.scale, -99999, 0, W, H, ASPECT)
  const period = W * init.scale
  check('arrastrar mucho a la derecha da un valor envuelto, no un tope', Math.abs(pannedFarRight.x) <= period / 2 + 0.01)
  check('arrastrar mucho a la izquierda también', Math.abs(pannedFarLeft.x) <= period / 2 + 0.01)

  console.log('\n=== 3. EL PELLIZCO: el punto bajo los dedos no se mueve ===')
  // Esta es LA comprobación. Se pellizca en varios sitios de la pantalla y en
  // ambos sentidos, y en todos el punto del mapa que estaba bajo el foco
  // tiene que seguir estando bajo el foco después.
  // Se parte de un zoom con margen por los cuatro lados, para que la
  // invariante se pueda comprobar de verdad y no quede todo en «topó con un
  // límite» (que no probaría nada).
  const start = clampTransform(3, -300, -60, W, H, ASPECT)
  for (const [fx, fy] of [
    [W / 2, H / 2], // centro
    [40, 80], // arriba a la izquierda
    [W - 30, H - 60], // abajo a la derecha
    [W - 20, 50], // arriba a la derecha
  ]) {
    // Se prueban gestos suaves Y gestos que se pasan de los topes de zoom
    // (0.05 y 40). Llegar al tope NO es excusa para que el mapa se desplace:
    // el zoom se queda en el límite, pero el punto bajo los dedos se queda
    // donde estaba. Aquí es donde se colaba el fallo.
    for (const g of [1.2, 0.9, 1.5, 0.05, 40]) {
      const anchorX = screenToContent(fx, start.scale, start.x)
      const anchorY = screenToContent(fy, start.scale, start.y)
      const next = pinchTransform(start, fx, fy, fx, fy, g, W, H, ASPECT)

      // Lo único que sí impide mantener el punto bajo el dedo es que el mapa
      // no pueda desplazarse más sin dejar ver fuera de él.
      //
      // OJO: si «está contra el borde» se dedujera comparando el resultado
      // con el valor ideal, el test estaría usando como excusa justo lo que
      // pretende comprobar, y dejaría pasar cualquier desviación. Se deduce
      // de los LÍMITES, que no dependen del resultado.
      const idealY = fy - anchorY * next.scale
      const contentH = W * ASPECT * next.scale
      const pannedToEdgeY = contentH <= H || idealY < Math.min(0, H - contentH) - 1e-9 || idealY > 1e-9

      // En X ya no hay borde con el que topar: el paneo da la vuelta. La
      // invariante ya no es «coincide exacto», sino «coincide salvo una
      // copia entera» (el período de `wrapTranslateX`, ancho del contenido a
      // esta escala).
      nearMod(
        `(${fx},${fy}) ×${g}: el punto sigue bajo el dedo en X (módulo una vuelta)`,
        contentToScreen(anchorX, next.scale, next.x),
        fx,
        W * next.scale,
      )
      if (pannedToEdgeY) {
        check(`(${fx},${fy}) ×${g}: Y contra el borde del mapa, correcto`, true)
      } else {
        near(`(${fx},${fy}) ×${g}: y en Y`, contentToScreen(anchorY, next.scale, next.y), fy)
      }
      check(
        `(${fx},${fy}) ×${g}: la escala respeta los topes`,
        next.scale >= MIN_SCALE - 1e-9 && next.scale <= MAX_SCALE + 1e-9,
      )
    }
  }

  console.log('\n=== 4. Pellizcar Y arrastrar a la vez ===')
  // Si los dedos se desplazan mientras pellizcas, el punto anclado debe
  // seguir al foco nuevo.
  const startFocal = { x: 150, y: 300 }
  const endFocal = { x: 260, y: 220 }
  const anchorX = screenToContent(startFocal.x, start.scale, start.x)
  const anchorY = screenToContent(startFocal.y, start.scale, start.y)
  const moved = pinchTransform(
    start,
    startFocal.x,
    startFocal.y,
    endFocal.x,
    endFocal.y,
    1.2,
    W,
    H,
    ASPECT,
  )
  near('el punto anclado acompaña al foco en X', contentToScreen(anchorX, moved.scale, moved.x), endFocal.x)
  near('y en Y', contentToScreen(anchorY, moved.scale, moved.y), endFocal.y)

  console.log('\n=== 4b. Al soltar un pellizco el mapa no salta ===')
  // Los dedos no se levantan a la vez: queda un instante con uno solo apoyado
  // y el gesto de arrastre se activa. Como su desplazamiento se mide desde que
  // apoyaste el PRIMER dedo, llega con todo el recorrido del pellizco ya
  // acumulado. Si no se descuenta, el mapa pega un salto justo al soltar.
  const afterPinch = clampTransform(3.5, -400, -120, W, H, ASPECT)
  // El arrastre se activa tarde, con 260/-180 ya acumulados, y el dedo que
  // queda NO se mueve más: el mapa debe quedarse exactamente donde estaba.
  const noMove = panTransform(afterPinch, 260, -180, 260, -180, W, H, ASPECT)
  near('no se mueve en X al activarse tarde', noMove.x, afterPinch.x)
  near('ni en Y', noMove.y, afterPinch.y)
  near('ni cambia el zoom', noMove.scale, afterPinch.scale)
  // Y si después sí arrastras 50px, se mueve 50px: ni más, ni menos.
  const thenDrag = panTransform(afterPinch, 310, -130, 260, -180, W, H, ASPECT)
  near('luego arrastra justo lo que pides en X', thenDrag.x - afterPinch.x, 50)
  near('y en Y', thenDrag.y - afterPinch.y, 50)

  console.log('\n=== 4c. Botones de zoom: el centro de la pantalla no se mueve ===')
  // Sin ningún dedo de por medio: pulsar el botón varias veces desde
  // distintos puntos de partida, y en todos el punto que había en el centro
  // de la pantalla se queda en el centro después.
  for (const s0 of [
    clampTransform(1.5, -50, -20, W, H, ASPECT),
    clampTransform(3, -300, -60, W, H, ASPECT),
    initialTransform(W, H, ASPECT),
  ]) {
    for (const factor of [1.5, 1 / 1.5, 4, 0.01]) {
      const centerX = W / 2
      const centerY = H / 2
      const anchorX = screenToContent(centerX, s0.scale, s0.x)
      const anchorY = screenToContent(centerY, s0.scale, s0.y)
      const next = centerZoomTransform(s0, factor, W, H, ASPECT)
      check(
        `factor ${factor}: la escala respeta los topes`,
        next.scale >= MIN_SCALE - 1e-9 && next.scale <= MAX_SCALE + 1e-9,
      )
      const contentH = W * ASPECT * next.scale
      const idealY = centerY - anchorY * next.scale
      const pannedToEdgeY = contentH <= H || idealY < Math.min(0, H - contentH) - 1e-9 || idealY > 1e-9
      // En X, otra vez: sin borde, la invariante es módulo una vuelta.
      nearMod(
        `factor ${factor}: el centro sigue en el centro (X, módulo una vuelta)`,
        contentToScreen(anchorX, next.scale, next.x),
        centerX,
        W * next.scale,
      )
      if (!pannedToEdgeY) {
        near(`factor ${factor}: el centro sigue en el centro (Y)`, contentToScreen(anchorY, next.scale, next.y), centerY)
      }
    }
  }
  // Ida y vuelta: ampliar y luego reducir el mismo factor deja la escala
  // igual (salvo que algún paso topara con un límite).
  const base = clampTransform(2, -150, -40, W, H, ASPECT)
  const out1 = centerZoomTransform(base, 1.5, W, H, ASPECT)
  const back = centerZoomTransform(out1, 1 / 1.5, W, H, ASPECT)
  near('ampliar y reducir el mismo factor vuelve al punto de partida', back.scale, base.scale)

  console.log('\n=== 4d. Los botones nunca dependen de ningún gesto ===')
  // Es la propiedad que motiva todo esto: el resultado sale SOLO de la
  // transformación actual y el factor, nada de estado de puntero ni de
  // «cuánto llevaba acumulado» — por construcción no puede arrastrar el
  // fallo que tuvo el arrastre (recorrido heredado de un gesto anterior).
  check(
    'centerZoomTransform tiene exactamente 5 parámetros (sin estado de gesto)',
    centerZoomTransform.length === 5,
  )

  console.log('\n=== 6b. Envolver el paneo horizontal ===')
  check('un valor ya dentro de rango no se toca', Math.abs(wrapTranslateX(50, 1000) - 50) < 0.001)
  check('el resultado siempre cabe en medio período', Math.abs(wrapTranslateX(12345, 1000)) <= 500.001)
  near('desplazar un período entero da el mismo resultado (misma copia)', wrapTranslateX(300, 1000), wrapTranslateX(300 + 1000, 1000))
  near('y también hacia el otro lado', wrapTranslateX(300, 1000), wrapTranslateX(300 - 1000, 1000))
  check('con período 0 (contenedor sin medir aún) no revienta', wrapTranslateX(999, 0) === 999)

  console.log('\n=== 7. Dedos en crudo: secuencias reales ===')
  // `touchUpdate` es el gesto de verdad. Se simulan secuencias como las que
  // rompían el pellizco antes: un segundo dedo a mitad de arrastre, levantar
  // uno de los dos, el tope de zoom. La propiedad que se exige siempre: al
  // cambiar los dedos, el mapa NO se mueve en ese instante.
  const base7 = clampTransform(4, -900, -400, W, H, ASPECT)
  /** Ejecuta una secuencia y devuelve la transformación tras cada evento. */
  const play = (events: Finger[][], from: Transform = base7) => {
    let anchor: TouchAnchor | null = null
    let t = from
    const out: Transform[] = []
    for (const fingers of events) {
      const r = touchUpdate(anchor, fingers, t, W, H, ASPECT)
      anchor = r.anchor
      t = r.t
      out.push(t)
    }
    return out
  }
  const f = (id: number, x: number, y: number): Finger => ({ id, x, y })
  const same = (a: Transform, b: Transform) =>
    Math.abs(a.scale - b.scale) < 1e-9 &&
    Math.abs(wrapTranslateX(a.x - b.x, W * a.scale)) < 1e-6 &&
    Math.abs(a.y - b.y) < 1e-6

  {
    const r = play([[f(1, 100, 300)], [f(1, 150, 330)]])
    nearMod('1 dedo: arrastra justo lo que mueves en X', r[1].x - base7.x, 50, W * base7.scale)
    near('y en Y', r[1].y - base7.y, 30)
  }
  {
    // Arrastrando con uno, se apoya un segundo dedo lejos: ni salto ni zoom.
    const r = play([[f(1, 100, 300)], [f(1, 140, 310)], [f(1, 140, 310), f(2, 300, 500)]])
    check('segundo dedo a mitad de arrastre: el mapa no salta', same(r[2], r[1]))
  }
  {
    // Pellizco simétrico: los dedos se separan el doble alrededor del mismo centro.
    const cx = 200
    const cy = 350
    const anchorX = screenToContent(cx, base7.scale, base7.x)
    const anchorY = screenToContent(cy, base7.scale, base7.y)
    const r = play([
      [f(1, cx - 50, cy), f(2, cx + 50, cy)],
      [f(1, cx - 100, cy), f(2, cx + 100, cy)],
    ])
    near('pellizco ×2: la escala se dobla', r[1].scale, base7.scale * 2)
    nearMod('el punto bajo el centro de los dedos no se mueve (X)', contentToScreen(anchorX, r[1].scale, r[1].x), cx, W * r[1].scale)
    near('ni en Y', contentToScreen(anchorY, r[1].scale, r[1].y), cy)
  }
  {
    // Soltar uno de los dos (primero el de id más bajo, que es el caso que
    // más se complica si se cuentan los dedos por posición) y seguir.
    const r = play([
      [f(1, 150, 300), f(2, 250, 300)],
      [f(1, 120, 300), f(2, 280, 300)],
      [f(2, 280, 300)],
      [f(2, 320, 340)],
    ])
    check('al levantar un dedo el mapa no salta', same(r[2], r[1]))
    near('y luego el que queda arrastra justo su recorrido (X)', wrapTranslateX(r[3].x - r[2].x, W * r[2].scale), 40)
    near('(Y)', r[3].y - r[2].y, 40)
    near('sin tocar el zoom', r[3].scale, r[2].scale)
  }
  {
    // Un tercer dedo no cambia nada: solo cuentan los dos primeros.
    const r = play([
      [f(1, 150, 300), f(2, 250, 300)],
      [f(1, 150, 300), f(2, 250, 300), f(3, 50, 50)],
      [f(1, 150, 300), f(2, 250, 300), f(3, 90, 90)],
    ])
    check('un tercer dedo no mueve el mapa', same(r[1], r[0]) && same(r[2], r[0]))
  }
  {
    // Pellizcar muchísimo: topa en MAX_SCALE y el centro sigue bajo los dedos.
    const anchorX = screenToContent(200, base7.scale, base7.x)
    // Por pasos de 20 dp, como un dedo de verdad (de un salto sería un
    // dedo «teletransportado», ver más abajo).
    const steps: Finger[][] = []
    for (let d = 5; d <= 200; d += 20) steps.push([f(1, 200 - d, 350), f(2, 200 + d, 350)])
    const r = play(steps)
    const last = r[r.length - 1]
    near('pellizco enorme: se queda en el tope', last.scale, MAX_SCALE)
    nearMod('y el centro sigue bajo los dedos', contentToScreen(anchorX, last.scale, last.x), 200, W * last.scale)
  }
  {
    // Sin dedos: no hay ancla y no cambia nada.
    const r = touchUpdate(null, [], base7, W, H, ASPECT)
    check('sin dedos no hay ancla ni cambio', r.anchor === null && same(r.t, base7))
  }
  {
    // Recorrido largo poniendo y quitando dedos: en CADA cambio de dedos el
    // mapa se queda quieto. Es la causa raíz del fallo de antes, en general.
    const seq: Finger[][] = [
      [f(1, 100, 100)],
      [f(1, 130, 120)],
      [f(1, 130, 120), f(2, 300, 400)],
      [f(1, 120, 110), f(2, 330, 450)],
      [f(2, 330, 450)],
      [f(2, 300, 420)],
      [f(2, 300, 420), f(3, 100, 600)],
      [f(2, 310, 410), f(3, 60, 650)],
      [f(3, 60, 650)],
    ]
    const r = play(seq)
    let ok = true
    for (let i = 1; i < seq.length; i++) {
      const changed = seq[i].map((x) => x.id).join() !== seq[i - 1].map((x) => x.id).join()
      if (changed && !same(r[i], r[i - 1])) ok = false
    }
    check('en un recorrido largo, ningún cambio de dedos mueve el mapa', ok)
  }

  {
    // Un dedo «teletransportado» (la pantalla confunde dos dedos juntos, o
    // reutiliza un id): el mapa no da el salto, y después sigue con
    // normalidad desde la posición nueva.
    const r = play([
      [f(1, 150, 300), f(2, 250, 300)],
      [f(1, 145, 300), f(2, 255, 300)],
      [f(1, 145, 300), f(2, 600, 50)],
      [f(1, 145, 300), f(2, 610, 50)],
    ])
    check('un dedo teletransportado no hace saltar el mapa', same(r[2], r[1]))
    check('y el siguiente movimiento normal sí se aplica', !same(r[3], r[2]))
  }
  {
    // Gesto nuevo con un ancla vieja del anterior y el MISMO id de dedo:
    // `touchUpdate` por sí solo no puede saberlo (lo resuelve WorldMap
    // poniendo el ancla a null al primer dedo); aquí se comprueba que con
    // el ancla limpia no hay salto.
    const fresh = touchUpdate(null, [f(1, 380, 650)], base7, W, H, ASPECT)
    check('primer dedo de un gesto nuevo: el mapa no se mueve', same(fresh.t, base7))
  }

  console.log('\n=== 8. Zoom animado (botones, doble toque) ===')
  for (const [px, py, fac] of [[W / 2, H / 2, 1.6], [50, 600, 2], [380, 90, 1 / 1.6]] as const) {
    const s0 = clampTransform(5, -2000, -600, W, H, ASPECT)
    const ax = screenToContent(px, s0.scale, s0.x)
    const ay = screenToContent(py, s0.scale, s0.y)
    const z = zoomAround(s0, px, py, fac, W, H, ASPECT)
    near(`(${px},${py}) ×${fac.toFixed(2)}: el punto se queda en X, EXACTO (sin dar la vuelta)`, contentToScreen(ax, z.scale, z.x), px)
    const contentH = W * ASPECT * z.scale
    const atEdge = Math.abs(z.y) < 1e-6 || Math.abs(z.y - (H - contentH)) < 1e-6
    if (atEdge) check('Y contra el borde del mapa, correcto', true)
    else near('y en Y', contentToScreen(ay, z.scale, z.y), py)
  }

  console.log('\n=== 9. Encuadrar el país seleccionado ===')
  // El hueco libre es la mitad de arriba (la ficha tapa la de abajo).
  const areaTop = 0
  const areaBottom = H * 0.45
  const PAD = 24
  const toContent = (b: number[]) => b.map((v) => (v * W) / MAP_WIDTH) as [number, number, number, number]
  for (const code of ['ESP', 'VAT', 'NZL', 'JPN', 'CHL', 'ISL', 'TUV', 'BRA']) {
    const site = siteOf(code)
    if (!site) {
      check(`${code}: tiene sitio en el mapa`, false)
      continue
    }
    const box = toContent(site.frame)
    for (const from of [initialTransform(W, H, ASPECT), clampTransform(20, -5000, -2000, W, H, ASPECT)]) {
      const t = fitBoundsTransform(box, from, areaTop, areaBottom, PAD, W, areaBottom, ASPECT)
      // X sin envolver: el país puede estar en la copia de al lado, que se
      // ve idéntica. Se lleva a la copia que cae en pantalla.
      const tx = wrapTranslateX(t.x, W * t.scale)
      const shift = W * t.scale * Math.round((W / 2 - contentToScreen((box[0] + box[2]) / 2, t.scale, tx)) / (W * t.scale))
      const sx0 = contentToScreen(box[0], t.scale, tx) + shift
      const sx1 = contentToScreen(box[2], t.scale, tx) + shift
      const sy0 = contentToScreen(box[1], t.scale, t.y)
      const sy1 = contentToScreen(box[3], t.scale, t.y)
      // Abajo del todo del mapa (Chile, Nueva Zelanda) no se puede subir más
      // de lo que deja el borde: ahí basta con que quede lo más arriba posible.
      const contentH = W * ASPECT * t.scale
      const yClamped = Math.abs(t.y - Math.min(0, areaBottom - contentH)) < 1e-6 || Math.abs(t.y) < 1e-6
      check(
        `${code} desde ×${from.scale.toFixed(1)}: entra entero en el hueco`,
        sx0 >= -0.5 && sx1 <= W + 0.5 && (yClamped || (sy0 >= areaTop - 0.5 && sy1 <= areaBottom + 0.5)),
        `x ${sx0.toFixed(0)}..${sx1.toFixed(0)} y ${sy0.toFixed(0)}..${sy1.toFixed(0)}`,
      )
      check(`${code}: no se acerca más del tope de encuadre`, t.scale <= Math.max(FRAME_MAX_SCALE, from.scale) + 1e-9)
      // Va a la copia más cercana: el centro del país no queda a más de
      // media vuelta de donde estaba.
      const before = contentToScreen((box[0] + box[2]) / 2, from.scale, from.x)
      const k = (W / 2 - before) / (W * from.scale)
      check(`${code}: va a la copia más cercana`, Math.abs(k - Math.round(k)) <= 0.5 + 1e-9)
    }
  }
  {
    // Ya estabas más cerca que el tope de encuadre y el país cabe: la
    // cámara no se aleja. Andorra a ×30 sigue cabiendo de sobra.
    const box = toContent(siteOf('AND')!.frame)
    const zoomedIn = clampTransform(30, -9000, -4000, W, H, ASPECT)
    const again = fitBoundsTransform(box, zoomedIn, areaTop, areaBottom, PAD, W, areaBottom, ASPECT)
    near('si el país ya cabe, se mantiene el zoom', again.scale, 30)
    const far = fitBoundsTransform(box, initialTransform(W, H, ASPECT), areaTop, areaBottom, PAD, W, areaBottom, ASPECT)
    near('y desde lejos se acerca justo hasta el tope', far.scale, FRAME_MAX_SCALE)
  }

  console.log('\n=== 10. Todos los países se pueden tocar ===')
  // La queja de partida: el Vaticano no se podía tocar. Se exige para todos
  // los sitios de la lista que exista un punto de la pantalla que los abra,
  // a vista de mundo y con zoom, con las mismas reglas que usa el mapa.
  const init10 = initialTransform(W, H, ASPECT)
  for (const scale of [init10.scale, 12, MAX_SCALE]) {
    const ppu = (scale * W) / MAP_WIDTH
    const unreachable: string[] = []
    const hidden: string[] = []
    for (const c of COUNTRIES) {
      if (c.cca3 === 'ATA') continue // la Antártida queda fuera del recorte de Mercator
      const site = siteOf(c.cca3)
      if (!site) {
        unreachable.push(`${c.name} (sin sitio)`)
        continue
      }
      const hit = (x: number, y: number) => siteAt(x, y, ppu) === c.cca3
      let ok = hit(site.anchor[0], site.anchor[1])
      if (!ok) {
        // Formas cóncavas (Croacia, Chile…) o enclaves cuyo punto aún no se
        // enseña: se busca un punto que lo abra con una rejilla sobre su caja.
        const [x0, y0, x1, y1] = site.frame
        for (let i = 1; i < 20 && !ok; i++) {
          for (let j = 1; j < 20 && !ok; j++) {
            ok = hit(x0 + ((x1 - x0) * i) / 20, y0 + ((y1 - y0) * j) / 20)
          }
        }
      }
      // A vista de mundo, un enclave cuyo país anfitrión aún se ve pequeño
      // (Andorra, Liechtenstein, el Vaticano) se alcanza acercándose: es lo
      // que se pide a escala 12 y al máximo, justo debajo.
      if (!ok && scale === init10.scale && hostCode(c.cca3)) hidden.push(c.name)
      else if (!ok) unreachable.push(c.name)
    }
    if (hidden.length) console.log(`        (a vista de mundo hay que acercarse para: ${hidden.join(', ')})`)
    check(
      `a escala ×${scale.toFixed(1)}: ${COUNTRIES.length - 1 - unreachable.length - hidden.length} de ${COUNTRIES.length - 1} se pueden tocar directamente`,
      unreachable.length === 0,
      unreachable.join(', '),
    )
  }
  check('el Vaticano lleva marcador incluso con el zoom al máximo', needsMarker(siteOf('VAT')!, (MAX_SCALE * W) / MAP_WIDTH))
  {
    // Tocar el centro de Italia a vista de mundo abre Italia, no el Vaticano.
    const ppu = (init10.scale * W) / MAP_WIDTH
    const ita = siteOf('ITA')!
    check('tocar el centro de Italia abre Italia', siteAt(ita.anchor[0], ita.anchor[1], ppu) === 'ITA')
  }
  check('el mar no es ningún país', shapeAt(MAP_WIDTH * 0.35, MAP_HEIGHT * 0.55) === null)
  check('todos los sitios caen dentro del lienzo', MAP_SITES.every((s) => s.anchor[0] >= 0 && s.anchor[0] <= MAP_WIDTH && s.anchor[1] >= 0 && s.anchor[1] <= MAP_HEIGHT))
  console.log('\n=== 11. Nombres de países ===')
  {
    // Medida aproximada de Roboto semibold a 11: ~0,58 em por letra.
    const fontSize = 11
    const measure = (t: string) => t.length * fontSize * 0.58
    const at = (scale: number, selected?: string) =>
      placeLabels({ ppu: (scale * W) / MAP_WIDTH, measure, fontSize, markerGap: 8, selected })
    const fuera = MAP_SHAPES.filter((s) => s.code && !shapeContains(s, s.label[0], s.label[1])).map((s) => s.code)
    check('el punto del nombre cae dentro de su país (no en el vecino)', fuera.length === 0, fuera.join(', '))
    const mundo = at(1.6)
    const cerca = at(8)
    check('con poco zoom, pocos nombres y de países grandes', mundo.length > 0 && mundo.length < 40, `${mundo.length}`)
    check('a vista de mundo y algo, Rusia tiene nombre', mundo.some((l) => l.code === 'RUS'))
    check('el Vaticano no, todavía', !mundo.some((l) => l.code === 'VAT'))
    check('ampliando, más nombres', cerca.length > mundo.length, `${mundo.length} → ${cerca.length}`)
    check('con zoom, España tiene nombre', cerca.some((l) => l.code === 'ESP'))
    // Ningún par de nombres se pisa (mismas cajas que usa placeLabels, sin el hueco).
    for (const [label, list, scale] of [['a poco zoom', mundo, 1.6], ['con zoom', cerca, 8], ['al máximo', at(MAX_SCALE), MAX_SCALE]] as const) {
      const ppu = (scale * W) / MAP_WIDTH
      const box = (l: (typeof list)[number]) => {
        const x = l.x * ppu + l.dx
        const y = l.y * ppu + l.dy
        return [x, y - fontSize * 0.8, x + measure(l.text), y + fontSize * 0.25]
      }
      let overlaps = 0
      for (let i = 0; i < list.length; i++) {
        const [l1, t1, r1, b1] = box(list[i])
        for (let j = i + 1; j < list.length; j++) {
          const [l2, t2, r2, b2] = box(list[j])
          if (l1 < r2 && r1 > l2 && t1 < b2 && b1 > t2) overlaps++
        }
      }
      check(`ningún nombre pisa a otro (${label})`, overlaps === 0, `${overlaps}`)
    }
    const ppuPoints = POINT_LABELS_MIN_PPU * 0.9
    const sinPuntos = placeLabels({ ppu: ppuPoints, measure, fontSize, markerGap: 8 })
    check('por debajo del umbral, los puntos (Andorra…) no llevan nombre', !sinPuntos.some((l) => l.dx > 0))
    check('pero el seleccionado sí, aunque sea un punto', at(1.6, 'TUV').some((l) => l.code === 'TUV' && l.dx > 0))
    const conPuntos = at(30)
    check('con mucho zoom, Gibraltar lleva nombre junto a su punto', conPuntos.some((l) => l.code === 'GIB' && l.dx > 0))
    check('cada sitio sale una vez como mucho', new Set(cerca.map((l) => l.code)).size === cerca.length)
  }

  console.log(
    failures === 0
      ? '\n✅ TODO CORRECTO — el zoom ancla donde tocas\n'
      : `\n❌ ${failures} COMPROBACIONES FALLIDAS\n`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\nEl test se rompió:', e)
  process.exit(1)
})
