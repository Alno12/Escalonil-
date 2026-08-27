/** Versão exibida em Configurações → Sobre. Mantenha em sincronia com o package.json. */
export const APP_VERSION = '1.2.0'

/** Como a versão aparece na frase para o usuário — "1.1", não "1.1.0". */
export const APP_RELEASE = '1.2'

/**
 * O que mudou nesta versão, na ordem em que o usuário vai notar.
 *
 * Aparece DEPOIS de atualizar, não antes: quem avisa que existe versão nova é
 * o app que está rodando, que ainda é o antigo e não tem como saber o que vem
 * na próxima. Só a versão nova conhece a própria lista.
 */
export const APP_CHANGES = [
  'Compartilhe a escala do mês: uma folha só, pelo WhatsApp ou impressa.',
  'Impressora que usa papel deitado? Ligue "Papel deitado" ao compartilhar.',
  'A Agenda abre no Mês, e o cabeçalho do período fica fixo ao rolar.',
  'Filtros da Lista mais enxutos, atrás de um botão só.',
  'Escala "todo primeiro sábado": escolha a posição no mês na hora.',
  'Correção de bugs.',
]
