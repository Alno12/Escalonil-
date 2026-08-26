import { useEffect } from 'react'

/**
 * Impede o fundo de rolar enquanto uma folha ou diálogo está aberto.
 *
 * A contagem é COMPARTILHADA por todos que travam ao mesmo tempo. Com cada
 * instância guardando e repondo o `overflow` por conta própria, o app inteiro
 * ficava sem rolagem: a folha do plantão trava (e guarda ""), o diálogo de
 * excluir trava por cima (e guarda "hidden"), os dois fecham juntos e o último
 * a soltar repõe o "hidden". Só recarregando a página destravava.
 */
let locks = 0
let restoreTo = ''

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    if (locks === 0) {
      restoreTo = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    locks += 1

    return () => {
      locks -= 1
      if (locks === 0) document.body.style.overflow = restoreTo
    }
  }, [active])
}
