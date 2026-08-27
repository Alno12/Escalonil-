import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMountTransition } from '@/hooks/useMountTransition'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useSheetHistory } from '@/hooks/useSheetHistory'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface SheetProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  /** Barra fixa no rodapé, acima da safe area. */
  footer?: ReactNode
  /** Ação no canto superior direito (ex.: "Salvar"). */
  action?: ReactNode
  /** Texto do botão de fechar. "Voltar" quando a folha veio de outra. */
  closeLabel?: string
  /** 'full' ocupa quase a tela toda; 'auto' cresce com o conteúdo. */
  size?: 'full' | 'auto'
}

/**
 * Folha que sobe do rodapé — o padrão que o iPhone usa para criar e editar.
 * Fecha no toque fora, no botão e com Esc.
 */
export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  action,
  closeLabel = 'Cancelar',
  size = 'full',
}: SheetProps) {
  const { mounted, visible } = useMountTransition(open, 240)
  useBodyScrollLock(mounted)
  useSheetHistory(open, onClose)
  // `visible` só é true depois da animação de entrada — antes disso, focar
  // faria o iPhone rolar a tela no meio dela.
  const trap = useFocusTrap<HTMLDivElement>(mounted, visible)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <div className={`sheet-root ${visible ? 'is-open' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={trap}
        className={`sheet sheet--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sheet__grip" aria-hidden="true" />
        <header className="sheet__header">
          <button className="sheet__close" onClick={onClose}>
            {closeLabel}
          </button>
          <div className="sheet__titles">
            <h2 className="sheet__title">{title}</h2>
            {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
          </div>
          <div className="sheet__action">{action}</div>
        </header>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
