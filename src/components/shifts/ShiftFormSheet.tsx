import { useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { useAppData } from '@/state/appDataContext'
import { useToast } from '@/state/toastContext'
import {
  createShifts,
  ensureLocation,
  updateSeriesFrom,
  updateShift,
  type ShiftInput,
} from '@/data/repository'
import { useMoneyMask } from '@/hooks/useMoneyMask'
import { findConflicts } from '@/domain/conflicts'
import { findLocationByName } from '@/domain/location'
import { buildShiftTemplates, type ShiftTemplate } from '@/domain/templates'
import {
  addHours,
  datePartOf,
  formatDate,
  formatDayMonth,
  formatDuration,
  formatTime,
  joinDateTime,
  timePartOf,
  toDate,
} from '@/domain/datetime'
import { formatMoney, parseMoneyInput } from '@/domain/money'
import type { LocationColor } from '@/db/types'
import {
  normalizeWeekdays,
  recurrenceLabel,
  recurrenceShiftHours,
  WEEKDAY_OPTIONS,
  type Recurrence,
} from '@/domain/recurrence'
import { LocationSheet } from './LocationSheet'
import { RecurrenceSheet } from './RecurrenceSheet'
import { ShiftTemplateSheet } from './ShiftTemplateSheet'
import {
  activeDurationShortcut,
  applyDuration,
  applyTemplate,
  DURATION_SHORTCUTS,
  formDuration,
  formExpectedAmount,
  formRange,
  repeatStarts,
  syncMoney,
  type ShiftFormValues,
} from './shiftFormValues'

export type ShiftFormMode = 'create' | 'edit' | 'duplicate'

interface ShiftFormSheetProps {
  /** Uma nova sessão de formulário remonta o componente (ver ShiftSheetsProvider). */
  open: boolean
  mode: ShiftFormMode
  shiftId?: string
  initialValues: ShiftFormValues
  onClose: () => void
}

const TITLES: Record<ShiftFormMode, string> = {
  create: 'Novo plantão',
  edit: 'Editar plantão',
  duplicate: 'Duplicar plantão',
}

export function ShiftFormSheet({
  open,
  mode,
  shiftId,
  initialValues,
  onClose,
}: ShiftFormSheetProps) {
  const { shifts, locations, settings } = useAppData()
  const toast = useToast()

  const [values, setValues] = useState<ShiftFormValues>(initialValues)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmConflict, setConfirmConflict] = useState(false)
  const [confirmSeries, setConfirmSeries] = useState(false)
  const [pickingRecurrence, setPickingRecurrence] = useState(false)
  const [pickingLocation, setPickingLocation] = useState(false)
  const [pickingTemplate, setPickingTemplate] = useState(false)

  const patch = (next: Partial<ShiftFormValues>) => {
    setValues((prev) => ({ ...prev, ...next }))
    setError(null)
  }

  /** Mover o início arrasta o término junto, preservando a duração. */
  const moveStart = (startDate: string, startTime: string) => {
    setValues((prev) => {
      const hours = formDuration(prev)
      const end = addHours(joinDateTime(startDate, startTime), Math.max(hours, 0))
      return {
        ...prev,
        startDate,
        startTime,
        endDate: datePartOf(end),
        endTime: timePartOf(end),
      }
    })
    setError(null)
  }

  // Os dois campos de dinheiro se preenchem da direita para a esquerda e
  // continuam espelhando um ao outro pela duração.
  const amountMask = useMoneyMask((amountText) =>
    setValues((prev) => syncMoney({ ...prev, amountText }, 'fixed')),
  )
  const hourlyMask = useMoneyMask((hourlyText) =>
    setValues((prev) => syncMoney({ ...prev, hourlyText }, 'hourly')),
  )

  const range = useMemo(() => formRange(values), [values])
  const duration = formDuration(values)
  const expectedAmount = useMemo(() => formExpectedAmount(values), [values])
  const activeShortcut = activeDurationShortcut(values)
  const crossesDay = values.endDate !== values.startDate

  const weekdayStart = toDate(values.startDate).getDay()
  const weekdays =
    values.recurrence.kind === 'weekdays'
      ? normalizeWeekdays(values.recurrence.weekdays, weekdayStart)
      : []

  /** Desmarcar o último dia não é permitido: a série ficaria sem nenhuma data. */
  const toggleWeekday = (day: number) =>
    setValues((prev) => {
      if (prev.recurrence.kind !== 'weekdays') return prev
      const current = normalizeWeekdays(prev.recurrence.weekdays, weekdayStart)
      const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
      return {
        ...prev,
        recurrence: { ...prev.recurrence, weekdays: next.length > 0 ? next : current },
      }
    })

  /**
   * O local manda na cor (invariante 10): escolher um lugar já usado traz a
   * cor dele. Para um nome novo vale a cor oferecida pelo seletor — a próxima
   * livre da paleta —, senão dois locais novos nasceriam com a mesma cor.
   */
  const chooseLocation = (locationName: string, color?: LocationColor) =>
    setValues((prev) => {
      const known = findLocationByName(locations, locationName)
      return { ...prev, locationName, color: known?.color ?? color ?? prev.color }
    })

  /**
   * Escolher uma escala de horas define a duração do plantão: um 12×36 é
   * feito de plantões de 12 horas.
   */
  const chooseRecurrence = (recurrence: Recurrence) =>
    setValues((prev) => {
      const hours = recurrenceShiftHours(recurrence)
      return { ...applyDuration(prev, hours ?? formDuration(prev)), recurrence }
    })

  /**
   * Modelos deduzidos do histórico. Só na criação: duplicar já traz tudo do
   * plantão de origem, e editar um plantão que existe não recomeça do zero.
   */
  const templates = useMemo(
    () => (mode === 'create' ? buildShiftTemplates(shifts, locations) : []),
    [mode, shifts, locations],
  )

  const chooseTemplate = (template: ShiftTemplate) =>
    setValues((prev) => applyTemplate(prev, template))

  /**
   * Plantões da mesma escala que vêm DEPOIS deste. Só existe ao editar, e é o
   * que decide se a gravação pergunta o alcance.
   */
  const original = mode === 'edit' && shiftId ? shifts.find((s) => s.id === shiftId) : undefined
  const following = useMemo(
    () =>
      original?.seriesId
        ? shifts.filter(
            (s) =>
              s.seriesId === original.seriesId &&
              s.id !== original.id &&
              s.startDateTime > original.startDateTime,
          )
        : [],
    [shifts, original],
  )
  const dateChanged = original ? datePartOf(original.startDateTime) !== values.startDate : false

  const canRepeat = mode !== 'edit'
  const repeats = canRepeat && values.recurrence.kind !== 'none'
  const occurrences = useMemo(
    () => (canRepeat ? repeatStarts(values) : [joinDateTime(values.startDate, values.startTime)]),
    [canRepeat, values],
  )

  const ranges = useMemo(
    () =>
      occurrences.map((start) => ({
        startDateTime: start,
        endDateTime: addHours(start, duration),
      })),
    [occurrences, duration],
  )

  // Conflito é verificado em TODAS as datas geradas, não só na primeira.
  const conflicts = useMemo(() => {
    const seen = new Set<string>()
    return ranges.flatMap((r) =>
      findConflicts({ id: shiftId, ...r }, shifts).filter((c) => {
        if (seen.has(c.id)) return false
        seen.add(c.id)
        return true
      }),
    )
  }, [ranges, shifts, shiftId])

  const knownLocation = findLocationByName(locations, values.locationName)

  async function persist(scope: 'one' | 'forward' = 'one') {
    setSaving(true)
    try {
      const location = await ensureLocation(values.locationName, values.color)
      const input: ShiftInput = {
        ...range,
        title: values.title.trim(),
        locationId: location.id,
        shiftType: values.shiftType,
        paymentMode: values.paymentMode,
        fixedAmount: parseMoneyInput(values.amountText),
        hourlyRate: parseMoneyInput(values.hourlyText),
        notes: values.notes.trim(),
      }

      if (mode === 'edit' && shiftId) {
        if (scope === 'forward') {
          const total = await updateSeriesFrom(shiftId, input)
          toast.success(
            total === 1 ? 'Plantão atualizado' : `${total} plantões atualizados`,
          )
        } else {
          await updateShift(shiftId, input)
          toast.success('Plantão atualizado')
        }
      } else {
        const created = await createShifts(ranges.map((r) => ({ ...input, ...r })))
        toast.success(created.length === 1 ? 'Plantão salvo' : `${created.length} plantões salvos`)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o plantão.')
    } finally {
      setSaving(false)
      setConfirmConflict(false)
      setConfirmSeries(false)
    }
  }

  function handleSubmit() {
    if (!values.locationName.trim()) {
      setError('Informe o local do plantão.')
      return
    }
    if (duration <= 0) {
      setError('O término precisa ser depois do início.')
      return
    }
    // O conflito avisa mas não bloqueia: quem decide é o usuário.
    if (conflicts.length > 0) {
      setConfirmConflict(true)
      return
    }
    askScope()
  }

  /** Editar um plantão de escala pergunta o alcance antes de gravar. */
  function askScope() {
    setConfirmConflict(false)
    if (following.length > 0) {
      setConfirmSeries(true)
      return
    }
    void persist('one')
  }

  const saveLabel =
    mode === 'edit' ? 'Salvar' : occurrences.length > 1 ? `Salvar ${occurrences.length}` : 'Salvar'

  return (
    <>
      <Sheet
        open={open}
        title={TITLES[mode]}
        onClose={onClose}
        action={
          <button className="sheet__action-btn" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando…' : saveLabel}
          </button>
        }
      >
        <div className="form">
          {/* ---- Modelos ---- */}
          {/*
            Cartão próprio, acima de tudo: é uma AÇÃO que preenche o resto, não
            mais um campo do plantão.

            A linha aparece SEMPRE ao criar, inclusive sem nenhum modelo ainda.
            Ela já sumiu nesse caso, pela ideia de que folha vazia é pior que
            linha nenhuma — só que quem instala o app hoje nunca a via, e por
            isso nunca ficava sabendo que o recurso existe. Some para sempre é
            pior que vazia uma vez: a folha vazia explica em uma frase o que
            fazer para os modelos aparecerem, e some sozinha no primeiro
            plantão cadastrado.
          */}
          <div className="card rows">
            <button
              type="button"
              className="row row--action"
              onClick={() => setPickingTemplate(true)}
            >
              <span className="row__icon row__icon--soft" aria-hidden="true">
                <Icon name="copy" size={18} />
              </span>
              <span className="row__label">Usar um modelo</span>
              <Icon name="chevronRight" size={17} className="row__chevron" />
            </button>
          </div>

          {/* ---- Identificação ---- */}
          <div className="card rows">
            <label className="row">
              <span className="row__label">Título</span>
              <input
                className="input"
                type="text"
                value={values.title}
                placeholder="Opcional"
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>

            {/* Sem nenhum local salvo não há o que escolher: o campo de texto
                evita uma tela intermediária vazia no primeiro plantão. */}
            {locations.length === 0 ? (
              <label className="row">
                <span className="row__label">Local</span>
                <input
                  className="input"
                  type="text"
                  value={values.locationName}
                  placeholder="Nome do local"
                  autoComplete="off"
                  onChange={(e) => chooseLocation(e.target.value)}
                />
              </label>
            ) : (
              <button type="button" className="row" onClick={() => setPickingLocation(true)}>
                <span className="row__label">Local</span>
                <span
                  className={`row__value ${values.locationName.trim() ? '' : 'row__value--muted'}`}
                >
                  {values.locationName.trim() || 'Escolher'}
                </span>
                <Icon name="chevronRight" size={17} className="row__chevron" />
              </button>
            )}

            <div className="row">
              <span className="row__label">Cor</span>
              <ColorPicker
                value={values.color}
                onChange={(color: LocationColor) => patch({ color })}
              />
            </div>

            <label className="row">
              <span className="row__label">Tipo</span>
              <select
                className="input row__select"
                value={values.shiftType}
                onChange={(e) => patch({ shiftType: e.target.value })}
              >
                <option value="">Nenhum</option>
                {settings.shiftTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {knownLocation && knownLocation.color !== values.color && (
            <p className="form-note">
              A cor vale para todos os plantões em {knownLocation.name}.
            </p>
          )}

          {/* ---- Horário ---- */}
          <div className="card rows">
            <label className="row">
              <span className="row__label">Começa</span>
              <span className="row__pair">
                <input
                  className="input"
                  type="date"
                  value={values.startDate}
                  onChange={(e) => moveStart(e.target.value, values.startTime)}
                />
                <input
                  className="input"
                  type="time"
                  step={300}
                  value={values.startTime}
                  onChange={(e) => moveStart(values.startDate, e.target.value)}
                />
              </span>
            </label>

            <label className="row">
              <span className="row__label">Termina</span>
              <span className="row__pair">
                <input
                  className="input"
                  type="date"
                  value={values.endDate}
                  onChange={(e) => patch({ endDate: e.target.value })}
                />
                <input
                  className="input"
                  type="time"
                  step={300}
                  value={values.endTime}
                  onChange={(e) => patch({ endTime: e.target.value })}
                />
              </span>
            </label>
          </div>

          <div className="chip-group chip-group--even">
            {DURATION_SHORTCUTS.map((hours) => (
              <button
                key={hours}
                type="button"
                className={`chip num ${activeShortcut === hours ? 'is-active' : ''}`}
                onClick={() => setValues((prev) => applyDuration(prev, hours))}
              >
                {hours}h
              </button>
            ))}
          </div>
          <p className="form-note num">
            {duration > 0
              ? `${formatDuration(duration)} · termina ${formatDayMonth(range.endDateTime)}${
                  crossesDay ? '' : ' (mesmo dia)'
                }`
              : 'O término precisa ser depois do início.'}
          </p>

          {/* ---- Recorrência ---- */}
          {/* Um plantão que já existe não ganha escala: mostrar o seletor aqui
              seria um controle que não faz nada. Para mexer numa escala já
              criada, edite um plantão dela e escolha "e os próximos". */}
          {canRepeat && (
          <>
          <div className="section-header">
            <h2 className="section-header__title">Repetir</h2>
          </div>
          <div className="card rows">
            <button
              type="button"
              className="row"
              onClick={() => setPickingRecurrence(true)}
            >
              <span className="row__label">Frequência</span>
              <span className="row__value">
                {recurrenceLabel(values.recurrence, values.startDate)}
              </span>
              <Icon name="chevronRight" size={17} className="row__chevron" />
            </button>

            {values.recurrence.kind === 'weekdays' && (
              <div className="row row--stack">
                <span className="row__label">Dias da semana</span>
                <div className="weekday-group" role="group" aria-label="Dias da semana">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const active = weekdays.includes(day.value)
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={active}
                        className={`weekday ${active ? 'is-active' : ''}`}
                        onClick={() => toggleWeekday(day.value)}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {values.recurrence.kind !== 'none' && (
              <label className="row">
                <span className="row__label">Repetir até</span>
                <input
                  className="input"
                  type="date"
                  value={values.repeatUntil}
                  min={values.startDate}
                  onChange={(e) => patch({ repeatUntil: e.target.value })}
                />
              </label>
            )}
          </div>
          {repeats && (
            <p className="form-note">
              {occurrences.length} {occurrences.length === 1 ? 'plantão' : 'plantões'}, de{' '}
              {formatDayMonth(occurrences[0])} a {formatDayMonth(occurrences[occurrences.length - 1])}.
            </p>
          )}
          </>
          )}

          {conflicts.length > 0 && (
            <div className="alert alert--warning" role="alert">
              <Icon name="alert" size={18} />
              <div>
                <strong>Conflito de horários</strong>
                <p>
                  {occurrences.length > 1 ? 'Esta série' : 'Este plantão'} se sobrepõe a{' '}
                  {conflicts.length === 1 ? 'outro já cadastrado' : `${conflicts.length} plantões`}:
                </p>
                <ul className="alert__list">
                  {conflicts.slice(0, 3).map((c) => (
                    <li key={c.id} className="num">
                      {locations.find((l) => l.id === c.locationId)?.name ?? 'Plantão'} ·{' '}
                      {formatDate(c.startDateTime)} · {formatTime(c.startDateTime)} →{' '}
                      {formatTime(c.endDateTime)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ---- Pagamento ---- */}
          <div className="section-header">
            <h2 className="section-header__title">Pagamento</h2>
          </div>
          <div className="card">
            <div className="money-field">
              <span className="money-field__label">Valor do plantão</span>
              <span className="money-field__input">
                <span className="money-field__prefix">R$</span>
                <input
                  className="input num"
                  value={values.amountText}
                  placeholder="0,00"
                  aria-label="Valor do plantão"
                  {...amountMask}
                />
              </span>
            </div>

            <div className="rows">
              <label className="row">
                <span className="row__label">Por hora</span>
                <span className="row__pair row__pair--money">
                  <span className="money-field__prefix">R$</span>
                  <input
                    className="input num"
                    value={values.hourlyText}
                    placeholder="0,00"
                    aria-label="Valor por hora"
                    {...hourlyMask}
                  />
                </span>
              </label>

            </div>
          </div>
          <p className="form-note num">
            {duration > 0
              ? `${formatMoney(expectedAmount)} por ${formatDuration(duration)} trabalhadas.`
              : 'Informe o horário para ver o cálculo.'}
          </p>

          {/* ---- Anotações ---- */}
          <div className="section-header">
            <h2 className="section-header__title">Anotações</h2>
          </div>
          <div className="card">
            <textarea
              className="input input--area"
              value={values.notes}
              placeholder="Plantão extra solicitado pela coordenação."
              aria-label="Anotações"
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </div>

          {error && (
            <div className="alert alert--danger" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          )}

          <Button variant="primary" size="lg" block onClick={handleSubmit} disabled={saving}>
            {saving
              ? 'Salvando…'
              : mode === 'edit'
                ? 'Salvar alterações'
                : occurrences.length > 1
                  ? `Salvar ${occurrences.length} plantões`
                  : 'Salvar plantão'}
          </Button>
        </div>
      </Sheet>

      <ShiftTemplateSheet
        open={pickingTemplate}
        templates={templates}
        startDate={values.startDate}
        onPick={chooseTemplate}
        onClose={() => setPickingTemplate(false)}
      />

      <LocationSheet
        open={pickingLocation}
        value={values.locationName}
        locations={locations}
        onChange={chooseLocation}
        onClose={() => setPickingLocation(false)}
      />

      <ConfirmDialog
        open={confirmSeries}
        title="Salvar na escala"
        message={
          `Este plantão faz parte de uma escala com mais ${following.length} ` +
          `${following.length === 1 ? 'plantão depois dele' : 'plantões depois dele'}.` +
          (dateChanged
            ? ' A data muda só neste plantão — os outros mantêm as datas da escala.'
            : '')
        }
        cancelLabel="Cancelar"
        choices={[
          { label: 'Salvar só neste plantão', onClick: () => void persist('one') },
          {
            label: `Salvar neste e nos ${following.length} próximos`,
            onClick: () => void persist('forward'),
          },
        ]}
        onCancel={() => setConfirmSeries(false)}
      />

      <RecurrenceSheet
        open={pickingRecurrence}
        value={values.recurrence}
        startDate={values.startDate}
        onChange={chooseRecurrence}
        onClose={() => setPickingRecurrence(false)}
      />

      <ConfirmDialog
        open={confirmConflict}
        title="Conflito de horários"
        message={
          conflicts.length === 1
            ? `${occurrences.length > 1 ? 'Esta série' : 'Este plantão'} se sobrepõe a ${
                locations.find((l) => l.id === conflicts[0]?.locationId)?.name ?? 'outro plantão'
              }, ${formatDate(conflicts[0]?.startDateTime ?? '')} das ${formatTime(
                conflicts[0]?.startDateTime ?? '',
              )} às ${formatTime(conflicts[0]?.endDateTime ?? '')}. Deseja salvar mesmo assim?`
            : `${occurrences.length > 1 ? 'Esta série' : 'Este plantão'} se sobrepõe a ${conflicts.length} plantões já cadastrados. Deseja salvar mesmo assim?`
        }
        confirmLabel="Salvar mesmo assim"
        cancelLabel="Revisar"
        onConfirm={askScope}
        onCancel={() => setConfirmConflict(false)}
      />
    </>
  )
}
