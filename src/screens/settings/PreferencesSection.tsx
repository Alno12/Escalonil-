import { useState } from 'react'
import { Card, SectionHeader } from '@/components/ui/Card'
import { ChipGroup, Field, FieldRow, MoneyInput } from '@/components/ui/Field'
import { useAppData } from '@/state/appDataContext'
import { saveSettings } from '@/data/repository'
import type { Settings } from '@/db/types'
import { parseMoneyInput } from '@/domain/money'

const moneyToText = (value: number) => (value > 0 ? String(value).replace('.', ',') : '')

/** Valores que já vêm preenchidos ao cadastrar um plantão novo. */
export function PreferencesSection() {
  const { settings } = useAppData()

  // A chave remonta o formulário quando as preferências mudam por fora
  // (por exemplo, ao restaurar um backup), sem efeito de sincronização.
  const signature = `${settings.defaultFixedAmount}|${settings.defaultHourlyRate}`

  return (
    <section aria-label="Preferências financeiras">
      <SectionHeader title="Preferências" hint="Usadas para preencher novos plantões" />
      <Card>
        <PreferencesForm key={signature} settings={settings} />
      </Card>
    </section>
  )
}

function PreferencesForm({ settings }: { settings: Settings }) {
  const [fixed, setFixed] = useState(moneyToText(settings.defaultFixedAmount))
  const [hourly, setHourly] = useState(moneyToText(settings.defaultHourlyRate))

  return (
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
        <Field label="Valor fixo padrão" htmlFor="pref-fixed">
          <MoneyInput
            id="pref-fixed"
            value={fixed}
            placeholder="0"
            onChange={(e) => setFixed(e.target.value)}
            onBlur={() => void saveSettings({ defaultFixedAmount: parseMoneyInput(fixed) })}
          />
        </Field>
        <Field label="Valor/hora padrão" htmlFor="pref-hourly">
          <MoneyInput
            id="pref-hourly"
            value={hourly}
            placeholder="0"
            suffix="/h"
            onChange={(e) => setHourly(e.target.value)}
            onBlur={() => void saveSettings({ defaultHourlyRate: parseMoneyInput(hourly) })}
          />
        </Field>
      </FieldRow>

    </div>
  )
}
