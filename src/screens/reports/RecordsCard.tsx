import type { Records } from '@/domain/reports'
import { formatDate, formatDuration, formatMonthCompact } from '@/domain/datetime'
import { formatMoneyCompact } from '@/domain/money'
import { Icon, type IconName } from '@/components/ui/Icon'

/**
 * Três marcas do histórico inteiro. Fica fora do recorte do período de
 * propósito: um recorde de um mês só não é recorde.
 */
export function RecordsCard({ records }: { records: Records }) {
  const rows: { icon: IconName; label: string; value: string }[] = []

  if (records.longest) {
    rows.push({
      icon: 'clock',
      label: 'Maior plantão',
      value: `${formatDuration(records.longest.hours)} · ${formatDate(records.longest.date)}`,
    })
  }
  if (records.bestMonth) {
    rows.push({
      icon: 'bag',
      label: 'Melhor mês',
      value: `${formatMonthCompact(`${records.bestMonth.month}-01`)} · ${formatMoneyCompact(records.bestMonth.expected)}`,
    })
  }
  // Uma sequência de um dia não é sequência nenhuma.
  if (records.streak && records.streak.days > 1) {
    rows.push({
      icon: 'calendar',
      label: 'Sequência mais longa',
      value: `${records.streak.days} dias seguidos`,
    })
  }

  return (
    <ul className="records">
      {rows.map((row) => (
        <li key={row.label} className="records__row">
          <span className="records__icon" aria-hidden="true">
            <Icon name={row.icon} size={17} />
          </span>
          <span className="records__label">{row.label}</span>
          <span className="records__value num">{row.value}</span>
        </li>
      ))}
    </ul>
  )
}
