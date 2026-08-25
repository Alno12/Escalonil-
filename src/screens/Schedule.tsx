import { useState } from 'react'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { LoadingScreen } from '@/components/ui/Skeleton'
import { useAppData } from '@/state/appDataContext'
import { WeekView } from './schedule/WeekView'
import { MonthView } from './schedule/MonthView'
import { ListView } from './schedule/ListView'

type Tab = 'week' | 'month' | 'list'

const TABS = [
  { value: 'week' as const, label: 'Semana' },
  { value: 'month' as const, label: 'Mês' },
  { value: 'list' as const, label: 'Lista' },
]

export function Schedule() {
  const { ready, today, views } = useAppData()
  const [tab, setTab] = useState<Tab>('week')
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
