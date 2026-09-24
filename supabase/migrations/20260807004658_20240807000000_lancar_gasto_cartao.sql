CREATE OR REPLACE FUNCTION lancar_gasto_cartao(
  p_valor_gasto DECIMAL(15,2),
  p_num_parcelas INTEGER,
  p_descricao_original VARCHAR,
  p_cartao_id UUID,
  p_cartao_nome VARCHAR,
  p_cartao_dia_fechamento INTEGER,
  p_cartao_dia_vencimento INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_categoria_id UUID;
  v_user_id UUID;
  i INTEGER;
  v_valor_fatura DECIMAL(15,2);
  v_descricao_tx VARCHAR;
  v_data_base DATE;
  v_data_vencimento_fatura DATE;
  v_data_venc_string DATE;
  v_mes_ano VARCHAR;
  v_descricao_fatura VARCHAR;
  v_fatura_id UUID;
  v_fatura_existente RECORD;
  v_mes_ajuste INTEGER;
  v_ano_ajuste INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- 1. Achar/criar categoria padrão para Cartão
  SELECT id INTO v_categoria_id FROM categorias WHERE nome = 'Cartão' AND user_id = v_user_id LIMIT 1;
  IF v_categoria_id IS NULL THEN
    INSERT INTO categorias (nome, tipo, cor, user_id) VALUES ('Cartão', 'despesa', '#ef4444', v_user_id) RETURNING id INTO v_categoria_id;
  END IF;

  v_data_base := CURRENT_DATE;

  FOR i IN 0..(p_num_parcelas - 1) LOOP
    IF p_num_parcelas > 1 THEN
      v_valor_fatura := ROUND((p_valor_gasto / p_num_parcelas), 2);
      v_descricao_tx := p_descricao_original || ' - Parcela ' || (i + 1) || '/' || p_num_parcelas;
    ELSE
      v_valor_fatura := p_valor_gasto;
      v_descricao_tx := p_descricao_original;
    END IF;

    -- Lógica de vencimento da fatura equivalente ao JS frontend
    IF p_cartao_dia_fechamento IS NOT NULL AND p_cartao_dia_vencimento IS NOT NULL THEN
      v_mes_ajuste := EXTRACT(MONTH FROM v_data_base)::integer + i;
      IF i = 0 AND EXTRACT(DAY FROM v_data_base)::integer >= p_cartao_dia_fechamento THEN
        v_mes_ajuste := v_mes_ajuste + 1;
      END IF;

      -- Ajustar ano se mês passar de 12
      v_ano_ajuste := EXTRACT(YEAR FROM v_data_base)::integer;

      WHILE v_mes_ajuste > 12 LOOP
        v_mes_ajuste := v_mes_ajuste - 12;
        v_ano_ajuste := v_ano_ajuste + 1;
      END LOOP;

      BEGIN
        v_data_vencimento_fatura := make_date(v_ano_ajuste, v_mes_ajuste, p_cartao_dia_vencimento);
      EXCEPTION WHEN OTHERS THEN
        v_data_vencimento_fatura := make_date(v_ano_ajuste, v_mes_ajuste, 1) + interval '1 month' - interval '1 day';
      END;

    ELSE
      v_data_vencimento_fatura := v_data_base + (i || ' month')::interval;
    END IF;

    v_data_venc_string := v_data_vencimento_fatura::DATE;
    v_mes_ano := lpad(EXTRACT(MONTH FROM v_data_vencimento_fatura)::text, 2, '0') || '/' || EXTRACT(YEAR FROM v_data_vencimento_fatura)::text;
    v_descricao_fatura := 'Fatura: ' || p_cartao_nome;

    -- Procurar Fatura Aberta no mês exato
    SELECT id, valor INTO v_fatura_existente
    FROM contas
    WHERE descricao = v_descricao_fatura
      AND status_pago = false
      AND EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM v_data_vencimento_fatura)
      AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM v_data_vencimento_fatura)
      AND user_id = v_user_id
    LIMIT 1;

    IF v_fatura_existente.id IS NOT NULL THEN
      UPDATE contas SET valor = valor + v_valor_fatura WHERE id = v_fatura_existente.id;
      v_fatura_id := v_fatura_existente.id;
    ELSE
      INSERT INTO contas (descricao, valor, data_vencimento, status_pago, categoria_id, mes_referencia, user_id)
      VALUES (v_descricao_fatura, v_valor_fatura, v_data_venc_string, false, v_categoria_id, v_mes_ano, v_user_id)
      RETURNING id INTO v_fatura_id;
    END IF;

    INSERT INTO transacoes (tipo, descricao, valor, data, categoria_id, cartao_id, conta_consumo_id, user_id)
    VALUES (
      'despesa',
      v_descricao_tx,
      v_valor_fatura,
      CASE WHEN p_num_parcelas > 1 THEN v_data_venc_string ELSE CURRENT_DATE END,
      v_categoria_id,
      p_cartao_id,
      v_fatura_id,
      v_user_id
    );

  END LOOP;
END;
$$;
