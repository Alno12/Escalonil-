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
- **Financeiro** — previsto, a receber, recebido e atrasado; registro de
  recebimento com indicação de divergência entre o previsto e o recebido.
- **Relatórios** — indicadores do período, evolução mensal, insights gerados
  localmente e desempenho por local.
- **Configurações** — tema, preferências de cadastro, locais, tipos de plantão,
  backup em JSON e exportação para CSV.

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

## Publicando no GitHub Pages

O workflow `.github/workflows/deploy.yml` roda lint, testes e build a cada push
na `main` (e na branch de desenvolvimento atual, enquanto a `main` não existir)
e publica o `dist/`. Para ativar:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Faça push na branch configurada — o workflow cuida do resto.

Enquanto o passo 1 não for feito, o job `build` passa (lint, testes e build) e o
job `deploy` falha com `Failed to create deployment (status: 404) … Ensure
GitHub Pages has been enabled`. Depois de ativar, é só reexecutar o workflow em
**Actions → Re-run all jobs**.

O `BASE_PATH` é derivado do nome do repositório automaticamente no workflow,
então a publicação funciona em `https://<usuário>.github.io/<repositório>/`.

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

**Configurações → Backup → Exportar backup** gera um `plantoes-backup-AAAA-MM-DD.json`
com plantões, locais, recebimentos e preferências. A importação substitui todos
os dados atuais (não mescla) e pede confirmação antes.

## Arquitetura

Documentada em [`CLAUDE.md`](./CLAUDE.md) — leia antes de mexer no código.

Resumo: React + TypeScript + Vite, Dexie (IndexedDB) para persistência,
React Router em modo hash, CSS com variáveis de tema. Sem backend, sem
analytics, sem rastreadores.
