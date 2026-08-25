import { useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon } from '@/components/ui/Icon'
import {
  ChipGroup,
  Field,
  FieldRow,
  MoneyInput,
  TextArea,
  TextInput,
} from '@/components/ui/Field'
import { useAppData } from '@/state/appDataContext'
import { useToast } from '@/state/toastContext'
import { createShifts, ensureLocation, updateShift, type ShiftInput } from '@/data/repository'
import { findConflicts } from '@/domain/conflicts'
import {
  buildShiftRange,
  formatDate,
  formatDateShort,
  formatDuration,
  formatTime,
  durationInHours,
} from '@/domain/datetime'
import { formatMoney, parseMoneyInput } from '@/domain/money'
import { suggestPaymentDate } from '@/domain/shift'
import {
  formDayShift,
  formExpectedAmount,
  formRange,
  repeatDates,
  type RepeatMode,
  type ShiftFormValues,
} from './shiftFormValues'

export type ShiftFormMode = 'create' | 'edit' | 'duplicate'

interface ShiftFormSheetProps {
  /** Uma nova sessão de formulário remonta o componente (ver ShiftSheetsProvider). */
  open: boolean
  mode: ShiftFormMode
  /** Id do plantão sendo editado — ausente em criação e duplicação. */
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
  // A data prevista é sugerida automaticamente até o usuário mexer nela.
  const [paymentDateTouched, setPaymentDateTouched] = useState(mode !== 'create')

  const patch = (next: Partial<ShiftFormValues>) => {
    setValues((prev) => {
      const merged = { ...prev, ...next }
      const changedSchedule =
        next.date !== undefined || next.startTime !== undefined || next.endTime !== undefined
      if (changedSchedule && !paymentDateTouched) {
        const { endDateTime } = buildShiftRange(merged.date, merged.startTime, merged.endTime)
        merged.expectedPaymentDate = suggestPaymentDate(endDateTime, settings.paymentTermDays)
      }
      return merged
    })
    setError(null)
  }

  const range = useMemo(() => formRange(values), [values])
  const duration = durationInHours(range.startDateTime, range.endDateTime)
  const expectedAmount = useMemo(() => formExpectedAmount(values), [values])
  const dayShift = formDayShift(values)

  // A repetição só existe ao criar: editar ou duplicar trata um plantão só.
  const canRepeat = mode !== 'edit'
  const occurrences = useMemo(
    () => (canRepeat ? repeatDates(values) : [values.date]),
    [canRepeat, values],
  )

  /** Todas as ocorrências da série, já com início e fim resolvidos. */
  const ranges = useMemo(
    () =>
      occurrences.map((date) =>
        buildShiftRange(date, values.startTime, values.endTime, values.extraDays),
      ),
    [occurrences, values.startTime, values.endTime, values.extraDays],
  )

  // Conflito é verificado em TODAS as datas geradas, não só na primeira.
  const conflicts = useMemo(
    () => {
      const seen = new Set<string>()
      return ranges.flatMap((r) =>
        findConflicts({ id: shiftId, ...r }, shifts).filter((c) => {
          if (seen.has(c.id)) return false
          seen.add(c.id)
          return true
        }),
      )
    },
    [ranges, shifts, shiftId],
  )

  const locationOptions = useMemo(
    () => locations.map((l) => ({ value: l.name, label: l.name })),
    [locations],
  )

  const typeOptions = useMemo(
    () => settings.shiftTypes.map((t) => ({ value: t, label: t })),
    [settings.shiftTypes],
  )

  async function persist() {
    setSaving(true)
    try {
      const location = await ensureLocation(values.locationName)
      const input: ShiftInput = {
        ...range,
        locationId: location.id,
        shiftType: values.shiftType,
        paymentMode: values.paymentMode,
        fixedAmount: parseMoneyInput(values.fixedAmountText),
        hourlyRate: parseMoneyInput(values.hourlyRateText),
        expectedPaymentDate: values.expectedPaymentDate || null,
        notes: values.notes.trim(),
      }

      if (mode === 'edit' && shiftId) {
        await updateShift(shiftId, input)
        toast.success('Plantão atualizado')
      } else {
        const created = await createShifts(ranges.map((r) => ({ ...input, ...r })))
        toast.success(
          created.length === 1 ? 'Plantão salvo' : `${created.length} plantões salvos`,
        )
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o plantão.')
    } finally {
      setSaving(false)
      setConfirmConflict(false)
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
    // O conflito avisa mas não bloqueia: quem decide é o usuário (§20).
    if (conflicts.length > 0) {
      setConfirmConflict(true)
      return
    }
    void persist()
  }

  return (
    <>
      <Sheet
        open={open}
        title={TITLES[mode]}
        subtitle={mode === 'duplicate' ? 'Confira a data do novo plantão' : undefined}
        onClose={onClose}
        action={
          <Button variant="ghost" size="sm" onClick={handleSubmit} disabled={saving}>
            Salvar
          </Button>
        }
        footer={
          <Button variant="primary" size="lg" block onClick={handleSubmit} disabled={saving}>
            {saving
            ? 'Salvando…'
            : mode === 'edit'
              ? 'Salvar alterações'
              : occurrences.length > 1
                ? `Salvar ${occurrences.length} plantões`
                : 'Salvar plantão'}
          </Button>
        }
      >
        <div className="form">
          {/* Prévia sempre visível: o usuário confere duração e valor sem rolar. */}
          <div className="form-preview">
            <div>
              <span className="form-preview__label">Duração</span>
              <strong className="form-preview__value num">{formatDuration(duration)}</strong>
            </div>
            <div className="form-preview__divider" aria-hidden="true" />
            <div>
              <span className="form-preview__label">Valor previsto</span>
              <strong className="form-preview__value num">{formatMoney(expectedAmount)}</strong>
            </div>
          </div>

          <Field label="Data" htmlFor="shift-date">
            <TextInput
              id="shift-date"
              type="date"
              value={values.date}
              onChange={(e) => patch({ date: e.target.value })}
              required
            />
          </Field>

          <FieldRow>
            <Field label="Início" htmlFor="shift-start">
              <TextInput
                id="shift-start"
                type="time"
                step={300}
                value={values.startTime}
                onChange={(e) => patch({ startTime: e.target.value })}
                required
              />
            </Field>
            <Field label="Término" htmlFor="shift-end">
              <TextInput
                id="shift-end"
                type="time"
                step={300}
                value={values.endTime}
                onChange={(e) => patch({ endTime: e.target.value })}
                required
              />
            </Field>
          </FieldRow>

          {/* Dia do término sempre visível: o automático cobre o plantão
              noturno, e o stepper permite plantões longos (36h, 48h). */}
          <div className="day-shift">
            <div className="day-shift__text">
              <span className="day-shift__label">Termina em</span>
              <strong className="day-shift__value num">
                {formatDateShort(range.endDateTime)}
                <span className="day-shift__offset">
                  {dayShift === 0
                    ? 'mesmo dia'
                    : dayShift === 1
                      ? '+1 dia'
                      : `+${dayShift} dias`}
                </span>
              </strong>
            </div>
            <div className="day-shift__stepper">
              <button
                type="button"
                aria-label="Um dia a menos"
                disabled={values.extraDays === 0}
                onClick={() => patch({ extraDays: values.extraDays - 1 })}
              >
                <Icon name="minus" size={18} />
              </button>
              <button
                type="button"
                aria-label="Um dia a mais"
                disabled={values.extraDays >= 6}
                onClick={() => patch({ extraDays: values.extraDays + 1 })}
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          </div>

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
                    <li key={c.id}>
                      {locations.find((l) => l.id === c.locationId)?.name ?? 'Plantão'} ·{' '}
                      {formatDate(c.startDateTime)} · {formatTime(c.startDateTime)} →{' '}
                      {formatTime(c.endDateTime)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <Field
            label="Local"
            htmlFor="shift-location"
            hint={locationOptions.length === 0 ? 'Os locais ficam salvos para a próxima vez.' : undefined}
          >
            <TextInput
              id="shift-location"
              type="text"
              value={values.locationName}
              placeholder="UPA Centro"
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => patch({ locationName: e.target.value })}
              required
            />
            {locationOptions.length > 0 && (
              <ChipGroup
                ariaLabel="Locais já usados"
                options={locationOptions}
                value={values.locationName}
                onChange={(name) => patch({ locationName: name })}
              />
            )}
          </Field>

          <Field label="Tipo de plantão" optional>
            <ChipGroup
              ariaLabel="Tipo de plantão"
              options={typeOptions}
              value={values.shiftType}
              onChange={(type) => patch({ shiftType: type })}
              allowClear
            />
          </Field>

          {canRepeat && (
            <Field
              label="Repetir"
              optional
              hint={
                values.repeat === 'none'
                  ? 'Cria vários plantões iguais de uma vez.'
                  : `${occurrences.length} plantões, de ${formatDateShort(occurrences[0])} a ${formatDateShort(occurrences[occurrences.length - 1])}.`
              }
            >
              <ChipGroup
                ariaLabel="Repetição do plantão"
                options={[
                  { value: 'none', label: 'Não repetir' },
                  { value: 'weekly', label: 'Toda semana' },
                  { value: 'biweekly', label: 'A cada 15 dias' },
                ]}
                value={values.repeat}
                onChange={(v) => patch({ repeat: v as RepeatMode })}
              />
              {values.repeat !== 'none' && (
                <div className="repeat-count">
                  <button
                    type="button"
                    aria-label="Menos repetições"
                    disabled={values.repeatCount <= 2}
                    onClick={() => patch({ repeatCount: values.repeatCount - 1 })}
                  >
                    <Icon name="minus" size={18} />
                  </button>
                  <span className="num">
                    {occurrences.length} <small>vezes</small>
                  </span>
                  <button
                    type="button"
                    aria-label="Mais repetições"
                    disabled={values.repeatCount >= 52}
                    onClick={() => patch({ repeatCount: values.repeatCount + 1 })}
                  >
                    <Icon name="plus" size={18} />
                  </button>
                </div>
              )}
            </Field>
          )}

          <Field label="Forma de pagamento">
            <ChipGroup
              ariaLabel="Forma de pagamento"
              options={[
                { value: 'fixed', label: 'Valor fixo' },
                { value: 'hourly', label: 'Valor por hora' },
              ]}
              value={values.paymentMode}
              onChange={(mode) => patch({ paymentMode: mode as 'fixed' | 'hourly' })}
            />
          </Field>

          {values.paymentMode === 'fixed' ? (
            <Field label="Valor do plantão" htmlFor="shift-fixed">
              <MoneyInput
                id="shift-fixed"
                value={values.fixedAmountText}
                placeholder="1.200"
                onChange={(e) => patch({ fixedAmountText: e.target.value })}
              />
            </Field>
          ) : (
            <Field
              label="Valor por hora"
              htmlFor="shift-hourly"
              hint={`${formatDuration(duration)} × valor/hora = ${formatMoney(expectedAmount)}`}
            >
              <MoneyInput
                id="shift-hourly"
                value={values.hourlyRateText}
                placeholder="100"
                suffix="/h"
                onChange={(e) => patch({ hourlyRateText: e.target.value })}
              />
            </Field>
          )}

          <Field
            label="Pagamento previsto para"
            htmlFor="shift-payment-date"
            optional
            hint="Usado para avisar quando um pagamento atrasa."
          >
            <TextInput
              id="shift-payment-date"
              type="date"
              value={values.expectedPaymentDate}
              onChange={(e) => {
                setPaymentDateTouched(true)
                patch({ expectedPaymentDate: e.target.value })
              }}
            />
          </Field>

          <Field label="Observações" htmlFor="shift-notes" optional>
            <TextArea
              id="shift-notes"
              value={values.notes}
              placeholder="Plantão extra solicitado pela coordenação."
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </Field>

          {error && (
            <div className="alert alert--danger" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </Sheet>

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
        onConfirm={() => void persist()}
        onCancel={() => setConfirmConflict(false)}
      />
    </>
  )
}
