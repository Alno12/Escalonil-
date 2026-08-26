import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { NoticeDialog } from '@/components/ui/NoticeDialog'
import { Icon } from '@/components/ui/Icon'

/**
 * Atualização da PWA (§43): quando uma versão nova é publicada, o usuário
 * recebe um aviso e decide quando recarregar — nunca fica preso na antiga.
 *
 * O aviso é um diálogo no centro da tela, e não uma barrinha no rodapé: já
 * tem gente usando o app, e uma tarja discreta em cima da barra de abas era
 * fácil demais de ignorar. Sem lista do que mudou — quem mostra este aviso é
 * a versão ANTIGA, que não sabe o que vem na nova (ver `WhatsNew`).
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
      <NoticeDialog
        open
        icon="refresh"
        title="Tem uma versão nova"
        message="O Escalonil vai recarregar para instalar. Seus plantões não são afetados — tudo continua no aparelho."
        closeLabel="Depois"
        onClose={() => setNeedRefresh(false)}
        confirmLabel="Atualizar"
        onConfirm={() => void updateServiceWorker(true)}
      />
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
