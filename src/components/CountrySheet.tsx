import { useEffect, useState } from 'react'
import { nameOf } from '../lib/countries'
import { setStatus, clearStatus } from '../lib/library'
import type { CountryStatus, Visit } from '../types'

interface Props {
  code: string
  current?: Visit
  onClose: () => void
}

/** Hoja inferior con las acciones para un país (marcar estado, año, quitar). */
export default function CountrySheet({ code, current, onClose }: Props) {
  const [year, setYear] = useState<string>(current?.year ? String(current.year) : '')

  useEffect(() => {
    setYear(current?.year ? String(current.year) : '')
  }, [current?.year, code])

  const parsedYear = () => {
    const n = parseInt(year, 10)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }

  async function choose(status: CountryStatus) {
    await setStatus(code, status, parsedYear())
    onClose()
  }

  async function remove() {
    await clearStatus(code)
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 style={{ marginTop: 0 }}>{nameOf(code)}</h2>

        <label className="row" style={{ marginBottom: 12 }}>
          <span className="muted">Año (opcional)</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="p.ej. 2023"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={{
              marginLeft: 'auto',
              width: 110,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
            }}
          />
        </label>

        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className={'btn' + (current?.status === 'been' ? ' primary' : '')}
            onClick={() => choose('been')}
          >
            ✅ Visitado
          </button>
          <button
            type="button"
            className={'btn' + (current?.status === 'want' ? ' want' : '')}
            onClick={() => choose('want')}
          >
            ⭐ Quiero ir
          </button>
          {current && (
            <button type="button" className="btn danger" onClick={remove}>
              🗑️ Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
