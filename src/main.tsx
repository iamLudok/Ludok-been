import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { requestPersistentStorage } from './lib/persistence'
import { ensureSettings } from './lib/db'

// Primera línea de defensa contra la pérdida de datos: pedir almacenamiento persistente.
void requestPersistentStorage()
// Crear los ajustes por defecto una sola vez (fuera de cualquier liveQuery).
void ensureSettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
