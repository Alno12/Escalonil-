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
│   ├── templates.ts  os plantões que já viraram rotina
│   ├── recurrence.ts escalas (12×36, 5×2) e recorrências de uma série
│   ├── backupReminder.ts  quando cobrar um backup novo
│   ├── vacation.ts   a contagem das férias (easter egg)
│   ├── summary.ts    somas financeiras e recortes de agenda
│   ├── reports.ts    indicadores, por local, insights, ritmo e recordes
│   ├── periods.ts    períodos dos relatórios e o período anterior equivalente
│   ├── monthSheet.ts    o conteúdo da folha do mês (impressão e envio)
│   └── monthSheetSvg.ts o desenho dessa folha, em SVG
├── state/        providers de dados, tema, toasts e folhas de plantão
├── components/   ui/ (primitivos) e shifts/ (formulário, detalhe, listas)
├── screens/      Home, Schedule, Finance, Reports, Settings
├── layout/       AppShell, TabBar e os ícones da própria barra
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

**9c. A POSIÇÃO NO MÊS é a exceção do 9, e é de propósito.**
Numa escala `monthlyWeekday` a série PULA para frente: o primeiro plantão cai
na primeira data que satisfaz `{nth, weekday}` e é **igual ou posterior** à
data digitada. Com o plantão numa quarta, 26/08, e "primeiro sábado" marcado,
ele vai para 05/09 — o primeiro sábado de agosto já passou.

As duas regras estão certas, cada uma pelo seu motivo, e **nenhuma das duas é
para ser "uniformizada" com a outra**. No 9 o dia da semana é o dia da própria
data digitada, então voltar até o domingo daquela semana devolve exatamente o
que o médico marcou. Aqui a posição é ESCOLHIDA à mão — `{nth, weekday}` mora
na recorrência, não é mais deduzida da data —, então a data digitada vira só o
ponto de partida: gerar para trás criaria um plantão num dia que o usuário
nunca viu. Foi decisão explícita do dono do app, com as duas escritas aqui de
propósito para ninguém achar que é incoerência.

`sameRecurrence` compara `nth` e `weekday`; `selectedOptionId` devolve
`monthly-weekday` para qualquer posição, porque a posição é o ajuste DENTRO da
linha (invariante 19), não outra linha. `recurrenceLabel` monta a frase a
partir da recorrência — ler a posição da data era justamente o que fazia a
linha dizer "na quarta quarta-feira" e parecer que a opção não existia.

**9b. Toda escala é `{work, off}`, em horas ou em dias.**
`12×36` é `{kind:'hours', segments:[{work:12, off:36}]}`; `5×2` é o mesmo em
dias. Escalas com dois trechos (`12×24, 12×72`) são dois segmentos percorridos
em rodízio. Escolher uma escala de HORAS também define a duração do plantão
(`recurrenceShiftHours`) — um 12×36 é feito de plantões de 12h. Escalas de dias
não mexem na duração.

**19. Na folha de escala, quem tem ajuste EXPANDE; quem não tem, aplica e fecha.**
"Todas as semanas" abria e fechava na hora, e o seletor de dias só aparecia
depois, dentro do formulário — quem estava na folha não tinha como saber que
ele existia. Agora a linha marca, abre os dias embaixo dela e espera o
"Concluir", como as "Personalizadas" sempre fizeram. Quem decide a CASA da
recorrência semanal é o intervalo, não os dias: `selectedOptionId` manda todo
`everyWeeks: 1` para "Todas as semanas" e todo `2` para "A cada 2 semanas",
senão a marca pulava para a linha personalizada no primeiro dia marcado. Os
presets que nomeiam os dias no próprio rótulo — "de segunda a sexta" — são
testados antes e continuam com casa própria. "Todos os meses no primeiro
sábado" expande do mesmo jeito, com a posição e o dia da semana (9c), e o
rótulo da própria linha acompanha o que está marcado embaixo dela — o rótulo
fixo do catálogo descreveria a data, não a escolha. Tocar de novo numa linha
JÁ marcada não reaplica o preset: a escala pronta apagaria o ajuste que o
usuário acabou de fazer. Os grupos vêm na ordem
Recorrentes → Horas → Dias: escala fixa é o caso comum, e ela ficava embaixo
de dezesseis linhas de ciclo.

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

**16. Na agenda, quem decide o dia seguinte é a HORA DE TÉRMINO.**
O plantão sempre pertence ao dia em que COMEÇA. Ele só aparece TAMBÉM no dia
seguinte quando de fato toma esse dia: atravessa ele inteiro, ou termina depois
do meio-dia (`NEXT_DAY_CUTOFF`, em `domain/summary.ts`). Um 19:00 → 07:00 sai
da agenda do dia seguinte — de manhã o médico vai para casa; um 19:00 → 19:00
fica. O critério NÃO é a duração: 12h (19:00 → 07:00), 18h (13:00 → 07:00) e
24h (07:00 → 07:00) terminam todos às 07:00 e tomam o mesmo pedaço do dia
seguinte, enquanto dois plantões de 24h podem ocupar dias seguintes
completamente diferentes. `occupiesDay` responde por um dia; `occupiedDays`
lista todos, e é o que o calendário usa para o anel e as bolinhas não
discordarem da lista que aparece embaixo dele.

**17. Modelo de plantão é deduzido, nunca cadastrado.**
`buildShiftTemplates` agrupa o histórico por local + título + tipo + hora de
início + duração + valor, e só devolve o que se repetiu pelo menos
`MIN_TEMPLATE_USES` vezes — com 1, "modelo" seria o histórico de novo, que já
está na agenda. Não existe tela de gerenciar modelos, e não deve existir: o
modelo se forma sozinho conforme o médico trabalha. As ANOTAÇÕES ficam fora da
chave e fora do modelo, porque são o pedaço realmente avulso do plantão. A
DATA nunca vem do modelo — é a única coisa que muda de verdade entre um
plantão e o outro. A linha "Usar um modelo" só existe ao CRIAR: duplicar já
traz tudo do plantão de origem, e editar não recomeça do zero.

**18. Na aba Lista os filtros são DOIS eixos, e ficam fora da tela.**
Situação (`próximos`, `realizados`, `cancelados`) e período (`qualquer`, mês
atual, próximo, anterior, personalizado) são independentes — antes dividiam um
controle só, e por isso "realizados do mês passado" era impossível de pedir.
Tudo mora atrás do botão de filtro (`ListFilterSheet`): na tela ficam a busca, a
fita do que está APLICADO e a lista. A fita só mostra o que está fora do padrão,
então some inteira na tela limpa. O rodapé da folha conta quantos plantões
passam pelo filtro AGORA, para ninguém fechar a folha e cair numa lista vazia
sem entender por quê. NÃO existe filtro de pagamento aqui: quanto falta receber
é a pergunta que a aba Financeiro responde melhor, com os valores somados.

**20. A folha do mês é UMA folha, deitada, e é SVG.**
`monthSheet.ts` monta o conteúdo e `monthSheetSvg.ts` desenha — separados
porque o conteúdo é testável em Node e o desenho é só texto. É SVG e não HTML
porque a MESMA folha vai para a impressora E vira PNG para o WhatsApp: em HTML
seriam dois desenhos obrigados a concordar para sempre — e um dia parariam.

A folha é AUTOSSUFICIENTE: as cores estão em hexadecimal e a fonte é a pilha do
sistema, porque nenhum CSS do app a alcança quando ela é rasterizada. Também
não existe quebra de linha automática — `fitText` corta no "…" por uma largura
ESTIMADA por caractere, o que basta com a folga que os campos têm.

**O iPhone IGNORA o `size` do `@page`** e imprime sempre em pé — pedir deitado
não basta. Por isso o `@media print` tem um ramo `orientation: portrait` que
GIRA o desenho 90°: assim ele ocupa a página inteira em vez de um terço dela, e
quem lê vira o papel — o mesmo custo já aceito na imagem do WhatsApp. Onde o
`@page` vale (computador, Android), o papel sai deitado e nada gira.

**No iPhone, NADA no CSS enxerga a orientação do papel. Não insista.**

Isso foi MEDIDO com uma página de provas impressa no aparelho: nas DUAS
orientações da caixa de impressão do iOS, `@media print` responde
`orientation: portrait` e ~103 × 175 mm — ou seja, a consulta de mídia vale a
JANELA DO TELEFONE, não o papel. Um `@container` medindo o layout, que seria a
saída óbvia, também não alcança: foi implementado, testado no aparelho e não
mudou nada. A escolha de Orientação acontece DEPOIS, quando o iOS já diagramou
a página e só a encaixa no papel.

A consequência: com a Orientação em **Horizontal**, o ramo girado continua
ligado, o bloco precisa de 1,42 de altura para cada 1 de largura, deixa de
caber na caixa em que foi diagramado, e o Safari **remove o bloco inteiro** —
sai uma folha em branco.

E a conta fecha a discussão. Em pé, os 92% dão 160 mm de largura e 228 mm de
altura, que cabem nos 297 mm do papel. Deitado, o papel tem 210 mm de altura:
os mesmos 228 mm já não cabem — e isso vale mesmo que o iOS não redimensione
nada, o que ele faz, piorando a conta. Para caber nos ~174 mm de corpo que ele
entrega, a folha teria de ir a 122 mm de largura: 70% do corpo em vez de 92%,
ou seja **pouco mais da metade da área de hoje**, bem abaixo dos 82% que já
foram medidos como letra pequena demais para imprimir. Não existe porcentagem
que sirva às duas orientações, e o navegador não diz em qual delas está.

**A saída não foi consertar o CSS, foi trocar de caminho.** No iPhone o botão
Imprimir NÃO imprime a página: ele entrega um **PDF** ao sistema
(`printsViaShareSheet` em `data/monthSheetFile.ts`), e quem toca em "Imprimir"
na lista é o usuário. A pista que faltava estava na própria página de provas:
ela imprimia bem nas DUAS orientações, porque é um documento simples; a folha
do app, no mesmo aparelho e no mesmo papel, saía em branco. O problema nunca
foi o iOS em Horizontal — era a impressão da PÁGINA DO APP.

**PDF, e não a imagem do compartilhamento — isso também foi medido.** O iOS
escolhe o papel padrão pelo TIPO do arquivo: imagem ele trata como FOTO e abre
a caixa em **4×6 polegadas**; PDF ele trata como documento, e aí o papel é A4 e
a orientação vem do próprio arquivo. Foi por isso que mandar o PNG não bastou.

`data/monthSheetPdf.ts` escreve esse PDF à mão, sem dependência: são cinco
objetos e um JPEG embutido cru por `/DCTDecode`. Ele **não redesenha nada** —
recebe a mesma imagem que o compartilhamento gera, a 3× (287 DPI), e só a
coloca numa página A4 deitada. Dois desenhos obrigados a concordar para sempre
é o que este mesmo invariante proíbe. A parte frágil do formato é a tabela
`xref`, que indexa os BYTES de cada objeto: um byte a mais em qualquer lugar e
o arquivo abre quebrado — por isso ela tem teste próprio.

No computador e no Android nada disso vale: lá a impressão da página funciona,
está calibrada, e continua sendo o caminho. O ramo girado abaixo é para eles e
para quem usa o app pelo navegador de um telefone que não seja iPhone.

**O que segue impossível é imprimir a PÁGINA em papel deitado no iPhone.** O
iOS abre em Vertical, que é o caso calibrado; o único conserto pelo CSS seria
encolher a folha o bastante para sobreviver às duas orientações, e isso
estragaria a impressão Vertical.

Tirar o `landscape` do `@page` — a única linha do CSS que fala de orientação —
foi cogitado e NÃO resolve: o iPhone ignora o `size` inteiro (é o que abre esta
seção), e no computador é justamente essa palavra que faz o papel sair deitado
por padrão. Trocá-la seria perder o caso que funciona para não ganhar nada no
que não funciona.

**A chave "Papel deitado" foi tentada DUAS vezes e caiu nas duas.** Ela avisava
ao CSS qual papel o usuário tinha escolhido, desligando o giro. Da primeira vez
saiu em branco no aparelho; da segunda — já com o preview atualizando de
verdade, e com o estouro reproduzido e corrigido no Chromium — também não
entregou o que precisava. Não volte a ela: o caminho do iPhone é o PDF, e lá
nenhuma dessas regras participa.

**E ela não teria ajudado nem funcionando, porque papel deitado no iPhone dá
uma folha MENOR.** O iOS come uma faixa fixa de ~55 mm de página, que numa A4
em pé sai de 297 mm e numa deitada sai de 210: sobram 174 × 245 em pé contra
261 × 151 deitada. Como o desenho é 1,42 de largura para cada 1 de altura, em
pé ele chega a 245 mm de largura (usamos 228) e deitado o teto físico é
151 × 1,42 = **215 mm**. Ou seja: pela PÁGINA, em pé e girado é o maior que
essa folha consegue ser num iPhone, e nenhuma porcentagem muda isso — quem
manda é a faixa do iOS. É mais um motivo para o PDF, que não passa por nada
disso.

Não tente adivinhar a orientação de novo. Quatro tentativas caíram antes do
PDF: `height: 96%`, `max-height`, `container-type: size` — esta última chegou a
zerar o desenho, porque contenção de tamanho sobre altura indefinida vale
ZERO — e um `@container` medindo a largura real da página, implementado e
testado no aparelho sem mudar nada. O que falta não é uma regra de CSS mais
esperta, é uma informação que o navegador não dá.

O teto do ramo deitado é um **`max-width` em milímetros**, porque a altura não
dá para limitar direto: como ela sai da proporção do desenho, limitar a largura
é limitá-la. Os 196 mm dão 138 mm, com folga sobre os ~151 mm que o iPhone
entrega numa página deitada. Um `@media (orientation: landscape) and
(min-height: 190mm)` tira o teto onde a mídia fala do papel de verdade
(computador, Android) e o desenho volta aos 261 × 184. No iPhone essa consulta
nunca casa, e o teto fica de pé — que é o comportamento seguro.

**Não existe mais `break-inside: avoid` na folha, e a ausência é de propósito.**
Ele custou duas páginas em branco: diante de um bloco que não cabe, o Safari
não corta — tira o bloco INTEIRO do papel. Sem ele, o pior caso é um desenho
cortado, que dá para ver e entender.

**No `@media print`, TUDO é porcentagem da página** — nem milímetros, nem `vh`.
Os dois foram tentados e os dois falharam:

- Milímetro fixo supõe o tamanho da área útil, que não é conhecido: o iPhone dá
  o que quiser, descontando a faixa que reserva ao endereço e ao número da
  página. Errado para menos, o desenho vaza e o Safari pagina PARA O LADO — sai
  uma segunda folha com a tira que sobrou. Aconteceu três vezes.
- `vh` na impressão do iPhone NÃO vale a altura do papel; vale bem menos
  (medido: ~235 mm num A4 de 297). Com o teto amarrado nele a folha saiu numa
  página só, mas com dois terços do tamanho e letra miúda demais para imprimir.

**No ramo deitado, `88%` com teto de `196mm`.** A largura sozinha já quebrou:
ela produz 0,70 de altura para cada 1 de largura, e na área útil que o iPhone
entrega numa A4 DEITADA (261 × 151 mm) isso daria 161 mm de altura para 151
disponíveis. Com o teto o desenho fica em 196 × 138 mm, e no papel inteiro
(onde `min-height: 190mm` vale) volta aos 261 × 184 de sempre.

No ramo girado, `92%` da largura, com a altura saindo da proporção do desenho. Ali é a LARGURA que limita — a folha precisa de
1,42 de altura para cada 1 de largura, e altura sobra —, então a porcentagem é
escolhida pela ALTURA que ela produz. Medido num iPhone, A4 em pé: **o iOS
entrega só 174 mm de corpo** (o papel tem 210; os 36 mm restantes são margem
dele, que não dá para tirar), o desenho começa a 17 mm do alto e a linha do
rodapé fica a 287 mm — mas a quebra vem ANTES do rodapé, e três valores medidos
cercam onde:

| largura | desenho | termina | papel |
| --- | --- | --- | --- |
| 82% | 143 × 203 mm | 220 mm | uma página, com 63 mm em branco e letra miúda |
| **92%** | **160 × 228 mm** | **245 mm** | **uma página, com folga** |
| 98% | 170 × 243 mm | 260 mm | DUAS páginas, por muito pouco |

Os 92% ficam no meio, com 15 mm de margem para o que quebrou e um quarto de
área a mais que os 82%. **Não vá atrás dos últimos milímetros**: a segunda
página em branco custa mais do que eles valem.

O `max-width: 192mm` do ramo girado é o freio do OUTRO caso: quando o navegador
entrega a página inteira, sem margem própria. O papel mais apertado é a Carta em
pé (216 × 279): a folha só cabe até 279 ÷ 1,42 = 196 mm de largura, e 92% de 216
dariam 199. Não é palpite sobre área útil — é o teto de quem não tem margem
nenhuma.

No ramo girado quem ocupa espaço é o CONTÊINER — o desenho sai do fluxo —, com
`aspect-ratio` e as medidas do desenho em porcentagem dele. O teto ali é na
LARGURA: limitar a altura de quem tem `aspect-ratio` NÃO encolhe a largura
junto, e o desenho passava por baixo do contêiner.

Mais duas armadilhas de paginação, cada uma com sua página em branco: a margem
do `@page` tem de ser ZERO (com margem, o bloco continua com a largura da
PÁGINA e vaza da área útil), e o `min-height: 100dvh` do body vale a altura da
JANELA, não a do papel — precisa ser zerado.

Em pé a coluna tem 26 mm e "Hospital Regional" é cortado; deitada tem 39 mm e
cabe. As seis linhas da grade têm altura FIXA: sem isso um dia com três
plantões estica a semana e joga a última linha para a segunda página. O
quadrado cheio mostra três e resume o resto em "mais 2" — nunca "+2", que é o
sobrescrito de quem vira a noite. A cor nunca é a única pista: o nome do local
vai escrito, para a folha valer em impressora preto e branco.

**O tingido é do FIM DE SEMANA, e só dele.** O dia de fora do mês já teve o
mesmo cinza, e as duas coisas viravam uma mancha só: a primeira linha inteira
parecia fim de semana e o sábado do dia 1 se perdia dentro dela. Fora do mês
agora RECUA, como no calendário do app (`.calendar__day.is-outside`): fundo
branco, número claro e os plantões apagados — eles continuam à vista, mas não
competem. Assim o cinza quer dizer uma coisa só, e a faixa existe apenas dentro
do mês, que é o único lugar onde ela ajuda a planejar. Quem diz de QUAL mês é o
quadrado vizinho é o rótulo `monthLabel` — "26 JUL", "1 SET" —, escrito só na
ABERTURA de cada bloco de fora: em todos os dias ele viraria uma coluna de ruído
ao lado dos números, e é ele, não o cinza, que sobrevive à impressora preto e
branco.

Compartilhar é o botão CHEIO e imprimir vem embaixo dele: compartilhar se faz
todo mês, imprimir depende de ter impressora por perto.

O ícone mora no cabeçalho de TODAS as telas, como o `+` — quem quer mandar a
escala não devia ter de passar pela Agenda antes. Por isso o `ScreenHeader`
desenha os dois sozinho, a partir do `useShiftSheets()`, e a folha vive no
`ShiftSheetsProvider` (`shareMonth`), não dentro da Agenda. Ele entra à
ESQUERDA do `+`, nunca no lugar dele: o `+` é sempre o círculo mais à direita e
o único preenchido, senão o canto do cabeçalho vira uma fileira de botões com o
mesmo peso.

A folha propõe o mês que a TELA está mostrando (`ScreenHeader shareMonth`) —
Agenda e Financeiro passam o deles; onde não existe mês na tela, vale o
corrente. Quem navegou até dezembro quer dezembro. Como o provedor remonta a
folha por `key` a cada abertura, ela nasce com o mês certo e não precisa de
sincronização.

O botão do rodapé fica só no Mês; na Semana seria repetição do ícone, que já
está sempre à vista.
Ficou registrado que a folha deitada numa conversa de 390 pt exige pinça ou
girar o telefone: foi decisão do dono, com o problema na mesa, para ver o mês
inteiro de uma vez.

O plantão que atravessa a meia-noite segue o invariante 16 e, no dia seguinte,
entra como CONTINUAÇÃO ("↳ Hospital Regional, até 19:00") sem valor — repetido
com valor, a folha pareceria somar duas vezes. Cancelado não vai: quem recebe a
escala precisa saber onde o médico ESTARÁ. O filtro de local não fica guardado
e, com um local escolhido, o nome entra abaixo do mês, o resumo reconta e a
legenda some.

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

`ready` espera as QUATRO consultas, configurações inclusive. Como
`db.settings.get('app')` devolve `undefined` tanto enquanto carrega quanto
quando a linha não existe, a consulta converte a ausência em `null` — sem essa
distinção, quem lesse `settings` na montagem via os padrões antes do que está
gravado, e o aviso de novidades piscava para todo mundo.

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
- Na Agenda, a barra de período mora DENTRO do cabeçalho (`screen-header__below`),
  junto das abas — não dentro de cada visão. O cabeçalho é `sticky`, então ela
  fica na tela ao rolar; solta, ela saía junto com o conteúdo e o calendário
  sozinho não dizia que mês era. Por isso `Schedule` é quem monta o rótulo e as
  setas: a Semana e o Mês só desenham o próprio conteúdo. A MESMA `PeriodNav` é
  usada solta no Financeiro, então o ajuste de margem é uma regra descendente
  (`.screen-header__below .period-nav`), nunca no seletor global.
- A barra de abas tem o PRÓPRIO conjunto de ícones (`layout/tabIcons.tsx`):
  traço de 2px e cantos bem mais redondos. O conjunto geral de
  `components/ui/Icon` continua fino porque `calendar`, `wallet` e `chart`
  também aparecem a 14–16px dentro de linhas de texto, onde 2px fica pesado.
  Os dois conjuntos nunca se encontram no mesmo tamanho.
- A aba ATIVA usa o ícone PREENCHIDO, não só a cor — sem isso, num relance a
  aba atual sumia no meio das outras quatro. Relatórios é o caso difícil: três
  barras cheias ou vazias ficam quase iguais, então a versão ativa é mais
  grossa (3,2px contra 2,6px) e a barra mais baixa subiu, senão preenchida
  virava uma bolinha em vez de uma barra.
- Nos Relatórios, as setas do cartão de Indicadores andam o período INTEIRO:
  um mês em "Mês atual", um trimestre em "3 meses". `buildPeriod` recebe um
  `offset` e, fora do zero, reescreve os rótulos das frases — "neste mês" seria
  mentira num mês que não é o de hoje. O cartão de Indicadores continua na tela
  mesmo em período vazio: sem isso, andar até um mês sem plantão escondia as
  próprias setas e prendia o usuário lá.
- O gráfico de Evolução lê o BANCO INTEIRO, não o período escolhido. São sempre
  12 meses até o fim do período, com os meses vazios zerados — sem isso o eixo
  mudaria de largura conforme o histórico e as barras trocariam de lugar, que é
  justamente o que o gráfico existe para comparar. A seleção do mês é estado
  local, então o gráfico é remontado por `key` quando o mês muda.
- A barra do relatório por local usa a cor do LOCAL, não o roxo do tema
  (invariante 10). A estrela marca o melhor valor por hora, que nem sempre é
  quem rendeu mais no total.
- No Ritmo da semana, no Mapa do mês e na sequência dos Recordes, o plantão
  conta no dia em que COMEÇA. Um 24h que vira a noite pertence ao dia em que o
  médico entrou e não vale metade para cada lado — e, na sequência, é um dia
  só, senão qualquer escala de 24h viraria uma sequência infinita.
- A escala de cor do Mapa do mês é FIXA em horas (6h, 12h, 18h, mais que
  isso), nunca relativa ao mês. Relativa, um mês leve ficaria tão escuro quanto
  um mês puxado e a comparação entre meses — a razão de o cartão existir —
  desapareceria. O número dentro da célula escurece junto com a faixa: cinza
  claro sobre roxo médio some.
- Recordes leem o acervo INTEIRO, não o período: um recorde de um mês só não é
  recorde. Empate não tem campeão — a frase do dia mais pesado e a estrela do
  melhor R$/h só aparecem quando há um vencedor único.
- `metric-grid` só vira três colunas a partir de **34rem**. Em 30rem o
  "R$ 21.400,00" não cabia e era cortado no meio.
- Os resumos "Esta semana" e "Este mês" do Início são recortes da AGENDA, não
  dos relatórios: cada um abre `#/agenda?v=semana` ou `?v=mes` e cai na
  visualização certa. `Schedule` lê esse parâmetro uma vez, na montagem. SEM
  parâmetro — tocar na aba do rodapé — a Agenda abre no MÊS, que é o recorte
  mais olhado; o parâmetro tem precedência, então os atalhos do Início
  continuam caindo onde prometem.
- O Início cabe numa tela até o começo de "Próximos plantões". Os dois resumos
  são DUAS LINHAS de um cartão só, e o cartão Financeiro não repete o previsto
  do mês (que já está na linha "Este mês"). Ao acrescentar qualquer coisa ali,
  meça de novo: o objetivo é o primeiro plantão da lista aparecer sem rolar.
- A contagem das férias é um EASTER EGG e mora embaixo do cartão do próximo
  plantão, discreta de propósito (`--text-footnote` em `--text-3`). A frase é
  uma só; o que muda com a distância é a gramática — "daqui 1 dias" e "daqui 0
  dias" estariam errados, então amanhã e o próprio dia têm texto próprio.
  Passada a data a linha some, porque o app não sabe quando as férias acabam, e
  os Ajustes passam a pedir a próxima. `vacationDate` e `vacationEnabled` são
  campos novos de `Settings` e NÃO exigiram versão nova do Dexie: a tabela é
  indexada só por `id` e `AppDataProvider` mescla `DEFAULT_SETTINGS` na
  leitura, então quem já tinha o app instalado recebe os padrões sozinho.
- O cartão do próximo plantão é tingido com a COR DO LOCAL, em degradê que some
  para baixo. Chapado, as cores quentes embarram o tema escuro e o texto
  secundário perde contraste — foi por isso que virou degradê.
- No Mês, o cartão do dia SEMPRE termina numa linha "Adicionar plantão", tenha
  ele plantão ou não. O `+` do cabeçalho abre a folha em HOJE, então quem
  estava olhando o dia 21 e quis somar um plantão noturno ao diurno tinha de
  corrigir a data à mão — enquanto o dia livre, que já trazia o botão, abria
  certo. A porta é a mesma; o que muda é o traje: no dia vazio ela é o botão
  CHEIO do `EmptyState`, porque ali é a única coisa do cartão; no dia ocupado é
  a última LINHA da lista (`.shift-add`), com o `+` na coluna da bolinha do
  local para o rótulo alinhar com os nomes acima. Cheio nos dois, todo dia com
  plantão ganharia um bloco roxo competindo com os próprios plantões e
  repetindo o `+` do cabeçalho. Na Semana a linha NÃO existe: são sete dias na
  tela ao mesmo tempo, e sete delas seriam mais ruído que ajuda.
- No calendário do mês, o dia com plantão ganha um ANEL em volta do número E
  bolinhas embaixo dele. Os dois dizem coisas diferentes: o anel diz que TEM
  plantão e engrossa a partir de dois; as bolinhas dizem QUANTOS e de QUAL
  local, na cor do local (invariante 10), até três. O contêiner das bolinhas
  existe mesmo vazio, senão os dias livres subiriam meia bolinha e os números
  da semana sairiam do alinhamento. As bolinhas ficam FORA do círculo, então
  mantêm a cor do local também no dia selecionado, que é preenchido de roxo.
  O círculo é do NÚMERO, não da célula:
  com o número e os pontos empilhados, o par ficava centralizado mas o número
  subia metade da altura dos pontos e aparecia torto dentro do círculo do dia
  selecionado, que ocupava a célula inteira. Dois ou mais plantões no mesmo dia
  engrossam o anel de 1,5px para 3px — é o que sobrou da contagem que os
  pontinhos davam. As quatro regras de anel têm a mesma especificidade dentro
  de cada par, então a ORDEM no arquivo é que manda.
- O cartão "Sobre", nos Ajustes, mostra o ícone oficial do app (`icons/icon-192.png`,
  a cara do dono), não um ícone de traço. O caminho passa por
  `import.meta.env.BASE_URL` porque o GitHub Pages serve numa subrota.
- São DOIS avisos de versão, e eles não são intercambiáveis. O de "tem uma
  versão nova" é dado pelo app que está rodando, que ainda é o ANTIGO e por
  isso não pode listar o que mudou — só oferece Depois/Atualizar. A lista mora
  no aviso de "Novidades da versão", mostrado uma vez DEPOIS de atualizar, por
  quem já é a versão nova (`APP_CHANGES`, em `appInfo.ts`). Os dois usam o
  `NoticeDialog`, que é separado do `ConfirmDialog` de propósito: lá quem
  pergunta é o app sobre uma ação destrutiva que o usuário pediu; aqui quem
  começou a conversa foi o app.
- Quem acaba de INSTALAR não vê novidade nenhuma — não mudou nada para ele.
  Como `lastSeenVersion` é `null` tanto para quem instalou agora quanto para
  quem já usava o app antes do campo existir, o desempate é o banco: com
  plantões gravados a lista aparece; vazio, a versão é anotada em silêncio.
  `lastSeenVersion` é mais um campo de `Settings` e, como `vacationDate`, NÃO
  exigiu versão nova do Dexie.
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
  saída. O `requestAnimationFrame` que promove `opening` → `open` confere a
  fase antes de gravar: um diálogo que abre e fecha no MESMO quadro (o aviso de
  novidades, enquanto as configurações ainda carregavam) recebia `open` por
  cima de `closing` e ficava na tela para sempre, porque nada mais mexe na fase
  `open`.
- `useSheetHistory` faz o gesto de voltar fechar a folha do topo em vez de
  navegar por baixo dela. Existe **UMA** entrada de histórico enquanto houver
  qualquer folha aberta: criada quando a primeira abre, recriada quando o
  gesto fecha uma e ainda sobra outra, desfeita quando a última fecha. Uma
  entrada por folha seria o caminho óbvio e é armadilha — ao salvar, folha e
  diálogo fecham juntos, e a ordem em que o React desmonta irmãos não é a
  ordem em que foram abertos. O ouvinte de `popstate` entra na primeira folha
  e nunca sai: removê-lo antes do `history.back()` fazia o próprio `popstate`
  do app não ser contado, e o gesto seguinte do usuário era engolido.
  Desfazer a entrada espera o fim do commit do React (`queueMicrotask`).
  Trocar de folha — abrir o recebimento FECHA o detalhe, editar um plantão
  também — zera e enche a pilha no mesmo commit, e o `history.back()`, que é
  assíncrono, comia a entrada que a folha nova tinha acabado de empurrar. A
  folha seguinte ficava sem entrada e, ao fechar, saía da ROTA: quem desfizesse
  um recebimento no Financeiro era jogado na tela visitada antes.
- `useBodyScrollLock` tira o body do fluxo com **`position: fixed`**, e não só
  com `overflow: hidden`. O `overflow` basta no computador, mas NÃO no iPhone:
  lá o dedo continua rolando a página por baixo da folha, e com a folha baixinha
  — a de compartilhar, a de filtros — o fundo inteiro fica à vista se mexendo.
  O `top` negativo guarda a posição: sem ele o body fixado volta ao topo e a
  tela salta no instante em que a folha abre; ao soltar, o `scrollTo` repõe a
  posição na MESMA tarefa, senão a tela pisca no topo antes de voltar.
  Consequência que já quebrou uma vez: a folha de opções continua aberta
  durante a impressão, então o `@media print` precisa desfazer a trava com
  `!important` (ela escreve no `style` do elemento). Sem isso, quem mandava
  imprimir com a tela rolada recebia a folha empurrada para fora do papel.
  A contagem é COMPARTILHADA por todos que travam ao mesmo tempo. Cada
  instância guardando e repondo por conta própria travava o app inteiro: a
  folha do plantão trava, o diálogo de excluir trava por cima, os dois fecham
  juntos e o último a soltar repõe o estado errado. Só recarregando a página
  destravava.
- `useFocusTrap` prende o foco no modal do topo, com uma PILHA compartilhada
  como a das travas de rolagem: só o último da pilha responde ao Tab, e todos
  os outros — mais o `#root` — ficam `inert`, que é o que também os tira do
  leitor de tela. Duas armadilhas moram aqui. O foco só entra depois da
  animação (`visible`, não `mounted`): focar no meio dela faz o iPhone rolar a
  tela sozinho. E "quem abriu" é lido durante o RENDER, não no efeito — os
  diálogos trazem `autoFocus`, que o React aplica no commit, então lido depois
  o dono do foco seria o botão do próprio diálogo, que some junto com ele. As
  folhas nascem abertas (o provedor só as monta quando o usuário pede) e por
  isso o valor INICIAL do estado faz a mesma leitura; sem ele, fechar a folha
  largava o foco no `body` em vez de devolvê-lo ao `+`. Trocar de folha não
  devolve foco nenhum: a folha nova já pegou o dele.
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
financeiras, o dia seguinte na agenda, modelos de plantão, insights, validação
de backup e CSV. Se você mexer nessas regras,
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
