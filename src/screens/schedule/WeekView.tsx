import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { ShiftRow } from '@/components/shifts/ShiftRow'
import { useAppData } from '@/state/appDataContext'
import { useShiftSheets } from '@/state/shiftSheetsContext'
import { addDays, startOfWeek, toDate, weekdayNamesShort } from '@/domain/datetime'
import { periodSummary, shiftsOnDay } from '@/domain/summary'
import { PeriodSummary } from './PeriodSummary'

interface WeekViewProps {
  reference: string
}

/** Semana de domingo a sábado, um bloco por dia. */
export function WeekView({ reference }: WeekViewProps) {
  const { views, today } = useAppData()
  const sheets = useShiftSheets()

  const start = startOfWeek(reference)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start])

  const dayShifts = useMemo(() => days.map((day) => shiftsOnDay(views, day)), [days, views])
  const summary = useMemo(
    () =>
      periodSummary(
        // Um plantão longo o bastante para ocupar dois dias (ver
        // `occupiesDay`) aparece nos dois, mas só conta uma vez no resumo.
        [...new Map(dayShifts.flat().map((v) => [v.shift.id, v])).values()],
      ),
    [dayShifts],
  )

  return (
    <>
      <PeriodSummary summary={summary} />

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
