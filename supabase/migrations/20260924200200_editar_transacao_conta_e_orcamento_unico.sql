-- =====================================================================
-- Edição consistente de transações e contas + orçamento único.
-- Só adiciona funções e um índice; não altera dados existentes.
-- =====================================================================

-- ── Editar transação ─────────────────────────────────────────────────
-- Compra no cartão: a fatura acompanha a edição.
--   * valor mudou  → a fatura é ajustada pela diferença;
--   * data mudou   → se a nova data cai em outra fatura, a compra muda de
--                    fatura (a antiga é descontada e excluída se zerar);
--   * tipo         → não pode mudar (compra no cartão é sempre despesa);
--   * fatura paga  → edição de valor/data bloqueada (desfaça o pagamento antes).
-- Pagamento de conta ("Pgto: ..."): o valor e o tipo vêm da conta; edite pela conta.
CREATE OR REPLACE FUNCTION public.editar_transacao(
  p_transacao_id uuid,
  p_descricao text,
  p_valor numeric,
  p_data date,
  p_categoria_id uuid,
  p_tipo text
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tx public.transacoes%ROWTYPE;
  v_fatura public.contas%ROWTYPE;
  v_cartao public.cartoes%ROWTYPE;
  v_venc date;
  v_destino uuid;
  v_ultimo_dia integer;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;
  IF p_tipo NOT IN ('receita', 'despesa') THEN
    RAISE EXCEPTION 'Tipo inválido';
  END IF;

  SELECT * INTO v_tx FROM public.transacoes WHERE id = p_transacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada';
  END IF;

  -- Pagamento de uma conta: valor e tipo pertencem à conta
  IF v_tx.conta_vinculada_id IS NOT NULL THEN
    IF p_valor <> v_tx.valor OR p_tipo <> v_tx.tipo THEN
      RAISE EXCEPTION 'O valor deste pagamento vem da conta. Edite pela conta em Contas a Pagar.';
    END IF;
  END IF;

  -- Transação comum: atualiza direto
  IF v_tx.fatura_id IS NULL THEN
    UPDATE public.transacoes
       SET descricao = p_descricao, valor = p_valor, data_transacao = p_data,
           categoria_id = p_categoria_id, tipo = p_tipo
     WHERE id = p_transacao_id;
    RETURN;
  END IF;

  -- ── Compra no cartão ──
  IF p_tipo <> v_tx.tipo THEN
    RAISE EXCEPTION 'Compra no cartão não pode mudar de tipo.';
  END IF;

  SELECT * INTO v_fatura FROM public.contas WHERE id = v_tx.fatura_id FOR UPDATE;

  -- Só descrição/categoria mudaram: não mexe na fatura (mesmo se já paga)
  IF p_valor = v_tx.valor AND p_data = v_tx.data_transacao THEN
    UPDATE public.transacoes SET descricao = p_descricao, categoria_id = p_categoria_id
     WHERE id = p_transacao_id;
    RETURN;
  END IF;

  IF v_fatura.status_pago THEN
    RAISE EXCEPTION 'A fatura desta compra já foi paga. Desfaça o pagamento da fatura antes de alterar valor ou data.';
  END IF;

  v_destino := v_fatura.id;

  IF p_data <> v_tx.data_transacao THEN
    IF v_tx.cartao_id IS NULL THEN
      RAISE EXCEPTION 'O cartão desta compra foi excluído; não é possível mudar a data.';
    END IF;
    SELECT * INTO v_cartao FROM public.cartoes WHERE id = v_tx.cartao_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cartão não encontrado';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('fatura:' || v_tx.cartao_id::text));

    IF v_tx.data_transacao = v_fatura.data_vencimento THEN
      -- Parcela: a data guardada é o vencimento da fatura → vai para a fatura do mês da nova data
      v_ultimo_dia := EXTRACT(DAY FROM (date_trunc('month', p_data) + interval '1 month' - interval '1 day'))::int;
      v_venc := date_trunc('month', p_data)::date + (LEAST(v_cartao.dia_vencimento, v_ultimo_dia) - 1);
    ELSE
      -- Compra à vista: a data é a da compra → mesma regra do lançamento
      v_venc := public.calcular_vencimento_fatura(p_data, v_cartao.dia_fechamento, v_cartao.dia_vencimento, 0);
    END IF;

    IF v_venc <> v_fatura.data_vencimento THEN
      SELECT id INTO v_destino FROM public.contas
       WHERE cartao_id = v_tx.cartao_id AND data_vencimento = v_venc AND status_pago = false
       ORDER BY created_at LIMIT 1
       FOR UPDATE;
      IF v_destino IS NULL THEN
        INSERT INTO public.contas (descricao, valor, data_vencimento, dia_vencimento, status_pago, categoria_id, cartao_id, user_id)
        VALUES ('Fatura: ' || v_cartao.nome, 0, v_venc, EXTRACT(DAY FROM v_venc)::int, false, v_fatura.categoria_id, v_tx.cartao_id, v_tx.user_id)
        RETURNING id INTO v_destino;
      END IF;
    END IF;
  END IF;

  -- Move/atualiza a compra antes de mexer nas faturas (a antiga pode ser excluída)
  UPDATE public.transacoes
     SET descricao = p_descricao, valor = p_valor, data_transacao = p_data,
         categoria_id = p_categoria_id, fatura_id = v_destino
   WHERE id = p_transacao_id;

  IF v_destino = v_fatura.id THEN
    UPDATE public.contas SET valor = valor - v_tx.valor + p_valor WHERE id = v_fatura.id;
  ELSE
    IF v_fatura.valor - v_tx.valor <= 0 THEN
      DELETE FROM public.contas WHERE id = v_fatura.id;
    ELSE
      UPDATE public.contas SET valor = valor - v_tx.valor WHERE id = v_fatura.id;
    END IF;
    UPDATE public.contas SET valor = valor + p_valor WHERE id = v_destino;
  END IF;
END;
$$;

-- ── Editar conta ─────────────────────────────────────────────────────
-- Conta paga: a despesa "Pgto: ..." acompanha valor, descrição e categoria.
-- Fatura de cartão: o valor é a soma das compras e não pode ser digitado.
-- dia_vencimento NÃO é alterado: guarda o dia original do vencimento
-- (a data pode ter sido ajustada, por exemplo, num pagamento em atraso).
CREATE OR REPLACE FUNCTION public.editar_conta(
  p_conta_id uuid,
  p_descricao text,
  p_valor numeric,
  p_data_vencimento date,
  p_categoria_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_conta public.contas%ROWTYPE;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  SELECT * INTO v_conta FROM public.contas WHERE id = p_conta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  IF v_conta.cartao_id IS NOT NULL AND p_valor <> v_conta.valor THEN
    RAISE EXCEPTION 'O valor da fatura é a soma das compras. Edite as compras em Transações.';
  END IF;

  UPDATE public.contas
     SET descricao = p_descricao, valor = p_valor,
         data_vencimento = p_data_vencimento, categoria_id = p_categoria_id
   WHERE id = p_conta_id;

  IF COALESCE(v_conta.status_pago, false) AND v_conta.cartao_id IS NULL THEN
    UPDATE public.transacoes
       SET valor = p_valor, descricao = 'Pgto: ' || p_descricao, categoria_id = p_categoria_id
     WHERE conta_vinculada_id = p_conta_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.editar_transacao(uuid, text, numeric, date, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.editar_conta(uuid, text, numeric, date, uuid)            FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.editar_transacao(uuid, text, numeric, date, uuid, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.editar_conta(uuid, text, numeric, date, uuid)            TO authenticated;

-- ── Orçamento único por usuário/categoria/mês ────────────────────────
-- (o app já trata o erro 23505 com "orçamento já existe"; faltava a regra no banco)
CREATE UNIQUE INDEX IF NOT EXISTS orcamentos_usuario_categoria_mes_key
  ON public.orcamentos (user_id, categoria_id, ano, mes);
