import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from '@/components/ui/Icon'
import { useShiftSheets } from '@/state/shiftSheetsContext'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Início', icon: 'home' },
  { to: '/agenda', label: 'Agenda', icon: 'calendar' },
  { to: '/financeiro', label: 'Financeiro', icon: 'wallet' },
  { to: '/relatorios', label: 'Relatórios', icon: 'chart' },
]

/**
 * Navegação principal fixa no rodapé, com o botão de novo plantão no centro —
 * a posição mais fácil de alcançar com o polegar no iPhone (§46).
 */
export function TabBar() {
  const sheets = useShiftSheets()
  const [first, second, third, fourth] = TABS

  return (
    <nav className="tabbar" aria-label="Navegação principal">
      <div className="tabbar__inner">
        <TabItem tab={first} />
        <TabItem tab={second} />

        <button
          type="button"
          className="tabbar__fab"
          onClick={() => sheets.newShift()}
          aria-label="Novo plantão"
        >
          <Icon name="plus" size={24} strokeWidth={2.1} />
        </button>

        <TabItem tab={third} />
        <TabItem tab={fourth} />
      </div>
    </nav>
  )
}

function TabItem({ tab }: { tab: (typeof TABS)[number] }) {
  return (
    <NavLink
      to={tab.to}
      end={tab.to === '/'}
      className={({ isActive }) => `tabbar__item ${isActive ? 'is-active' : ''}`}
    >
      <Icon name={tab.icon} size={22} />
      <span>{tab.label}</span>
    </NavLink>
  )
}
