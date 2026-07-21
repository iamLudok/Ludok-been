import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { computeStats } from '../lib/library'
import { shareStatsImage } from '../lib/share'

export default function StatsPage() {
  const visits = useLiveQuery(() => db.visits.toArray(), [], [])
  const [sharing, setSharing] = useState(false)
  const stats = computeStats(visits)

  async function handleShare() {
    setSharing(true)
    try {
      const statusByCode = new Map(visits.map((v) => [v.code, v.status]))
      await shareStatsImage(stats, statusByCode)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div>
      <h1>Estadísticas</h1>

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--accent)' }}>
          {stats.percent}%
        </div>
        <div className="muted">del mundo visitado</div>
        <div className="row" style={{ justifyContent: 'center', gap: 20, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.been}</div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              de {stats.worldTotal} países
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--want)' }}>
              {stats.want}
            </div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              por visitar
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.continentsVisited}</div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              continentes
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn primary"
        style={{ width: '100%', marginTop: 12 }}
        onClick={handleShare}
        disabled={sharing}
      >
        {sharing ? 'Generando…' : '📸 Compartir imagen'}
      </button>

      <h2>Por continente</h2>
      {stats.byContinent.map((c) => {
        const pct = c.total ? Math.round((c.been / c.total) * 100) : 0
        return (
          <div key={c.continent} style={{ marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{c.continent}</span>
              <span className="muted">
                {c.been}/{c.total} · {pct}%
              </span>
            </div>
            <div className="bar">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
