# Escalonil — guia de arquitetura

Este projeto é mantido principalmente por agentes de IA. A prioridade é
**simplicidade + boa experiência do usuário**, não sofisticação técnica.
Leia este arquivo antes de alterar qualquer coisa.

## Regra de ouro

Ao decidir entre duas soluções, escolha a que torna a vida do médico
plantonista mais simples. Não invente funcionalidades que ninguém pediu.

## Estrutura

```
src/
├── db/           types.ts (modelo de dados) e db.ts (Dexie/IndexedDB)
├── data/         repository.ts (todo CRUD) e backup.ts (JSON/CSV)
├── domain/       regras puras e testáveis — nenhuma importa React
│   ├── datetime.ts   datas/horas locais e formatação pt-BR
│   ├── money.ts      formatação e leitura de valores em BRL
│   ├── shift.ts      duração, valor esperado, situação do plantão/pagamento
│   ├── conflicts.ts  sobreposição de horários
│   ├── location.ts   o que conta como "o mesmo lugar"
│   ├── recurrence.ts escalas (12×36, 5×2) e recorrências de uma série
│   ├── backupReminder.ts  quando cobrar um backup novo
│   ├── summary.ts    somas financeiras e recortes de agenda
│   ├── reports.ts    indicadores, relatório por local e insights
│   └── periods.ts    períodos dos relatórios e o período anterior equivalente
├── state/        providers de dados, tema, toasts e folhas de plantão
├── components/   ui/ (primitivos) e shifts/ (formulário, detalhe, listas)
├── screens/      Home, Schedule, Finance, Reports, Settings
├── layout/       AppShell e TabBar
└── styles/       tokens → base → ui → layout → screens (nesta ordem)
```

## Invariantes — quebre isto e o app fica errado

**1. Datas são strings locais, nunca UTC.**
`startDateTime`/`endDateTime` são `"YYYY-MM-DDTHH:mm"` sem fuso. Um plantão às
19:00 continua às 19:00 em qualquer fuso, e o backup fica legível. Use
`toDate()` de `domain/datetime.ts` para converter — **nunca** `new Date(string)`
direto, que interpreta a string como UTC.

**2. Situação é sempre calculada, nunca armazenada.**
`getShiftStatus()` e `getPaymentStatus()` recebem o `now`. "Em andamento"
depende da hora atual, então gravar esse estado no banco o deixaria velho no
minuto seguinte.

**3. `expectedAmount` é derivado, mas persistido.**
Fica no banco para listas e relatórios não recalcularem tudo. É sempre
regravado por `computeExpectedAmount()` dentro de `repository.ts`. Se você
alterar `paymentMode`, `fixedAmount`, `hourlyRate` ou os horários em qualquer
outro lugar, o valor sai de sincronia.

**4. Um `Payment` existe apenas para plantões pagos.**
Sem registro = "ainda não recebido". `expectedAmount` no Payment é uma
fotografia do previsto no momento do recebimento, para a divergência sobreviver
a edições posteriores do plantão.

**4b. Não existe "atrasado". O app não controla prazos.**
Plantão realizado e não pago fica "a receber" por tempo indeterminado, e só sai
dessa lista quando o usuário registra o recebimento. Foi uma decisão explícita
de simplificação: nada de data prevista, prazo padrão ou cobrança automática.
Se isso voltar um dia, os valores antigos de `expectedPaymentDate` continuam
gravados nos registros — a v3 do banco só removeu o índice, não os dados.

**5. Conflito avisa, não bloqueia.**
`findConflicts()` alimenta um aviso no formulário e um diálogo
"Revisar / Salvar mesmo assim". Plantões sobrepostos são raros mas legítimos.

**6. Toda escrita passa por `data/repository.ts`.**
Telas não falam com o Dexie. Excluir um plantão apaga o pagamento junto —
essa regra mora lá.

**6b. Cancelar NÃO apaga o recebimento.**
`getPaymentStatus` já devolve `cancelled` para plantão cancelado, então ele sai
de todas as somas sozinho. Apagar o `Payment` junto não mudava número nenhum e
destruía o histórico de um dinheiro que entrou de verdade — sem aviso e sem
desfazer. Cancelar é reversível: reativar traz o recebimento de volta.

**7. Semana começa no domingo.** Convenção brasileira, usada no calendário e
nos resumos.

**8. Início e fim são datas completas, sem regra escondida.**
O formulário guarda `startDate`+`startTime` e `endDate`+`endTime`. Não existe
mais "virada automática de meia-noite": os atalhos de duração usam `addHours`,
o usuário vê a data final na tela e confere. É o que torna 36h e 48h possíveis
sem nenhuma aritmética invisível.

**10. A cor pertence ao LOCAL, não ao plantão.**
`Location.color` guarda a CHAVE da cor (`blue`, `teal`…), nunca o hexadecimal,
para que cada tema use o tom certo via `--loc-*`. Escolher a cor no formulário
altera o local inteiro — todos os plantões daquele lugar mudam junto, que é o
que faz a agenda ficar legível de relance.

**11. O título complementa o local, nunca o substitui.**
`Shift.title` aparece depois do nome do local nas listas. Um plantão sem título
continua mostrando o local normalmente.

**9. A série SEMPRE começa no dia marcado, mesmo que ele já tenha passado.**
`recurrenceStarts` recebe o instante do primeiro plantão e devolve
`LocalDateTime[]` — datetimes, não datas, porque as escalas de horas caem fora
da meia-noite (um 12×24 às 07:00 volta às 19:00 do dia seguinte). Nas escalas
por dias da semana a varredura começa no **domingo da semana de início**, sem
nenhum filtro pela data digitada: marcar segunda com início na quarta gera a
segunda daquela mesma semana. Foi um pedido explícito do dono do app — não
"conserte" isso. `normalizeWeekdays` garante que a lista nunca fica vazia e
`MAX_OCCURRENCES` é o teto de segurança de qualquer escala.

**9b. Toda escala é `{work, off}`, em horas ou em dias.**
`12×36` é `{kind:'hours', segments:[{work:12, off:36}]}`; `5×2` é o mesmo em
dias. Escalas com dois trechos (`12×24, 12×72`) são dois segmentos percorridos
em rodízio. Escolher uma escala de HORAS também define a duração do plantão
(`recurrenceShiftHours`) — um 12×36 é feito de plantões de 12h. Escalas de dias
não mexem na duração.

**14. `seriesId` amarra os plantões criados pela mesma escala.**
`createShifts` só gera o identificador a partir de DOIS plantões — um plantão
sozinho não é série. Editar ou duplicar nunca mexe nele, então um plantão
continua na série depois de ajustado. Excluir um plantão de uma série pergunta
"só este" ou "a série inteira"; sem isso, desfazer uma escala de um ano seria
apagar plantão por plantão. `deleteSeries` roda numa transação só, senão meio
caminho andado deixaria recebimento órfão.

**14b. Editar pergunta "só este" ou "este e os próximos".**
`updateSeriesFrom` propaga o que DESCREVE o plantão — local, tipo, título,
forma de pagamento, valores, anotações — mais a hora de início e a duração,
aplicadas sobre a data que cada plantão já tem. A **data não propaga**: ela vem
do ritmo da escala, e reescrevê-la a partir de uma edição solta é a única
mudança capaz de destruir um ano de agenda de uma vez; o diálogo avisa isso
quando a data mudou. Só alcança os plantões que começam DEPOIS do editado —
o que já passou é histórico. Plantão cancelado continua cancelado.
A seção "Repetir" não aparece ao editar: um plantão que já existe não ganha
escala, e um seletor que não faz nada é pior que nenhum.

**13. Só existe UMA regra de "mesmo local", e ela mora em `domain/location.ts`.**
`sameLocationName` ignora maiúsculas e espaço sobrando; `ensureLocation`, o
formulário e o seletor usam todos ela. Já quebrou uma vez por ter duas contas
diferentes: a tela achava que "upa  centro" era um local novo, o banco achava
que era o antigo, e a cor do local existente era sobrescrita sem ninguém pedir.
Se precisar comparar nome de local em qualquer lugar novo, importe daqui — não
escreva `.toLowerCase()` no componente.

**15. A restauração de backup não confia no arquivo.**
`parseBackup` recalcula `expectedAmount` (o invariante 3 vale também para dado
importado) e recusa o que o app nunca produziria: data que não existe no
calendário, plantão que termina antes de começar, valor negativo, identificador
repetido e dois recebimentos para o mesmo plantão. Cada recusa tem mensagem
própria — "não foi possível restaurar" sozinho não diz se o arquivo está
corrompido ou se o problema é passageiro. Restaurar continua sendo tudo ou
nada, dentro de uma transação: falhou, os dados atuais ficam intactos.

**12. Recebimento em lote nunca rateia valores.**
`registerPayments` grava cada plantão pelo próprio `expectedAmount`. Se o
depósito veio diferente, o ajuste é plantão a plantão — inventar um rateio
criaria divergências que o usuário nunca escolheu.

## Como os dados chegam na interface

`AppDataProvider` carrega **o banco inteiro** em memória com `useLiveQuery` e
monta os `ShiftView` (plantão + local + pagamento + situação). Isso é
intencional: o app é pessoal, alguns milhares de plantões ocupam poucos
megabytes, e todo cálculo vira síncrono e instantâneo. Não introduza consultas
paginadas sem uma razão medida.

Um relógio compartilhado (`useNow`) atualiza no máximo uma vez por minuto e
imediatamente quando o app volta ao primeiro plano.

## Escopos financeiros (não misture)

- `expected` — soma dos plantões não cancelados do recorte.
- `pending` — realizados e ainda não pagos.
- `outstanding` — tudo que falta entrar; hoje é igual a `pending`.
- `received` — soma do que entrou de fato (não do previsto).

Na tela Financeiro, os valores do topo olham o mês selecionado e as listas
abaixo mostram todos os períodos — de propósito, para nenhuma pendência antiga
sumir por causa de um filtro.

## Interface — linguagem visual do iOS

O app segue a linguagem do Apple Saúde:

- Fundo cinza agrupado, cartões **sem borda e sem sombra**. A separação vem do
  contraste de fundo, não de traços.
- Dentro dos cartões, as linhas são separadas por **hairlines recuadas**
  (`left: var(--row-pad)`), nunca por bordas completas.
- Cinco abas no rodapé, sem botão de ação no meio. **Novo plantão** vive no
  canto superior direito de cada tela (`ScreenHeader`).
- Os resumos "Esta semana" e "Este mês" do Início são recortes da AGENDA, não
  dos relatórios: cada um abre `#/agenda?v=semana` ou `?v=mes` e cai na
  visualização certa. `Schedule` lê esse parâmetro uma vez, na montagem.
- O Início cabe numa tela até o começo de "Próximos plantões". Os dois resumos
  são DUAS LINHAS de um cartão só, e o cartão Financeiro não repete o previsto
  do mês (que já está na linha "Este mês"). Ao acrescentar qualquer coisa ali,
  meça de novo: o objetivo é o primeiro plantão da lista aparecer sem rolar.
- O cartão do próximo plantão é tingido com a COR DO LOCAL, em degradê que some
  para baixo. Chapado, as cores quentes embarram o tema escuro e o texto
  secundário perde contraste — foi por isso que virou degradê.
- Números usam `.num` (tabular) para alinhar em colunas.

Cuidado com a cascata: modificadores com a MESMA especificidade da regra base
dependem da ordem no arquivo. Prefira regras descendentes
(`.agenda-day--free .agenda-day__date`) a modificadores soltos — já quebrou uma
vez por isso.

- Estado local de formulário é reiniciado por **remontagem via `key`**
  (`ShiftSheetsProvider`), nunca por `useEffect` de sincronização. A chave tem
  que cercar só o campo que precisa remontar: em `PreferencesSection` ela
  envolvia o formulário inteiro, então gravar um valor no blur derrubava o foco
  do campo vizinho e fechava o teclado no iPhone.
- **Todo campo de dinheiro usa `useMoneyMask`.** O valor se preenche da direita
  para a esquerda (1 → 0,01 → 0,12 → 1,20 → 12,00 → 1.200,00) e o cursor mora
  no fim, como numa calculadora. `moneyToInput` produz exatamente o texto que a
  máscara geraria, e `parseMoneyInput` lê esse texto de volta — os três andam
  juntos, não mexa em um sem os outros.
- `useMountTransition` mantém folhas e diálogos montados durante a animação de
  saída.
- `useBodyScrollLock` conta as travas num contador COMPARTILHADO. Cada
  instância guardando e repondo o `overflow` por conta própria travava o app
  inteiro: a folha do plantão trava (guardando ""), o diálogo de excluir trava
  por cima (guardando "hidden"), os dois fecham juntos e o último a soltar
  repõe o "hidden". Só recarregando a página destravava.
- Toda cor, espaçamento e sombra vem de `styles/tokens.css`. Não escreva valores
  literais nos componentes, e defina qualquer token novo nos **dois** temas.
- Campos de texto usam **`--text-input-min` (16px)** — abaixo disso o Safari dá
  zoom ao focar. Vale para os campos compactos dentro de `.row__pair` também,
  que já estiveram a 15px. Esses campos precisam de `min-width: 0`: os seletores
  nativos de data e hora impõem a largura intrínseca deles e vazam do cartão
  em vez de encolher.
- Respeite `env(safe-area-inset-*)` em qualquer elemento fixo.

## PWA, GitHub Pages e Netlify

- `base` no `vite.config.ts` é `/Escalonil-/` e pode ser trocado por
  `BASE_PATH`. O workflow do Pages deriva do nome do repositório; o
  `netlify.toml` fixa `BASE_PATH = "/"` porque o Netlify serve na raiz. Os dois
  destinos publicam do mesmo commit sem conflito.
- Rotas em **hash** (`#/agenda`) — funcionam em subrota do GitHub Pages sem
  configuração de servidor.
- Service worker em modo `prompt`: o usuário decide quando atualizar.
- O ícone do app é `assets/icon-source.png` (512×512). Para trocar, substitua
  esse arquivo e rode `node scripts/generate-icons.mjs`: ele deriva os seis
  arquivos de `public/` sozinho, ainda sem nenhuma dependência — o script traz
  leitor e gravador de PNG próprios.
- Os ícones `maskable` são gerados a **80% do quadrado**, com o fundo
  completando as bordas. O Android recorta o ícone em círculo, squircle ou gota
  conforme o aparelho, e só garante o círculo central de 80%: em tamanho cheio,
  o topo da cabeça seria cortado.
- `background_color` do manifest é o fundo CLARO do app, não o amarelo do
  ícone. Amarelo com amarelo faria o ícone sumir dentro da própria tela de
  abertura.

## Antes de terminar qualquer alteração

```bash
npm run lint && npm test && npm run build
```

Migração de banco não tem teste automático — o vitest roda em Node, sem
IndexedDB. Ao subir a versão do Dexie, monte o esquema anterior no navegador,
abra o app em cima e confira que os registros antigos sobreviveram.

No CSV, o texto que o usuário escreve (local, tipo, anotações) passa por
`csvText`: uma anotação começando com `=`, `+`, `-` ou `@` é lida como FÓRMULA
pelo Excel. As colunas numéricas não passam por lá — nelas o `-` é sinal.

Os testes cobrem as regras críticas: virada de meia-noite, duração, valor
esperado, situação do pagamento, conflitos, escalas e recorrências, somas
financeiras, insights, validação de backup e CSV. Se você mexer nessas regras,
ajuste os testes junto.

## Fluxo de contribuição

A `main` é a branch publicada — **não envie commits direto nela**. Trabalhe em
uma branch e abra um pull request: o `ci.yml` roda lint, testes e build, e o
merge é que dispara a publicação. Descreva no PR o que mudou e o que você
verificou; quem lê é o próprio dono do app.

## Fora de escopo na V1

Login, contas, multiusuário, sincronização em nuvem, integração com Google/Apple
Calendar, notificações push, troca de plantões entre médicos, backend e IA
externa. Não implemente nada disso sem pedido explícito.
