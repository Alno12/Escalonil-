import { useState } from 'react'
import { Card, SectionHeader } from '@/components/ui/Card'
import { Field, Switch, TextInput } from '@/components/ui/Field'
import { useAppData } from '@/state/appDataContext'
import { saveSettings } from '@/data/repository'
import { vacationCountdown } from '@/domain/vacation'

/** A contagem das férias que aparece embaixo do cartão do próximo plantão. */
export function VacationSection() {
  const { settings, today } = useAppData()
  const preview = vacationCountdown(settings.vacationDate, today, settings.vacationEnabled)
  const expired =
    settings.vacationEnabled &&
    settings.vacationDate !== null &&
    vacationCountdown(settings.vacationDate, today) === null

  return (
    <section aria-label="Férias">
      <SectionHeader title="Férias" hint="A contagem que aparece no Início" />
      <Card padded={false}>
        <div className="rows">
          <div className="row">
            <span className="row__label">Mostrar a contagem</span>
            <span className="row__value">
              <Switch
                checked={settings.vacationEnabled}
                ariaLabel="Mostrar a contagem das férias no Início"
                onChange={(vacationEnabled) => void saveSettings({ vacationEnabled })}
              />
            </span>
          </div>
        </div>

        <div className="form form--inset">
          <VacationDate
            key={settings.vacationDate ?? 'sem-data'}
            value={settings.vacationDate ?? ''}
            onSave={(vacationDate) => void saveSettings({ vacationDate: vacationDate || null })}
          />

          <p className="vacation-preview">
            {preview ?? (expired ? 'A data já passou — marque a próxima.' : 'Nada aparece no Início.')}
          </p>
        </div>
      </Card>
    </section>
  )
}

/**
 * A data em estado local, gravada a cada escolha.
 *
 * A chave vem da data guardada, como nas preferências de valor: o campo só é
 * remontado quando o banco muda por fora — restaurar um backup, por exemplo —
 * e não a cada tecla.
 */
function VacationDate({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [date, setDate] = useState(value)

  return (
    <Field label="Primeiro dia de férias" htmlFor="vacation-date">
      <TextInput
        id="vacation-date"
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value)
          onSave(e.target.value)
        }}
      />
    </Field>
  )
}
