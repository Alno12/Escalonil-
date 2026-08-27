import { useEffect, useRef, useState } from 'react'

/**
 * Prende o foco dentro da folha ou do diálogo aberto.
 *
 * Sem isso, o Tab passeava pelo app inteiro atrás do modal e o leitor de tela
 * lia a tela de baixo como se ela ainda estivesse valendo. Três coisas, então:
 * ao abrir o foco entra no modal, enquanto ele está aberto o Tab não sai de
 * dentro dele, e ao fechar o foco volta para o botão que o abriu.
 *
 * A PILHA é compartilhada, como as travas de rolagem: com uma folha e um
 * diálogo abertos ao mesmo tempo, só o de cima prende o foco — o de baixo fica
 * `inert`, que também é o que o tira do alcance do leitor de tela.
 */
const stack: HTMLElement[] = []

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Só o que está de fato na tela — botão dentro de seção escondida não conta. */
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  )
}

/**
 * Isola tudo que não é o modal do topo.
 *
 * O `inert` vai na CAMADA (`.sheet-root`), não no elemento com o `role`: o
 * fundo escuro que fecha no toque mora fora dele, e uma folha de baixo inteira
 * precisa sair do caminho, fundo incluído.
 */
function refreshInert() {
  const top = stack[stack.length - 1] ?? null
  const root = document.getElementById('root')
  if (root) root.inert = top !== null
  for (const el of stack) {
    const layer = el.closest<HTMLElement>('.sheet-root, .dialog-root')
    if (layer) layer.inert = el !== top
  }
}

/**
 * @param mounted enquanto o modal está no DOM (inclusive saindo).
 * @param ready só depois da animação de entrada — focar no meio dela faz o
 *   iPhone rolar a tela sozinho.
 */
export function useFocusTrap<T extends HTMLElement>(mounted: boolean, ready: boolean) {
  const ref = useRef<T>(null)
  /*
   * Quem abriu é lido durante o RENDER, antes do commit — o mesmo ajuste de
   * estado que o `useMountTransition` faz. Os diálogos trazem `autoFocus` no
   * botão principal e o React o aplica no commit: lido depois, "quem abriu"
   * seria o botão do próprio diálogo, que some junto com ele, e o foco
   * terminava no `body`.
   *
   * O valor inicial faz o mesmo pelas folhas, que NASCEM abertas: o provedor
   * só as monta quando o usuário pede, então nelas nunca há a virada de
   * `mounted` que o ajuste abaixo escuta.
   */
  const [opener, setOpener] = useState<HTMLElement | null>(() =>
    mounted && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )
  const [wasMounted, setWasMounted] = useState(mounted)

  if (mounted !== wasMounted) {
    setWasMounted(mounted)
    const active = document.activeElement
    setOpener(mounted && active instanceof HTMLElement ? active : null)
  }

  useEffect(() => {
    const el = ref.current
    if (!mounted || !el) return

    stack.push(el)
    refreshInert()

    return () => {
      const i = stack.indexOf(el)
      if (i >= 0) stack.splice(i, 1)
      refreshInert()

      // O `body` não recebe foco: é o que sobra quando o modal já nasceu
      // aberto, sem ninguém tendo clicado em nada.
      const back = opener
      if (!back || back === document.body || !back.isConnected) return
      // Trocar de folha desmonta uma e monta outra no mesmo commit (abrir o
      // recebimento FECHA o detalhe). Devolver o foco ali roubaria da folha
      // que acabou de abrir, então só devolve quem estava por baixo dela.
      const top = stack[stack.length - 1]
      if (top && !top.contains(back)) return
      back.focus({ preventScroll: true })
    }
  }, [mounted, opener])

  useEffect(() => {
    const el = ref.current
    if (!mounted || !ready || !el) return
    // Os diálogos já trazem `autoFocus` no botão principal; nesse caso o foco
    // já está dentro e mexer nele seria tirá-lo de onde o app quis pôr.
    if (el.contains(document.activeElement)) return
    const first = focusables(el)[0]
    if (first) first.focus({ preventScroll: true })
    else {
      el.tabIndex = -1
      el.focus({ preventScroll: true })
    }
  }, [mounted, ready])

  useEffect(() => {
    if (!mounted) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const el = ref.current
      // Quem prende é sempre o de cima: com o diálogo aberto sobre a folha, o
      // Tab é dele.
      if (!el || stack[stack.length - 1] !== el) return

      const items = focusables(el)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (!el.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [mounted])

  return ref
}
