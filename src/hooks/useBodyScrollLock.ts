import { useEffect } from 'react'

/** Impede o fundo de rolar enquanto uma folha ou diálogo está aberto. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [active])
}
