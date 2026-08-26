import { useMemo, useState } from 'react'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card, SectionHeader } from '@/components/ui/Card'
import { ChipGroup, Field, FieldRow, TextInput } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { LoadingScreen } from '@/components/ui/Skeleton'
import { useAppData } from '@/state/appDataContext'
import { useShiftSheets } from '@/state/shiftSheetsContext'
import {
  endOfMonth,
  formatDate,
  formatDuration,
  formatMonthYear,
  monthPartOf,
  startOfMonth,
} from '@/domain/datetime'
import { formatMoney, formatNumber } from '@/domain/money'
import { buildPeriod, PERIOD_OPTIONS, type PeriodKey } from '@/domain/periods'
import {
  buildDayMap,
  buildIndicators,
  buildInsights,
  buildLocationReport,
  buildMonthlySeries,
  buildRecords,
  buildWeekdayHours,
} from '@/domain/reports'
import { filterByRange } from '@/domain/summary'
import { MonthlyChart } from './reports/MonthlyChart'
import { LocationReport } from './reports/LocationReport'
import { WeekdayChart } from './reports/WeekdayChart'
import { MonthMap } from './reports/MonthMap'
import { RecordsCard } from './reports/RecordsCard'

/** Relatórios (§27–§30): indicadores, gráfico, insights e desempenho por local. */
export function Reports() {
  const { ready, views, today } = useAppData()
  const sheets = useShiftSheets()

  const [periodKey, setPeriodKey] = useState<PeriodKey>('thisMonth')
  const [customFrom, setCustomFrom] = useState(startOfMonth(today))
  const [customTo, setCustomTo] = useState(endOfMonth(today))
  /** Quantos passos as setas andaram a partir do período que o chip descreve. */
  const [offset, setOffset] = useState(0)

  const period = useMemo(
    () => buildPeriod(periodKey, today, { from: customFrom, to: customTo }, offset),
    [periodKey, today, customFrom, customTo, offset],
  )

  const current = useMemo(
    () => filterByRange(views, period.from, period.to),
    [views, period.from, period.to],
  )
  const previous = useMemo(
    () => filterByRange(views, period.previousFrom, period.previousTo),
    [views, period.previousFrom, period.previousTo],
  )

  const indicators = useMemo(
    () => buildIndicators(current, period.from, period.to),
    [current, period.from, period.to],
  )
  const insights = useMemo(
    () =>
      buildInsights(current, previous, {
        periodLabel: period.label,
        previousLabel: period.previousLabel,
      }),
    [current, previous, period.label, period.previousLabel],
  )
  const locationRows = useMemo(() => buildLocationReport(current), [current])
  // A evolução olha os 12 meses até o fim do período — não o período em si.
  const endMonth = monthPartOf(period.to)
  const series = useMemo(() => buildMonthlySeries(views, endMonth), [views, endMonth])
  const hasHistory = series.some((b) => b.shifts > 0)
  const weekdays = useMemo(() => buildWeekdayHours(current), [current])
  const dayMap = useMemo(() => buildDayMap(current, endMonth), [current, endMonth])
  // Recorde é do acervo inteiro: um recorde de um mês só não é recorde.
  const records = useMemo(() => buildRecords(views), [views])

  return (
    <>
      <ScreenHeader
        title="Relatórios"
        subtitle={period.title}
        below={
          <ChipGroup
            ariaLabel="Período do relatório"
            scroll
            options={PERIOD_OPTIONS}
            value={periodKey}
            onChange={(v) => {
              setPeriodKey(v as PeriodKey)
              setOffset(0)
            }}
          />
        }
      />

      {!ready ? (
        <LoadingScreen />
      ) : (
        <div className="screen">
          {periodKey === 'custom' && (
            <section aria-label="Intervalo personalizado">
              <FieldRow>
                <Field label="De" htmlFor="report-from">
                  <TextInput
                    id="report-from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value)
                      setOffset(0)
                    }}
                  />
                </Field>
                <Field label="Até" htmlFor="report-to">
                  <TextInput
                    id="report-to"
                    type="date"
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value)
                      setOffset(0)
                    }}
                  />
                </Field>
              </FieldRow>
            </section>
          )}

          {views.length === 0 ? (
            <section>
              <EmptyState
                icon="chart"
                title="Nada para relatar ainda"
                description="Cadastre o primeiro plantão e os números aparecem aqui."
                action={
                  <Button variant="primary" icon="plus" onClick={() => sheets.newShift()}>
                    Cadastrar plantão
                  </Button>
                }
              />
            </section>
          ) : (
            <>
              <section aria-label="Indicadores">
                <SectionHeader title="Indicadores" />
                <Card padded={false}>
                  {/* As setas andam o período inteiro: um mês em "Mês atual",
                      um trimestre em "3 meses". */}
                  <div className="period-step">
                    <button
                      type="button"
                      className="period-step__btn"
                      aria-label="Período anterior"
                      onClick={() => setOffset(offset - 1)}
                    >
                      <Icon name="chevronLeft" size={19} strokeWidth={2.1} />
                    </button>
                    <div className="period-step__mid">
                      <p className="period-step__title">{period.title}</p>
                      <p className="period-step__range num">
                        {formatDate(period.from)} a {formatDate(period.to)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="period-step__btn"
                      aria-label="Período seguinte"
                      onClick={() => setOffset(offset + 1)}
                    >
                      <Icon name="chevronRight" size={19} strokeWidth={2.1} />
                    </button>
                  </div>

                  <dl className="metric-grid metric-grid--inset">
                    <Metric label="Plantões" value={String(indicators.shifts)} />
                    <Metric label="Horas" value={formatDuration(indicators.hours)} />
                    <Metric label="Previsto" value={formatMoney(indicators.expected)} />
                    <Metric label="Recebido" value={formatMoney(indicators.received)} tone="success" />
                    <Metric label="A receber" value={formatMoney(indicators.pending)} />
                    <Metric label="Média por plantão" value={formatMoney(indicators.avgPerShift)} />
                    <Metric label="Média por hora" value={formatMoney(indicators.avgPerHour)} />
                    <Metric
                      label="Horas por semana"
                      value={`${formatNumber(indicators.avgHoursPerWeek)} h`}
                    />
                  </dl>
                </Card>
              </section>

              {hasHistory && (
                <section aria-label="Evolução">
                  <SectionHeader title="Evolução" hint="Últimos 12 meses · toque numa barra" />
                  <Card>
                    {/* Remontar ao trocar de mês devolve a leitura ao mês do fim
                        do período — o estado de seleção não sobrevive à troca. */}
                    <MonthlyChart key={endMonth} data={series} />
                  </Card>
                </section>
              )}

              {indicators.shifts === 0 ? (
                <section>
                  <EmptyState
                    icon="calendar"
                    title="Sem plantões neste período"
                    description={`Nada entre ${formatDate(period.from)} e ${formatDate(period.to)}. Use as setas para ver outro período.`}
                  />
                </section>
              ) : (
                <>
                  {locationRows.length > 0 && (
                    <section aria-label="Relatório por local">
                      <SectionHeader title="Por local" hint="Onde o seu tempo rende mais" />
                      <Card>
                        <LocationReport rows={locationRows} />
                      </Card>
                    </section>
                  )}
                  <section aria-label="Ritmo da semana">
                    <SectionHeader title="Ritmo da semana" hint="Horas por dia da semana" />
                    <Card>
                      <WeekdayChart data={weekdays} periodLabel={period.label} />
                    </Card>
                  </section>

                  <section aria-label="Mapa do mês">
                    <SectionHeader
                      title="Mapa do mês"
                      hint={`${formatMonthYear(period.to)} · intensidade por dia`}
                    />
                    <Card>
                      <MonthMap days={dayMap} />
                    </Card>
                  </section>

                  {insights.length > 0 && (
                    <section aria-label="Insights">
                      <SectionHeader title="Insights" />
                      <ul className="insight-list">
                        {insights.map((insight) => (
                          <li key={insight.id} className={`insight insight--${insight.tone}`}>
                            <span className="insight__icon" aria-hidden="true">
                              <Icon
                                name={insight.tone === 'warning' ? 'alert' : 'spark'}
                                size={16}
                              />
                            </span>
                            <span>{insight.text}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {records.longest && (
                    <section aria-label="Recordes">
                      <SectionHeader title="Recordes" hint="Do histórico inteiro" />
                      <Card padded={false}>
                        <RecordsCard records={records} />
                      </Card>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'danger'
}) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd className={`num ${tone ? `metric--${tone}` : ''}`}>{value}</dd>
    </div>
  )
}
