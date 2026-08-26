import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TabBar } from './TabBar'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { WhatsNew } from '@/components/WhatsNew'

export function AppShell() {
  const { pathname } = useLocation()

  // Cada tela começa do topo — trocar de aba não herda a rolagem da anterior.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      {/* A key reinicia a animação de entrada a cada troca de tela. */}
      <main className="app__main" key={pathname}>
        <Outlet />
      </main>
      <TabBar />
      <UpdatePrompt />
      <WhatsNew />
    </div>
  )
}
