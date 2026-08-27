import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { LoadingScreen } from '@/components/ui/Skeleton'
import { useAppData } from '@/state/appDataContext'
import {
  addDays,
  addMonths,
  formatDayMonth,
  formatMonthYear,
  monthPartOf,
  startOfWeek,
} from '@/domain/datetime'
import { WeekView } from './schedule/WeekView'
import { MonthView } from './schedule/MonthView'
import { ListView } from './schedule/ListView'
import { PeriodNav } from './schedule/PeriodNav'
import { PrintMonthSheet } from './schedule/PrintMonthSheet'

type Tab = 'week' | 'month' | 'list'

/** O mês vem primeiro: é onde a agenda abre e o recorte que se olha mais. */
const TABS = [
  { value: 'month' as const, label: 'Mês' },
  { value: 'week' as const, label: 'Semana' },
  { value: 'list' as const, label: 'Lista' },
]

/**
 * Visualização pedida na URL (`#/agenda?v=mes`), para que os cards do Início
 * caiam direto no recorte certo. Lida uma vez, na montagem: trocar de aba
 * depois é escolha do usuário e não mexe no endereço.
 *
 * Sem parâmetro — tocar na aba do rodapé — a agenda abre no MÊS. O parâmetro
 * continua tendo precedência, então "Esta semana" no Início ainda cai na semana.
 */
const TAB_BY_PARAM: Record<string, Tab> = { semana: 'week', mes: 'month', lista: 'list' }

export function Schedule() {
  const { ready, today, views } = useAppData()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => TAB_BY_PARAM[params.get('v') ?? ''] ?? 'month')
  const [reference, setReference] = useState(today)
  const [printing, setPrinting] = useState(false)

  /**
   * A navegação do período mora AQUI, e não dentro de cada visão, porque ela
   * vai no cabeçalho — que é fixo. Dentro da Semana e do Mês ela rolava para
   * fora da tela junto com o conteúdo, e ficava impossível saber que mês se
   * está olhando depois de rolar a lista do dia.
   */
  const weekStart = startOfWeek(reference)
  const nav =
    tab === 'week'
      ? {
          label: `${formatDayMonth(weekStart)} — ${formatDayMonth(addDays(weekStart, 6))}`,
          onPrev: () => setReference(addDays(weekStart, -7)),
          onNext: () => setReference(addDays(weekStart, 7)),
          showToday: startOfWeek(today) !== weekStart,
        }
      : tab === 'month'
        ? {
            label: formatMonthYear(reference),
            onPrev: () => setReference(addMonths(reference, -1)),
            onNext: () => setReference(addMonths(reference, 1)),
            showToday: monthPartOf(today) !== monthPartOf(reference),
          }
        : null

  return (
    <>
      <ScreenHeader
        title="Agenda"
        subtitle={`${views.length} ${views.length === 1 ? 'plantão cadastrado' : 'plantões cadastrados'}`}
        below={
          <>
            <SegmentedControl
              ariaLabel="Visualização da agenda"
              options={TABS}
              value={tab}
              onChange={setTab}
            />
            {nav && (
              <PeriodNav
                label={nav.label}
                onPrev={nav.onPrev}
                onNext={nav.onNext}
                onToday={() => setReference(today)}
                showToday={nav.showToday}
              />
            )}
          </>
        }
      />

      {!ready ? (
        <LoadingScreen />
      ) : (
        <div className="screen">
          {tab === 'week' && <WeekView reference={reference} />}
          {tab === 'month' && (
            <MonthView
              selected={reference}
              onSelect={setReference}
              onPrint={() => setPrinting(true)}
            />
          )}
          {tab === 'list' && <ListView />}
        </div>
      )}

      <PrintMonthSheet
        open={printing}
        month={monthPartOf(reference)}
        onClose={() => setPrinting(false)}
      />
    </>
  )
}
