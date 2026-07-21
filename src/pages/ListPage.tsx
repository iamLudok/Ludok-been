import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { COUNTRIES } from '../lib/countries'
import CountrySheet from '../components/CountrySheet'
import type { Country, Visit } from '../types'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const STATUS_ICON = { been: '✅', want: '⭐' } as const

export default function ListPage() {
  const visits = useLiveQuery(() => db.visits.toArray(), [], [])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const visitByCode = useMemo(
    () => new Map<string, Visit>(visits.map((v) => [v.code, v])),
    [visits],
  )

  const groups = useMemo(() => {
    const q = normalize(query.trim())
    const filtered = q
      ? COUNTRIES.filter((c) => normalize(c.name).includes(q))
      : COUNTRIES
    const byContinent = new Map<string, Country[]>()
    for (const c of filtered) {
      const arr = byContinent.get(c.continent) ?? []
      arr.push(c)
      byContinent.set(c.continent, arr)
    }
    return [...byContinent.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [query])

  const current = selected ? visitByCode.get(selected) : undefined

  return (
    <div>
      <h1>Lista</h1>
      <input
        type="search"
        placeholder="Buscar país…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          marginBottom: 12,
        }}
      />

      {groups.map(([continent, list]) => (
        <div key={continent}>
          <h2>{continent}</h2>
          <div className="card" style={{ padding: 0 }}>
            {list.map((c, i) => {
              const v = visitByCode.get(c.cca3)
              return (
                <button
                  key={c.cca3}
                  type="button"
                  className="list-row"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
                  onClick={() => setSelected(c.cca3)}
                >
                  <span>{c.name}</span>
                  <span className="row" style={{ gap: 8 }}>
                    {v?.year ? <span className="muted">{v.year}</span> : null}
                    {v ? <span>{STATUS_ICON[v.status]}</span> : <span className="muted">＋</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {selected && (
        <CountrySheet code={selected} current={current} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
