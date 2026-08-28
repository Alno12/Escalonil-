import { useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { ShiftRow } from '@/components/shifts/ShiftRow'
import { useAppData } from '@/state/appDataContext'
import { useShiftSheets } from '@/state/shiftSheetsContext'
import {
  addDays,
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
import { PeriodSummary } from './PeriodSummary'

interface MonthViewProps {
  selected: string
  onSelect: (date: string) => void
  /** Abre a folha do mês. É o fim natural de quem rolou o mês inteiro. */
  onShare: () => void
}

/** Quatro bolinhas já não cabem na largura da célula sem encostar uma na outra. */
const MAX_DOTS = 3

/** Calendário mensal: toque num dia para ver os plantões dele (§21). */
export function MonthView({ selected, onSelect, onShare }: MonthViewProps) {
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
        {/*
          O "Adicionar" mora no CABEÇALHO do dia, não no fim da lista.

          No fim ele afundava: medido a 393×852, com dois plantões a linha já
          caía atrás da barra de abas (y=793 de 852) e com quatro saía da tela
          (y=927). Aqui ele fica em y=634 sempre, porque está ACIMA da lista —
          a posição deixa de depender de quantos plantões o dia tem, que era
          justamente o problema.

          Pílula TINGIDA, não preenchida: o `+` do cabeçalho da tela é o único
          botão cheio, e dois roxos sólidos na mesma tela brigariam. E não
          custa altura nenhuma — entra num espaço que já estava vazio à direita
          da data.
        */}
        <div className="day-head">
          <h3 className="day-title">{formatLongDate(selected)}</h3>
          <button type="button" className="day-add" onClick={() => sheets.newShift(selected)}>
            <Icon name="plus" size={15} strokeWidth={2.4} />
            Adicionar
          </button>
        </div>
        {daysShifts.length > 0 ? (
          <ul className="shift-list">
            {daysShifts.map((view) => (
              <ShiftRow key={view.shift.id} view={view} onClick={sheets.openShift} />
            ))}
          </ul>
        ) : (
          /*
            Sem botão: o "Adicionar" do cabeçalho do dia está logo acima e vale
            para o dia cheio e para o vazio. O botão cheio que morava aqui
            existia porque era a única porta do dia livre — agora seria a mesma
            ação duas vezes, e medindo a 393×852 ele caía FORA da tela
            enquanto a pílula aparecia. Some o que não se alcança.
          */
          <EmptyState
            compact
            icon="calendar"
            title="Dia livre"
            description="Nenhum plantão cadastrado para esta data."
          />
        )}
      </section>

      {/* Só no Mês: é a folha DO MÊS, e o botão cai no fim do fluxo de quem
          rolou o mês inteiro. Na Semana ele seria repetição do ícone do
          cabeçalho, que já está sempre à vista. */}
      <Button variant="secondary" block icon="share" onClick={onShare}>
        Compartilhar
      </Button>
    </>
  )
}
