-- pg_net não pode ser movido com ALTER EXTENSION ... SET SCHEMA;
-- recria no schema "extensions" (acabou de ser instalado, não há dados).
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- reset_login_attempts era chamável por visitantes para zerar o bloqueio
-- de QUALQUER e-mail. Agora só usuário logado, e só o próprio e-mail
-- (o parâmetro é mantido para não quebrar o front atual, mas é ignorado).
CREATE OR REPLACE FUNCTION public.reset_login_attempts(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(auth.jwt() ->> 'email');
BEGIN
  IF v_email IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM public.login_attempts WHERE lower(email) = v_email;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_login_attempts(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reset_login_attempts(text) TO authenticated;
