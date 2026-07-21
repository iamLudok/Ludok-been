import { useRef, useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, readSettings, updateSettings } from '../lib/db'
import type { Settings } from '../types'
import {
  shareOrDownloadBackup,
  importAll,
  daysSinceBackup,
  markBackupDone,
} from '../lib/backup'
import { isStoragePersisted, requestPersistentStorage } from '../lib/persistence'

type Msg = { kind: 'ok' | 'err'; text: string } | null

export default function SettingsPage() {
  const settings = useLiveQuery(() => readSettings(), [])
  const visitCount = useLiveQuery(() => db.visits.count(), [])
  const fileInput = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    void isStoragePersisted().then(setPersisted)
  }, [])

  if (!settings) return <p className="muted">Cargando…</p>

  const days = daysSinceBackup(settings.lastBackup)

  async function handleExport() {
    setMsg(null)
    try {
      await shareOrDownloadBackup()
      setMsg({ kind: 'ok', text: 'Copia generada.' })
    } catch {
      setMsg({ kind: 'err', text: 'No se pudo generar la copia.' })
    }
  }

  async function handleImportFile(file: File) {
    setMsg(null)
    try {
      const text = await file.text()
      const res = await importAll(text)
      await markBackupDone()
      setMsg({ kind: 'ok', text: `Importados ${res.visits} países.` })
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Error al importar.' })
    }
  }

  async function handleTheme(theme: Settings['theme']) {
    await updateSettings({ theme })
  }

  async function handleRequestPersist() {
    const ok = await requestPersistentStorage()
    setPersisted(ok)
  }

  return (
    <div>
      <h1>Ajustes</h1>

      <h2>Copia de seguridad</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          {days === null
            ? 'Aún no has hecho ninguna copia.'
            : days === 0
              ? 'Última copia: hoy.'
              : `Última copia hace ${days} día${days === 1 ? '' : 's'}.`}{' '}
          Tienes {visitCount ?? 0} países guardados.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn primary" onClick={handleExport}>
            ⬇️ Exportar copia
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            ⬆️ Importar copia
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleImportFile(f)
              e.target.value = ''
            }}
          />
        </div>
        {msg && (
          <p style={{ color: msg.kind === 'ok' ? 'var(--accent)' : 'var(--danger)', marginBottom: 0 }}>
            {msg.text}
          </p>
        )}
        <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
          Importar <b>reemplaza</b> los datos actuales. Guarda el fichero en un sitio seguro
          (Nextcloud, Drive, un USB…).
        </p>
      </div>

      <h2>Almacenamiento</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          Almacenamiento persistente:{' '}
          <b style={{ color: persisted ? 'var(--accent)' : 'var(--want)' }}>
            {persisted === null ? '—' : persisted ? 'activado ✅' : 'no garantizado ⚠️'}
          </b>
        </p>
        {persisted === false && (
          <button type="button" className="btn" onClick={handleRequestPersist}>
            Solicitar almacenamiento persistente
          </button>
        )}
        <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
          Cuando está activado, el navegador no borra tus datos para liberar espacio. Aun así,
          haz copias: es la única garantía real.
        </p>
      </div>

      <h2>Tema</h2>
      <div className="card">
        <div className="row">
          {(['system', 'dark', 'light'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={'btn' + (settings.theme === t ? ' primary' : '')}
              onClick={() => handleTheme(t)}
            >
              {t === 'system' ? 'Sistema' : t === 'dark' ? 'Oscuro' : 'Claro'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
