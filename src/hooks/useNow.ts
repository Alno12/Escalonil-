import { useEffect, useMemo, useState } from 'react'

/**
 * Relógio compartilhado do app.
 * As situações ("em andamento", "atrasado") dependem da hora atual, então
 * a interface precisa acompanhar o tempo. Atualiza no máximo uma vez por
 * minuto — e imediatamente quando o app volta ao primeiro plano, que é o
 * caso comum no iPhone.
 */
export function useNow(): Date {
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000))

  useEffect(() => {
    const sync = () => {
      const current = Math.floor(Date.now() / 60_000)
      setMinute((prev) => (prev === current ? prev : current))
    }
    const id = window.setInterval(sync, 20_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', sync)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', sync)
    }
  }, [])

  return useMemo(() => new Date(minute * 60_000), [minute])
}
