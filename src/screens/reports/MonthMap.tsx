import type { DayCell } from '@/domain/reports'
import { formatDuration, formatLongDate, toDate, weekdayNamesMin } from '@/domain/datetime'

/**
 * Calendário de intensidade do mês: quanto mais escuro, mais horas naquele dia.
 *
 * A escala é FIXA em horas (6h, 12h, 18h, mais que isso), não relativa ao mês.
 * Relativa, um mês leve ficaria tão escuro quanto um mês puxado e a comparação
 * entre meses deixaria de existir — que é o que o cartão serve para fazer.
 */
export function MonthMap({ days }: { days: DayCell[] }) {
  const blanks = toDate(days[0].date).getDay()

  return (
    <div className="daymap">
      <div className="daymap__head" aria-hidden="true">
        {weekdayNamesMin.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="daymap__grid">
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank-${i}`} className="daymap__cell daymap__cell--void" aria-hidden="true" />
        ))}
        {days.map((cell) => (
          <span
            key={cell.date}
            className={`daymap__cell daymap__cell--${level(cell.hours)} num`}
            title={`${formatLongDate(cell.date)}: ${
              cell.hours > 0 ? formatDuration(cell.hours) : 'sem plantão'
            }`}
          >
            {cell.day}
          </span>
        ))}
      </div>

      <div className="daymap__scale" aria-hidden="true">
        <span>menos</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`daymap__cell daymap__cell--${l}`} />
        ))}
        <span>mais</span>
      </div>
    </div>
  )
}

function level(hours: number): number {
  if (hours <= 0) return 0
  if (hours <= 6) return 1
  if (hours <= 12) return 2
  if (hours <= 18) return 3
  return 4
}
