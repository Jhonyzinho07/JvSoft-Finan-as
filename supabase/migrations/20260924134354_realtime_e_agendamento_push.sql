-- ── Realtime ─────────────────────────────────────────────────────────
-- Só ADICIONA tabelas à publicação (nunca DROP PUBLICATION).
-- O Realtime respeita o RLS: cada usuário só recebe eventos das próprias linhas.
DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  FOREACH t IN ARRAY ARRAY['transacoes','contas','categorias','cartoes','metas','orcamentos'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ── Agendamento diário das notificações push ─────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove o job antigo só se ele existir (unschedule direto dá erro quando não existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-notificacoes-push') THEN
    PERFORM cron.unschedule('enviar-notificacoes-push');
  END IF;
END $$;

-- 11:00 UTC = 08:00 em Brasília.
-- Lê URL e service role key do Supabase Vault; se os segredos ainda não
-- foram cadastrados, o job simplesmente não faz nada.
SELECT cron.schedule(
  'enviar-notificacoes-push',
  '0 11 * * *',
  $job$
  DO $do$
  DECLARE
    v_url text;
    v_key text;
  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'supabase_project_url';
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key';

    IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_url || '/functions/v1/send-push-notifications',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    END IF;
  END;
  $do$;
  $job$
);
