import { createPortal } from 'react-dom'
import { useMountTransition } from '@/hooks/useMountTransition'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useSheetHistory } from '@/hooks/useSheetHistory'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { Button } from './Button'

export interface DialogChoice {
  label: string
  onClick: () => void
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /**
   * Mais de um caminho para a mesma ação (ex.: excluir só este plantão ou a
   * série inteira). Quando informado, os botões ficam empilhados e
   * `confirmLabel`/`onConfirm` não são usados.
   */
  choices?: DialogChoice[]
  onConfirm?: () => void
  onCancel: () => void
}

/** Confirmação para ações destrutivas (§55). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  choices,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { mounted, visible } = useMountTransition(open, 200)
  useBodyScrollLock(mounted)
  useSheetHistory(open, onCancel)
  const trap = useFocusTrap<HTMLDivElement>(mounted, visible)

  if (!mounted) return null

  return createPortal(
    <div className={`dialog-root ${visible ? 'is-open' : ''}`}>
      <div className="sheet-backdrop" onClick={onCancel} aria-hidden="true" />
      <div ref={trap} className="dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="dialog__title">{title}</h2>
        <p className="dialog__message">{message}</p>
        {choices ? (
          <div className="dialog__actions dialog__actions--stack">
            {choices.map((choice) => (
              <Button
                key={choice.label}
                variant={destructive ? 'danger' : 'primary'}
                size="lg"
                block
                onClick={choice.onClick}
              >
                {choice.label}
              </Button>
            ))}
            <Button variant="secondary" size="lg" block onClick={onCancel} autoFocus>
              {cancelLabel}
            </Button>
          </div>
        ) : (
          <div className="dialog__actions">
            <Button variant="secondary" size="lg" block onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              size="lg"
              block
              onClick={onConfirm}
              autoFocus
            >
              {confirmLabel}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
