import { LOCATION_COLORS, type LocationColor } from '@/db/types'

interface ColorPickerProps {
  value: LocationColor
  onChange: (color: LocationColor) => void
}

const NAMES: Record<LocationColor, string> = {
  blue: 'Azul',
  teal: 'Turquesa',
  green: 'Verde',
  orange: 'Laranja',
  red: 'Vermelho',
  purple: 'Roxo',
  pink: 'Rosa',
  indigo: 'Índigo',
}

/** Escolha da cor do local — identifica o plantão de relance nas listas. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Cor do local">
      {LOCATION_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={NAMES[color]}
          className={`swatch ${color === value ? 'is-active' : ''}`}
          style={{ background: `var(--loc-${color})` }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}
