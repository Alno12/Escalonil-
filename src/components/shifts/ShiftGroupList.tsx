import { useMemo } from 'react'
import type { ShiftView } from '@/db/types'
import { datePartOf, relativeDayLabel } from '@/domain/datetime'
import { ShiftRow } from './ShiftRow'

interface ShiftGroupListProps {
  views: ShiftView[]
  today: string
  onSelect: (id: string) => void
}

/** Lista cronológica agrupada por dia — "HOJE", "AMANHÃ", "Sex, 28/08". */
export function ShiftGroupList({ views, today, onSelect }: ShiftGroupListProps) {
  const groups = useMemo(() => {
    const map = new Map<string, ShiftView[]>()
    for (const view of views) {
      const day = datePartOf(view.shift.startDateTime)
      const bucket = map.get(day)
      if (bucket) bucket.push(view)
      else map.set(day, [view])
    }
    return [...map.entries()]
  }, [views])

  return (
    <div className="shift-groups">
      {groups.map(([day, dayViews]) => (
        <section key={day} className="shift-group">
          <h3 className="shift-group__label">{relativeDayLabel(day, today)}</h3>
          <ul className="shift-list">
            {dayViews.map((view) => (
              <ShiftRow key={view.shift.id} view={view} onClick={onSelect} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
