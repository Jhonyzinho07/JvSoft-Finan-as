CREATE OR REPLACE FUNCTION public.registrar_aceite_termos_novo_usuario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.raw_user_meta_data->>'terms_accepted') = 'true' THEN
    INSERT INTO public.termos_aceites (user_id, versao_termos, aceito_em)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'terms_version', '1.0'),
      now()
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created_termos_aceites
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_aceite_termos_novo_usuario();
