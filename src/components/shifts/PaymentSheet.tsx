import { useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, MoneyInput, TextArea, TextInput } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { useAppData } from '@/state/appDataContext'
import { useToast } from '@/state/toastContext'
import { registerPayment, removePayment } from '@/data/repository'
import { formatDate, formatDuration, todayISO } from '@/domain/datetime'
import {
  formatMoney,
  formatMoneySigned,
  moneyToInput,
  parseMoneyInput,
  roundMoney,
} from '@/domain/money'

interface PaymentSheetProps {
  open: boolean
  shiftId: string
  onClose: () => void
}

/** Registro de recebimento (§25) com indicador de divergência (§26). */
export function PaymentSheet({ open, shiftId, onClose }: PaymentSheetProps) {
  const { viewById } = useAppData()
  const toast = useToast()
  const view = viewById.get(shiftId)

  // Ao marcar como recebido já vem preenchido com hoje e o valor previsto.
  const [receivedDate, setReceivedDate] = useState(() => view?.payment?.receivedDate ?? todayISO())
  const [amountText, setAmountText] = useState(() =>
    moneyToInput(view?.payment?.receivedAmount ?? view?.shift.expectedAmount ?? 0),
  )
  const [notes, setNotes] = useState(() => view?.payment?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expected = view?.payment?.expectedAmount ?? view?.shift.expectedAmount ?? 0
  const received = useMemo(() => parseMoneyInput(amountText), [amountText])
  const difference = roundMoney(received - expected)
  const hasDifference = Math.abs(difference) >= 0.01

  if (!view) return null

  async function save() {
    setSaving(true)
    try {
      await registerPayment(shiftId, { receivedAmount: received, receivedDate, notes: notes.trim() })
      toast.success('Pagamento registrado')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível registrar o pagamento.')
    } finally {
      setSaving(false)
    }
  }

  async function undo() {
    await removePayment(shiftId)
    toast.show('Recebimento desfeito')
    onClose()
  }

  return (
    <Sheet
      open={open}
      title={view.payment ? 'Editar recebimento' : 'Registrar recebimento'}
      subtitle={view.location?.name}
      onClose={onClose}
      size="auto"
      footer={
        <Button variant="primary" size="lg" block onClick={() => void save()} disabled={saving}>
          {saving ? 'Salvando…' : view.payment ? 'Salvar alterações' : 'Marcar como recebido'}
        </Button>
      }
    >
      <div className="form">
        <div className="payment-summary">
          <div>
            <span className="payment-summary__label">Plantão</span>
            <strong>{formatDate(view.shift.startDateTime)}</strong>
            <span className="payment-summary__meta num">
              {formatDuration(view.durationHours)} · previsto {formatMoney(expected)}
            </span>
          </div>
        </div>

        <Field label="Data do recebimento" htmlFor="payment-date">
          <TextInput
            id="payment-date"
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
          />
        </Field>

        <Field label="Valor recebido" htmlFor="payment-amount">
          <MoneyInput
            id="payment-amount"
            value={amountText}
            onValueChange={setAmountText}
          />
        </Field>

        {hasDifference && (
          <div className={`alert ${difference < 0 ? 'alert--warning' : 'alert--success'}`}>
            <Icon name={difference < 0 ? 'arrowDown' : 'arrowUp'} size={18} />
            <div>
              <strong>
                {difference < 0 ? 'Recebido abaixo do previsto' : 'Recebido acima do previsto'}
              </strong>
              <p className="num">
                Esperado {formatMoney(expected)} · Recebido {formatMoney(received)}
              </p>
              <p className="alert__figure num">{formatMoneySigned(difference)}</p>
            </div>
          </div>
        )}

        <Field label="Observação" htmlFor="payment-notes" optional>
          <TextArea
            id="payment-notes"
            value={notes}
            placeholder="Pago com desconto de imposto."
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        {error && (
          <div className="alert alert--danger" role="alert">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        )}

        {view.payment && (
          <Button variant="quiet" block icon="refresh" onClick={() => void undo()}>
            Desfazer recebimento
          </Button>
        )}
      </div>
    </Sheet>
  )
}
