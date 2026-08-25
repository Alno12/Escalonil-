import type { PaymentStatus, ShiftStatus } from '@/db/types'
import { paymentStatusLabel, paymentStatusTone, shiftStatusLabel, shiftStatusTone } from '@/domain/shift'

type Tone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger'

export function Pill({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: React.ReactNode
  tone?: Tone
  dot?: boolean
}) {
  return (
    <span className={`pill pill--${tone}`}>
      {dot && <span className="pill__dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

export function ShiftStatusPill({ status }: { status: ShiftStatus }) {
  return (
    <Pill tone={shiftStatusTone[status]} dot={status === 'inProgress'}>
      {shiftStatusLabel[status]}
    </Pill>
  )
}

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  if (status === 'notEligible' || status === 'cancelled') return null
  return <Pill tone={paymentStatusTone[status]}>{paymentStatusLabel[status]}</Pill>
}
