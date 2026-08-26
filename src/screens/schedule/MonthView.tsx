import { useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Stat } from '@/components/ui/KpiCard'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ShiftRow } from '@/components/shifts/ShiftRow'
import { useAppData } from '@/state/appDataContext'
import { useShiftSheets } from '@/state/shiftSheetsContext'
import {
  addDays,
  addMonths,
  formatLongDate,
  formatMonthYear,
  monthPartOf,
  startOfMonth,
  startOfWeek,
  toDate,
  weekdayNamesMin,
} from '@/domain/datetime'
import { formatMoneyCompact, formatNumber } from '@/domain/money'
import { filterByMonth, periodSummary, shiftsOnDay } from '@/domain/summary'
import { PeriodNav } from './PeriodNav'

interface MonthViewProps {
  selected: string
  onSelect: (date: string) => void
}

/** Calendário mensal: toque num dia para ver os plantões dele (§21). */
export function MonthView({ selected, onSelect }: MonthViewProps) {
  const { views, today } = useAppData()
  const sheets = useShiftSheets()

  const month = monthPartOf(selected)
  const summary = useMemo(() => periodSummary(filterByMonth(views, month)), [views, month])

  // 6 semanas cobrem qualquer mês, mantendo a grade com altura estável.
  const gridStart = startOfWeek(startOfMonth(selected))
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart])

  const countByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const view of views) {
      if (view.shift.cancelled) continue
      const day = view.shift.startDateTime.slice(0, 10)
      map.set(day, (map.get(day) ?? 0) + 1)
    }
    return map
  }, [views])

  const daysShifts = useMemo(() => shiftsOnDay(views, selected), [views, selected])

  return (
    <>
      <PeriodNav
        label={formatMonthYear(selected)}
        onPrev={() => onSelect(addMonths(selected, -1))}
        onNext={() => onSelect(addMonths(selected, 1))}
        onToday={() => onSelect(today)}
        showToday={monthPartOf(today) !== month}
      />

      <Card>
        <div className="week-summary">
          <Stat value={summary.shifts} label={summary.shifts === 1 ? 'plantão' : 'plantões'} />
          <span className="week-summary__divider" aria-hidden="true" />
          <Stat value={formatNumber(summary.hours)} label="horas" />
          <span className="week-summary__divider" aria-hidden="true" />
          <Stat value={formatMoneyCompact(summary.expected)} label="previstos" />
        </div>
      </Card>

      <Card padded={false} className="calendar">
        <div className="calendar__weekdays" aria-hidden="true">
          {weekdayNamesMin.map((name, i) => (
            <span key={i}>{name}</span>
          ))}
        </div>
        <div className="calendar__grid" role="grid" aria-label={`Calendário de ${formatMonthYear(selected)}`}>
          {cells.map((day) => {
            const count = countByDay.get(day) ?? 0
            const inMonth = monthPartOf(day) === month
            return (
              <button
                key={day}
                type="button"
                role="gridcell"
                aria-selected={day === selected}
                aria-label={`${formatLongDate(day)}${
                  count ? ` · ${count} ${count === 1 ? 'plantão' : 'plantões'}` : ''
                }`}
                className={[
                  'calendar__day',
                  inMonth ? '' : 'is-outside',
                  count > 0 ? 'has-shifts' : '',
                  day === today ? 'is-today' : '',
                  day === selected ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelect(day)}
              >
                {/* O número mora no próprio círculo: é ele que recebe o anel do
                    dia com plantão e o preenchimento do dia selecionado. */}
                <span className="calendar__num num">{toDate(day).getDate()}</span>
              </button>
            )
          })}
        </div>
      </Card>

      <section aria-label="Plantões do dia selecionado">
        <h3 className="day-title">{formatLongDate(selected)}</h3>
        {daysShifts.length > 0 ? (
          <ul className="shift-list">
            {daysShifts.map((view) => (
              <ShiftRow key={view.shift.id} view={view} onClick={sheets.openShift} />
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon="calendar"
            title="Dia livre"
            description="Nenhum plantão cadastrado para esta data."
            action={
              <Button variant="primary" icon="plus" onClick={() => sheets.newShift(selected)}>
                Adicionar plantão
              </Button>
            }
          />
        )}
      </section>
    </>
  )
}
