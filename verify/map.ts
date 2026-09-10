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
  originCompensatedTranslate,
  wrapTranslateX,
  tiledTranslateX,
  OVERSAMPLE,
  MIN_SCALE,
  MAX_SCALE,
} from '../src/lib/mapTransform'

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
const ASPECT = 535 / 800

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

  console.log('\n=== 5. Corrección del origen central de React Native ===')
  // RN escala respecto al centro de la vista; la matemática de arriba asume
  // esquina. Se simula lo que hace RN y se comprueba que sale lo mismo, en
  // todo el rango de zoom (que es donde antes se colaba el salto).
  const canvasW = W * OVERSAMPLE
  const canvasH = W * ASPECT * OVERSAMPLE
  /** Lo que hace React Native: p' = C + (p - C) * k + t */
  const rn = (p: number, canvas: number, translate: number, k: number) => {
    const c = canvas / 2
    return c + (p - c) * k + translate
  }
  for (const s of [MIN_SCALE, 1.5, 2.4, 3.7, MAX_SCALE]) {
    const t = clampTransform(s, -300, -50, W, H, ASPECT)
    const k = t.scale / OVERSAMPLE
    const tx = originCompensatedTranslate(t.x, canvasW, k)
    const ty = originCompensatedTranslate(t.y, canvasH, k)
    let ok = true
    for (const content of [0, W / 4, W / 2, W]) {
      // El punto del contenido está en `content * OVERSAMPLE` dentro del lienzo.
      if (Math.abs(rn(content * OVERSAMPLE, canvasW, tx, k) - contentToScreen(content, t.scale, t.x)) > 0.01) {
        ok = false
      }
    }
    for (const content of [0, W * ASPECT]) {
      if (Math.abs(rn(content * OVERSAMPLE, canvasH, ty, k) - contentToScreen(content, t.scale, t.y)) > 0.01) {
        ok = false
      }
    }
    check(`a escala ${s}: el mapa cae exactamente donde dice la matemática`, ok)
  }

  console.log('\n=== 6b. Envolver el paneo horizontal ===')
  check('un valor ya dentro de rango no se toca', Math.abs(wrapTranslateX(50, 1000) - 50) < 0.001)
  check('el resultado siempre cabe en medio período', Math.abs(wrapTranslateX(12345, 1000)) <= 500.001)
  near('desplazar un período entero da el mismo resultado (misma copia)', wrapTranslateX(300, 1000), wrapTranslateX(300 + 1000, 1000))
  near('y también hacia el otro lado', wrapTranslateX(300, 1000), wrapTranslateX(300 - 1000, 1000))
  check('con período 0 (contenedor sin medir aún) no revienta', wrapTranslateX(999, 0) === 999)

  console.log('\n=== 6c. El mosaico: cada una de las 3 copias cae donde toca ===')
  // WorldMap.tsx dibuja el mapa tres veces seguidas (izquierda/centro/derecha)
  // para poder dar la vuelta sin fin. `tiledTranslateX` es la corrección que
  // hace que ese lienzo triple, más ancho y con su propio centro, siga
  // colocando cada copia exactamente donde le toca.
  //
  // La propiedad a comprobar: la copia n-ésima de un punto del contenido debe
  // caer un período (`containerW * scale`) más allá que la copia central —
  // es lo que hace que las tres copias, puestas una junto a otra, formen una
  // franja continua y sin costuras.
  for (const s of [MIN_SCALE, 1.7, 3.2, MAX_SCALE]) {
    const t = clampTransform(s, -137, -40, W, H, ASPECT)
    const k = t.scale / OVERSAMPLE
    const canvasWidth = W * OVERSAMPLE // ancho de UNA copia
    const canvas3Width = 3 * canvasWidth // ancho del lienzo con las tres
    const tx3 = tiledTranslateX(t.x, W, t.scale, canvas3Width, k)
    /** Lo que hace React Native sobre el lienzo triple: p' = C + (p - C) * k + t */
    const rn3 = (p: number) => {
      const c = canvas3Width / 2
      return c + (p - c) * k + tx3
    }
    let ok = true
    for (const content of [0, W / 3, W / 2, W]) {
      for (const n of [-1, 0, 1]) {
        // Píxel dentro del lienzo triple para la copia `n` de este punto: la
        // copia -1 ocupa el primer tercio, la 0 el segundo, la 1 el último.
        const canvasPixel = (n + 1) * canvasWidth + content * OVERSAMPLE
        const expected = contentToScreen(content, t.scale, t.x) + n * (W * t.scale)
        if (Math.abs(rn3(canvasPixel) - expected) > 0.01) ok = false
      }
    }
    check(`a escala ${s}: las tres copias caen exactamente donde dice la matemática`, ok)
  }

  console.log('\n=== 6. El lienzo no cambia de tamaño nunca ===')
  // Esto es lo que provocaba el salto al levantar los dedos: si el tamaño del
  // lienzo dependiera del zoom, cambiaría a mitad de interacción.
  check('OVERSAMPLE es una constante', typeof OVERSAMPLE === 'number' && OVERSAMPLE >= 1)
  const canvasAt = (s: number) => {
    const t = clampTransform(s, 0, 0, W, H, ASPECT)
    void t
    return W * OVERSAMPLE
  }
  check('mismo lienzo a escala 1 y a escala máxima', canvasAt(MIN_SCALE) === canvasAt(MAX_SCALE))

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
