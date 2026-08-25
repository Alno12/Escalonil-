import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppDataProvider } from '@/state/AppDataProvider'
import { ShiftSheetsProvider } from '@/state/ShiftSheetsProvider'
import { ToastProvider } from '@/state/ToastProvider'
import { ThemeSync } from '@/state/ThemeSync'
import { AppShell } from '@/layout/AppShell'
import { Home } from '@/screens/Home'
import { Schedule } from '@/screens/Schedule'
import { Finance } from '@/screens/Finance'
import { Reports } from '@/screens/Reports'
import { Settings } from '@/screens/Settings'

/**
 * Rotas em hash (#/agenda). É o formato que funciona sem configuração de
 * servidor no GitHub Pages, inclusive publicado em uma subrota.
 */
export function App() {
  return (
    <AppDataProvider>
      <ThemeSync />
      <ToastProvider>
        <HashRouter>
          <ShiftSheetsProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Home />} />
                <Route path="/agenda" element={<Schedule />} />
                <Route path="/financeiro" element={<Finance />} />
                <Route path="/relatorios" element={<Reports />} />
                <Route path="/configuracoes" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </ShiftSheetsProvider>
        </HashRouter>
      </ToastProvider>
    </AppDataProvider>
  )
}
