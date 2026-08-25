import { createPortal } from 'react-dom'
import { useMountTransition } from '@/hooks/useMountTransition'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
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
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { mounted, visible } = useMountTransition(open, 200)
  useBodyScrollLock(mounted)

  if (!mounted) return null

  return createPortal(
    <div className={`dialog-root ${visible ? 'is-open' : ''}`}>
      <div className="sheet-backdrop" onClick={onCancel} aria-hidden="true" />
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="dialog__title">{title}</h2>
        <p className="dialog__message">{message}</p>
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
      </div>
    </div>,
    document.body,
  )
}
