import { useEffect, useRef } from 'react'

/**
 * Faz o gesto de voltar fechar a folha em vez de navegar por baixo dela.
 *
 * Folhas e diálogos não são rotas — são estado do React —, então o histórico
 * do navegador não os enxergava: deslizar da borda trocava a tela por baixo e
 * a folha ficava boiando sobre outra, com o corpo ainda travado.
 *
 * A conta é deliberadamente simples: existe **UMA** entrada de histórico
 * enquanto houver qualquer folha aberta, criada quando a primeira abre e
 * desfeita quando a última fecha. Voltar fecha a folha do topo e, se ainda
 * sobrar alguma embaixo, recria a entrada para o gesto seguinte.
 *
 * Uma entrada por folha seria o caminho óbvio e é uma armadilha: ao salvar um
 * plantão, a folha e o diálogo de confirmação fecham no mesmo instante, e a
 * ordem em que o React desmonta irmãos não é a ordem em que eles foram
 * abertos — o `history.back()` de cada um sairia trocado e o app navegaria
 * para telas erradas. Com uma entrada só, a ordem deixa de importar.
 */
interface Entry {
  close: () => void
}

const stack: Entry[] = []
/** Quantas voltas o próprio app pediu — essas não fecham nada. */
let selfPop = 0
let listening = false

const MARK = { escalonilSheet: true }

function onPop() {
  if (selfPop > 0) {
    selfPop -= 1
    return
  }
  const top = stack.pop()
  if (!top) return

  // Ainda há folha embaixo: o gesto seguinte precisa de entrada própria.
  if (stack.length > 0) window.history.pushState(MARK, '')
  top.close()
}

/**
 * O ouvinte entra na primeira folha e NUNCA sai.
 *
 * Tirar o ouvinte ao fechar a última folha parecia arrumação e era um bug: o
 * `history.back()` logo abaixo dispara um `popstate` que ninguém ouvia, então
 * o `selfPop` ficava para sempre em 1 e engolia o próximo gesto de verdade do
 * usuário. Com a pilha vazia o ouvinte não faz nada — pode ficar.
 */
function listen() {
  if (listening) return
  listening = true
  window.addEventListener('popstate', onPop)
}

function open(entry: Entry) {
  listen()
  stack.push(entry)
  if (stack.length === 1) window.history.pushState(MARK, '')
}

function close(entry: Entry) {
  const index = stack.indexOf(entry)
  // Já saiu pelo `onPop`: a entrada de histórico foi consumida pelo gesto.
  if (index === -1) return

  stack.splice(index, 1)
  if (stack.length === 0) {
    selfPop += 1
    window.history.back()
  }
}

export function useSheetHistory(isOpen: boolean, onDismiss: () => void) {
  // A folha pode fechar muitas vezes; o callback mais recente é o que vale.
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  })

  useEffect(() => {
    if (!isOpen) return
    const entry: Entry = { close: () => dismiss.current() }
    open(entry)
    return () => close(entry)
  }, [isOpen])
}
