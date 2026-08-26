import { useRef, type ChangeEvent } from 'react'
import { maskMoneyInput } from '@/domain/money'

/**
 * O cursor mora no fim do campo, como numa calculadora: dígito entra pela
 * direita, apagar tira da direita. Tocar no meio de "1.200,00" e digitar não
 * conserta um algarismo no lugar — insere um dígito ali e embaralha o valor.
 * Nenhum app de banco deixa fazer isso, e por bom motivo.
 *
 * Uma seleção de verdade (selecionar tudo para substituir) é respeitada.
 */
function caretToEnd(el: HTMLInputElement) {
  if (el.selectionStart !== el.selectionEnd) return
  el.setSelectionRange(el.value.length, el.value.length)
}

/**
 * Liga um `<input>` à máscara de dinheiro brasileira.
 *
 * Quando a máscara devolve o MESMO texto (o usuário colou uma letra, por
 * exemplo), o estado não muda, o React não re-renderiza e o caractere inválido
 * ficaria no DOM. Por isso o valor é reescrito na mão.
 */
export function useMoneyMask(onChange: (masked: string) => void) {
  const ref = useRef<HTMLInputElement>(null)

  const snap = () => {
    requestAnimationFrame(() => {
      const el = ref.current
      if (el && document.activeElement === el) caretToEnd(el)
    })
  }

  return {
    ref,
    type: 'text' as const,
    inputMode: 'numeric' as const,
    autoComplete: 'off',
    onFocus: snap,
    onClick: snap,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const masked = maskMoneyInput(event.target.value)
      onChange(masked)
      requestAnimationFrame(() => {
        const el = ref.current
        if (!el) return
        if (el.value !== masked) el.value = masked
        if (document.activeElement === el) caretToEnd(el)
      })
    },
  }
}
