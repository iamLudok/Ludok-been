import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/mapa', ico: '🗺️', label: 'Mapa' },
  { to: '/lista', ico: '📋', label: 'Lista' },
  { to: '/stats', ico: '📊', label: 'Stats' },
  { to: '/ajustes', ico: '⚙️', label: 'Ajustes' },
]

export default function NavBar() {
  return (
    <nav className="nav">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to}>
          <span className="ico">{t.ico}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
