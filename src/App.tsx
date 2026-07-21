import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { readSettings } from './lib/db'
import NavBar from './components/NavBar'
import BackupBanner from './components/BackupBanner'
import MapPage from './pages/MapPage'
import ListPage from './pages/ListPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'

function applyTheme(theme: 'dark' | 'light' | 'system') {
  const root = document.documentElement
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : theme
  root.setAttribute('data-theme', resolved)
}

function App() {
  const settings = useLiveQuery(() => readSettings(), [])

  useEffect(() => {
    if (settings) applyTheme(settings.theme)
  }, [settings])

  return (
    <>
      <main className="app-main">
        <BackupBanner />
        <Routes>
          <Route path="/" element={<Navigate to="/mapa" replace />} />
          <Route path="/mapa" element={<MapPage />} />
          <Route path="/lista" element={<ListPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/mapa" replace />} />
        </Routes>
      </main>
      <NavBar />
    </>
  )
}

export default App
