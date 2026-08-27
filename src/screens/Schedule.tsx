import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { LoadingScreen } from '@/components/ui/Skeleton'
import { useAppData } from '@/state/appDataContext'
import { WeekView } from './schedule/WeekView'
import { MonthView } from './schedule/MonthView'
import { ListView } from './schedule/ListView'

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

  return (
    <>
      <ScreenHeader
        title="Agenda"
        subtitle={`${views.length} ${views.length === 1 ? 'plantão cadastrado' : 'plantões cadastrados'}`}
        below={
          <SegmentedControl ariaLabel="Visualização da agenda" options={TABS} value={tab} onChange={setTab} />
        }
      />

      {!ready ? (
        <LoadingScreen />
      ) : (
        <div className="screen">
          {tab === 'week' && <WeekView reference={reference} onReferenceChange={setReference} />}
          {tab === 'month' && <MonthView selected={reference} onSelect={setReference} />}
          {tab === 'list' && <ListView />}
        </div>
      )}
    </>
  )
}
