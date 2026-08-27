import { Card } from '@/components/ui/Card'
import { formatMoneyCompact, formatNumber } from '@/domain/money'
import type { PeriodSummary as Totals } from '@/domain/summary'

/**
 * Resumo do período no alto da Semana e do Mês.
 *
 * Número e rótulo na MESMA linha, sem riscos entre eles: a versão anterior
 * empilhava número grande e rótulo em três colunas separadas por hairlines, e
 * era o bloco mais alto da Agenda — empurrava o primeiro dia para fora da tela.
 * "24h" em vez de "24 horas" é a mesma abreviação das linhas de plantão, e o
 * "previstos" saiu porque o R$ já diz o que aquele número é.
 */
export function PeriodSummary({ summary }: { summary: Totals }) {
  return (
    <Card padded={false} className="period-summary">
      <span className="period-summary__item num">
        <b>{summary.shifts}</b> {summary.shifts === 1 ? 'plantão' : 'plantões'}
      </span>
      <span className="period-summary__item num">
        <b>{formatNumber(summary.hours)}</b>h
      </span>
      <span className="period-summary__item num">
        <b>{formatMoneyCompact(summary.expected)}</b>
      </span>
    </Card>
  )
}
