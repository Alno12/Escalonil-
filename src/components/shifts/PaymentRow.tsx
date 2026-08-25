import type { ShiftView } from '@/db/types'
import { Icon } from '@/components/ui/Icon'
import { daysBetween, formatDate, formatDuration } from '@/domain/datetime'
import { formatMoney, formatMoneySigned } from '@/domain/money'
import { paymentDifference } from '@/domain/shift'

interface PaymentRowProps {
  view: ShiftView
  today: string
  onOpen: (id: string) => void
  onRegister: (id: string) => void
  /** Quando definido, a linha vira um seletor em vez de abrir o detalhe. */
  selection?: { selected: boolean; onToggle: (id: string) => void }
}

/** Item da lista de pagamentos (§24), com prazo ou atraso em destaque. */
export function PaymentRow({ view, today, onOpen, onRegister, selection }: PaymentRowProps) {
  const { shift, location, payment } = view
  const overdue = view.paymentStatus === 'overdue'
  const difference = payment ? paymentDifference(payment) : 0
  const selecting = selection !== undefined

  return (
    <li
      className={[
        'payment-row',
        overdue ? 'is-overdue' : '',
        selecting ? 'is-selecting' : '',
        selection?.selected ? 'is-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {selecting && (
        <span className="payment-row__check" aria-hidden="true">
          {selection.selected && <Icon name="check" size={15} strokeWidth={2.4} />}
        </span>
      )}

      <button
        type="button"
        className="payment-row__main"
        aria-pressed={selecting ? selection.selected : undefined}
        onClick={() => (selecting ? selection.onToggle(shift.id) : onOpen(shift.id))}
      >
        <span className="payment-row__top">
          <span className="payment-row__location">{location?.name ?? 'Local removido'}</span>
          <span className="payment-row__amount num">
            {payment ? formatMoney(payment.receivedAmount) : formatMoney(shift.expectedAmount)}
          </span>
        </span>

        <span className="payment-row__meta num">
          Plantão {formatDate(shift.startDateTime)} · {formatDuration(view.durationHours)}
        </span>

        <span className={`payment-row__term ${overdue ? 'is-overdue' : ''}`}>
          {payment ? (
            <>
              <Icon name="check" size={14} />
              Recebido em {formatDate(payment.receivedDate)}
              {Math.abs(difference) >= 0.01 && (
                <span className="payment-row__diff num">{formatMoneySigned(difference)}</span>
              )}
            </>
          ) : shift.expectedPaymentDate ? (
            <>
              <Icon name={overdue ? 'alert' : 'clock'} size={14} />
              Previsto {formatDate(shift.expectedPaymentDate)} ·{' '}
              {termLabel(daysBetween(today, shift.expectedPaymentDate))}
            </>
          ) : (
            <>
              <Icon name="clock" size={14} />
              Sem data prevista
            </>
          )}
        </span>
      </button>

      {!payment && !selecting && (
        <button
          type="button"
          className="payment-row__action"
          onClick={() => onRegister(shift.id)}
          aria-label={`Marcar plantão em ${location?.name ?? ''} como recebido`}
        >
          <Icon name="check" size={18} />
          <span>Receber</span>
        </button>
      )}
    </li>
  )
}

function termLabel(days: number): string {
  if (days === 0) return 'é hoje'
  if (days === 1) return 'falta 1 dia'
  if (days > 1) return `faltam ${days} dias`
  if (days === -1) return 'atrasado há 1 dia'
  return `atrasado há ${Math.abs(days)} dias`
}
