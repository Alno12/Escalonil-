import { useState } from 'react'
import { Card, SectionHeader } from '@/components/ui/Card'
import { ChipGroup, Field, FieldRow, MoneyInput } from '@/components/ui/Field'
import { useAppData } from '@/state/appDataContext'
import { saveSettings } from '@/data/repository'
import { moneyToInput, parseMoneyInput } from '@/domain/money'

/** Valores que já vêm preenchidos ao cadastrar um plantão novo. */
export function PreferencesSection() {
  const { settings } = useAppData()

  return (
    <section aria-label="Preferências financeiras">
      <SectionHeader title="Preferências" hint="Usadas para preencher novos plantões" />
      <Card>
        <div className="form">
          <Field label="Forma de pagamento padrão">
            <ChipGroup
              ariaLabel="Forma de pagamento padrão"
              options={[
                { value: 'fixed', label: 'Valor fixo' },
                { value: 'hourly', label: 'Valor por hora' },
              ]}
              value={settings.defaultPaymentMode}
              onChange={(value) => {
                void saveSettings({ defaultPaymentMode: value as 'fixed' | 'hourly' })
              }}
            />
          </Field>

          <FieldRow>
            <MoneyPref
              key={`fixed-${settings.defaultFixedAmount}`}
              id="pref-fixed"
              label="Valor fixo padrão"
              amount={settings.defaultFixedAmount}
              onSave={(defaultFixedAmount) => void saveSettings({ defaultFixedAmount })}
            />
            <MoneyPref
              key={`hourly-${settings.defaultHourlyRate}`}
              id="pref-hourly"
              label="Valor/hora padrão"
              suffix="/h"
              amount={settings.defaultHourlyRate}
              onSave={(defaultHourlyRate) => void saveSettings({ defaultHourlyRate })}
            />
          </FieldRow>
        </div>
      </Card>
    </section>
  )
}

interface MoneyPrefProps {
  id: string
  label: string
  amount: number
  suffix?: string
  onSave: (value: number) => void
}

/**
 * Um valor padrão, com o texto digitado em estado local e a gravação no blur.
 *
 * Cada campo é remontado pela SUA chave, e não por uma chave do formulário
 * inteiro: gravar um valor remontava os dois, e o campo que o usuário tinha
 * acabado de tocar perdia o foco — no iPhone, o teclado abria e fechava. Como
 * a remontagem agora só atinge o campo que já está desfocado, ela não
 * atrapalha nada e continua servindo para o que existe: trazer os valores
 * novos depois de restaurar um backup.
 */
function MoneyPref({ id, label, amount, suffix, onSave }: MoneyPrefProps) {
  const [text, setText] = useState(() => moneyToInput(amount))

  return (
    <Field label={label} htmlFor={id}>
      <MoneyInput
        id={id}
        value={text}
        suffix={suffix}
        onValueChange={setText}
        onBlur={() => onSave(parseMoneyInput(text))}
      />
    </Field>
  )
}
