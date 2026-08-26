import { useMemo } from 'react'
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
  const { ready, views, now, today } = useAppData()
  const sheets = useShiftSheets()

  const next = useMemo(() => currentOrNextShift(views, now), [views, now])
  const week = useMemo(() => weekSummary(views, today), [views, today])
  const month = useMemo(() => periodSummary(filterByMonth(views, monthPartOf(today))), [views, today])
  const monthMoney = useMemo(
    () => financeTotals(filterByMonth(views, monthPartOf(today))),
    [views, today],
  )
  const global = useMemo(() => financeTotals(views), [views])

  const hasShifts = views.length > 0
  const agendaEnd = addDays(today, 13)

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
            </section>
          )}

          <section aria-label="Esta semana">
            <Link to="/agenda" className="card card--padded summary-card">
              <span className="card-title" style={{ color: 'var(--green)' }}>
                <Icon name="calendar" size={16} />
                Esta semana
                <Icon name="chevronRight" size={14} className="card-title__chevron" />
              </span>
              <span className="summary-card__stats">
                <Stat value={String(week.shifts)} label={week.shifts === 1 ? 'plantão' : 'plantões'} />
                <Stat value={`${formatNumber(week.hours)}h`} label="horas" />
                <Stat value={formatMoneyCompact(week.expected)} label="previsto" />
              </span>
            </Link>
          </section>

          <section aria-label="Este mês">
            <Link to="/relatorios" className="card card--padded summary-card">
              <span className="card-title" style={{ color: 'var(--purple)' }}>
                <Icon name="calendar" size={16} />
                Este mês
                <Icon name="chevronRight" size={14} className="card-title__chevron" />
              </span>
              <span className="summary-card__stats">
                <Stat
                  value={String(month.shifts)}
                  label={month.shifts === 1 ? 'plantão' : 'plantões'}
                />
                <Stat value={`${formatNumber(month.hours)}h`} label="horas" />
                <Stat value={formatMoneyCompact(month.expected)} label="previsto" />
              </span>
            </Link>
          </section>

          <section aria-label="Financeiro">
            <div className="section-header">
              <h2 className="section-header__title">Financeiro</h2>
              <Link to="/financeiro" className="text-link">
                Ver tudo
              </Link>
            </div>
            <div className="card rows">
              <MoneyRow label="Previsto no mês" value={monthMoney.expected} strong />
              <MoneyRow label="Recebido no mês" value={monthMoney.received} />
              <MoneyRow label="A receber" value={global.pending} strong />
              <MoneyRow label="Atrasado" value={global.overdue} tone="danger" />
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
    <button type="button" className="card card--padded next" onClick={() => sheets.openShift(shift.id)}>
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
