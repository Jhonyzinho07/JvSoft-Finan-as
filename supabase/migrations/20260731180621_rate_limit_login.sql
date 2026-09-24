CREATE TABLE IF NOT EXISTS public.login_attempts (
    email TEXT PRIMARY KEY,
    attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_login_status(p_email TEXT)
RETURNS JSON AS $$
DECLARE
    v_record public.login_attempts%ROWTYPE;
    v_time_left INT;
BEGIN
    SELECT * INTO v_record FROM public.login_attempts WHERE email = p_email;

    IF NOT FOUND THEN
        RETURN json_build_object('is_locked', false, 'time_left', 0);
    END IF;

    IF v_record.locked_until IS NOT NULL AND v_record.locked_until > NOW() THEN
        v_time_left := CEIL(EXTRACT(EPOCH FROM (v_record.locked_until - NOW())))::INT;
        RETURN json_build_object('is_locked', true, 'time_left', v_time_left);
    ELSEIF v_record.locked_until IS NOT NULL AND v_record.locked_until <= NOW() THEN
        -- lock expired, reset attempts
        DELETE FROM public.login_attempts WHERE email = p_email;
        RETURN json_build_object('is_locked', false, 'time_left', 0);
    END IF;

    RETURN json_build_object('is_locked', false, 'time_left', 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.register_login_failure(p_email TEXT)
RETURNS JSON AS $$
DECLARE
    v_record public.login_attempts%ROWTYPE;
    v_new_attempts INT;
    v_locked_until TIMESTAMPTZ;
    v_time_left INT;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reset_login_attempts(p_email TEXT)
RETURNS void AS $$
BEGIN
    DELETE FROM public.login_attempts WHERE email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
