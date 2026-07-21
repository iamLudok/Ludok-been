import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, readSettings } from '../lib/db'
import { daysSinceBackup } from '../lib/backup'

// Umbral de días sin copia a partir del cual avisamos.
const WARN_AFTER_DAYS = 7

export default function BackupBanner() {
  const navigate = useNavigate()
  const settings = useLiveQuery(() => readSettings(), [])
  const visitCount = useLiveQuery(() => db.visits.count(), [])

  if (!settings || !visitCount) return null

  const days = daysSinceBackup(settings.lastBackup)
  const never = days === null
  if (!never && days < WARN_AFTER_DAYS) return null

  const text = never
    ? 'Aún no has hecho ninguna copia de seguridad.'
    : `Llevas ${days} días sin hacer copia.`

  return (
    <div className="backup-banner" role="status">
      <span>⚠️ {text}</span>
      <button type="button" className="btn primary" onClick={() => navigate('/ajustes')}>
        Hacer copia
      </button>
    </div>
  )
}
