/**
 * O que conta como "o mesmo lugar".
 *
 * Fica aqui, e não dentro do repositório, porque o formulário precisa da
 * MESMA resposta que o banco. Enquanto os dois tinham cada um a sua conta,
 * digitar "upa  centro" fazia a tela achar que era um local novo e o banco
 * achar que era o antigo — e a cor do local existente era sobrescrita sem
 * ninguém pedir.
 */

/** Tira o espaço das pontas e reduz qualquer sequência interna a um só. */
export function normalizeLocationName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Mesmo lugar? Ignora maiúsculas, acentuação de caixa e espaço sobrando. */
export function sameLocationName(a: string, b: string): boolean {
  return normalizeLocationName(a).toLowerCase() === normalizeLocationName(b).toLowerCase()
}

/** O local salvo que corresponde ao nome digitado, se existir. */
export function findLocationByName<T extends { name: string }>(
  locations: T[],
  name: string,
): T | undefined {
  return locations.find((location) => sameLocationName(location.name, name))
}
