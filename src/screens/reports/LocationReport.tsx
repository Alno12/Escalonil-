import type { LocationReportRow } from '@/domain/reports'
import { formatMoney, formatNumber } from '@/domain/money'
import { formatDuration } from '@/domain/datetime'

/** Relatório por local (§30): onde vale mais a pena trabalhar. */
export function LocationReport({ rows }: { rows: LocationReportRow[] }) {
  return (
    <ul className="location-list">
      {rows.map((row) => (
        <li key={row.locationId} className="location-row">
          <div className="location-row__head">
            <span className="location-row__name">{row.name}</span>
            <span className="location-row__amount num">{formatMoney(row.expected)}</span>
          </div>

          <div className="location-row__bar" aria-hidden="true">
            <span style={{ width: `${Math.max(2, row.share)}%` }} />
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
            <span>{formatMoney(row.avgPerHour)}/h</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
