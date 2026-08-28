import { useMemo, useState } from 'react'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { MoneyRow } from '@/components/ui/KpiCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { LoadingScreen } from '@/components/ui/Skeleton'
import { PaymentRow } from '@/components/shifts/PaymentRow'
import { BatchPaymentSheet } from '@/components/shifts/BatchPaymentSheet'
import { useAppData } from '@/state/appDataContext'
import { useShiftSheets } from '@/state/shiftSheetsContext'
import { addMonths, formatMonthYear, monthPartOf } from '@/domain/datetime'
import { formatMoney } from '@/domain/money'
import { filterByMonth, financeTotals, sortByStart } from '@/domain/summary'
import { PeriodNav } from './schedule/PeriodNav'

type Tab = 'pending' | 'received'

const TABS = [
  { value: 'pending' as const, label: 'A receber' },
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
  // Seleção múltipla: o hospital costuma pagar vários plantões de uma vez.
  // É um modo explícito — fora dele, tocar numa linha abre o detalhe como sempre.
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchOpen, setBatchOpen] = useState(false)

  const monthTotals = useMemo(() => financeTotals(filterByMonth(views, month)), [views, month])
  const globalTotals = useMemo(() => financeTotals(views), [views])

  const lists = useMemo(
    () => ({
      pending: sortByStart(views.filter((v) => v.paymentStatus === 'pending')),
      received: sortByStart(views.filter((v) => v.paymentStatus === 'received'), 'desc'),
    }),
    [views],
  )

  const current = lists[tab]
  const monthReference = `${month}-01`

  // Só faz sentido selecionar o que ainda não foi pago.
  const canSelect = tab !== 'received' && current.length > 1
  const selectedTotal = current
    .filter((v) => selected.has(v.shift.id))
    .reduce((sum, v) => sum + v.shift.expectedAmount, 0)

  const exitSelection = () => {
    setSelecting(false)
    setSelected(new Set())
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const changeTab = (next: Tab) => {
    exitSelection()
    setTab(next)
  }

  return (
    <>
      <ScreenHeader
        title="Financeiro"
        shareMonth={month}
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
            <div className="card rows">
              <MoneyRow label="Previsto" value={monthTotals.expected} strong />
              <MoneyRow label="Recebido" value={monthTotals.received} tone="success" />
              <MoneyRow label="A receber" value={monthTotals.pending} strong />
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
              onChange={changeTab}
            />
            <div className="list-head">
              <p className="list-count">
                Todos os períodos ·{' '}
                <strong className="num">
                  {formatMoney(tab === 'received' ? globalTotals.received : globalTotals.pending)}
                </strong>
              </p>
              {canSelect && (
                <button
                  type="button"
                  className="select-toggle"
                  onClick={() => (selecting ? exitSelection() : setSelecting(true))}
                >
                  {selecting ? 'Cancelar' : 'Selecionar'}
                </button>
              )}
            </div>

            {current.length > 0 ? (
              <ul className="payment-list">
                {current.map((view) => (
                  <PaymentRow
                    key={view.shift.id}
                    view={view}
                    onOpen={sheets.openShift}
                    onRegister={sheets.openPayment}
                    selection={
                      selecting
                        ? { selected: selected.has(view.shift.id), onToggle: toggle }
                        : undefined
                    }
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon="wallet"
                title={
                  tab === 'pending' ? 'Nada a receber no momento' : 'Nenhum pagamento registrado'
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

      {selecting && (
        <div className="selection-bar" role="region" aria-label="Ações da seleção">
          <button
            type="button"
            className="selection-bar__all"
            onClick={() =>
              setSelected(
                selected.size === current.length
                  ? new Set()
                  : new Set(current.map((v) => v.shift.id)),
              )
            }
          >
            {selected.size === current.length ? 'Nenhum' : 'Todos'}
          </button>

          <div className="selection-bar__info">
            <strong className="num">{selected.size} selecionados</strong>
            <span className="num">{formatMoney(selectedTotal)}</span>
          </div>

          <Button
            variant="primary"
            icon="check"
            disabled={selected.size === 0}
            onClick={() => setBatchOpen(true)}
          >
            Receber
          </Button>
        </div>
      )}

      <BatchPaymentSheet
        open={batchOpen}
        shiftIds={[...selected]}
        onClose={() => setBatchOpen(false)}
        onDone={exitSelection}
      />
    </>
  )
}
