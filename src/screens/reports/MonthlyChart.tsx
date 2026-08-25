import type { MonthBucket } from '@/domain/reports'
import { formatMonthCompact } from '@/domain/datetime'
import { formatMoneyCompact } from '@/domain/money'

/**
 * Barras mensais: a altura é o valor previsto e a parte cheia é o já recebido.
 * Feito em CSS puro — nenhuma biblioteca de gráficos no bundle.
 */
export function MonthlyChart({ data }: { data: MonthBucket[] }) {
  const max = Math.max(...data.map((d) => d.expected), 1)

  return (
    <div className="chart">
      <div className="chart__bars" role="img" aria-label="Valores por mês">
        {data.map((bucket) => {
          const height = Math.max(4, (bucket.expected / max) * 100)
          const receivedShare =
            bucket.expected > 0 ? Math.min(100, (bucket.received / bucket.expected) * 100) : 0
          return (
            <div key={bucket.month} className="chart__col">
              <span className="chart__value num">{formatMoneyCompact(bucket.expected)}</span>
              <div className="chart__track">
                <div className="chart__bar" style={{ height: `${height}%` }}>
                  <div className="chart__bar-fill" style={{ height: `${receivedShare}%` }} />
                </div>
              </div>
              <span className="chart__label">{formatMonthCompact(`${bucket.month}-01`)}</span>
            </div>
          )
        })}
      </div>
      <div className="chart__legend">
        <span className="chart__legend-item">
          <span className="chart__swatch chart__swatch--expected" aria-hidden="true" />
          Previsto
        </span>
        <span className="chart__legend-item">
          <span className="chart__swatch chart__swatch--received" aria-hidden="true" />
          Recebido
        </span>
      </div>
    </div>
  )
}
