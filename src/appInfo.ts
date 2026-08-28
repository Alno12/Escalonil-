/** Versão exibida em Configurações → Sobre. Mantenha em sincronia com o package.json. */
export const APP_VERSION = '1.3.0'

/** Como a versão aparece na frase para o usuário — "1.1", não "1.1.0". */
export const APP_RELEASE = '1.3'

/**
 * O que mudou nesta versão, na ordem em que o usuário vai notar.
 *
 * Aparece DEPOIS de atualizar, não antes: quem avisa que existe versão nova é
 * o app que está rodando, que ainda é o antigo e não tem como saber o que vem
 * na próxima. Só a versão nova conhece a própria lista.
 */
export const APP_CHANGES = [
  '"Usar um modelo" fica sempre à vista, e explica como funciona.',
  'Na Agenda, o "Adicionar" do dia sobe para o topo, sem precisar rolar.',
]
