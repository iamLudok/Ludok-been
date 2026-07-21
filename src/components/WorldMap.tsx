import { useMemo } from 'react'
import { svgPaths, MAP_WIDTH, MAP_HEIGHT } from '../lib/geo'
import type { CountryStatus } from '../types'

interface Props {
  /** estado actual por país (cca3 → estado). */
  statusByCode: Map<string, CountryStatus>
  onSelect?: (cca3: string) => void
  selected?: string | null
}

function fillFor(status: CountryStatus | undefined): string {
  if (status === 'been') return 'var(--accent)'
  if (status === 'want') return 'var(--want)'
  return 'var(--map-empty)'
}

export default function WorldMap({ statusByCode, onSelect, selected }: Props) {
  const paths = useMemo(() => svgPaths(), [])

  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      width="100%"
      role="img"
      aria-label="Mapa mundial"
      style={{ display: 'block', touchAction: 'manipulation' }}
    >
      {paths.map((p, i) => {
        const status = p.cca3 ? statusByCode.get(p.cca3) : undefined
        const isSelected = p.cca3 != null && p.cca3 === selected
        const clickable = p.cca3 != null && onSelect
        return (
          <path
            key={p.cca3 ?? `x${i}`}
            d={p.d}
            fill={fillFor(status)}
            stroke={isSelected ? 'var(--text)' : 'var(--map-stroke)'}
            strokeWidth={isSelected ? 1.4 : 0.4}
            style={{ cursor: clickable ? 'pointer' : 'default' }}
            onClick={clickable ? () => onSelect!(p.cca3!) : undefined}
          >
            <title>{p.name}</title>
          </path>
        )
      })}
    </svg>
  )
}
