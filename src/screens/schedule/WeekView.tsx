import { useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Stat } from '@/components/ui/KpiCard'
import { Button } from '@/components/ui/Button'
import { ShiftRow } from '@/components/shifts/ShiftRow'
import { useAppData } from '@/state/appDataContext'
import { useShiftSheets } from '@/state/shiftSheetsContext'
import {
  addDays,
  formatDayMonth,
  startOfWeek,
  toDate,
  weekdayNamesShort,
} from '@/domain/datetime'
import { formatMoneyCompact, formatNumber } from '@/domain/money'
import { periodSummary, shiftsOnDay } from '@/domain/summary'
import { PeriodNav } from './PeriodNav'

interface WeekViewProps {
  reference: string
  onReferenceChange: (date: string) => void
}

/** Semana de domingo a sábado, um bloco por dia. */
export function WeekView({ reference, onReferenceChange }: WeekViewProps) {
  const { views, today } = useAppData()
  const sheets = useShiftSheets()

  const start = startOfWeek(reference)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start])

  const dayShifts = useMemo(() => days.map((day) => shiftsOnDay(views, day)), [days, views])
  const summary = useMemo(
    () =>
      periodSummary(
        // Um plantão que atravessa a meia-noite aparece nos dois dias, mas
        // só conta uma vez no resumo.
        [...new Map(dayShifts.flat().map((v) => [v.shift.id, v])).values()],
      ),
    [dayShifts],
  )

  return (
    <>
      <PeriodNav
        label={`${formatDayMonth(start)} — ${formatDayMonth(addDays(start, 6))}`}
        onPrev={() => onReferenceChange(addDays(start, -7))}
        onNext={() => onReferenceChange(addDays(start, 7))}
        onToday={() => onReferenceChange(today)}
        showToday={startOfWeek(today) !== start}
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

      <div className="week-days">
        {days.map((day, index) => {
          const shifts = dayShifts[index]
          const isToday = day === today
          return (
            <section key={day} className={`week-day ${isToday ? 'is-today' : ''}`}>
              <header className="week-day__header">
                <span className="week-day__name">{weekdayNamesShort[toDate(day).getDay()]}</span>
                <span className="week-day__number num">{toDate(day).getDate()}</span>
                {isToday && <span className="week-day__badge">hoje</span>}
              </header>
              {shifts.length > 0 ? (
                <ul className="shift-list">
                  {shifts.map((view) => (
                    <ShiftRow key={view.shift.id} view={view} onClick={sheets.openShift} />
                  ))}
                </ul>
              ) : (
                <button
                  type="button"
                  className="week-day__empty"
                  onClick={() => sheets.newShift(day)}
                >
                  Livre · adicionar plantão
                </button>
              )}
            </section>
          )
        })}
      </div>

      <Button variant="secondary" block icon="plus" onClick={() => sheets.newShift(today)}>
        Novo plantão
      </Button>
    </>
  )
}
