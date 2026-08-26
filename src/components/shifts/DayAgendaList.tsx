import { useMemo } from 'react'
import type { ShiftView } from '@/db/types'
import { addDays, daysBetween, formatTime, toDate, weekdayNamesShort } from '@/domain/datetime'
import { formatMoneyCompact } from '@/domain/money'
import { formatDuration } from '@/domain/datetime'
import { datePartOf } from '@/domain/datetime'

interface DayAgendaListProps {
  views: ShiftView[]
  from: string
  /** Último dia mostrado (inclusive). */
  to: string
  today: string
  onSelect: (id: string) => void
  onAddDay?: (date: string) => void
}

/**
 * Agenda dia a dia. Os dias sem plantão aparecem numa linha fina e apagada —
 * assim dá para ver o ritmo da semana, não só os compromissos soltos.
 */
export function DayAgendaList({
  views,
  from,
  to,
  today,
  onSelect,
  onAddDay,
}: DayAgendaListProps) {
  const days = useMemo(() => {
    const total = Math.max(0, daysBetween(from, to)) + 1
    const byDay = new Map<string, ShiftView[]>()
    for (const view of views) {
      const day = datePartOf(view.shift.startDateTime)
      const bucket = byDay.get(day)
      if (bucket) bucket.push(view)
      else byDay.set(day, [view])
    }
    return Array.from({ length: total }, (_, i) => {
      const date = addDays(from, i)
      return { date, shifts: byDay.get(date) ?? [] }
    })
  }, [views, from, to])

  return (
    <div className="card agenda">
      {days.map(({ date, shifts }) => {
        const weekday = weekdayNamesShort[toDate(date).getDay()]
        const dayNumber = toDate(date).getDate()
        const isToday = date === today

        if (shifts.length === 0) {
          return (
            <button
              key={date}
              type="button"
              className={`agenda-day agenda-day--free ${isToday ? 'is-today' : ''}`}
              onClick={() => onAddDay?.(date)}
            >
              <span className="agenda-day__date">
                <span className="agenda-day__dow">{weekday}</span>
                <span className="agenda-day__num num">{dayNumber}</span>
              </span>
              <span className="agenda-day__free">Livre</span>
            </button>
          )
        }

        return shifts.map((view, index) => (
          <button
            key={view.shift.id}
            type="button"
            className={`agenda-day ${isToday ? 'is-today' : ''} ${
              view.shift.cancelled ? 'is-cancelled' : ''
            }`}
            onClick={() => onSelect(view.shift.id)}
          >
            <span className="agenda-day__date">
              {index === 0 && (
                <>
                  <span className="agenda-day__dow">{weekday}</span>
                  <span className="agenda-day__num num">{dayNumber}</span>
                </>
              )}
            </span>

            <span className="agenda-day__body">
              <span className="agenda-day__place">
                <span
                  className="loc-dot"
                  style={{ background: `var(--loc-${view.location?.color ?? 'blue'})` }}
                  aria-hidden="true"
                />
                {view.location?.name ?? 'Local removido'}
              </span>
              <span className="agenda-day__meta num">
                {formatTime(view.shift.startDateTime)} → {formatTime(view.shift.endDateTime)}
                {view.shift.title && <span className="agenda-day__title"> · {view.shift.title}</span>}
              </span>
            </span>

            <span className="agenda-day__right">
              <span className="agenda-day__amount num">
                {formatMoneyCompact(view.shift.expectedAmount)}
              </span>
              <span className="agenda-day__dur num">{formatDuration(view.durationHours)}</span>
            </span>
          </button>
        ))
      })}
    </div>
  )
}
