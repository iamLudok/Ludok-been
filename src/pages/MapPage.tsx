import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { computeStats } from '../lib/library'
import WorldMap from '../components/WorldMap'
import CountrySheet from '../components/CountrySheet'
import type { CountryStatus } from '../types'

export default function MapPage() {
  const visits = useLiveQuery(() => db.visits.toArray(), [], [])
  const [selected, setSelected] = useState<string | null>(null)

  const statusByCode = new Map<string, CountryStatus>(visits.map((v) => [v.code, v.status]))
  const stats = computeStats(visits)
  const current = selected ? visits.find((v) => v.code === selected) : undefined

  return (
    <div>
      <h1>Mapa</h1>
      <div className="row" style={{ gap: 16, marginBottom: 8 }}>
        <span>
          <b style={{ color: 'var(--accent)' }}>{stats.been}</b> visitados
        </span>
        <span>
          <b style={{ color: 'var(--want)' }}>{stats.want}</b> por ir
        </span>
        <span className="muted">{stats.percent}% del mundo</span>
      </div>

      <div className="card" style={{ padding: 6 }}>
        <WorldMap statusByCode={statusByCode} onSelect={setSelected} selected={selected} />
      </div>
      <p className="muted" style={{ fontSize: '0.8rem' }}>
        Toca un país para marcarlo. Para islas pequeñas o precisión, usa la pestaña Lista.
      </p>

      {selected && (
        <CountrySheet code={selected} current={current} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
