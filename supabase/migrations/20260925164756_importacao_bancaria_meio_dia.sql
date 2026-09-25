-- A importação bancária passa das 06:00 para as 12:00 de Brasília (15:00 UTC):
-- o Meu Pluggy atualiza os dados do banco por volta das 10h–11h40, então ao
-- meio-dia o app já pega a atualização do mesmo dia.
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'sincronizar-banco'),
  schedule := '0 15 * * *'
);
