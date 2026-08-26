import { NavLink } from 'react-router-dom'
import { TabIcon, type TabIconName } from './tabIcons'

const TABS: { to: string; label: string; icon: TabIconName }[] = [
  { to: '/', label: 'Início', icon: 'home' },
  { to: '/agenda', label: 'Agenda', icon: 'calendar' },
  { to: '/financeiro', label: 'Financeiro', icon: 'wallet' },
  { to: '/relatorios', label: 'Relatórios', icon: 'chart' },
  { to: '/ajustes', label: 'Ajustes', icon: 'settings' },
]

/**
 * Barra de abas no padrão do iOS: só navegação, sem botão de ação no meio.
 * Novo plantão vive no canto superior direito de cada tela.
 */
export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Navegação principal">
      <div className="tabbar__inner">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) => `tabbar__item ${isActive ? 'is-active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <TabIcon name={tab.icon} active={isActive} />
                <span>{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
