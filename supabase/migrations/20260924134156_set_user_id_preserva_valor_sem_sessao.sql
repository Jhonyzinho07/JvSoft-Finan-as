-- Durante o cadastro (trigger em auth.users) não existe sessão, então
-- auth.uid() é NULL e as categorias padrão ficavam com user_id NULL.
-- Com sessão: sempre força o usuário logado (como antes).
-- Sem sessão (triggers internos / service role): mantém o valor informado.
CREATE OR REPLACE FUNCTION public.set_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    NEW.user_id := COALESCE(auth.uid(), NEW.user_id);
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    NEW.user_id := COALESCE(auth.uid(), NEW.user_id);
    RETURN NEW;
END;
$function$;
