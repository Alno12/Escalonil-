# Escalonil

Organizador pessoal de plantões médicos. PWA offline-first, sem login, sem
servidor: todos os dados ficam no aparelho do usuário.

Ao abrir o aplicativo, o plantonista precisa saber em poucos segundos **quando
vai trabalhar, quanto vai trabalhar e quanto tem para receber**.

## O que o app faz

- **Início** — próximo plantão em destaque, resumo da semana, resumo financeiro
  do mês e lista dos próximos plantões.
- **Agenda** — visualização por semana, calendário mensal e lista cronológica
  com busca e filtros.
- **Financeiro** — previsto, a receber e recebido; registro de recebimento com
  indicação de divergência entre o previsto e o recebido. O app não controla
  prazos: plantão realizado fica "a receber" até você marcar como pago.
- **Relatórios** — indicadores do período, evolução mensal, insights gerados
  localmente e desempenho por local.
- **Ajustes** — tema (o app abre no claro), preferências de cadastro, locais e
  suas cores, tipos de plantão, backup em JSON e exportação para CSV.

Detecção de conflitos de horário, plantões que atravessam a meia-noite e
histórico completo estão incluídos.

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:5173/Escalonil-/
```

Outros comandos:

```bash
npm run build      # typecheck + build de produção em dist/
npm run preview    # serve o build em http://localhost:4173/Escalonil-/
npm run lint
npm test
```

Para servir na raiz em vez da subrota do GitHub Pages:

```bash
BASE_PATH=/ npm run dev
```

## Como as mudanças chegam no ar

A `main` é a única branch que publica. Todo o resto entra por pull request:

```
branch de trabalho → pull request → CI verde → merge na main → site publicado
```

Dois workflows cuidam disso:

| Workflow | Quando roda | O que faz |
| --- | --- | --- |
| `.github/workflows/ci.yml` | todo pull request | lint, testes e build — não publica |
| `.github/workflows/deploy.yml` | push na `main` | lint, testes, build e publicação |

As verificações aparecem nos dois de propósito: assim nada é publicado sem
estar verde, mesmo que um commit chegue direto na `main`.

## Publicando no GitHub Pages

Uma vez só, no repositório:

**Settings → Pages → Build and deployment → Source: GitHub Actions**

Enquanto isso não for feito, o job `build` passa e o job `deploy` falha com
`Failed to create deployment (status: 404) … Ensure GitHub Pages has been
enabled`. Depois de ativar, use **Actions → Re-run all jobs** na última
execução.

O `BASE_PATH` é derivado do nome do repositório automaticamente no workflow,
então a publicação funciona em `https://<usuário>.github.io/<repositório>/`.

## Publicando no Netlify

O `netlify.toml` na raiz já traz tudo: comando de build, pasta publicada,
versão do Node, o redirect de rota e os cabeçalhos de cache. Uma vez só, no
painel do Netlify:

**Add new site → Import an existing project → GitHub → `Escalonil-`**

Não é preciso preencher comando nem diretório: o Netlify lê o `netlify.toml`.
Depois disso, todo push na `main` republica o site e todo pull request ganha um
preview com endereço próprio.

A diferença para o GitHub Pages é só o endereço: o Pages serve em
`/Escalonil-/` e o Netlify serve na raiz. Quem cuida disso é o `BASE_PATH`, e
os dois destinos convivem sem conflito — o mesmo commit publica nos dois.

> Os dados ficam no IndexedDB do navegador, que é separado por domínio. Abrir o
> app no endereço do Netlify começa do zero, sem os plantões que estão no
> endereço do GitHub Pages. Para levar o histórico, exporte o backup em um e
> importe no outro.

## Instalando no iPhone

1. Abra o endereço publicado no **Safari** (o Chrome no iOS não instala PWA).
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra pelo ícone: o app roda em tela cheia, respeita as safe areas e funciona
   sem internet.

Quando uma versão nova é publicada, o app mostra **"Nova versão disponível →
Atualizar"** em vez de deixar o usuário preso na versão antiga.

## Backup — leia isto

Não existe servidor nem sincronização. Se o usuário apagar os dados do site,
trocar de aparelho ou desinstalar o app, os plantões vão junto.

**Ajustes → Backup → Exportar backup** gera um `plantoes-backup-AAAA-MM-DD.json`
com plantões, locais, recebimentos e preferências. A importação substitui todos
os dados atuais (não mescla) e pede confirmação antes.

Logo abaixo, **Apagar dados → Apagar todos os dados** recomeça do zero: apaga
plantões, locais e recebimentos deste aparelho e mantém as preferências. Pede
confirmação e não tem volta.

## Arquitetura

Documentada em [`CLAUDE.md`](./CLAUDE.md) — leia antes de mexer no código.

Resumo: React + TypeScript + Vite, Dexie (IndexedDB) para persistência,
React Router em modo hash, CSS com variáveis de tema. Sem backend, sem
analytics, sem rastreadores.
