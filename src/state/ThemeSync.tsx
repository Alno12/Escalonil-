import { useEffect } from 'react'
import { useAppData } from './appDataContext'

export const THEME_STORAGE_KEY = 'escalonil:theme'

const BACKGROUNDS = { light: '#F4F5F8', dark: '#0B0F14' }

/**
 * Aplica o tema escolhido no documento.
 * Também espelha a escolha no localStorage porque o `index.html` precisa dela
 * ANTES do React carregar — é o que evita o "flash" de tema errado.
 */
export function ThemeSync() {
  const { settings } = useAppData()
  const preference = settings.theme

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const dark = preference === 'dark' || (preference === 'system' && media.matches)
      const theme = dark ? 'dark' : 'light'
      document.documentElement.dataset.theme = theme
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', BACKGROUNDS[theme])
    }

    apply()
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference)
    } catch {
      // Modo privado do Safari pode bloquear — o tema segue funcionando na sessão.
    }

    if (preference !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])

  return null
}
