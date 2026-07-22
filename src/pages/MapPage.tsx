import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import WorldMap from '../components/WorldMap'
import CountrySheet from '../components/CountrySheet'
import type { CountryStatus } from '../types'

export default function MapPage() {
  const visits = useLiveQuery(() => db.visits.toArray(), [], [])
  const [selected, setSelected] = useState<string | null>(null)

  const statusByCode = new Map<string, CountryStatus>(visits.map((v) => [v.code, v.status]))
  const current = selected ? visits.find((v) => v.code === selected) : undefined

  return (
    <div className="map-page">
      <div className="map-canvas">
        <WorldMap statusByCode={statusByCode} onSelect={setSelected} selected={selected} />
        <div className="map-hint">Toca un país para marcarlo · usa Lista para islas pequeñas</div>
      </div>

      {selected && (
        <CountrySheet code={selected} current={current} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
