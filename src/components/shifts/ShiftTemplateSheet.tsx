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
          /*
            Vazia, esta folha é a ÚNICA chance de explicar o recurso: a linha
            "Usar um modelo" agora aparece desde o começo, e quem toca nela sem
            ter modelo nenhum precisa sair sabendo como eles surgem. Depois do
            primeiro plantão a lista nunca mais fica vazia, então este texto é
            visto uma vez na vida do usuário — e por isso pode ser um passo a
            passo em vez de uma frase solta.
          */
          <>
            <EmptyState
              icon="copy"
              title="Ainda sem modelos"
              description="Modelo é um plantão que você já cadastrou, guardado para preencher o próximo."
            />
            <ol className="empty-steps">
              <li>Cadastre um plantão como sempre.</li>
              <li>Ele passa a aparecer nesta lista, com local, horário, tipo e valor.</li>
              <li>
                Tocar nele preenche tudo de uma vez — só a data continua sendo a que você
                escolheu.
              </li>
            </ol>
            <p className="form-note">
              Nada para configurar: os modelos se formam sozinhos conforme você usa o app, e
              os mais repetidos ficam no topo.
            </p>
          </>
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
