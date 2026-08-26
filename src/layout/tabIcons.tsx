/**
 * Ícones da barra de abas.
 *
 * Vivem aqui, e não em `components/ui/Icon`, porque a barra é outra
 * superfície. O traço é de 2px e os cantos são bem mais redondos — o mesmo
 * desenho a 14px, no meio de uma linha de texto, ficaria borrado e pesado.
 * `calendar`, `wallet` e `chart` continuam existindo no conjunto geral, na
 * versão fina, e os dois nunca aparecem lado a lado no mesmo tamanho.
 *
 * A aba ATIVA usa a versão preenchida, como o iPhone faz em Saúde e Fotos.
 * Só trocar a cor não bastava: num relance a aba atual sumia no meio das
 * outras quatro.
 *
 * As barras de Relatórios são o caso difícil — cheias ou vazias ficam quase
 * iguais. Por isso a versão ativa é mais GROSSA (3,2px contra 2,6px), não
 * só "preenchida" — e a barra mais baixa subiu, senão preenchida virava
 * uma bolinha em vez de uma barra.
 */
import type { ReactNode } from 'react'

export type TabIconName = 'home' | 'calendar' | 'wallet' | 'chart' | 'settings'

const OUTLINE: Record<TabIconName, ReactNode> = {
  home: (
    <path d="M3.6 11.1a2 2 0 0 1 .75-1.56l6.4-5.1a2 2 0 0 1 2.5 0l6.4 5.1a2 2 0 0 1 .75 1.56V18a2.6 2.6 0 0 1-2.6 2.6H6.2A2.6 2.6 0 0 1 3.6 18Z" />
  ),
  calendar: (
    <path d="M4.4 9.1A2.7 2.7 0 0 1 7.1 6.4h9.8a2.7 2.7 0 0 1 2.7 2.7v8.2a2.7 2.7 0 0 1-2.7 2.7H7.1a2.7 2.7 0 0 1-2.7-2.7ZM8.6 4v3.6M15.4 4v3.6M4.4 11.4h15.2" />
  ),
  wallet: (
    <path d="M3.4 9.4a2.7 2.7 0 0 1 2.7-2.7h11.8a2.7 2.7 0 0 1 2.7 2.7v5.2a2.7 2.7 0 0 1-2.7 2.7H6.1a2.7 2.7 0 0 1-2.7-2.7ZM14.2 12a2.2 2.2 0 1 0-4.4 0 2.2 2.2 0 0 0 4.4 0M6.8 10.9v2.2M17.2 10.9v2.2" />
  ),
  chart: <path strokeWidth={2.6} d="M6.4 19.4v-6.4M12 19.4v-9.6M17.6 19.4V7.2" />,
  settings: (
    <path d="M4 8.4h4.6M13.4 8.4H20M13.4 8.4a2.4 2.4 0 1 0-4.8 0 2.4 2.4 0 1 0 4.8 0M4 15.6h2.6M11.4 15.6H20M11.4 15.6a2.4 2.4 0 1 0-4.8 0 2.4 2.4 0 1 0 4.8 0" />
  ),
}

const FILLED: Record<TabIconName, ReactNode> = {
  // A porta é um segundo contorno fechado; `evenodd` a transforma em recorte.
  home: (
    <path
      fillRule="evenodd"
      d="M3.6 11.1a2 2 0 0 1 .75-1.56l6.4-5.1a2 2 0 0 1 2.5 0l6.4 5.1a2 2 0 0 1 .75 1.56V18a2.6 2.6 0 0 1-2.6 2.6H6.2A2.6 2.6 0 0 1 3.6 18ZM9.7 20.6v-4a2.3 2.3 0 0 1 4.6 0v4Z"
    />
  ),
  // Três partes: os dois pinos, a faixa do cabeçalho e o corpo. A folga de
  // 1,1px entre faixa e corpo é a linha que o contorno desenha.
  calendar: (
    <>
      <path d="M8.6 3.6a1 1 0 0 1 1 1v2.9a1 1 0 1 1-2 0V4.6a1 1 0 0 1 1-1Z" />
      <path d="M15.4 3.6a1 1 0 0 1 1 1v2.9a1 1 0 1 1-2 0V4.6a1 1 0 0 1 1-1Z" />
      <path d="M4.4 9.1A2.7 2.7 0 0 1 7.1 6.4h9.8a2.7 2.7 0 0 1 2.7 2.7v1.8H4.4Z" />
      <path d="M4.4 12h15.2v5.9a2.7 2.7 0 0 1-2.7 2.7H7.1a2.7 2.7 0 0 1-2.7-2.7Z" />
    </>
  ),
  // Sem os dois traços laterais recortados, a cédula cheia vira um interruptor.
  wallet: (
    <path
      fillRule="evenodd"
      d="M3.4 9.4a2.7 2.7 0 0 1 2.7-2.7h11.8a2.7 2.7 0 0 1 2.7 2.7v5.2a2.7 2.7 0 0 1-2.7 2.7H6.1a2.7 2.7 0 0 1-2.7-2.7Zm8.6.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM6.8 10.05a.85.85 0 0 1 .85.85v2.2a.85.85 0 0 1-1.7 0v-2.2a.85.85 0 0 1 .85-.85Zm10.4 0a.85.85 0 0 1 .85.85v2.2a.85.85 0 0 1-1.7 0v-2.2a.85.85 0 0 1 .85-.85Z"
    />
  ),
  chart: (
    <>
      <path d="M4.8 14.6a1.6 1.6 0 0 1 3.2 0V17.8a1.6 1.6 0 0 1-3.2 0Z" />
      <path d="M10.4 11.4a1.6 1.6 0 0 1 3.2 0V17.8a1.6 1.6 0 0 1-3.2 0Z" />
      <path d="M16 8.8a1.6 1.6 0 0 1 3.2 0V17.8a1.6 1.6 0 0 1-3.2 0Z" />
    </>
  ),
  // Os botões preenchidos são o que muda; as hastes continuam sendo traço.
  settings: (
    <>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        d="M4 8.4h4M14 8.4H20M4 15.6h2M12 15.6H20"
      />
      <circle cx={11} cy={8.4} r={2.9} />
      <circle cx={9} cy={15.6} r={2.9} />
    </>
  ),
}

export function TabIcon({ name, active }: { name: TabIconName; active: boolean }) {
  return (
    <svg width={25} height={25} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {active ? (
        <g fill="currentColor">{FILLED[name]}</g>
      ) : (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {OUTLINE[name]}
        </g>
      )}
    </svg>
  )
}
