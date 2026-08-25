import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Card, SectionHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { KpiCard, Stat } from '@/components/ui/KpiCard'
import { LoadingScreen } from '@/components/ui/Skeleton'
import { ShiftGroupList } from '@/components/shifts/ShiftGroupList'
import { useAppData } from '@/state/appDataContext'
import { useShiftSheets } from '@/state/shiftSheetsContext'
import {
  formatCountdown,
  formatDuration,
  formatLongDate,
  formatTime,
  isSameDay,
  monthPartOf,
  relativeDayLabel,
} from '@/domain/datetime'
import { formatMoneyCompact, formatNumber } from '@/domain/money'
import {
  currentOrNextShift,
  filterByMonth,
  financeTotals,
  upcomingShifts,
  weekSummary,
} from '@/domain/summary'

/**
 * Tela Início: em poucos segundos o usuário precisa saber se tem plantão hoje,
 * qual é o próximo, quanto vai trabalhar na semana e quanto tem a receber (§5).
 */
export function Home() {
  const { ready, views, now, today, settings } = useAppData()
  const sheets = useShiftSheets()

  const next = useMemo(() => currentOrNextShift(views, now), [views, now])
  const week = useMemo(() => weekSummary(views, today), [views, today])
  const month = useMemo(() => financeTotals(filterByMonth(views, monthPartOf(today))), [views, today])
  const global = useMemo(() => financeTotals(views), [views])
  // O plantão em destaque não se repete na lista logo abaixo.
  const upcoming = useMemo(
    () => upcomingShifts(views).filter((v) => v.shift.id !== next?.shift.id).slice(0, 6),
    [views, next],
  )

  const greeting = getGreeting(now.getHours())
  const hasShifts = views.length > 0

  return (
    <>
      <ScreenHeader
        title={greeting}
        subtitle={formatLongDate(today)}
        action={
          <Link to="/configuracoes" className="icon-link" aria-label="Configurações">
            <Icon name="settings" size={20} />
          </Link>
        }
      />

      {!ready ? (
        <LoadingScreen />
      ) : (
        <div className="screen">
          <section aria-label="Próximo plantão">
            {next ? (
              <NextShiftCard viewId={next.shift.id} onOpen={sheets.openShift} />
            ) : (
              <EmptyState
                icon="calendar"
                title={hasShifts ? 'Nenhum plantão programado' : 'Comece cadastrando um plantão'}
                description={
                  hasShifts
                    ? 'Seu próximo plantão aparecerá aqui assim que for cadastrado.'
                    : 'Leva menos de 20 segundos: data, horário, local e valor.'
                }
                action={
                  <Button variant="primary" size="lg" icon="plus" onClick={() => sheets.newShift()}>
                    Adicionar plantão
                  </Button>
                }
              />
            )}
          </section>

          {hasShifts && (
            <section aria-label="Resumo da semana">
              <SectionHeader title="Esta semana" />
              <Card>
                <div className="week-summary">
                  <Stat
                    value={week.shifts}
                    label={week.shifts === 1 ? 'plantão' : 'plantões'}
                  />
                  <span className="week-summary__divider" aria-hidden="true" />
                  <Stat value={formatNumber(week.hours)} label="horas" />
                  <span className="week-summary__divider" aria-hidden="true" />
                  <Stat value={formatMoneyCompact(week.expected)} label="previstos" />
                </div>
              </Card>
            </section>
          )}

          {hasShifts && (
            <section aria-label="Resumo financeiro">
              <SectionHeader
                title="Financeiro"
                action={
                  <Link to="/financeiro" className="text-link">
                    Ver tudo <Icon name="chevronRight" size={14} />
                  </Link>
                }
              />
              <div className="kpi-grid">
                <KpiCard label="Previsto no mês" value={formatMoneyCompact(month.expected)} />
                <KpiCard
                  label="Recebido no mês"
                  value={formatMoneyCompact(month.received)}
                  tone="success"
                  muted={month.received === 0}
                />
                <KpiCard
                  label="A receber"
                  value={formatMoneyCompact(global.pending)}
                  hint={global.pending > 0 ? 'no prazo' : undefined}
                  muted={global.pending === 0}
                />
                <KpiCard
                  label="Atrasado"
                  value={formatMoneyCompact(global.overdue)}
                  tone={global.overdue > 0 ? 'danger' : 'neutral'}
                  muted={global.overdue === 0}
                  hint={global.overdue === 0 ? 'nada atrasado' : 'cobrar'}
                />
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section aria-label="Próximos plantões">
              <SectionHeader
                title="Próximos plantões"
                action={
                  <Link to="/agenda" className="text-link">
                    Agenda <Icon name="chevronRight" size={14} />
                  </Link>
                }
              />
              <ShiftGroupList views={upcoming} today={today} onSelect={sheets.openShift} />
            </section>
          )}

          {hasShifts && upcoming.length === 0 && (
            <section aria-label="Próximos plantões">
              <SectionHeader title="Próximos plantões" />
              <EmptyState
                compact
                icon="calendar"
                title="Nenhum plantão à frente"
                description="Cadastre o próximo para não perder o controle das horas e dos valores."
                action={
                  <Button variant="primary" icon="plus" onClick={() => sheets.newShift()}>
                    Novo plantão
                  </Button>
                }
              />
            </section>
          )}

          {settings.paymentTermDays > 0 && !hasShifts && (
            <p className="screen__footnote">
              Seus dados ficam apenas neste aparelho. Faça um backup em Configurações.
            </p>
          )}
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

/** Cartão principal da tela inicial — o destaque visual do app. */
function NextShiftCard({ viewId, onOpen }: { viewId: string; onOpen: (id: string) => void }) {
  const { viewById, now, today } = useAppData()
  const view = viewById.get(viewId)
  if (!view) return null

  const { shift, location } = view
  const running = view.status === 'inProgress'
  const overnight = !isSameDay(shift.startDateTime, shift.endDateTime)

  return (
    <button type="button" className="hero" onClick={() => onOpen(shift.id)}>
      <span className="hero__label">
        {running ? (
          <>
            <span className="hero__live" aria-hidden="true" />
            Plantão em andamento
          </>
        ) : (
          'Próximo plantão'
        )}
      </span>

      <span className="hero__location">{location?.name ?? 'Local removido'}</span>

      <span className="hero__schedule num">
        {relativeDayLabel(shift.startDateTime.slice(0, 10), today)}
        <span className="hero__sep" aria-hidden="true">
          •
        </span>
        {formatTime(shift.startDateTime)} → {formatTime(shift.endDateTime)}
        {overnight && <span className="hero__plus">+1</span>}
      </span>

      <span className="hero__facts">
        <span className="hero__fact num">{formatDuration(view.durationHours)}</span>
        <span className="hero__dot" aria-hidden="true" />
        <span className="hero__fact num">{formatMoneyCompact(shift.expectedAmount)}</span>
        {shift.shiftType && (
          <>
            <span className="hero__dot" aria-hidden="true" />
            <span className="hero__fact">{shift.shiftType}</span>
          </>
        )}
      </span>

      <span className="hero__countdown">
        <Icon name="clock" size={16} />
        {running
          ? `Termina ${formatCountdown(shift.endDateTime, now).toLowerCase()}`
          : formatCountdown(shift.startDateTime, now)}
      </span>
    </button>
  )
}
