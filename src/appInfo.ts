/** Versão exibida em Configurações → Sobre. Mantenha em sincronia com o package.json. */
export const APP_VERSION = '1.1.0'

/** Como a versão aparece na frase para o usuário — "1.1", não "1.1.0". */
export const APP_RELEASE = '1.1'

/**
 * O que mudou nesta versão, na ordem em que o usuário vai notar.
 *
 * Aparece DEPOIS de atualizar, não antes: quem avisa que existe versão nova é
 * o app que está rodando, que ainda é o antigo e não tem como saber o que vem
 * na próxima. Só a versão nova conhece a própria lista.
 */
export const APP_CHANGES = [
  'Modelos de plantão: preencha um plantão novo em um toque.',
  'Bolinhas coloridas no calendário — a cor é a do local.',
  'Correção de bugs.',
]
