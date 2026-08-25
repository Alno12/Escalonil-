import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { useAppData } from '@/state/appDataContext'
import { useToast } from '@/state/toastContext'
import { registerPayments } from '@/data/repository'
import { formatDate, todayISO } from '@/domain/datetime'
import { formatMoney } from '@/domain/money'

interface BatchPaymentSheetProps {
  open: boolean
  shiftIds: string[]
  onClose: () => void
  onDone: () => void
}

/**
 * Recebimento em lote: na vida real o hospital deposita o mês inteiro de uma
 * vez. Cada plantão entra pelo próprio valor previsto — nenhum valor é rateado
 * ou inventado. Se algum veio diferente, o ajuste é feito plantão a plantão.
 */
export function BatchPaymentSheet({ open, shiftIds, onClose, onDone }: BatchPaymentSheetProps) {
  const { viewById } = useAppData()
  const toast = useToast()

  const [receivedDate, setReceivedDate] = useState(() => todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const views = shiftIds.map((id) => viewById.get(id)).filter((v) => v !== undefined)
  const total = views.reduce((sum, v) => sum + v.shift.expectedAmount, 0)

  async function save() {
    setSaving(true)
    try {
      const count = await registerPayments(shiftIds, receivedDate)
      toast.success(
        count === 1 ? 'Pagamento registrado' : `${count} pagamentos registrados`,
      )
      onDone()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível registrar os pagamentos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      title="Registrar recebimentos"
      subtitle={`${views.length} ${views.length === 1 ? 'plantão' : 'plantões'}`}
      onClose={onClose}
      size="auto"
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => void save()}
          disabled={saving || views.length === 0}
        >
          {saving ? 'Salvando…' : `Marcar ${views.length} como recebidos`}
        </Button>
      }
    >
      <div className="form">
        <div className="batch-total">
          <span className="batch-total__label">Total</span>
          <strong className="batch-total__value num">{formatMoney(total)}</strong>
        </div>

        <Field
          label="Data do recebimento"
          htmlFor="batch-date"
          hint="Vale para todos os plantões selecionados."
        >
          <TextInput
            id="batch-date"
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
          />
        </Field>

        <div className="alert alert--info">
          <Icon name="info" size={18} />
          <span>
            Cada plantão é registrado pelo seu valor previsto. Se algum veio diferente, abra
            esse plantão depois e ajuste o valor recebido.
          </span>
        </div>

        <ul className="batch-list">
          {views.map((view) => (
            <li key={view.shift.id}>
              <span className="batch-list__name">{view.location?.name ?? 'Local removido'}</span>
              <span className="batch-list__meta num">{formatDate(view.shift.startDateTime)}</span>
              <span className="batch-list__amount num">
                {formatMoney(view.shift.expectedAmount)}
              </span>
            </li>
          ))}
        </ul>

        {error && (
          <div className="alert alert--danger" role="alert">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Sheet>
  )
}
