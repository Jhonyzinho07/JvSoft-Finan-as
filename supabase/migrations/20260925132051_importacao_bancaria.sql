-- =====================================================================
-- Importação bancária (Nubank via Meu Pluggy / Open Finance)
--
-- Todo dia às 06:00 de Brasília a Edge Function `sincronizar-banco` lê
-- as transações que o Meu Pluggy já trouxe do banco e grava em
-- `importacoes_banco`. Nada vira lançamento sem aprovação do usuário:
-- `aprovar_importacao` cria a transação (ou a compra no cartão, ou marca
-- a fatura como paga) e aprende a categoria escolhida.
-- =====================================================================


-- ── Conexão com o banco ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conexoes_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT 'Nubank',
  provedor text NOT NULL DEFAULT 'pluggy' CHECK (provedor = 'pluggy'),
  item_id text NOT NULL CHECK (length(trim(item_id)) > 0),
  -- Cartão do app onde entram as compras do cartão de crédito do banco
  cartao_id uuid REFERENCES public.cartoes(id) ON DELETE SET NULL,
  -- Ponto de virada: nada antes desta data é importado
  importar_desde date NOT NULL DEFAULT DATE '2026-10-01',
  ativo boolean NOT NULL DEFAULT true,
  -- Preenchidos pela Edge Function
  dados_atualizados_em timestamptz,   -- quando o Pluggy atualizou com o banco
  proxima_atualizacao_em timestamptz, -- próxima atualização prevista do Pluggy
  ultima_importacao_em timestamptz,   -- última sincronização com sucesso
  ultima_tentativa_em timestamptz,
  ultimo_status text CHECK (ultimo_status IN ('ok', 'erro')),
  ultimo_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conexoes_bancarias_usuario_item_key UNIQUE (user_id, item_id)
);

-- ── Transações importadas, aguardando revisão ────────────────────────
CREATE TABLE IF NOT EXISTS public.importacoes_banco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conexao_id uuid NOT NULL REFERENCES public.conexoes_bancarias(id) ON DELETE CASCADE,
  externo_id text NOT NULL,        -- id da transação no Pluggy (evita duplicar)
  conta_externa_id text,           -- id da conta/cartão no Pluggy
  origem text NOT NULL CHECK (origem IN ('conta', 'cartao')),
  data date NOT NULL,
  descricao text NOT NULL,
  chave_descricao text NOT NULL,   -- descrição normalizada (regras de categoria)
  valor numeric(15,2) NOT NULL CHECK (valor > 0), -- na compra parcelada: valor da parcela
  tipo_sugerido text NOT NULL CHECK (tipo_sugerido IN ('receita', 'despesa', 'pagamento_fatura')),
  categoria_sugerida_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL,
  parcela_numero integer,
  parcelas_total integer,
  valor_total numeric(15,2),
  possivel_duplicada_id uuid REFERENCES public.transacoes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'ignorada')),
  motivo text,                     -- ex.: 'parcela_ja_lancada' (ignorada automaticamente)
  transacao_id uuid REFERENCES public.transacoes(id) ON DELETE SET NULL,
  dados jsonb,                     -- transação original do Pluggy (para conferência)
  created_at timestamptz NOT NULL DEFAULT now(),
  revisada_em timestamptz,
  CONSTRAINT importacoes_banco_usuario_externo_key UNIQUE (user_id, externo_id)
);

-- ── Categorias aprendidas ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regras_categoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  padrao text NOT NULL,            -- descrição normalizada
  categoria_id uuid NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regras_categoria_usuario_padrao_key UNIQUE (user_id, padrao)
);

-- Índices (FKs e a busca de pendentes)
CREATE INDEX IF NOT EXISTS idx_conexoes_bancarias_cartao_id ON public.conexoes_bancarias (cartao_id);
CREATE INDEX IF NOT EXISTS idx_importacoes_banco_usuario_status ON public.importacoes_banco (user_id, status);
CREATE INDEX IF NOT EXISTS idx_importacoes_banco_conexao_id ON public.importacoes_banco (conexao_id);
CREATE INDEX IF NOT EXISTS idx_importacoes_banco_categoria_id ON public.importacoes_banco (categoria_sugerida_id);
CREATE INDEX IF NOT EXISTS idx_importacoes_banco_duplicada_id ON public.importacoes_banco (possivel_duplicada_id);
CREATE INDEX IF NOT EXISTS idx_importacoes_banco_transacao_id ON public.importacoes_banco (transacao_id);
CREATE INDEX IF NOT EXISTS idx_regras_categoria_categoria_id ON public.regras_categoria (categoria_id);

-- user_id preenchido pelo usuário logado (mesmo padrão das outras tabelas)
DROP TRIGGER IF EXISTS set_user_id_conexoes_bancarias ON public.conexoes_bancarias;
CREATE TRIGGER set_user_id_conexoes_bancarias BEFORE INSERT ON public.conexoes_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
DROP TRIGGER IF EXISTS set_user_id_regras_categoria ON public.regras_categoria;
CREATE TRIGGER set_user_id_regras_categoria BEFORE INSERT ON public.regras_categoria
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id();

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.conexoes_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_banco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_categoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas conexões bancárias" ON public.conexoes_bancarias;
CREATE POLICY "Usuários gerenciam suas conexões bancárias" ON public.conexoes_bancarias
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Importações: só a Edge Function (service role) insere; o usuário lê,
-- revisa (update) e apaga as próprias.
DROP POLICY IF EXISTS "Usuários veem suas importações" ON public.importacoes_banco;
CREATE POLICY "Usuários veem suas importações" ON public.importacoes_banco
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Usuários revisam suas importações" ON public.importacoes_banco;
CREATE POLICY "Usuários revisam suas importações" ON public.importacoes_banco
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Usuários apagam suas importações" ON public.importacoes_banco;
CREATE POLICY "Usuários apagam suas importações" ON public.importacoes_banco
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuários gerenciam suas regras de categoria" ON public.regras_categoria;
CREATE POLICY "Usuários gerenciam suas regras de categoria" ON public.regras_categoria
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

REVOKE ALL ON public.conexoes_bancarias, public.importacoes_banco, public.regras_categoria FROM anon;


-- ── Aprovar uma transação importada ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.aprovar_importacao(
  p_importacao_id uuid,
  p_descricao text,
  p_valor numeric,
  p_data date,
  p_categoria_id uuid,
  p_tipo text,
  p_parcelas integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_imp public.importacoes_banco%ROWTYPE;
  v_cartao_id uuid;
  v_fatura_id uuid;
  v_tx uuid;
  v_descricao text := nullif(trim(p_descricao), '');
  v_parcelas integer := greatest(coalesce(p_parcelas, 1), 1);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- RLS: só enxerga as importações do próprio usuário
  SELECT * INTO v_imp FROM public.importacoes_banco WHERE id = p_importacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Importação não encontrada';
  END IF;
  IF v_imp.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta transação já foi revisada.';
  END IF;
  IF p_tipo NOT IN ('receita', 'despesa', 'pagamento_fatura') THEN
    RAISE EXCEPTION 'Tipo inválido';
  END IF;

  v_descricao := coalesce(v_descricao, v_imp.descricao);

  SELECT cartao_id INTO v_cartao_id FROM public.conexoes_bancarias WHERE id = v_imp.conexao_id;

  IF p_tipo = 'pagamento_fatura' THEN
    -- Não é gasto (as compras já contam no cartão): só marca como paga a
    -- fatura em aberto do cartão com vencimento mais próximo do pagamento.
    IF v_cartao_id IS NOT NULL THEN
      SELECT id INTO v_fatura_id FROM public.contas
        WHERE cartao_id = v_cartao_id AND status_pago = false
        ORDER BY abs(data_vencimento - coalesce(p_data, v_imp.data)), data_vencimento
        LIMIT 1;
      IF v_fatura_id IS NOT NULL THEN
        PERFORM public.pagar_conta(v_fatura_id, true, coalesce(p_data, v_imp.data));
      END IF;
    END IF;
  ELSE
    IF p_valor IS NULL OR p_valor <= 0 THEN
      RAISE EXCEPTION 'Valor inválido';
    END IF;
    IF p_data IS NULL THEN
      RAISE EXCEPTION 'Data inválida';
    END IF;

    IF v_imp.origem = 'cartao' AND p_tipo = 'despesa' AND v_cartao_id IS NOT NULL THEN
      -- Compra no cartão: mesma regra do app (fatura de cada mês)
      PERFORM public.lancar_gasto_cartao(v_cartao_id, p_valor, v_parcelas, v_descricao, p_data, p_categoria_id);
      -- A transação (primeira parcela) criada agora nesta mesma transação
      SELECT id INTO v_tx FROM public.transacoes
        WHERE user_id = v_uid AND cartao_id = v_cartao_id AND created_at = now()
          AND left(descricao, length(v_descricao)) = v_descricao
        ORDER BY data_transacao, descricao
        LIMIT 1;
    ELSE
      INSERT INTO public.transacoes (tipo, descricao, valor, data_transacao, categoria_id)
      VALUES (p_tipo, v_descricao, p_valor, p_data, p_categoria_id)
      RETURNING id INTO v_tx;
    END IF;

    -- Aprende a categoria para as próximas importações parecidas
    IF p_categoria_id IS NOT NULL THEN
      INSERT INTO public.regras_categoria (user_id, padrao, categoria_id)
      VALUES (v_uid, v_imp.chave_descricao, p_categoria_id)
      ON CONFLICT (user_id, padrao)
      DO UPDATE SET categoria_id = EXCLUDED.categoria_id, updated_at = now();
    END IF;
  END IF;

  UPDATE public.importacoes_banco
     SET status = 'aprovada', transacao_id = v_tx, revisada_em = now()
   WHERE id = p_importacao_id;

  RETURN v_tx;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aprovar_importacao(uuid, text, numeric, date, uuid, text, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.aprovar_importacao(uuid, text, numeric, date, uuid, text, integer) TO authenticated;


-- ── Excluir a conta: inclui as tabelas novas ─────────────────────────
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

  DELETE FROM public.importacoes_banco  WHERE user_id = v_uid;
  DELETE FROM public.regras_categoria   WHERE user_id = v_uid;
  DELETE FROM public.conexoes_bancarias WHERE user_id = v_uid;
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


-- ── Realtime: o aviso do Dashboard e a tela de revisão se atualizam ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'importacoes_banco') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.importacoes_banco;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conexoes_bancarias') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conexoes_bancarias;
  END IF;
END $$;


-- ── Agendamento: todo dia às 06:00 de Brasília (09:00 UTC) ────────────
-- Mesmo padrão do push: URL e service role key lidas do Vault.
SELECT cron.unschedule('sincronizar-banco')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sincronizar-banco');

SELECT cron.schedule(
  'sincronizar-banco',
  '0 9 * * *',
  $cron$
  DO $do$
  DECLARE
    v_url text;
    v_key text;
  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'supabase_project_url';
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key';

    IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_url || '/functions/v1/sincronizar-banco',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    END IF;
  END;
  $do$;
  $cron$
);
