-- =====================================================================
-- Limpeza de schema (2026-09-25)
--
-- O que faz:
--   1) Faz backup (schema backup_limpeza_20260925) do único candidato que
--      tem dados reais (public.credores, 9 linhas). As demais tabelas e
--      colunas removidas aqui estão vazias / com valores todos no padrão
--      em produção (conferido antes de escrever esta migration).
--   2) Recria public.delete_user() e public.criar_parcelamento(...) sem
--      referências às tabelas/colunas removidas.
--   3) Remove colunas não usadas pelo app: transacoes.paga,
--      transacoes.conta_id, contas.transacao_id, contas.credor_id,
--      cartoes.fatura_atual.
--   4) Remove tabelas não usadas pelo app: public.dividas, public.credores,
--      public.receitas, public.contas_bancarias, public.metas_financeiras.
--      (o app usa a tabela `metas`, não `metas_financeiras`).
--   5) Recria as policies de RLS trocando auth.uid() por
--      (select auth.uid()) — mesma semântica, só otimiza o plano de
--      execução (aviso "auth_rls_initplan" do linter do Supabase).
--   6) Cria índices para chaves estrangeiras sem índice (aviso
--      "unindexed_foreign_keys" do linter do Supabase).
--
-- O que NÃO faz / não altera:
--   - Nenhum dado das tabelas em uso (transacoes, contas, cartoes,
--     categorias, orcamentos, metas, login_attempts, login_attempts_ip,
--     termos_aceites, push_subscriptions) é alterado.
--   - contas.status e contas.dia_vencimento são preservadas como estão
--     (dia_vencimento guarda o dia original do vencimento; divergências
--     de data_vencimento são intencionais, por pagamento em atraso).
--   - Nenhuma função SECURITY DEFINER de login é alterada.
--
-- Tudo idempotente (IF EXISTS / IF NOT EXISTS).
-- =====================================================================


-- =====================================================================
-- 1) BACKUP antes de remover
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS backup_limpeza_20260925;
-- Sem GRANT de USAGE para anon/authenticated: schema não fica acessível
-- pela API pública, só por quem tiver acesso direto ao banco (postgres).

DROP TABLE IF EXISTS backup_limpeza_20260925.credores;
CREATE TABLE backup_limpeza_20260925.credores AS TABLE public.credores;
-- Mesmo fora da API, fica com RLS ligado e sem policies (ninguém de fora lê)
ALTER TABLE backup_limpeza_20260925.credores ENABLE ROW LEVEL SECURITY;
-- dividas, receitas, contas_bancarias e metas_financeiras estão com 0
-- linhas em produção; e as colunas removidas (transacoes.paga,
-- transacoes.conta_id, contas.transacao_id, contas.credor_id,
-- cartoes.fatura_atual) não têm nenhum valor não nulo/não padrão —
-- não há dado a copiar para elas.


-- =====================================================================
-- 2) Recriar funções que referenciam tabelas/colunas removidas
-- =====================================================================

-- ── delete_user(): mesma SECURITY DEFINER, mesmo search_path, mesmas
--    permissões (só authenticated executa) e mesma ordem seletiva para
--    as tabelas restantes — só tira as linhas das tabelas removidas.
CREATE OR REPLACE FUNCTION public.delete_user()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  DELETE FROM public.orcamentos WHERE user_id = v_uid;
  DELETE FROM public.transacoes WHERE user_id = v_uid;
  DELETE FROM public.contas     WHERE user_id = v_uid;
  DELETE FROM public.cartoes    WHERE user_id = v_uid;
  DELETE FROM public.categorias WHERE user_id = v_uid;
  DELETE FROM public.metas      WHERE user_id = v_uid;

  IF v_email IS NOT NULL THEN
    DELETE FROM public.login_attempts WHERE email = v_email;
  END IF;

  -- Por fim, remove o usuário do Auth
  DELETE FROM auth.users WHERE id = v_uid;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_user() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_user() TO authenticated;

-- ── criar_parcelamento(): mesma assinatura usada pelo app (o front-end
--    nunca passava p_credor_id — sempre ficava NULL, coluna sem uso),
--    só removendo o parâmetro e a coluna credor_id do INSERT.
--    Como o número de parâmetros muda, a função antiga (com 6 args)
--    precisa ser removida antes de criar a nova (com 5 args).
DROP FUNCTION IF EXISTS public.criar_parcelamento(text, numeric, integer, date, uuid, uuid);

CREATE OR REPLACE FUNCTION public.criar_parcelamento(
  p_descricao text,
  p_valor_total numeric,
  p_total_parcelas integer,
  p_data_inicio date,
  p_categoria_id uuid DEFAULT NULL::uuid
)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id_parcelamento UUID := gen_random_uuid();
  v_valor_parcela NUMERIC;
  v_soma_parcial NUMERIC := 0;
  v_valor_linha NUMERIC;
  v_data DATE;
  i INT;
BEGIN
  IF p_total_parcelas < 1 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser pelo menos 1';
  END IF;

  -- Arredonda para baixo em centavos; a diferença acumulada
  -- (por causa de dízimas tipo 1000/3) vai inteira na última parcela,
  -- garantindo que a soma das parcelas bate exatamente com o valor total.
  v_valor_parcela := TRUNC(p_valor_total / p_total_parcelas, 2);

  FOR i IN 1..p_total_parcelas LOOP
    v_data := p_data_inicio + (INTERVAL '1 month' * (i - 1));

    IF i = p_total_parcelas THEN
      v_valor_linha := p_valor_total - v_soma_parcial;
    ELSE
      v_valor_linha := v_valor_parcela;
      v_soma_parcial := v_soma_parcial + v_valor_parcela;
    END IF;

    INSERT INTO contas (
      descricao, valor, data_vencimento, dia_vencimento,
      categoria_id, status_pago,
      id_parcelamento, numero_parcela, total_parcelas
    ) VALUES (
      p_descricao, v_valor_linha, v_data, EXTRACT(DAY FROM v_data)::INT,
      p_categoria_id, false,
      v_id_parcelamento, i, p_total_parcelas
    );
  END LOOP;

  RETURN v_id_parcelamento;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.criar_parcelamento(text, numeric, integer, date, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.criar_parcelamento(text, numeric, integer, date, uuid) TO authenticated;


-- =====================================================================
-- 3) Remover colunas sem uso
-- =====================================================================

ALTER TABLE public.contas     DROP COLUMN IF EXISTS credor_id;
ALTER TABLE public.contas     DROP COLUMN IF EXISTS transacao_id;
ALTER TABLE public.transacoes DROP COLUMN IF EXISTS paga;
ALTER TABLE public.transacoes DROP COLUMN IF EXISTS conta_id;
ALTER TABLE public.cartoes    DROP COLUMN IF EXISTS fatura_atual;


-- =====================================================================
-- 4) Remover tabelas sem uso
--    Sem CASCADE: cada DROP só é aceito se não houver mais nada
--    dependendo da tabela (as FKs que apontavam para elas já foram
--    removidas junto com as colunas do passo 3, ou pertencem à própria
--    tabela sendo removida).
-- =====================================================================

DROP TABLE IF EXISTS public.dividas;
DROP TABLE IF EXISTS public.credores;
DROP TABLE IF EXISTS public.receitas;
DROP TABLE IF EXISTS public.contas_bancarias;
DROP TABLE IF EXISTS public.metas_financeiras;


-- =====================================================================
-- 5) Policies de RLS otimizadas — mesmo comando, roles, USING e
--    WITH CHECK; só troca auth.uid() por (select auth.uid()).
--    Tabelas removidas no passo 4 (credores, dividas, receitas,
--    contas_bancarias, metas_financeiras) ficam de fora: as policies
--    delas somem junto com as tabelas.
-- =====================================================================

DROP POLICY IF EXISTS "Usuários veem apenas seus cartões (cartoes)" ON public.cartoes;
CREATE POLICY "Usuários veem apenas seus cartões (cartoes)" ON public.cartoes
  AS PERMISSIVE FOR ALL TO public
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Usuários veem apenas suas categorias" ON public.categorias;
CREATE POLICY "Usuários veem apenas suas categorias" ON public.categorias
  AS PERMISSIVE FOR ALL TO public
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Privacidade Contas" ON public.contas;
CREATE POLICY "Privacidade Contas" ON public.contas
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuários veem apenas suas metas (metas)" ON public.metas;
CREATE POLICY "Usuários veem apenas suas metas (metas)" ON public.metas
  AS PERMISSIVE FOR ALL TO public
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Usuarios veem apenas seus orçamentos" ON public.orcamentos;
CREATE POLICY "Usuarios veem apenas seus orçamentos" ON public.orcamentos
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Acesso total às inscrições de push" ON public.push_subscriptions;
CREATE POLICY "Acesso total às inscrições de push" ON public.push_subscriptions
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuários registram seu próprio aceite" ON public.termos_aceites;
CREATE POLICY "Usuários registram seu próprio aceite" ON public.termos_aceites
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuários veem apenas seus próprios aceites" ON public.termos_aceites;
CREATE POLICY "Usuários veem apenas seus próprios aceites" ON public.termos_aceites
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuarios veem apenas suas transacoes" ON public.transacoes;
CREATE POLICY "Usuarios veem apenas suas transacoes" ON public.transacoes
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);


-- =====================================================================
-- 6) Índices para FKs sem índice (tabelas em uso; as FKs das tabelas
--    removidas no passo 4 não precisam mais de índice)
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_contas_user_id        ON public.contas (user_id);
CREATE INDEX IF NOT EXISTS idx_contas_categoria_id    ON public.contas (categoria_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_categoria_id ON public.transacoes (categoria_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_cartao_id   ON public.transacoes (cartao_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_categoria_id ON public.orcamentos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_termos_aceites_user_id ON public.termos_aceites (user_id);
