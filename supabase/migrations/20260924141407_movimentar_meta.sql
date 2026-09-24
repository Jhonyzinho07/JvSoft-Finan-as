-- Depósito/resgate em meta: atualiza o valor guardado e registra a transação
-- na mesma transação do banco (antes eram 3 chamadas soltas do navegador).
CREATE OR REPLACE FUNCTION public.movimentar_meta(p_meta_id uuid, p_tipo text, p_valor numeric, p_data date DEFAULT CURRENT_DATE)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_meta public.metas%ROWTYPE;
  v_tipo_tx text;
  v_categoria uuid;
  v_novo numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  IF p_tipo NOT IN ('depositar', 'resgatar') THEN
    RAISE EXCEPTION 'Tipo de movimento inválido';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  SELECT * INTO v_meta FROM public.metas WHERE id = p_meta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meta não encontrada';
  END IF;

  IF p_tipo = 'resgatar' AND p_valor > COALESCE(v_meta.valor_atual, 0) THEN
    RAISE EXCEPTION 'Valor de resgate maior do que o saldo guardado';
  END IF;

  v_novo := COALESCE(v_meta.valor_atual, 0) + CASE WHEN p_tipo = 'depositar' THEN p_valor ELSE -p_valor END;
  UPDATE public.metas SET valor_atual = v_novo WHERE id = p_meta_id;

  v_tipo_tx := CASE WHEN p_tipo = 'depositar' THEN 'despesa' ELSE 'receita' END;
  SELECT id INTO v_categoria FROM public.categorias
    WHERE user_id = v_uid AND nome ILIKE 'Investimento' AND tipo = v_tipo_tx LIMIT 1;
  IF v_categoria IS NULL THEN
    INSERT INTO public.categorias (nome, tipo, user_id) VALUES ('Investimento', v_tipo_tx, v_uid)
    RETURNING id INTO v_categoria;
  END IF;

  INSERT INTO public.transacoes (tipo, descricao, valor, data_transacao, categoria_id, user_id)
  VALUES (
    v_tipo_tx,
    CASE WHEN p_tipo = 'depositar' THEN 'Investimento: ' ELSE 'Resgate: ' END || v_meta.titulo,
    p_valor,
    p_data,
    v_categoria,
    v_uid
  );

  RETURN v_novo;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.movimentar_meta(uuid, text, numeric, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.movimentar_meta(uuid, text, numeric, date) TO authenticated;
