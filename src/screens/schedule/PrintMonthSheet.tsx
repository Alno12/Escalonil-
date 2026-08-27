import { useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Switch } from '@/components/ui/Field'
import { OptionSheet, type SheetOption } from '@/components/ui/OptionSheet'
import { useAppData } from '@/state/appDataContext'
import { formatMonthYear, monthPartOf } from '@/domain/datetime'
import { buildMonthSheet } from '@/domain/monthSheet'
import { buildMonthSheetSvg } from '@/domain/monthSheetSvg'
import { printMonthSheet } from '@/data/monthSheetFile'

interface PrintMonthSheetProps {
  open: boolean
  /** Mês que a agenda está mostrando — é o que a folha propõe. */
  month: string
  onClose: () => void
}

const ALL = ''

/**
 * As opções da folha do mês: qual mês, com ou sem valores, e de qual local.
 *
 * As escolhas NÃO ficam guardadas: reabriu, é o mês da agenda, sem valores e
 * com todos os locais. Imprimir um local só, ou com valores, é exceção — e uma
 * exceção lembrada vira uma folha errada impressa sem ninguém perceber.
 */
export function PrintMonthSheet({ open, month, onClose }: PrintMonthSheetProps) {
  const { views, locations, today } = useAppData()

  const [picking, setPicking] = useState<'month' | 'location' | null>(null)
  const [chosenMonth, setChosenMonth] = useState(month)
  const [showAmounts, setShowAmounts] = useState(false)
  const [locationId, setLocationId] = useState(ALL)

  // Trocar de mês na agenda com a folha fechada tem de mudar a proposta: sem
  // isso, abrir em setembro ofereceria o agosto da primeira vez.
  const [lastMonth, setLastMonth] = useState(month)
  if (month !== lastMonth) {
    setLastMonth(month)
    setChosenMonth(month)
  }

  /** Os meses que têm plantão, mais o de hoje — não faz sentido oferecer o resto. */
  const monthOptions: SheetOption<string>[] = useMemo(() => {
    const months = new Set(views.map((v) => monthPartOf(v.shift.startDateTime)))
    months.add(monthPartOf(today))
    months.add(month)
    return [...months]
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: formatMonthYear(`${value}-01`) }))
  }, [views, today, month])

  const locationOptions: SheetOption<string>[] = [
    { value: ALL, label: 'Todos os locais' },
    ...locations.map((l) => ({ value: l.id, label: l.name, color: l.color })),
  ]
  const location = locations.find((l) => l.id === locationId) ?? null

  const svg = () =>
    buildMonthSheetSvg(
      buildMonthSheet(views, chosenMonth, {
        location: location && { id: location.id, name: location.name },
        showAmounts,
        today,
      }),
    )

  // A folha de opções continua aberta durante a impressão de propósito: o
  // `@media print` esconde o app inteiro, e fechá-la antes deixaria a tela
  // piscar atrás da caixa de impressão.
  const print = () => printMonthSheet(svg())

  return (
    <>
      <Sheet
        open={open}
        title="Imprimir"
        subtitle="Escala do mês em uma folha"
        onClose={onClose}
        size="auto"
        footer={
          <Button variant="primary" size="lg" block icon="printer" onClick={print}>
            Imprimir
          </Button>
        }
      >
        <div className="form">
          <div className="card rows">
            <button type="button" className="row" onClick={() => setPicking('month')}>
              <span className="row__label">Mês</span>
              <span className="row__value">{formatMonthYear(`${chosenMonth}-01`)}</span>
              <Icon name="chevronRight" size={17} className="row__chevron" />
            </button>

            <div className="row">
              <span className="row__label">Incluir valores</span>
              <Switch
                checked={showAmounts}
                onChange={setShowAmounts}
                ariaLabel="Incluir valores na folha"
              />
            </div>

            {locations.length > 1 && (
              <button type="button" className="row" onClick={() => setPicking('location')}>
                <span className="row__label">Local</span>
                <span className={`row__value ${location ? '' : 'row__value--muted'}`}>
                  {location?.name ?? 'Todos'}
                </span>
                <Icon name="chevronRight" size={17} className="row__chevron" />
              </button>
            )}
          </div>

          <p className="form-note">
            {location
              ? `A folha sai só com os plantões do ${location.name} — o resto do mês fica em branco.`
              : 'A folha sai deitada, em uma página só, com a escala inteira do mês.'}
          </p>
        </div>
      </Sheet>

      <OptionSheet
        open={picking === 'month'}
        title="Mês"
        options={monthOptions}
        value={chosenMonth}
        onChange={setChosenMonth}
        onClose={() => setPicking(null)}
      />

      <OptionSheet
        open={picking === 'location'}
        title="Local"
        options={locationOptions}
        value={locationId}
        onChange={setLocationId}
        onClose={() => setPicking(null)}
      />
    </>
  )
}
