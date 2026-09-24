# JvSoft Finanças

Controle financeiro pessoal: transações, contas a pagar, parcelamentos, cartões de crédito com fatura automática, orçamentos, metas, relatórios em PDF e alertas de vencimento (no app e por push). PWA instalável.

**Stack:** React 19 + Vite, Tailwind, React Router, React Query, Recharts · Supabase (Postgres + RLS, Auth, Storage, Realtime, Edge Functions, pg_cron) · Vercel.

## Rodando localmente

```bash
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

| Script | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção (gera também o service worker do PWA) |
| `npm test` | testes (Vitest) |
| `npm run lint` | lint (oxlint) |
| `npm run types` | gera `supabase/database.types.ts` a partir do banco (requer `npx supabase login`) |

## Estrutura

```
src/
  App.jsx              # rotas, layout e sessão
  Dashboard.jsx        # visão geral (React Query + Realtime)
  ContasPagar.jsx      # contas, parcelamentos e faturas
  pages/               # Transações, Cartões, Orçamentos, Metas, Relatórios, Configurações, Login…
  components/          # Sidebar, BottomNav, ModalTransacao, Toast…
  hooks/               # useRealtime, useAlertasVencimento
  utils/helpers.js     # formatação e datas no fuso local
  utils/push.js        # inscrição de notificações push
  sw.js                # service worker (cache + push)
supabase/
  migrations/          # FONTE DE VERDADE do banco (ver abaixo)
  rollback/            # comandos para desfazer migrations recentes
  functions/send-push-notifications/  # Edge Function do push diário
```

## Banco de dados (Supabase)

O schema é versionado **somente** em `supabase/migrations/`. Não crie tabelas pelo SQL Editor: crie uma migration.

- `20260713000000_baseline.sql` recria a estrutura original do projeto. Em produção ela está marcada como aplicada.
- Cada arquivo tem a mesma versão registrada no banco (`supabase_migrations.schema_migrations`). A integração GitHub do Supabase aplica em produção as migrations novas que chegarem na `main`.

Nova migration:

```bash
npx supabase migration new nome_da_mudanca   # edite o arquivo gerado
npx supabase db push                          # ou deixe a integração GitHub aplicar no merge
```

Regras de negócio que ficam no banco, em funções transacionais chamadas via `supabase.rpc`:

| Função | Uso |
|---|---|
| `lancar_gasto_cartao` | compra no cartão (à vista/parcelada): cria/atualiza a fatura de cada mês e as transações |
| `excluir_transacao` | exclui transação; se for compra no cartão, desconta da fatura (bloqueia se a fatura já foi paga) |
| `pagar_conta` | marca conta como paga/pendente e cria/estorna a despesa. **Fatura de cartão não gera despesa**, porque as compras já foram lançadas |
| `criar_parcelamento` | conta parcelada (a última parcela recebe os centavos restantes) |
| `movimentar_meta` | depósito/resgate em meta + transação correspondente |
| `resumo_financeiro` | receitas, despesas e saldo do usuário (com período opcional) |

Todas rodam como o usuário logado (`SECURITY INVOKER`), então o RLS vale dentro delas.

## Notificações push

O fluxo tem três partes:

1. O app inscreve o navegador (`src/utils/push.js`) e grava em `push_subscriptions`.
2. O job `enviar-notificacoes-push` (pg_cron) roda todo dia às **08:00 de Brasília**.
3. O job chama a Edge Function `send-push-notifications`.

Para ativar, uma única vez:

1. Gere um par de chaves: `npx web-push generate-vapid-keys`.
2. Supabase → Edge Functions → Secrets: `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.
3. Vercel → Environment Variables: `VITE_VAPID_PUBLIC_KEY` (a chave **pública**).
4. Supabase → SQL Editor (os valores ficam só no Vault):
   ```sql
   SELECT vault.create_secret('https://SEU_PROJETO.supabase.co', 'supabase_project_url');
   SELECT vault.create_secret('SUA_SERVICE_ROLE_KEY', 'supabase_service_role_key');
   ```

Sem esses passos o app continua funcionando e mostra os alertas de vencimento dentro do próprio app.

## Deploy

O front é publicado na Vercel (SPA: `vercel.json` redireciona todas as rotas para `index.html`). Configure na Vercel as variáveis de `.env.example`. Em Supabase → Authentication → URL Configuration, inclua `https://SEU_DOMINIO/reset-password` nas Redirect URLs, para a recuperação de senha funcionar.

Segurança: veja [`docs/SEGURANCA.md`](docs/SEGURANCA.md).
