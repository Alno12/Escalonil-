import type { ShiftView } from '@/db/types'
import { formatDateShort, formatDuration, formatTime, isSameDay } from '@/domain/datetime'
import { formatMoney } from '@/domain/money'
import { PaymentStatusPill } from '@/components/ui/StatusPill'
import { Icon } from '@/components/ui/Icon'

interface ShiftRowProps {
  view: ShiftView
  onClick: (id: string) => void
  /** Mostra a data na coluna da esquerda — usado em listas sem agrupamento. */
  showDate?: boolean
}

/**
 * Linha de plantão pensada para leitura rápida (§11): horário à esquerda,
 * local em destaque, duração e valor logo abaixo.
 */
export function ShiftRow({ view, onClick, showDate = false }: ShiftRowProps) {
  const { shift, location } = view
  const overnight = !isSameDay(shift.startDateTime, shift.endDateTime)

  return (
    <li>
      <button
        type="button"
        className={`shift-row ${shift.cancelled ? 'is-cancelled' : ''} status-${view.status}`}
        onClick={() => onClick(shift.id)}
      >
        <span className="shift-row__rail" aria-hidden="true" />

        <span className="shift-row__time num">
          {showDate && <span className="shift-row__date">{formatDateShort(shift.startDateTime)}</span>}
          <span className="shift-row__start">{formatTime(shift.startDateTime)}</span>
          <span className="shift-row__end">
            {formatTime(shift.endDateTime)}
            {overnight && <span className="shift-row__plus">+1</span>}
          </span>
        </span>

        <span className="shift-row__main">
          <span className="shift-row__location">{location?.name ?? 'Local removido'}</span>
          <span className="shift-row__meta num">
            {formatDuration(view.durationHours)}
            <span aria-hidden="true"> · </span>
            {formatMoney(shift.expectedAmount)}
            {shift.shiftType && (
              <>
                <span aria-hidden="true"> · </span>
                {shift.shiftType}
              </>
            )}
          </span>
        </span>

        <span className="shift-row__end-slot">
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
          <Icon name="chevronRight" size={16} className="shift-row__chevron" />
        </span>
      </button>
    </li>
  )
}
