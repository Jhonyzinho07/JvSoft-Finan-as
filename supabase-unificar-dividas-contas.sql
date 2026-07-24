-- =====================================================================
-- MIGRATION: Unificação de "dividas" dentro de "contas"
-- =====================================================================
-- Contexto: o app tinha dois modelos de dívida — "contas" (com data
-- explícita por parcela, usada no parcelamento novo) e "dividas" (modelo
-- antigo, recorrente, com "parcelas_restantes" e sem data específica por
-- parcela). Isso obrigava o front-end a ter um "if/else" duplicado em
-- toda tela que lida com pagamento, edição e exclusão de conta.
--
-- Esta migration converte cada dívida ativa (parcelas_restantes > 0) em
-- N linhas de "contas" — uma por parcela restante, com data de
-- vencimento explícita, mês a mês, tratando corretamente o caso de
-- dia_vencimento = 31 caindo em meses mais curtos (usa o último dia do
-- mês nesses casos). Todas as parcelas migradas de uma mesma dívida
-- compartilham o mesmo id_parcelamento, exatamente como um parcelamento
-- comum feito pela função criar_parcelamento.
--
-- SEGURANÇA:
-- - dividas com parcelas_restantes = 0 (já quitadas) NÃO são migradas.
-- - A tabela "dividas" NÃO é apagada — é renomeada para "dividas_legado"
--   ao final, como backup. Pode ser removida depois de confirmar que
--   está tudo certo (ver comando comentado no final do arquivo).
-- - Testado localmente com casos de borda (dia 31 em fevereiro/setembro,
--   dívida sem dia_vencimento, dívida já quitada) antes de ser entregue.
--
-- Execute este script no SQL Editor do Supabase.
-- =====================================================================

DO $$
DECLARE
  d RECORD;
  novo_id_parcelamento UUID;
  mes_base DATE;
  mes_alvo DATE;
  ultimo_dia_mes INTEGER;
  dia_final INTEGER;
  data_parcela DATE;
  i INTEGER;
  total_migradas INTEGER := 0;
BEGIN
  FOR d IN SELECT * FROM dividas WHERE parcelas_restantes > 0 LOOP
    novo_id_parcelamento := gen_random_uuid();

    -- Se não há dia de vencimento definido, usa hoje como base; caso
    -- contrário, começa neste mês (se o dia ainda não passou) ou no próximo.
    IF d.dia_vencimento IS NULL THEN
      mes_base := date_trunc('month', CURRENT_DATE)::date;
    ELSIF EXTRACT(DAY FROM CURRENT_DATE) > d.dia_vencimento THEN
      mes_base := (date_trunc('month', CURRENT_DATE) + interval '1 month')::date;
    ELSE
      mes_base := date_trunc('month', CURRENT_DATE)::date;
    END IF;

    FOR i IN 0 .. (d.parcelas_restantes - 1) LOOP
      mes_alvo := (mes_base + (i || ' months')::interval)::date;
      ultimo_dia_mes := EXTRACT(DAY FROM (mes_alvo + interval '1 month - 1 day'))::int;

      IF d.dia_vencimento IS NULL THEN
        dia_final := EXTRACT(DAY FROM CURRENT_DATE)::int;
      ELSE
        dia_final := LEAST(d.dia_vencimento, ultimo_dia_mes); -- trata dia 31 em mês curto
      END IF;

      data_parcela := mes_alvo + (dia_final - 1) * interval '1 day';

      INSERT INTO contas (
        descricao, valor, data_vencimento, dia_vencimento,
        credor_id, status_pago, id_parcelamento, numero_parcela, total_parcelas
      ) VALUES (
        d.descricao, d.valor_parcela, data_parcela, dia_final,
        d.credor_id, false, novo_id_parcelamento, i + 1, d.parcelas_restantes
      );

      total_migradas := total_migradas + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Migração concluída: % parcela(s) criadas em "contas".', total_migradas;
END $$;

-- Renomeia a tabela antiga como backup (não apaga nada)
ALTER TABLE IF EXISTS dividas RENAME TO dividas_legado;

-- Depois de conferir no app que tudo migrou certo (rode por pelo menos
-- um ciclo de mês), você pode remover o backup definitivamente com:
-- DROP TABLE dividas_legado;
