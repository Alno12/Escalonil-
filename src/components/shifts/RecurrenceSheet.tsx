import { Fragment, useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { toDate } from '@/domain/datetime'
import {
  CUSTOM_IDS,
  defaultCustom,
  normalizeWeekdays,
  recurrenceGroups,
  selectedOptionId,
  WEEKDAY_OPTIONS,
  type CustomKind,
  type Recurrence,
  type RecurrenceOption,
} from '@/domain/recurrence'
import type { LocalDate } from '@/db/types'

interface RecurrenceSheetProps {
  open: boolean
  value: Recurrence
  /** Data do primeiro plantão — três opções são descritas a partir dela. */
  startDate: LocalDate
  onChange: (recurrence: Recurrence) => void
  onClose: () => void
}

/**
 * Escolha da escala ou recorrência, no formato de lista agrupada do iOS.
 *
 * Escolher uma escala pronta aplica e volta na hora. As três "personalizadas"
 * abrem um editor ali mesmo, embaixo da linha, e continuam valendo enquanto o
 * usuário mexe nos números.
 */
export function RecurrenceSheet({
  open,
  value,
  startDate,
  onChange,
  onClose,
}: RecurrenceSheetProps) {
  const groups = useMemo(() => recurrenceGroups(startDate), [startDate])
  const [editing, setEditing] = useState<CustomKind | null>(null)
  // Com um editor aberto, a marca fica nele: é ele que manda no valor, mesmo
  // que os números coincidam com alguma escala pronta.
  const selected = editing ? CUSTOM_IDS[editing] : selectedOptionId(value, startDate)

  /**
   * Escolher aplica e volta na hora — menos nas linhas que abrem um ajuste
   * embaixo: fechar a folha ali esconderia justamente a escolha que falta.
   */
  const pick = (option: RecurrenceOption) => {
    onChange(option.recurrence)
    setEditing(null)
    if (!option.expand) onClose()
  }

  /** Abre o editor mantendo o que já estava escolhido, quando for do mesmo tipo. */
  const openEditor = (kind: CustomKind) => {
    setEditing(kind)
    const keep =
      (kind === 'hours' && value.kind === 'hours') ||
      (kind === 'days' && value.kind === 'days') ||
      (kind === 'weekdays' && value.kind === 'weekdays')
    if (!keep) onChange(defaultCustom(kind, startDate))
  }

  return (
    <Sheet
      open={open}
      title="Escala ou recorrência"
      onClose={onClose}
      closeLabel="Voltar"
      action={
        <button className="sheet__action-btn" onClick={onClose}>
          Concluir
        </button>
      }
    >
      <div className="form">
        {groups.map((group) => (
          <Fragment key={group.id}>
            {group.title && (
              <div className="section-header">
                <h2 className="section-header__title">{group.title}</h2>
              </div>
            )}
            <div className="card rows">
              {group.options.map((option) => (
                <Fragment key={option.id}>
                  <button
                    type="button"
                    className="row option"
                    aria-pressed={selected === option.id}
                    onClick={() =>
                      option.custom ? openEditor(option.custom) : pick(option)
                    }
                  >
                    <span className="row__label">{option.label}</span>
                    {selected === option.id && (
                      <span className="option__check" aria-hidden="true">
                        <Icon name="check" size={17} strokeWidth={2.4} />
                      </span>
                    )}
                  </button>

                  {option.custom && editing === option.custom && (
                    <CustomEditor
                      kind={option.custom}
                      value={value}
                      startDate={startDate}
                      onChange={onChange}
                    />
                  )}

                  {/* Ajuste da própria linha, aberto enquanto ela está marcada. */}
                  {option.expand === 'weekdays' && selected === option.id && (
                    <WeekdayPicker value={value} startDate={startDate} onChange={onChange} />
                  )}
                </Fragment>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </Sheet>
  )
}

/**
 * Os dias da semana, sem o intervalo — o intervalo é a própria linha que está
 * marcada ("Todas as semanas" ou "A cada 2 semanas"). Quem quiser outro
 * intervalo usa a linha personalizada, que traz o contador junto.
 */
function WeekdayPicker({
  value,
  startDate,
  onChange,
}: {
  value: Recurrence
  startDate: LocalDate
  onChange: (recurrence: Recurrence) => void
}) {
  const fallback = toDate(startDate).getDay()
  const everyWeeks = value.kind === 'weekdays' ? value.everyWeeks : 1
  const days = normalizeWeekdays(value.kind === 'weekdays' ? value.weekdays : [], fallback)

  /** Desmarcar o último dia não é permitido: a série ficaria sem nenhuma data. */
  const toggle = (day: number) => {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
    onChange({ kind: 'weekdays', weekdays: next.length > 0 ? next : days, everyWeeks })
  }

  return (
    <div className="row row--stack">
      <span className="row__label">Dias da semana</span>
      <div className="weekday-group" role="group" aria-label="Dias da semana">
        {WEEKDAY_OPTIONS.map((day) => (
          <button
            key={day.value}
            type="button"
            aria-pressed={days.includes(day.value)}
            className={`weekday ${days.includes(day.value) ? 'is-active' : ''}`}
            onClick={() => toggle(day.value)}
          >
            {day.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface CustomEditorProps {
  kind: CustomKind
  value: Recurrence
  startDate: LocalDate
  onChange: (recurrence: Recurrence) => void
}

function CustomEditor({ kind, value, startDate, onChange }: CustomEditorProps) {
  if (kind === 'weekdays') {
    const current =
      value.kind === 'weekdays' ? value : { weekdays: [toDate(startDate).getDay()], everyWeeks: 1 }
    const days = normalizeWeekdays(current.weekdays, toDate(startDate).getDay())

    /** Desmarcar o último dia não é permitido: a série ficaria sem nenhuma data. */
    const toggle = (day: number) => {
      const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
      onChange({ kind: 'weekdays', weekdays: next.length > 0 ? next : days, everyWeeks: current.everyWeeks })
    }

    return (
      <>
        <div className="row row--stack">
          <span className="row__label">Dias da semana</span>
          <div className="weekday-group" role="group" aria-label="Dias da semana">
            {WEEKDAY_OPTIONS.map((day) => (
              <button
                key={day.value}
                type="button"
                aria-pressed={days.includes(day.value)}
                className={`weekday ${days.includes(day.value) ? 'is-active' : ''}`}
                onClick={() => toggle(day.value)}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
        <Stepper
          label="Repetir a cada"
          value={current.everyWeeks}
          min={1}
          max={8}
          suffix={current.everyWeeks === 1 ? ' semana' : ' semanas'}
          onChange={(everyWeeks) => onChange({ kind: 'weekdays', weekdays: days, everyWeeks })}
        />
      </>
    )
  }

  const unit = kind === 'hours' ? 'h' : kind === 'days' ? 'd' : ''
  const segment =
    value.kind === kind && value.segments[0]
      ? value.segments[0]
      : { work: kind === 'hours' ? 12 : 1, off: kind === 'hours' ? 36 : 1 }
  const set = (work: number, off: number) =>
    onChange(
      kind === 'hours'
        ? { kind: 'hours', segments: [{ work, off }] }
        : { kind: 'days', segments: [{ work, off }] },
    )
  const cycle = segment.work + segment.off

  return (
    <>
      <Stepper
        label={kind === 'hours' ? 'Horas de trabalho' : 'Dias de trabalho'}
        value={segment.work}
        min={1}
        max={kind === 'hours' ? 72 : 30}
        suffix={unit}
        onChange={(work) => set(work, segment.off)}
      />
      <Stepper
        label={kind === 'hours' ? 'Horas de folga' : 'Dias de folga'}
        value={segment.off}
        min={0}
        max={kind === 'hours' ? 240 : 60}
        suffix={unit}
        onChange={(off) => set(segment.work, off)}
      />
      <div className="row">
        <span className="row__label">Ciclo</span>
        <span className="row__value num">
          {kind === 'hours'
            ? `${cycle}h · ${formatCycleDays(cycle)}`
            : `${cycle} ${cycle === 1 ? 'dia' : 'dias'}`}
        </span>
      </div>
    </>
  )
}

/** "2 dias" para 48h, "1 dia e 12h" para 36h — o intervalo entre dois plantões. */
function formatCycleDays(hours: number): string {
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  if (days === 0) return `${rest}h`
  const dayLabel = `${days} ${days === 1 ? 'dia' : 'dias'}`
  return rest === 0 ? dayLabel : `${dayLabel} e ${rest}h`
}

interface StepperProps {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (value: number) => void
}

function Stepper({ label, value, min, max, suffix = '', onChange }: StepperProps) {
  return (
    <div className="row">
      <span className="row__label">{label}</span>
      <span className="stepper">
        <button
          type="button"
          className="stepper__btn"
          disabled={value <= min}
          aria-label={`Diminuir ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Icon name="minus" size={16} strokeWidth={2.4} />
        </button>
        <span className="stepper__value num">
          {value}
          {suffix}
        </span>
        <button
          type="button"
          className="stepper__btn"
          disabled={value >= max}
          aria-label={`Aumentar ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Icon name="plus" size={16} strokeWidth={2.4} />
        </button>
      </span>
    </div>
  )
}
