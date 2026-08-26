import type { WeekdayBucket } from '@/domain/reports'
import { formatDuration, weekdayNames, weekdayNamesMin } from '@/domain/datetime'
import { Icon } from '@/components/ui/Icon'

/**
 * Horas por dia da semana, de domingo a sábado (invariante 7).
 *
 * A intensidade da barra acompanha a altura: com sete barras da mesma cor,
 * a diferença entre 12h e 18h passava despercebida numa olhada rápida.
 */
export function WeekdayChart({
  data,
  periodLabel,
}: {
  data: WeekdayBucket[]
  periodLabel: string
}) {
  const max = Math.max(...data.map((d) => d.hours))
  const heaviest = uniqueHeaviest(data, max)

  return (
    <div className="weekday">
      <div className="weekday__bars">
        {data.map((bucket) => {
          const share = max > 0 ? bucket.hours / max : 0
          return (
            <div
              key={bucket.weekday}
              className={`weekday__col ${bucket.weekday === heaviest ? 'is-max' : ''}`}
            >
              <span className="weekday__value num">
                {bucket.hours > 0 ? formatDuration(bucket.hours) : '—'}
              </span>
              <span className="weekday__track">
                {bucket.hours > 0 && (
                  <span
                    className="weekday__bar"
                    style={{
                      height: `${Math.max(8, share * 100)}%`,
                      opacity: 0.35 + share * 0.65,
                    }}
                  />
                )}
              </span>
              <span className="weekday__day" aria-hidden="true">
                {weekdayNamesMin[bucket.weekday]}
              </span>
              <span className="sr-only">
                {weekdayNames[bucket.weekday]}: {formatDuration(bucket.hours)}
              </span>
            </div>
          )
        })}
      </div>

      {heaviest !== null && (
        <p className="weekday__note">
          <Icon name="clock" size={15} />
          <span>
            <b>{capitalize(weekdayNames[heaviest].replace('-feira', ''))}</b> é o seu dia mais
            pesado — {formatDuration(data[heaviest].hours)} {periodLabel}.
          </span>
        </p>
      )}
    </div>
  )
}

/** O dia mais pesado só é dito quando há um só — empate não tem campeão. */
function uniqueHeaviest(data: WeekdayBucket[], max: number): number | null {
  if (max <= 0) return null
  const winners = data.filter((d) => d.hours === max)
  return winners.length === 1 ? winners[0].weekday : null
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
