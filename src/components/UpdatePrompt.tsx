import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

/**
 * Atualização da PWA (§43): quando uma versão nova é publicada, o usuário
 * recebe um aviso e decide quando recarregar — nunca fica preso na antiga.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  // "Pronto para usar offline" é só uma confirmação: some sozinho.
  useEffect(() => {
    if (!offlineReady) return
    const timer = window.setTimeout(() => setOfflineReady(false), 4000)
    return () => window.clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (needRefresh) {
    return (
      <div className="update-prompt" role="status">
        <Icon name="refresh" size={18} />
        <span>Nova versão disponível</span>
        <div className="update-prompt__actions">
          <Button variant="quiet" size="sm" onClick={() => setNeedRefresh(false)}>
            Depois
          </Button>
          <Button variant="primary" size="sm" onClick={() => void updateServiceWorker(true)}>
            Atualizar
          </Button>
        </div>
      </div>
    )
  }

  if (offlineReady) {
    return (
      <div className="update-prompt" role="status">
        <Icon name="check" size={18} />
        <span>Pronto para usar offline</span>
      </div>
    )
  }

  return null
}
