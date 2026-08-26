import type { LocationReportRow } from '@/domain/reports'
import { formatMoney, formatNumber } from '@/domain/money'
import { formatDuration } from '@/domain/datetime'

/**
 * Relatório por local (§30): onde vale mais a pena trabalhar.
 *
 * A barra usa a COR DO LOCAL (invariante 10), a mesma da agenda — com quatro
 * barras roxas iguais era preciso ler o nome para saber de quem era cada uma.
 * A estrela marca o melhor valor por hora, que é a pergunta que o cartão
 * responde e não é necessariamente quem rendeu mais no total.
 */
export function LocationReport({ rows }: { rows: LocationReportRow[] }) {
  const best = bestPerHour(rows)

  return (
    <ul className="location-list">
      {rows.map((row) => (
        <li key={row.locationId} className="location-row">
          <div className="location-row__head">
            <i
              className="location-row__dot"
              style={{ background: `var(--loc-${row.color})` }}
              aria-hidden="true"
            />
            <span className="location-row__name">{row.name}</span>
            <span className="location-row__amount num">{formatMoney(row.expected)}</span>
          </div>

          <div className="location-row__bar" aria-hidden="true">
            <span
              style={{
                width: `${Math.max(2, row.share)}%`,
                background: `var(--loc-${row.color})`,
              }}
            />
          </div>

          <div className="location-row__meta num">
            <span>{formatNumber(row.share)}% da renda</span>
            <span aria-hidden="true">·</span>
            <span>
              {row.shifts} {row.shifts === 1 ? 'plantão' : 'plantões'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatDuration(row.hours)}</span>
            <span aria-hidden="true">·</span>
            <span className={row.locationId === best ? 'location-row__best' : ''}>
              {formatMoney(row.avgPerHour)}/h
              {row.locationId === best && <span title="Melhor valor por hora"> ★</span>}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Id do local com o melhor valor por hora — nulo se houver empate ou só um local. */
function bestPerHour(rows: LocationReportRow[]): string | null {
  if (rows.length < 2) return null
  const max = Math.max(...rows.map((r) => r.avgPerHour))
  const winners = rows.filter((r) => r.avgPerHour === max)
  return winners.length === 1 && max > 0 ? winners[0].locationId : null
}
