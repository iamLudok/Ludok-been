import { useCallback, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { svgPaths, MAP_WIDTH, MAP_HEIGHT } from '../lib/geo'
import type { CountryStatus } from '../types'

interface Props {
  /** estado actual por país (cca3 → estado). */
  statusByCode: Map<string, CountryStatus>
  onSelect?: (cca3: string) => void
  selected?: string | null
}

interface Transform {
  scale: number
  x: number
  y: number
}

interface Gesture {
  mode: 'none' | 'pan' | 'pinch'
  startX: number
  startY: number
  startMid: { x: number; y: number }
  startDist: number
  startScale: number
  moved: boolean
  multi: boolean
  tapTarget?: string
}

const MIN_SCALE = 1
const MAX_SCALE = 8
const TAP_THRESHOLD = 4

const idleGesture: Gesture = {
  mode: 'none',
  startX: 0,
  startY: 0,
  startMid: { x: 0, y: 0 },
  startDist: 0,
  startScale: 1,
  moved: false,
  multi: false,
}

function fillFor(status: CountryStatus | undefined): string {
  if (status === 'been') return 'var(--accent)'
  if (status === 'want') return 'var(--want)'
  return 'var(--map-empty)'
}

export default function WorldMap({ statusByCode, onSelect, selected }: Props) {
  const paths = useMemo(() => svgPaths(), [])
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 })
  const transformRef = useRef(transform)
  transformRef.current = transform

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture>(idleGesture)

  const clamp = useCallback((t: Transform): Transform => {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale))
    const el = containerRef.current
    if (!el) return { ...t, scale }
    const rect = el.getBoundingClientRect()
    const w = rect.width * scale
    const h = rect.height * scale
    const minX = Math.min(0, rect.width - w)
    const minY = Math.min(0, rect.height - h)
    return {
      scale,
      x: Math.min(0, Math.max(minX, t.x)),
      y: Math.min(0, Math.max(minY, t.y)),
    }
  }, [])

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const t = transformRef.current

    if (pointers.current.size === 1) {
      const target = e.target as SVGElement
      gesture.current = {
        mode: 'pan',
        startX: t.x,
        startY: t.y,
        startMid: { x: e.clientX, y: e.clientY },
        startDist: 0,
        startScale: t.scale,
        moved: false,
        multi: false,
        tapTarget: target.dataset?.cca3,
      }
    } else if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      gesture.current = {
        mode: 'pinch',
        startX: t.x,
        startY: t.y,
        startMid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        startDist: dist,
        startScale: t.scale,
        moved: true,
        multi: true,
      }
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const el = containerRef.current
    if (!el) return

    if (g.mode === 'pan') {
      const dx = e.clientX - g.startMid.x
      const dy = e.clientY - g.startMid.y
      if (!g.moved && Math.hypot(dx, dy) > TAP_THRESHOLD) g.moved = true
      if (!g.moved) return
      setTransform(clamp({ scale: g.startScale, x: g.startX + dx, y: g.startY + dy }))
    } else if (g.mode === 'pinch' && pointers.current.size === 2) {
      const rect = el.getBoundingClientRect()
      const pts = Array.from(pointers.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.startScale * (dist / g.startDist)))
      const c0x = (g.startMid.x - rect.left - g.startX) / g.startScale
      const c0y = (g.startMid.y - rect.top - g.startY) / g.startScale
      setTransform(
        clamp({
          scale,
          x: mid.x - rect.left - c0x * scale,
          y: mid.y - rect.top - c0y * scale,
        }),
      )
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current
    pointers.current.delete(e.pointerId)

    if (pointers.current.size === 0) {
      if (g.mode === 'pan' && !g.moved && !g.multi && g.tapTarget && onSelect) {
        onSelect(g.tapTarget)
      }
      gesture.current = idleGesture
    } else if (pointers.current.size === 1) {
      const [remaining] = Array.from(pointers.current.values())
      gesture.current = {
        ...idleGesture,
        mode: 'pan',
        startX: transformRef.current.x,
        startY: transformRef.current.y,
        startMid: { x: remaining.x, y: remaining.y },
        startScale: transformRef.current.scale,
        moved: true,
        multi: true,
      }
    }
  }

  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    e.preventDefault()
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const t = transformRef.current
    const factor = Math.exp(-e.deltaY * 0.0015)
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * factor))
    const cx = (e.clientX - rect.left - t.x) / t.scale
    const cy = (e.clientY - rect.top - t.y) / t.scale
    setTransform(
      clamp({
        scale,
        x: e.clientX - rect.left - cx * scale,
        y: e.clientY - rect.top - cy * scale,
      }),
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Mapa mundial"
        style={{
          display: 'block',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {paths.map((p, i) => {
          const status = p.cca3 ? statusByCode.get(p.cca3) : undefined
          const isSelected = p.cca3 != null && p.cca3 === selected
          return (
            <path
              key={p.cca3 ?? `x${i}`}
              d={p.d}
              data-cca3={p.cca3 ?? undefined}
              fill={fillFor(status)}
              stroke={isSelected ? 'var(--text)' : 'var(--map-stroke)'}
              strokeWidth={(isSelected ? 1.4 : 0.4) / transform.scale}
              style={{ cursor: p.cca3 && onSelect ? 'pointer' : 'default' }}
            >
              <title>{p.name}</title>
            </path>
          )
        })}
      </svg>
    </div>
  )
}
