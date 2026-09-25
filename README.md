# JvSoft Finanças

Controle financeiro pessoal: transações, contas a pagar, parcelamentos, cartões de crédito com fatura automática, orçamentos, metas, relatórios em PDF, alertas de vencimento (no app e por push) e importação diária das transações do Nubank via Open Finance, com revisão antes de lançar. PWA instalável.

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
  pages/               # Transações, Cartões, Orçamentos, Metas, Relatórios, Importações, Configurações, Login…
  components/          # Sidebar, BottomNav, ModalOverlay, CampoMoeda, GraficoMensal, Toast…
  hooks/               # useRealtime, useAlertasVencimento
  utils/helpers.js     # formatação e datas no fuso local
  utils/moeda.js       # máscara e conversão de valores em R$
  utils/senha.js       # regra única de senha
  utils/buscarTodas.js # busca paginada (o Supabase devolve no máximo 1000 linhas por consulta)
  utils/importacoes.js # regras da tela de revisão das importações bancárias
  utils/push.js        # inscrição de notificações push
  sw.js                # service worker (cache + push)
public/icons/          # ícones do PWA (192, 512 e apple-touch)
supabase/
  migrations/          # FONTE DE VERDADE do banco (ver abaixo)
  rollback/            # comandos para desfazer migrations recentes
  functions/send-push-notifications/  # Edge Function do push diário
  functions/sincronizar-banco/        # Edge Function da importação bancária diária
```

## Banco de dados (Supabase)

O schema é versionado **somente** em `supabase/migrations/`. Não crie tabelas pelo SQL Editor: crie uma migration.

- `20260713000000_baseline.sql` recria a estrutura original do projeto. Em produção ela está marcada como aplicada.
- Cada arquivo tem a mesma versão registrada no banco (`supabase_migrations.schema_migrations`). A integração GitHub do Supabase aplica em produção as migrations novas que chegarem na `main`.

Tabelas em uso: `transacoes`, `contas`, `categorias`, `cartoes`, `orcamentos`, `metas`, `push_subscriptions`, `termos_aceites`, `login_attempts`, `login_attempts_ip`, e as da importação bancária: `conexoes_bancarias`, `importacoes_banco` e `regras_categoria`. As tabelas antigas sem uso (`receitas`, `dividas`, `credores`, `contas_bancarias`, `metas_financeiras`) foram removidas em 2026-09-25 (`20260925114030_limpeza_schema.sql`).

Nova migration:

```bash
npx supabase migration new nome_da_mudanca   # edite o arquivo gerado
npx supabase db push                          # ou deixe a integração GitHub aplicar no merge
```

Regras de negócio que ficam no banco, em funções transacionais chamadas via `supabase.rpc`:

| Função | Uso |
|---|---|
| `lancar_gasto_cartao` | compra no cartão (à vista/parcelada): cria/atualiza a fatura de cada mês e as transações |
| `editar_transacao` | edita transação; se for compra no cartão, ajusta a fatura (o tipo não muda; bloqueia valor/data se a fatura já foi paga) |
| `excluir_transacao` | exclui transação; se for compra no cartão, desconta da fatura (bloqueia se a fatura já foi paga) |
| `editar_conta` | edita conta a pagar, mantendo o `dia_vencimento` original |
| `pagar_conta` | marca conta como paga/pendente e cria/estorna a despesa. **Fatura de cartão não gera despesa**, porque as compras já foram lançadas |
| `criar_parcelamento` | conta parcelada (a última parcela recebe os centavos restantes) |
| `movimentar_meta` | depósito/resgate em meta + transação correspondente |
| `resumo_financeiro` | receitas, despesas e saldo do usuário (com período opcional) |
| `aprovar_importacao` | aprova uma transação importada do banco: cria a transação (ou a compra no cartão, ou marca a fatura como paga) e aprende a categoria |

Todas rodam como o usuário logado (`SECURITY INVOKER`), então o RLS vale dentro delas.

Consultas que podem passar de 1000 linhas (Dashboard, Relatórios) usam `buscarTodas`, com uma ordenação estável (`.order('id')` como desempate).

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

## Importação bancária (Nubank via Meu Pluggy)

O fluxo:

1. O [Meu Pluggy](https://meu.pluggy.ai), gratuito para uso pessoal, lê a conta e o cartão do Nubank pelo Open Finance **uma vez por dia**. Itens do Meu Pluggy não aceitam atualização manual.
2. O job `sincronizar-banco` (pg_cron) roda todo dia às **12:00 de Brasília**, logo depois da atualização diária do Meu Pluggy (por volta das 10h–11h40), e chama a Edge Function `sincronizar-banco`.
3. A função grava as transações novas em `importacoes_banco` como **pendentes**. Ela:
   - não duplica nada (usa o id da transação no Pluggy);
   - sugere a categoria pelas regras aprendidas ou por palavras-chave;
   - avisa sobre um possível lançamento manual igual;
   - não conta o pagamento de fatura como gasto.
4. Na tela **Importações**, cada transação é aprovada (`aprovar_importacao`), vinculada a um lançamento existente ou ignorada. Nada entra nos relatórios antes disso. O Dashboard mostra o horário da última atualização e quantas faltam revisar.

Para ativar, uma única vez:

1. Crie a conta em meu.pluggy.ai e conecte o Nubank.
2. Em dashboard.pluggy.ai, crie a aplicação, autorize o Meu Pluggy e anote o **ID do item**.
3. Supabase → Edge Functions → Secrets: `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`.
4. Os segredos do Vault do passo 4 das notificações push, que o job também usa.
5. No app: cadastre o cartão Nubank em **Cartões** e, em **Configurações → Conexão bancária**, informe o ID do item, o cartão e a data de início. Depois, use "Testar conexão agora".

## Deploy

O front é publicado na Vercel (SPA: `vercel.json` redireciona todas as rotas para `index.html`). Cada merge na `main` gera um deploy automático.

O app é um PWA com cache: depois de um deploy, a primeira abertura ainda usa a versão antiga e a nova é baixada em seguida (o app recarrega sozinho). Se uma migration remover algo que a versão antiga usa, publique o front **antes** de aplicar a migration.

Configure na Vercel as variáveis de `.env.example`. Em Supabase → Authentication → URL Configuration, inclua `https://SEU_DOMINIO/reset-password` nas Redirect URLs, para a recuperação de senha funcionar.

Segurança: veja [`docs/SEGURANCA.md`](docs/SEGURANCA.md).
