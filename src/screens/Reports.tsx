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
import { endOfMonth, formatDate, formatDuration, startOfMonth } from '@/domain/datetime'
import { formatMoney, formatNumber } from '@/domain/money'
import { buildPeriod, PERIOD_OPTIONS, type PeriodKey } from '@/domain/periods'
import { buildIndicators, buildInsights, buildLocationReport, buildMonthlySeries } from '@/domain/reports'
import { filterByRange } from '@/domain/summary'
import { MonthlyChart } from './reports/MonthlyChart'
import { LocationReport } from './reports/LocationReport'

/** Relatórios (§27–§30): indicadores, gráfico, insights e desempenho por local. */
export function Reports() {
  const { ready, views, today } = useAppData()
  const sheets = useShiftSheets()

  const [periodKey, setPeriodKey] = useState<PeriodKey>('thisMonth')
  const [customFrom, setCustomFrom] = useState(startOfMonth(today))
  const [customTo, setCustomTo] = useState(endOfMonth(today))

  const period = useMemo(
    () => buildPeriod(periodKey, today, { from: customFrom, to: customTo }),
    [periodKey, today, customFrom, customTo],
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
  const series = useMemo(() => buildMonthlySeries(current), [current])

  return (
    <>
      <ScreenHeader
        title="Relatórios"
        subtitle={period.title}
        below={
          <ChipGroup
            ariaLabel="Período do relatório"
            options={PERIOD_OPTIONS}
            value={periodKey}
            onChange={(v) => setPeriodKey(v as PeriodKey)}
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
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </Field>
                <Field label="Até" htmlFor="report-to">
                  <TextInput
                    id="report-to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </Field>
              </FieldRow>
            </section>
          )}

          {indicators.shifts === 0 ? (
            <section>
              <EmptyState
                icon="chart"
                title="Sem dados neste período"
                description={`Nenhum plantão entre ${formatDate(period.from)} e ${formatDate(period.to)}.`}
                action={
                  views.length === 0 ? (
                    <Button variant="primary" icon="plus" onClick={() => sheets.newShift()}>
                      Cadastrar plantão
                    </Button>
                  ) : undefined
                }
              />
            </section>
          ) : (
            <>
              <section aria-label="Indicadores">
                <SectionHeader title="Indicadores" hint={`${formatDate(period.from)} a ${formatDate(period.to)}`} />
                <Card>
                  <dl className="metric-grid">
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

              {series.length > 1 && (
                <section aria-label="Evolução mensal">
                  <SectionHeader title="Evolução mensal" />
                  <Card>
                    <MonthlyChart data={series} />
                  </Card>
                </section>
              )}

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

              {locationRows.length > 0 && (
                <section aria-label="Relatório por local">
                  <SectionHeader
                    title="Por local"
                    hint="Onde o seu tempo rende mais"
                  />
                  <Card>
                    <LocationReport rows={locationRows} />
                  </Card>
                </section>
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
