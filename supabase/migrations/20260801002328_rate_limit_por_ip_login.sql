-- Tabela de controle de tentativas por IP. Não tem policy nenhuma de RLS
-- (RLS ligado, zero policies) -- só é tocada via funções SECURITY DEFINER,
-- nunca diretamente pelo client.
CREATE TABLE IF NOT EXISTS public.login_attempts_ip (
  ip_address text PRIMARY KEY,
  attempts int NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);
ALTER TABLE public.login_attempts_ip ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._client_ip()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT NULLIF(split_part(
    COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
    ',', 1
  ), '');
$function$;

CREATE OR REPLACE FUNCTION public.register_login_failure(p_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_record public.login_attempts%ROWTYPE;
    v_ip_record public.login_attempts_ip%ROWTYPE;
    v_ip text := public._client_ip();
    v_new_attempts INT;
    v_locked_until TIMESTAMPTZ;
    v_time_left INT;
    v_ip_window CONSTANT interval := make_interval(mins => 15);
    v_ip_max_attempts CONSTANT INT := 10;
    v_ip_lock CONSTANT interval := make_interval(mins => 5);
BEGIN
    -- Rate limit por IP: impede abuso direto desta RPC pra bloquear
    -- e-mail de terceiro repetidamente, sem nunca tentar logar de verdade.
    IF v_ip IS NOT NULL THEN
        SELECT * INTO v_ip_record FROM public.login_attempts_ip WHERE ip_address = v_ip;

        IF FOUND AND v_ip_record.locked_until IS NOT NULL AND v_ip_record.locked_until > NOW() THEN
            v_time_left := CEIL(EXTRACT(EPOCH FROM (v_ip_record.locked_until - NOW())))::INT;
            RETURN json_build_object('is_locked', true, 'time_left', v_time_left, 'motivo', 'ip');
        END IF;

        IF NOT FOUND THEN
            INSERT INTO public.login_attempts_ip (ip_address, attempts, window_start)
            VALUES (v_ip, 1, NOW());
        ELSIF v_ip_record.window_start < NOW() - v_ip_window THEN
            UPDATE public.login_attempts_ip
            SET attempts = 1, window_start = NOW(), locked_until = NULL
            WHERE ip_address = v_ip;
        ELSE
            UPDATE public.login_attempts_ip
            SET attempts = attempts + 1
            WHERE ip_address = v_ip
            RETURNING * INTO v_ip_record;

            IF v_ip_record.attempts >= v_ip_max_attempts THEN
                UPDATE public.login_attempts_ip
                SET locked_until = NOW() + v_ip_lock
                WHERE ip_address = v_ip;
                RETURN json_build_object('is_locked', true, 'time_left', EXTRACT(EPOCH FROM v_ip_lock)::INT, 'motivo', 'ip');
            END IF;
        END IF;
    END IF;

    -- Lógica original por e-mail (inalterada)
    SELECT * INTO v_record FROM public.login_attempts WHERE email = p_email;

    IF NOT FOUND THEN
        INSERT INTO public.login_attempts (email, attempts) VALUES (p_email, 1);
        RETURN json_build_object('is_locked', false, 'time_left', 0, 'attempts', 1);
    ELSE
        v_new_attempts := v_record.attempts + 1;

        IF v_new_attempts >= 3 THEN
            v_locked_until := NOW() + INTERVAL '30 seconds';
            v_time_left := 30;
            UPDATE public.login_attempts
            SET attempts = v_new_attempts, locked_until = v_locked_until
            WHERE email = p_email;

            RETURN json_build_object('is_locked', true, 'time_left', v_time_left, 'attempts', v_new_attempts);
        ELSE
            UPDATE public.login_attempts
            SET attempts = v_new_attempts
            WHERE email = p_email;

            RETURN json_build_object('is_locked', false, 'time_left', 0, 'attempts', v_new_attempts);
        END IF;
    END IF;
END;
$function$;
