-- =====================================================================
-- Cartão de crédito, faturas, pagamento de contas e saldo.
-- Só adiciona colunas (vazias), índices e funções. Não altera dados.
-- Todas as funções novas são SECURITY INVOKER: o RLS do usuário logado
-- continua valendo dentro delas.
-- =====================================================================

-- ── Colunas novas ────────────────────────────────────────────────────
-- Fatura passa a ser ligada ao cartão pelo ID (antes: pelo texto "Fatura: <nome>")
ALTER TABLE public.contas     ADD COLUMN IF NOT EXISTS cartao_id uuid;
-- Compra no cartão aponta para a fatura (conta) onde foi lançada
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS fatura_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contas_cartao_id_fkey') THEN
    ALTER TABLE public.contas ADD CONSTRAINT contas_cartao_id_fkey
      FOREIGN KEY (cartao_id) REFERENCES public.cartoes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transacoes_fatura_id_fkey') THEN
    ALTER TABLE public.transacoes ADD CONSTRAINT transacoes_fatura_id_fkey
      FOREIGN KEY (fatura_id) REFERENCES public.contas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Excluir um cartão não pode ser bloqueado pelo histórico de compras:
-- as transações ficam, apenas perdem o vínculo com o cartão.
ALTER TABLE public.transacoes DROP CONSTRAINT IF EXISTS transacoes_cartao_id_fkey;
ALTER TABLE public.transacoes ADD CONSTRAINT transacoes_cartao_id_fkey
  FOREIGN KEY (cartao_id) REFERENCES public.cartoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_cartao_venc     ON public.contas (cartao_id, data_vencimento) WHERE cartao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_fatura_id   ON public.transacoes (fatura_id) WHERE fatura_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_user_data   ON public.transacoes (user_id, data_transacao);

-- ── Remove a versão antiga (quebrada) do lançamento no cartão ────────
-- Ela gravava em colunas inexistentes (transacoes.data, conta_consumo_id,
-- contas.mes_referencia) e falhava em toda chamada.
DROP FUNCTION IF EXISTS public.lancar_gasto_cartao(numeric, integer, character varying, uuid, character varying, integer, integer);

-- ── Vencimento da fatura para uma compra ─────────────────────────────
-- Compra ANTES do dia de fechamento entra na fatura que fecha neste mês;
-- no dia do fechamento ou depois, entra na do mês seguinte.
-- Se o vencimento é num dia menor/igual ao fechamento, ele cai no mês
-- seguinte ao fechamento. Dia inexistente (ex.: 31/02) vira o último dia do mês.
CREATE OR REPLACE FUNCTION public.calcular_vencimento_fatura(
  p_data_compra date, p_dia_fechamento integer, p_dia_vencimento integer, p_parcela integer DEFAULT 0
) RETURNS date
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_mes date := date_trunc('month', p_data_compra)::date;
  v_ultimo_dia integer;
BEGIN
  IF EXTRACT(DAY FROM p_data_compra)::int >= p_dia_fechamento THEN
    v_mes := (v_mes + interval '1 month')::date;
  END IF;
  IF p_dia_vencimento <= p_dia_fechamento THEN
    v_mes := (v_mes + interval '1 month')::date;
  END IF;
  v_mes := (v_mes + make_interval(months => p_parcela))::date;
  v_ultimo_dia := EXTRACT(DAY FROM (v_mes + interval '1 month' - interval '1 day'))::int;
  RETURN v_mes + (LEAST(p_dia_vencimento, v_ultimo_dia) - 1);
END;
$$;

-- ── Lançar compra no cartão (à vista ou parcelada) ───────────────────
CREATE OR REPLACE FUNCTION public.lancar_gasto_cartao(
  p_cartao_id uuid,
  p_valor numeric,
  p_parcelas integer DEFAULT 1,
  p_descricao text DEFAULT 'Compra no cartão',
  p_data date DEFAULT CURRENT_DATE,
  p_categoria_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cartao public.cartoes%ROWTYPE;
  v_categoria uuid := p_categoria_id;
  v_valor_parcela numeric(15,2);
  v_valor_linha numeric(15,2);
  v_soma numeric(15,2) := 0;
  v_venc date;
  v_fatura_id uuid;
  i integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;
  IF p_parcelas IS NULL OR p_parcelas < 1 OR p_parcelas > 48 THEN
    RAISE EXCEPTION 'Número de parcelas inválido';
  END IF;

  -- RLS garante que só enxerga cartões do próprio usuário
  SELECT * INTO v_cartao FROM public.cartoes WHERE id = p_cartao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartão não encontrado';
  END IF;

  -- Serializa lançamentos no mesmo cartão: evita duas faturas para o mesmo mês
  PERFORM pg_advisory_xact_lock(hashtext('fatura:' || p_cartao_id::text));

  IF v_categoria IS NULL THEN
    SELECT id INTO v_categoria FROM public.categorias
      WHERE user_id = v_uid AND nome = 'Cartão' AND tipo = 'despesa' LIMIT 1;
    IF v_categoria IS NULL THEN
      INSERT INTO public.categorias (nome, tipo, icone, cor, user_id)
      VALUES ('Cartão', 'despesa', '💳', '#1e40af', v_uid)
      RETURNING id INTO v_categoria;
    END IF;
  END IF;

  -- Mesma regra do criar_parcelamento: trunca em centavos e a última
  -- parcela recebe a diferença (a soma bate exatamente com o total).
  v_valor_parcela := TRUNC(p_valor / p_parcelas, 2);

  FOR i IN 0..(p_parcelas - 1) LOOP
    IF i = p_parcelas - 1 THEN
      v_valor_linha := p_valor - v_soma;
    ELSE
      v_valor_linha := v_valor_parcela;
      v_soma := v_soma + v_valor_parcela;
    END IF;

    v_venc := public.calcular_vencimento_fatura(p_data, v_cartao.dia_fechamento, v_cartao.dia_vencimento, i);

    SELECT id INTO v_fatura_id FROM public.contas
      WHERE cartao_id = p_cartao_id AND data_vencimento = v_venc AND status_pago = false
      ORDER BY created_at LIMIT 1
      FOR UPDATE;

    IF v_fatura_id IS NULL THEN
      INSERT INTO public.contas (descricao, valor, data_vencimento, dia_vencimento, status_pago, categoria_id, cartao_id, user_id)
      VALUES ('Fatura: ' || v_cartao.nome, v_valor_linha, v_venc, EXTRACT(DAY FROM v_venc)::int, false, v_categoria, p_cartao_id, v_uid)
      RETURNING id INTO v_fatura_id;
    ELSE
      UPDATE public.contas SET valor = valor + v_valor_linha WHERE id = v_fatura_id;
    END IF;

    INSERT INTO public.transacoes (tipo, descricao, valor, data_transacao, categoria_id, cartao_id, fatura_id, user_id)
    VALUES (
      'despesa',
      CASE WHEN p_parcelas > 1 THEN p_descricao || ' - Parcela ' || (i + 1) || '/' || p_parcelas ELSE p_descricao END,
      v_valor_linha,
      CASE WHEN p_parcelas > 1 THEN v_venc ELSE p_data END,
      v_categoria,
      p_cartao_id,
      v_fatura_id,
      v_uid
    );
  END LOOP;

  RETURN p_parcelas;
END;
$$;

-- ── Excluir compra do cartão (ajusta a fatura na mesma transação) ────
CREATE OR REPLACE FUNCTION public.excluir_transacao(p_transacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tx public.transacoes%ROWTYPE;
  v_fatura public.contas%ROWTYPE;
BEGIN
  SELECT * INTO v_tx FROM public.transacoes WHERE id = p_transacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada';
  END IF;

  IF v_tx.fatura_id IS NOT NULL THEN
    SELECT * INTO v_fatura FROM public.contas WHERE id = v_tx.fatura_id FOR UPDATE;
    IF FOUND THEN
      IF v_fatura.status_pago THEN
        RAISE EXCEPTION 'A fatura desta compra já foi paga. Desfaça o pagamento da fatura antes de excluir.';
      END IF;
      IF v_fatura.valor - v_tx.valor <= 0 THEN
        DELETE FROM public.contas WHERE id = v_fatura.id;
      ELSE
        UPDATE public.contas SET valor = valor - v_tx.valor WHERE id = v_fatura.id;
      END IF;
    END IF;
  END IF;

  DELETE FROM public.transacoes WHERE id = p_transacao_id;
END;
$$;

-- ── Pagar / desfazer pagamento de uma conta ──────────────────────────
-- Conta comum: pagar cria a despesa vinculada; desfazer remove a despesa.
-- Fatura de cartão: NÃO cria despesa (as compras já foram lançadas uma a
-- uma) — evita contar o mesmo gasto duas vezes.
CREATE OR REPLACE FUNCTION public.pagar_conta(p_conta_id uuid, p_pago boolean, p_data date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_conta public.contas%ROWTYPE;
  v_eh_fatura boolean;
BEGIN
  SELECT * INTO v_conta FROM public.contas WHERE id = p_conta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;
  IF COALESCE(v_conta.status_pago, false) = p_pago THEN
    RETURN; -- já está no estado pedido
  END IF;

  v_eh_fatura := v_conta.cartao_id IS NOT NULL;

  UPDATE public.contas SET status_pago = p_pago WHERE id = p_conta_id;

  IF p_pago THEN
    IF NOT v_eh_fatura THEN
      INSERT INTO public.transacoes (tipo, descricao, valor, data_transacao, categoria_id, conta_vinculada_id, user_id)
      VALUES ('despesa', 'Pgto: ' || v_conta.descricao, v_conta.valor, p_data, v_conta.categoria_id, v_conta.id, v_conta.user_id);
    END IF;
  ELSE
    DELETE FROM public.transacoes WHERE conta_vinculada_id = p_conta_id;
  END IF;
END;
$$;

-- ── Resumo financeiro do usuário (calculado no banco) ────────────────
-- Substitui o "select * from transacoes" do Dashboard, que era cortado em
-- 1000 linhas pelo PostgREST.
CREATE OR REPLACE FUNCTION public.resumo_financeiro(p_inicio date DEFAULT NULL, p_fim date DEFAULT NULL)
RETURNS TABLE (receitas numeric, despesas numeric, saldo numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'receita'), 0),
    COALESCE(SUM(valor) FILTER (WHERE tipo = 'despesa'), 0),
    COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END), 0)
  FROM public.transacoes
  WHERE user_id = auth.uid()
    AND (p_inicio IS NULL OR data_transacao >= p_inicio)
    AND (p_fim    IS NULL OR data_transacao <= p_fim);
$$;

-- ── Permissões: só usuários logados ──────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.calcular_vencimento_fatura(date, integer, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lancar_gasto_cartao(uuid, numeric, integer, text, date, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.excluir_transacao(uuid)                                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pagar_conta(uuid, boolean, date)                            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resumo_financeiro(date, date)                               FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.calcular_vencimento_fatura(date, integer, integer, integer) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.lancar_gasto_cartao(uuid, numeric, integer, text, date, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.excluir_transacao(uuid)                                     TO authenticated;
GRANT  EXECUTE ON FUNCTION public.pagar_conta(uuid, boolean, date)                            TO authenticated;
GRANT  EXECUTE ON FUNCTION public.resumo_financeiro(date, date)                               TO authenticated;
