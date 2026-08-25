import { useMemo, useState } from 'react'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { KpiCard } from '@/components/ui/KpiCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { LoadingScreen } from '@/components/ui/Skeleton'
import { PaymentRow } from '@/components/shifts/PaymentRow'
import { useAppData } from '@/state/appDataContext'
import { useShiftSheets } from '@/state/shiftSheetsContext'
import { addMonths, formatMonthYear, monthPartOf } from '@/domain/datetime'
import { formatMoney, formatMoneyCompact } from '@/domain/money'
import { filterByMonth, financeTotals, sortByStart } from '@/domain/summary'
import { PeriodNav } from './schedule/PeriodNav'

type Tab = 'pending' | 'overdue' | 'received'

const TABS = [
  { value: 'pending' as const, label: 'A receber' },
  { value: 'overdue' as const, label: 'Atrasados' },
  { value: 'received' as const, label: 'Recebidos' },
]

/**
 * Tela Financeiro (§23–§26).
 * Os cartões do topo olham o MÊS selecionado; as listas abaixo mostram TODOS
 * os períodos, para que nenhuma pendência antiga fique escondida por um filtro.
 */
export function Finance() {
  const { ready, views, today } = useAppData()
  const sheets = useShiftSheets()

  const [month, setMonth] = useState(monthPartOf(today))
  const [tab, setTab] = useState<Tab>('pending')

  const monthTotals = useMemo(() => financeTotals(filterByMonth(views, month)), [views, month])
  const globalTotals = useMemo(() => financeTotals(views), [views])

  const lists = useMemo(
    () => ({
      pending: sortByStart(views.filter((v) => v.paymentStatus === 'pending')),
      overdue: sortByStart(views.filter((v) => v.paymentStatus === 'overdue')),
      received: sortByStart(views.filter((v) => v.paymentStatus === 'received'), 'desc'),
    }),
    [views],
  )

  const current = lists[tab]
  const monthReference = `${month}-01`

  return (
    <>
      <ScreenHeader
        title="Financeiro"
        subtitle={
          globalTotals.outstanding > 0
            ? `${formatMoney(globalTotals.outstanding)} ainda para receber`
            : 'Nenhum valor pendente'
        }
      />

      {!ready ? (
        <LoadingScreen />
      ) : (
        <div className="screen">
          <section aria-label="Resumo do mês">
            <PeriodNav
              label={formatMonthYear(monthReference)}
              onPrev={() => setMonth(monthPartOf(addMonths(monthReference, -1)))}
              onNext={() => setMonth(monthPartOf(addMonths(monthReference, 1)))}
              onToday={() => setMonth(monthPartOf(today))}
              showToday={month !== monthPartOf(today)}
            />
            <div className="kpi-grid">
              <KpiCard label="Previsto" value={formatMoneyCompact(monthTotals.expected)} />
              <KpiCard
                label="Recebido"
                value={formatMoneyCompact(monthTotals.received)}
                tone="success"
                muted={monthTotals.received === 0}
              />
              <KpiCard
                label="A receber"
                value={formatMoneyCompact(monthTotals.pending)}
                muted={monthTotals.pending === 0}
              />
              <KpiCard
                label="Atrasado"
                value={formatMoneyCompact(monthTotals.overdue)}
                tone={monthTotals.overdue > 0 ? 'danger' : 'neutral'}
                muted={monthTotals.overdue === 0}
              />
            </div>
          </section>

          <section aria-label="Pagamentos">
            <SegmentedControl
              ariaLabel="Situação dos pagamentos"
              options={TABS.map((t) => ({
                ...t,
                label: `${t.label}${lists[t.value].length ? ` (${lists[t.value].length})` : ''}`,
              }))}
              value={tab}
              onChange={setTab}
            />
            <p className="list-count">
              Todos os períodos ·{' '}
              <strong className="num">
                {formatMoney(
                  tab === 'received'
                    ? globalTotals.received
                    : tab === 'overdue'
                      ? globalTotals.overdue
                      : globalTotals.pending,
                )}
              </strong>
            </p>

            {current.length > 0 ? (
              <ul className="payment-list">
                {current.map((view) => (
                  <PaymentRow
                    key={view.shift.id}
                    view={view}
                    today={today}
                    onOpen={sheets.openShift}
                    onRegister={sheets.openPayment}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={tab === 'overdue' ? 'check' : 'wallet'}
                title={
                  tab === 'pending'
                    ? 'Nada a receber no momento'
                    : tab === 'overdue'
                      ? 'Nenhum pagamento atrasado'
                      : 'Nenhum pagamento registrado'
                }
                description={
                  tab === 'received'
                    ? 'Ao marcar um plantão como recebido, ele aparece aqui.'
                    : 'Plantões realizados e ainda não pagos aparecem nesta lista.'
                }
                action={
                  views.length === 0 ? (
                    <Button variant="primary" icon="plus" onClick={() => sheets.newShift()}>
                      Novo plantão
                    </Button>
                  ) : undefined
                }
              />
            )}
          </section>
        </div>
      )}
    </>
  )
}
