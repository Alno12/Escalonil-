import { useEffect, useState } from 'react'

type Phase = 'closed' | 'opening' | 'open' | 'closing'

/**
 * Mantém o elemento montado durante a animação de saída.
 * Sem isso, fechar uma folha ou diálogo seria um corte seco.
 *
 * `visible` só fica true um frame depois de montar, para que o navegador
 * tenha um estado inicial de onde animar.
 */
export function useMountTransition(open: boolean, duration = 220) {
  const [phase, setPhase] = useState<Phase>(open ? 'opening' : 'closed')
  const [lastOpen, setLastOpen] = useState(open)

  // Ajuste de estado durante a renderização — reage à mudança de `open`
  // sem passar por um efeito.
  if (open !== lastOpen) {
    setLastOpen(open)
    setPhase(open ? 'opening' : 'closing')
  }

  useEffect(() => {
    if (phase === 'opening') {
      // O `raf` pode chegar DEPOIS de `open` já ter virado false — um diálogo
      // que abre e fecha no mesmo quadro. Sem conferir a fase aqui, ele
      // devolvia 'open' por cima de 'closing' e o elemento ficava na tela
      // para sempre: nada mais mexe na fase 'open'.
      const raf = requestAnimationFrame(() => setPhase((p) => (p === 'opening' ? 'open' : p)))
      return () => cancelAnimationFrame(raf)
    }
    if (phase === 'closing') {
      const timer = window.setTimeout(() => setPhase('closed'), duration)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [phase, duration])

  return { mounted: phase !== 'closed', visible: phase === 'open' }
}
