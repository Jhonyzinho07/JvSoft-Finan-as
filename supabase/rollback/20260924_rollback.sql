-- =====================================================================
-- ROLLBACK das migrations de 2026-09-24 (NÃO é migration — rodar à mão
-- no SQL Editor, e só a seção necessária).
--
-- Nenhuma dessas migrations alterou dados. A cópia de segurança feita antes
-- das mudanças (schema backup_20260924) foi conferida contra a produção e
-- removida em 2026-09-24, depois da validação do app; estes comandos desfazem
-- só a estrutura (funções, permissões, colunas), não restauram dados.
-- =====================================================================

-- ── 20260924141407_movimentar_meta ─────────────────────────────────
-- DROP FUNCTION IF EXISTS public.movimentar_meta(uuid, text, numeric, date);

-- ── 20260924134647_ajustes_pg_net_e_reset_login ─────────────────────
-- GRANT EXECUTE ON FUNCTION public.reset_login_attempts(text) TO anon;
-- (versão anterior da função: supabase/migrations/20260731180621_rate_limit_login.sql)

-- ── 20260924134424_storage_avatars ──────────────────────────────────
-- Apenas recria o que já existia; não há o que desfazer.

-- ── 20260924134354_realtime_e_agendamento_push ──────────────────────
-- SELECT cron.unschedule('enviar-notificacoes-push');
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.transacoes, public.contas,
--   public.categorias, public.cartoes, public.metas, public.orcamentos;

-- ── 20260924134315_cartao_faturas_pagamentos_saldo ──────────────────
-- DROP FUNCTION IF EXISTS public.resumo_financeiro(date, date);
-- DROP FUNCTION IF EXISTS public.pagar_conta(uuid, boolean, date);
-- DROP FUNCTION IF EXISTS public.excluir_transacao(uuid);
-- DROP FUNCTION IF EXISTS public.lancar_gasto_cartao(uuid, numeric, integer, text, date, uuid);
-- DROP FUNCTION IF EXISTS public.calcular_vencimento_fatura(date, integer, integer, integer);
-- As colunas contas.cartao_id e transacoes.fatura_id podem ficar (são opcionais);
-- removê-las apaga o vínculo compra→fatura de compras feitas depois da migration.
-- ALTER TABLE public.transacoes DROP CONSTRAINT transacoes_cartao_id_fkey;
-- ALTER TABLE public.transacoes ADD CONSTRAINT transacoes_cartao_id_fkey
--   FOREIGN KEY (cartao_id) REFERENCES public.cartoes(id);

-- ── 20260924134156_set_user_id_preserva_valor_sem_sessao ────────────
-- (voltar faria o cadastro criar categorias sem dono — não recomendado)

-- ── 20260924133521_seguranca_funcoes_e_cadastro ─────────────────────
-- DROP INDEX IF EXISTS public.categorias_user_nome_tipo_key;  -- quebra o cadastro
-- GRANT EXECUTE ON FUNCTION public.delete_user(), public.criar_parcelamento(text, numeric, integer, date, uuid, uuid),
--   public.cancelar_parcelamento(uuid, boolean), public.set_user_id(), public.set_user_id_on_insert(),
--   public.criar_categorias_padrao_novo_usuario(), public.registrar_aceite_termos_novo_usuario(),
--   public._client_ip() TO anon, authenticated;
-- ALTER FUNCTION <função> RESET search_path;
