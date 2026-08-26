import { createPortal } from 'react-dom'
import { useMountTransition } from '@/hooks/useMountTransition'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useSheetHistory } from '@/hooks/useSheetHistory'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'

interface NoticeDialogProps {
  open: boolean
  icon: IconName
  /** 'accent' para o que o app pede; 'warning' para o que ele conta. */
  tone?: 'accent' | 'warning'
  title: string
  message: string
  /** Lista opcional embaixo da mensagem (as novidades da versão). */
  items?: string[]
  /** Botão que só fecha. É o único quando não existe `onConfirm`. */
  closeLabel: string
  onClose: () => void
  confirmLabel?: string
  onConfirm?: () => void
}

/**
 * Aviso no centro da tela: o app tem algo a dizer, não algo a confirmar.
 *
 * Separado do ConfirmDialog de propósito — lá a pergunta é sobre uma ação
 * destrutiva que o usuário acabou de pedir; aqui quem começou a conversa foi
 * o app, então o aviso ganha ícone e pode trazer uma lista.
 */
export function NoticeDialog({
  open,
  icon,
  tone = 'accent',
  title,
  message,
  items,
  closeLabel,
  onClose,
  confirmLabel,
  onConfirm,
}: NoticeDialogProps) {
  const { mounted, visible } = useMountTransition(open, 200)
  useBodyScrollLock(mounted)
  useSheetHistory(open, onClose)

  if (!mounted) return null

  return createPortal(
    <div className={`dialog-root ${visible ? 'is-open' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className={`dialog ${items ? 'dialog--wide' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <span className={`dialog__mark dialog__mark--${tone}`} aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
        <h2 className="dialog__title">{title}</h2>
        <p className="dialog__message">{message}</p>

        {items && items.length > 0 && (
          <ul className="dialog__list">
            {items.map((item) => (
              <li key={item}>
                <span className="dialog__bullet" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        )}

        <div className="dialog__actions">
          <Button
            variant={onConfirm ? 'secondary' : 'primary'}
            size="lg"
            block
            onClick={onClose}
            autoFocus={!onConfirm}
          >
            {closeLabel}
          </Button>
          {onConfirm && (
            <Button variant="primary" size="lg" block onClick={onConfirm} autoFocus>
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
