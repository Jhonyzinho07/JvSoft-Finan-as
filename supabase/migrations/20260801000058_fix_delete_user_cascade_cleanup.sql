CREATE OR REPLACE FUNCTION public.delete_user()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  -- Ordem respeita as foreign keys com delete_rule = NO ACTION
  -- (filhas antes das tabelas que elas referenciam)
  DELETE FROM public.orcamentos       WHERE user_id = v_uid;
  DELETE FROM public.transacoes       WHERE user_id = v_uid;
  DELETE FROM public.contas           WHERE user_id = v_uid;
  DELETE FROM public.dividas          WHERE user_id = v_uid;
  DELETE FROM public.cartoes          WHERE user_id = v_uid;
  DELETE FROM public.categorias       WHERE user_id = v_uid;
  DELETE FROM public.contas_bancarias WHERE user_id = v_uid;
  DELETE FROM public.credores         WHERE user_id = v_uid;
  DELETE FROM public.metas            WHERE user_id = v_uid;
  DELETE FROM public.metas_financeiras WHERE user_id = v_uid;
  DELETE FROM public.receitas         WHERE user_id = v_uid;

  IF v_email IS NOT NULL THEN
    DELETE FROM public.login_attempts WHERE email = v_email;
  END IF;

  -- Por fim, remove o usuário do Auth
  DELETE FROM auth.users WHERE id = v_uid;
END;
$function$;
