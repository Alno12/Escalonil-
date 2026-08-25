import { Button } from '@/components/ui/Button'

interface PeriodNavProps {
  label: string
  onPrev: () => void
  onNext: () => void
  onToday?: () => void
  showToday?: boolean
}

/** Navegação ‹ período › usada na semana, no mês e nos relatórios. */
export function PeriodNav({ label, onPrev, onNext, onToday, showToday }: PeriodNavProps) {
  return (
    <div className="period-nav">
      <Button variant="secondary" size="sm" icon="chevronLeft" onClick={onPrev} aria-label="Anterior" />
      <span className="period-nav__label">{label}</span>
      <div className="period-nav__right">
        {onToday && showToday && (
          <Button variant="ghost" size="sm" onClick={onToday}>
            Hoje
          </Button>
        )}
        <Button variant="secondary" size="sm" icon="chevronRight" onClick={onNext} aria-label="Próximo" />
      </div>
    </div>
  )
}
