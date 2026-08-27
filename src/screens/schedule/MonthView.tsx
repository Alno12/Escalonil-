import { useMemo } from 'react'
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
import { filterByMonth, occupiedDays, periodSummary, shiftsOnDay } from '@/domain/summary'
import type { LocationColor } from '@/db/types'
import { PeriodNav } from './PeriodNav'
import { PeriodSummary } from './PeriodSummary'

interface MonthViewProps {
  selected: string
  onSelect: (date: string) => void
}

/** Quatro bolinhas já não cabem na largura da célula sem encostar uma na outra. */
const MAX_DOTS = 3

/** Calendário mensal: toque num dia para ver os plantões dele (§21). */
export function MonthView({ selected, onSelect }: MonthViewProps) {
  const { views, today } = useAppData()
  const sheets = useShiftSheets()

  const month = monthPartOf(selected)
  const summary = useMemo(() => periodSummary(filterByMonth(views, month)), [views, month])

  // 6 semanas cobrem qualquer mês, mantendo a grade com altura estável.
  const gridStart = startOfWeek(startOfMonth(selected))
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart])

  /**
   * Cor do local de cada plantão, dia a dia. Usa os mesmos dias que a lista
   * embaixo do calendário vai mostrar (`occupiedDays`), para o anel e as
   * bolinhas nunca discordarem dela.
   */
  const marksByDay = useMemo(() => {
    const map = new Map<string, LocationColor[]>()
    for (const view of views) {
      if (view.shift.cancelled) continue
      const color = view.location?.color ?? 'blue'
      for (const day of occupiedDays(view.shift)) {
        const marks = map.get(day)
        if (marks) marks.push(color)
        else map.set(day, [color])
      }
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

      <PeriodSummary summary={summary} />

      <Card padded={false} className="calendar">
        <div className="calendar__weekdays" aria-hidden="true">
          {weekdayNamesMin.map((name, i) => (
            <span key={i}>{name}</span>
          ))}
        </div>
        <div className="calendar__grid" role="grid" aria-label={`Calendário de ${formatMonthYear(selected)}`}>
          {cells.map((day) => {
            const marks = marksByDay.get(day) ?? []
            const count = marks.length
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
                  count > 1 ? 'has-many' : '',
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
                {/* As bolinhas dizem QUANTOS e de QUAL local; o anel só diz que
                    tem. Ficam fora do círculo, então mantêm a cor do local
                    mesmo no dia selecionado. O contêiner existe sempre, senão
                    os dias sem plantão subiriam meia bolinha. */}
                <span className="calendar__dots" aria-hidden="true">
                  {marks.slice(0, MAX_DOTS).map((color, i) => (
                    <span
                      key={i}
                      className="calendar__dot"
                      style={{ background: `var(--loc-${color})` }}
                    />
                  ))}
                </span>
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
