import { useEffect, useState } from 'react'
import { NoticeDialog } from '@/components/ui/NoticeDialog'
import { useAppData } from '@/state/appDataContext'
import { saveSettings } from '@/data/repository'
import { APP_CHANGES, APP_RELEASE, APP_VERSION } from '@/appInfo'

/**
 * O que mudou, mostrado uma vez por versão depois que o app já atualizou.
 *
 * Este é o único momento em que a lista de novidades é possível: o aviso de
 * "tem versão nova" vem do app antigo, que não conhece o conteúdo da próxima.
 *
 * Quem acaba de instalar não recebe novidade nenhuma — não mudou nada para
 * ele, o app é novo inteiro. Como `lastSeenVersion` também é `null` para quem
 * já usava o app antes deste campo existir, o desempate é o banco: com
 * plantões gravados é um usuário antigo e a lista aparece; vazio, a versão é
 * anotada em silêncio.
 */
export function WhatsNew() {
  const { ready, shifts, settings } = useAppData()
  const [dismissed, setDismissed] = useState(false)

  // Antes de o banco responder, `shifts` está vazio por não ter carregado —
  // decidir aí trataria todo mundo como instalação nova.
  const pending = ready && settings.lastSeenVersion !== APP_VERSION
  const firstInstall = pending && settings.lastSeenVersion === null && shifts.length === 0

  useEffect(() => {
    if (firstInstall) void saveSettings({ lastSeenVersion: APP_VERSION })
  }, [firstInstall])

  const dismiss = () => {
    setDismissed(true)
    void saveSettings({ lastSeenVersion: APP_VERSION })
  }

  return (
    <NoticeDialog
      open={pending && !firstInstall && !dismissed}
      icon="spark"
      tone="warning"
      title={`Novidades da versão ${APP_RELEASE}`}
      message="O que mudou desde a última vez que você abriu."
      items={APP_CHANGES}
      closeLabel="Entendi"
      onClose={dismiss}
    />
  )
}
