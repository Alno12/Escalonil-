import { useEffect } from 'react'

/**
 * Impede o fundo de rolar enquanto uma folha ou diálogo está aberto.
 *
 * A contagem é COMPARTILHADA por todos que travam ao mesmo tempo. Com cada
 * instância guardando e repondo o estilo por conta própria, o app inteiro
 * ficava sem rolagem: a folha do plantão trava, o diálogo de excluir trava por
 * cima, os dois fecham juntos e o último a soltar repõe o estado errado. Só
 * recarregando a página destravava.
 */
let locks = 0
let release: (() => void) | null = null

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    if (locks === 0) release = lockBody()
    locks += 1

    return () => {
      locks -= 1
      if (locks === 0) {
        release?.()
        release = null
      }
    }
  }, [active])
}

/**
 * Trava o documento e devolve como destravar.
 *
 * `overflow: hidden` no body basta no computador, mas NÃO no iPhone: lá o dedo
 * continua rolando a página por baixo da folha, e com a folha baixinha — a de
 * compartilhar, a de filtros — o fundo inteiro fica à vista se mexendo. O que
 * segura de verdade é tirar o body do fluxo com `position: fixed`.
 *
 * O `top` negativo é o que mantém a tela EXATAMENTE onde estava: sem ele, o
 * body fixado volta ao topo e a página salta no instante em que a folha abre.
 * Ao soltar, o `scrollTo` repõe a posição na mesma tarefa, antes de o navegador
 * pintar de novo — separado por um quadro, a tela pisca no topo.
 */
function lockBody(): () => void {
  const { body } = document
  const y = window.scrollY
  const before = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    overflow: body.style.overflow,
  }

  body.style.position = 'fixed'
  body.style.top = `-${y}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.overflow = 'hidden'

  return () => {
    Object.assign(body.style, before)
    window.scrollTo(0, y)
  }
}
