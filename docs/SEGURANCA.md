# Segurança

Estado em 2026-09-25. As definições que valem estão em `supabase/migrations/`.

## Isolamento de dados (RLS)

- Todas as tabelas de `public` têm Row Level Security ligado.
- Cada tabela de dados tem a política `(select auth.uid()) = user_id` (leitura e escrita). O `select` faz o Postgres calcular o usuário uma vez por consulta, e não uma vez por linha.
- `login_attempts` e `login_attempts_ip` têm RLS **sem** políticas, de propósito: só as funções de login mexem nelas.
- O `user_id` é preenchido por trigger (`set_user_id` / `set_user_id_on_insert`):
  - com sessão, é sempre o usuário logado;
  - sem sessão (triggers internos, como as categorias padrão no cadastro), mantém o valor informado.
- O Realtime respeita o RLS: cada usuário só recebe eventos das próprias linhas.
- No Storage, o bucket `avatars` é público para leitura. Cada usuário só grava, altera ou apaga arquivos em `<user_id>/…`.

## Funções no banco

- Todas têm `search_path` fixo.
- As funções de regra de negócio (`lancar_gasto_cartao`, `pagar_conta`, `excluir_transacao`, `movimentar_meta`, `resumo_financeiro`, parcelamentos) são `SECURITY INVOKER` e só podem ser executadas por usuários logados.
- Funções de trigger e internas (`set_user_id*`, `criar_categorias_padrao_novo_usuario`, `registrar_aceite_termos_novo_usuario`, `_client_ip`) não podem ser chamadas pela API.
- Por padrão, funções novas em `public` **não** ficam executáveis por visitantes (`ALTER DEFAULT PRIVILEGES`).
- `delete_user` é `SECURITY DEFINER`, restrita a usuários logados, e apaga apenas os dados do próprio `auth.uid()`.

## Login

- `check_login_status` e `register_login_failure` precisam ser chamáveis sem login, porque rodam antes da sessão existir. O Supabase lista isso como aviso, e o aviso é esperado.
- `register_login_failure` limita tentativas por IP para impedir que alguém bloqueie o e-mail de outra pessoa.
- `reset_login_attempts` só pode ser chamada por usuário logado e só zera o bloqueio do próprio e-mail.
- Esse bloqueio é uma camada de experiência de uso. A proteção real contra força bruta é o rate limit do Supabase Auth.
  - **Recomendado:** ativar CAPTCHA (Authentication → Bot and Abuse Protection).

## Senhas

- Regra única do app em `src/utils/senha.js` (cadastro, redefinição e troca de senha): mínimo de 8 caracteres, com letra, número e caractere especial.
- No servidor (Supabase → Authentication → Email): **Minimum password length 8** e **Password requirements: Letters and digits**. Configurado em 2026-09-24. Tudo o que o app aceita também passa no servidor.
- A proteção contra senhas vazadas (HaveIBeenPwned) não está disponível no plano atual do Supabase. Se o plano mudar, vale ativar em Authentication → Email → "Prevent use of leaked passwords".

## Segredos

| Onde | O quê |
|---|---|
| `.env` / Vercel | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`: todas **públicas** por natureza |
| Supabase Vault | URL do projeto e service role key, lidas pelo job pg_cron |
| Secrets da Edge Function | `VAPID_PRIVATE_KEY` (a service role key é injetada automaticamente) |

A service role key **nunca** vai para o front-end nem para o repositório.

## Backup

- A cópia de segurança feita antes das correções de 2026-09-24 (schema `backup_20260924`) foi conferida contra a produção e removida no mesmo dia, depois da validação do app.
- A limpeza de schema de 2026-09-25 (remoção de tabelas e colunas sem uso) copiou antes os dados da única tabela removida que tinha linhas (`credores`, 9 linhas) para o schema `backup_limpeza_20260925`. Depois da validação do app em produção, esse backup foi removido no mesmo dia.
- Para um backup completo antes de mudanças grandes: `npx supabase db dump -f schema.sql` e `npx supabase db dump --data-only -f dados.sql`. O arquivo de dados contém dados pessoais: guarde **fora** do repositório.
- `supabase/rollback/20260924_rollback.sql` desfaz a estrutura das migrations de 2026-09-24 (funções, permissões, colunas), não os dados.
- `supabase/rollback/20260925_rollback.sql` desfaz a limpeza de schema de 2026-09-25 (tabelas, colunas, policies, índices). Os dados de `credores` não são mais restauráveis, porque o backup foi removido.
