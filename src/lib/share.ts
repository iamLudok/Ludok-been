// Genera una imagen para compartir (mapa coloreado + % del mundo) dibujando en
// un <canvas>. Reutiliza la misma proyección que el mapa SVG (lib/geo).
import { geoPath } from 'd3-geo'
import { MAP_COUNTRIES, makeProjection } from './geo'
import type { Stats } from './library'
import type { CountryStatus } from '../types'

const W = 1080
const MAP_H = 560
const H = 1080

const COLORS = {
  bg: '#0f172a',
  panel: '#1e293b',
  empty: '#273449',
  stroke: '#0f172a',
  been: '#22c55e',
  want: '#f59e0b',
  text: '#e2e8f0',
  muted: '#94a3b8',
}

/** Dibuja la tarjeta y devuelve un Blob PNG. */
export async function renderStatsImage(
  stats: Stats,
  statusByCode: Map<string, CountryStatus>,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, W, H)

  // Mapa proyectado al ancho del lienzo.
  const projection = makeProjection(W - 80, MAP_H - 80)
  projection.translate([W / 2, 120 + (MAP_H - 80) / 2])
  const path = geoPath(projection, ctx)

  for (const c of MAP_COUNTRIES) {
    const status = c.cca3 ? statusByCode.get(c.cca3) : undefined
    ctx.beginPath()
    path(c.feature)
    ctx.fillStyle = status === 'been' ? COLORS.been : status === 'want' ? COLORS.want : COLORS.empty
    ctx.fill()
    ctx.lineWidth = 0.6
    ctx.strokeStyle = COLORS.stroke
    ctx.stroke()
  }

  // Bloque de texto inferior.
  ctx.textAlign = 'center'
  ctx.fillStyle = COLORS.been
  ctx.font = '800 220px system-ui, sans-serif'
  ctx.fillText(`${stats.percent}%`, W / 2, 850)

  ctx.fillStyle = COLORS.text
  ctx.font = '600 46px system-ui, sans-serif'
  ctx.fillText('del mundo visitado', W / 2, 910)

  ctx.fillStyle = COLORS.muted
  ctx.font = '400 40px system-ui, sans-serif'
  ctx.fillText(
    `${stats.been} de ${stats.worldTotal} países · ${stats.continentsVisited} continentes`,
    W / 2,
    968,
  )

  ctx.fillStyle = COLORS.muted
  ctx.font = '600 34px system-ui, sans-serif'
  ctx.fillText('Ludok Been', W / 2, 1030)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png')
  })
}

/** Comparte (Web Share API) o descarga la imagen de estadísticas. */
export async function shareStatsImage(
  stats: Stats,
  statusByCode: Map<string, CountryStatus>,
): Promise<void> {
  const blob = await renderStatsImage(stats, statusByCode)
  const file = new File([blob], 'ludok-been.png', { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Mi mapa de Ludok Been' })
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ludok-been.png'
  a.click()
  URL.revokeObjectURL(url)
}
