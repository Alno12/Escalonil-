import type { ShiftView } from '@/db/types'
import { formatDateShort, formatDuration, formatTime, isSameDay } from '@/domain/datetime'
import { formatMoneyCompact } from '@/domain/money'
import { PaymentStatusPill } from '@/components/ui/StatusPill'

interface ShiftRowProps {
  view: ShiftView
  onClick: (id: string) => void
  /** Mostra a data — usado em listas sem agrupamento por dia. */
  showDate?: boolean
}

/**
 * Linha de plantão dentro de um cartão agrupado: cor do local à esquerda,
 * nome em destaque, horário e valor. Mesma anatomia da agenda do Início.
 */
export function ShiftRow({ view, onClick, showDate = false }: ShiftRowProps) {
  const { shift, location } = view
  const overnight = !isSameDay(shift.startDateTime, shift.endDateTime)

  return (
    <li>
      <button
        type="button"
        className={`shift-row ${shift.cancelled ? 'is-cancelled' : ''}`}
        onClick={() => onClick(shift.id)}
      >
        <span
          className="loc-dot"
          style={{ background: `var(--loc-${location?.color ?? 'blue'})` }}
          aria-hidden="true"
        />

        <span className="shift-row__body">
          <span className="shift-row__top">
            <span className="shift-row__location">{location?.name ?? 'Local removido'}</span>
            <span className="shift-row__amount num">
              {formatMoneyCompact(shift.expectedAmount)}
            </span>
          </span>

          <span className="shift-row__meta num">
            {showDate && <span className="shift-row__date">{formatDateShort(shift.startDateTime)} · </span>}
            {formatTime(shift.startDateTime)} → {formatTime(shift.endDateTime)}
            {overnight && <span className="shift-row__plus">+1</span>}
            <span aria-hidden="true"> · </span>
            {formatDuration(view.durationHours)}
            {shift.title && <span className="shift-row__title"> · {shift.title}</span>}
          </span>
        </span>

        <span className="shift-row__end">
          {view.status === 'inProgress' ? (
            <span className="pill pill--success">
              <span className="pill__dot" aria-hidden="true" />
              Agora
            </span>
          ) : shift.cancelled ? (
            <span className="pill pill--neutral">Cancelado</span>
          ) : (
            <PaymentStatusPill status={view.paymentStatus} />
          )}
        </span>
      </button>
    </li>
  )
}
