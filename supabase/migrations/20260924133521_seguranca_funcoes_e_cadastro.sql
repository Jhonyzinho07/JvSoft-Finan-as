-- 1) Corrige o cadastro de novos usuários: o trigger
--    criar_categorias_padrao_novo_usuario usa ON CONFLICT (user_id, nome, tipo),
--    que exige um índice único nessas colunas (não existia -> signup falhava).
CREATE UNIQUE INDEX IF NOT EXISTS categorias_user_nome_tipo_key
  ON public.categorias (user_id, nome, tipo);

-- 2) search_path fixo em todas as funções (lint 0011)
ALTER FUNCTION public.set_user_id()                                         SET search_path = public;
ALTER FUNCTION public.set_user_id_on_insert()                               SET search_path = public;
ALTER FUNCTION public.criar_parcelamento(text, numeric, integer, date, uuid, uuid) SET search_path = public;
ALTER FUNCTION public.cancelar_parcelamento(uuid, boolean)                  SET search_path = public;
ALTER FUNCTION public.check_login_status(text)                              SET search_path = public;
ALTER FUNCTION public.reset_login_attempts(text)                            SET search_path = public;
ALTER FUNCTION public.register_login_failure(text)                          SET search_path = public;
ALTER FUNCTION public.delete_user()                                         SET search_path = public;
ALTER FUNCTION public._client_ip()                                          SET search_path = public;

-- 3) Funções de trigger / internas: ninguém chama pela API
REVOKE EXECUTE ON FUNCTION public.set_user_id()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_user_id_on_insert()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.criar_categorias_padrao_novo_usuario() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registrar_aceite_termos_novo_usuario() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._client_ip()                           FROM PUBLIC, anon, authenticated;

-- 4) Funções de usuário logado: tira acesso de visitantes (anon)
REVOKE EXECUTE ON FUNCTION public.delete_user()                                          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.criar_parcelamento(text, numeric, integer, date, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_parcelamento(uuid, boolean)                   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_user()                                          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.criar_parcelamento(text, numeric, integer, date, uuid, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.cancelar_parcelamento(uuid, boolean)                   TO authenticated;

-- check_login_status / register_login_failure / reset_login_attempts continuam
-- liberadas para anon: são chamadas na tela de login, antes de existir sessão.

-- 5) Funções criadas daqui pra frente não ficam executáveis por anon por padrão
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
