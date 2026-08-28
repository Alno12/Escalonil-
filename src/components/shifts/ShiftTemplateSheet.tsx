import { Sheet } from '@/components/ui/Sheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { addHours, formatDuration, formatTime, joinDateTime } from '@/domain/datetime'
import { formatMoneyCompact } from '@/domain/money'
import type { ShiftTemplate } from '@/domain/templates'

interface ShiftTemplateSheetProps {
  open: boolean
  templates: ShiftTemplate[]
  /** Data escolhida no formulário — só para mostrar o horário que vai sair. */
  startDate: string
  onPick: (template: ShiftTemplate) => void
  onClose: () => void
}

/**
 * Os plantões que o médico já fez, prontos para preencher o formulário.
 *
 * A anatomia é a mesma linha de plantão da agenda de propósito: o médico
 * reconhece o plantão pelo formato que já conhece, não por um cartão novo.
 */
export function ShiftTemplateSheet({
  open,
  templates,
  startDate,
  onPick,
  onClose,
}: ShiftTemplateSheetProps) {
  const pick = (template: ShiftTemplate) => {
    onPick(template)
    onClose()
  }

  return (
    <Sheet open={open} title="Modelos" onClose={onClose} closeLabel="Voltar">
      <div className="form">
        {templates.length === 0 ? (
          <EmptyState
            icon="copy"
            title="Ainda sem modelos"
            description="Depois do primeiro plantão cadastrado, ele aparece aqui para você preencher o próximo em um toque."
          />
        ) : (
          <>
            {/*
              "Mais usados" só é verdade quando ALGUM se repetiu. Com o mínimo
              em 1, quem varia horário e valor vê uma lista inteira de plantões
              de uma vez só — e chamá-la de "mais usados" seria mentira.
            */}
            <div className="section-header">
              <div>
                <h2 className="section-header__title">
                  {templates.some((t) => t.uses > 1) ? 'Mais usados' : 'Recentes'}
                </h2>
                <p className="section-header__hint">Toque para preencher o plantão</p>
              </div>
            </div>

            <ul className="shift-list">
              {templates.map((template) => {
                const end = addHours(
                  joinDateTime(startDate, template.startTime),
                  template.durationHours,
                )
                const overnight = end.slice(0, 10) !== startDate
                return (
                  <li key={template.id}>
                    <button type="button" className="shift-row" onClick={() => pick(template)}>
                      <span
                        className="loc-dot"
                        style={{ background: `var(--loc-${template.color})` }}
                        aria-hidden="true"
                      />

                      <span className="shift-row__body">
                        <span className="shift-row__top">
                          <span className="shift-row__location">{template.locationName}</span>
                          <span className="shift-row__amount num">
                            {formatMoneyCompact(template.expectedAmount)}
                          </span>
                        </span>

                        <span className="shift-row__meta num">
                          {template.startTime} → {formatTime(end)}
                          {overnight && <span className="shift-row__plus">+1</span>}
                          <span aria-hidden="true"> · </span>
                          {formatDuration(template.durationHours)}
                          {template.title && (
                            <span className="shift-row__title"> · {template.title}</span>
                          )}
                          {template.shiftType && (
                            <span className="shift-row__title"> · {template.shiftType}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <p className="form-note">
              O modelo traz local, horário e valor. A data continua sendo a que você escolheu.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
