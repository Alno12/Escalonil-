import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { LoadingScreen } from '@/components/ui/Skeleton'
import { MoneyRow, Stat } from '@/components/ui/KpiCard'
import { DayAgendaList } from '@/components/shifts/DayAgendaList'
import { useAppData } from '@/state/appDataContext'
import { useShiftSheets } from '@/state/shiftSheetsContext'
import {
  addDays,
  formatCountdown,
  formatCountdownShort,
  formatDuration,
  formatLongDate,
  formatTime,
  monthPartOf,
  relativeDayLabel,
} from '@/domain/datetime'
import { formatMoneyCompact, formatNumber } from '@/domain/money'
import { vacationCountdown } from '@/domain/vacation'
import {
  currentOrNextShift,
  filterByMonth,
  financeTotals,
  periodSummary,
  weekSummary,
} from '@/domain/summary'

/**
 * Tela Início: em poucos segundos o usuário precisa saber se tem plantão hoje,
 * qual é o próximo, quanto vai trabalhar e quanto tem a receber.
 */
export function Home() {
  const { ready, views, now, today, settings } = useAppData()
  const sheets = useShiftSheets()

  const vacation = vacationCountdown(settings.vacationDate, today, settings.vacationEnabled)

  const next = useMemo(() => currentOrNextShift(views, now), [views, now])
  const week = useMemo(() => weekSummary(views, today), [views, today])
  const month = useMemo(() => periodSummary(filterByMonth(views, monthPartOf(today))), [views, today])
  const monthMoney = useMemo(
    () => financeTotals(filterByMonth(views, monthPartOf(today))),
    [views, today],
  )
  const global = useMemo(() => financeTotals(views), [views])

  const hasShifts = views.length > 0
  // Dois meses à frente: o plantonista costuma fechar a escala com semanas de
  // antecedência, e a lista precisa alcançar isso.
  const agendaEnd = addDays(today, 60)

  return (
    <>
      <ScreenHeader eyebrow={formatLongDate(today)} title={getGreeting(now.getHours())} />

      {!ready ? (
        <LoadingScreen />
      ) : !hasShifts ? (
        <div className="screen">
          <section>
            <EmptyState
              icon="calendar"
              title="Comece cadastrando um plantão"
              description="Leva menos de 20 segundos: data, horário, local e valor."
              action={
                <Button variant="primary" size="lg" icon="plus" onClick={() => sheets.newShift()}>
                  Adicionar plantão
                </Button>
              }
            />
          </section>
        </div>
      ) : (
        <div className="screen">
          {next && (
            <section aria-label="Próximo plantão">
              <NextShiftCard viewId={next.shift.id} />
              {vacation && (
                <p className="vacation">
                  <Icon name="sun" size={14} />
                  {vacation}
                </p>
              )}
            </section>
          )}

          {/* Semana e mês são o mesmo resumo em dois recortes: duas linhas de
              um cartão só, para o começo de "Próximos plantões" caber na
              primeira tela. */}
          <section aria-label="Resumo">
            <div className="card rows">
              <SummaryRow
                to="/agenda?v=semana"
                title="Esta semana"
                tone="--green"
                shifts={week.shifts}
                hours={week.hours}
                expected={week.expected}
              />
              <SummaryRow
                to="/agenda?v=mes"
                title="Este mês"
                tone="--purple"
                shifts={month.shifts}
                hours={month.hours}
                expected={month.expected}
              />
            </div>
          </section>

          <section aria-label="Financeiro">
            <div className="section-header">
              <h2 className="section-header__title">Financeiro</h2>
              <Link to="/financeiro" className="text-link">
                Ver tudo
              </Link>
            </div>
            {/* O previsto do mês não entra aqui: já está na linha "Este mês"
                logo acima, e o mesmo número duas vezes só ocupa espaço. */}
            <div className="card rows">
              <MoneyRow label="Recebido no mês" value={monthMoney.received} strong />
              <MoneyRow label="A receber" value={global.pending} strong />
            </div>
          </section>

          <section aria-label="Próximos plantões">
            <div className="section-header">
              <h2 className="section-header__title">Próximos plantões</h2>
              <Link to="/agenda" className="text-link">
                Agenda
              </Link>
            </div>
            <DayAgendaList
              views={views}
              from={today}
              to={agendaEnd}
              today={today}
              onSelect={sheets.openShift}
              onAddDay={sheets.newShift}
            />
          </section>
        </div>
      )}
    </>
  )
}

interface SummaryRowProps {
  to: string
  title: string
  /** Token da cor do título (ex.: "--green"). */
  tone: string
  shifts: number
  hours: number
  expected: number
}

/** Linha de resumo de um recorte da agenda: contagem, horas e previsto. */
function SummaryRow({ to, title, tone, shifts, hours, expected }: SummaryRowProps) {
  return (
    <Link to={to} className="row summary-row">
      <span className="summary-row__body">
        <span className="summary-row__title" style={{ color: `var(${tone})` }}>
          <Icon name="calendar" size={14} />
          {title}
        </span>
        <span className="summary-row__values num">
          <strong>{shifts}</strong> {shifts === 1 ? 'plantão' : 'plantões'}
          <span className="summary-row__sep" aria-hidden="true">
            ·
          </span>
          <strong>{formatNumber(hours)}h</strong>
          <span className="summary-row__sep" aria-hidden="true">
            ·
          </span>
          <strong>{formatMoneyCompact(expected)}</strong> previsto
        </span>
      </span>
      <Icon name="chevronRight" size={17} className="row__chevron" />
    </Link>
  )
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Cartão do próximo plantão: compacto, com data, local e contagem regressiva. */
function NextShiftCard({ viewId }: { viewId: string }) {
  const { viewById, now, today } = useAppData()
  const sheets = useShiftSheets()
  const view = viewById.get(viewId)
  if (!view) return null

  const { shift, location } = view
  const running = view.status === 'inProgress'
  const crossesDay = shift.endDateTime.slice(0, 10) !== shift.startDateTime.slice(0, 10)

  return (
    <button
      type="button"
      className="card card--padded next"
      // A cor do local tinge o cartão inteiro: antes de ler o nome já dá para
      // saber para onde é o plantão.
      style={{ '--loc': `var(--loc-${location?.color ?? 'blue'})` } as CSSProperties}
      onClick={() => sheets.openShift(shift.id)}
    >
      <span className="next__top">
        <span className="card-title next__label">
          {running ? (
            <>
              <span className="next__live" aria-hidden="true" />
              Em andamento
            </>
          ) : (
            <>
              <Icon name="clock" size={16} />
              Próximo plantão
            </>
          )}
        </span>
        <span className="next__badge num">
          {running
            ? `Faltam ${formatCountdownShort(shift.endDateTime, now)}`
            : formatCountdown(shift.startDateTime, now)}
        </span>
      </span>

      <span className="next__place">
        <span
          className="loc-dot loc-dot--lg"
          style={{ background: `var(--loc-${location?.color ?? 'blue'})` }}
          aria-hidden="true"
        />
        <span className="next__name">{location?.name ?? 'Local removido'}</span>
      </span>

      <span className="next__when num">
        {relativeDayLabel(shift.startDateTime.slice(0, 10), today)} · {formatTime(shift.startDateTime)}{' '}
        → {formatTime(shift.endDateTime)}
        {crossesDay && <span className="next__plus">+1</span>}
      </span>

      {shift.title && <span className="next__title">{shift.title}</span>}

      <span className="next__stats">
        <Stat value={formatDuration(view.durationHours)} label="duração" />
        <Stat value={formatMoneyCompact(shift.expectedAmount)} label="valor previsto" />
      </span>
    </button>
  )
}
