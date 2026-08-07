-- ============================================
-- SCRIPT DE CONFIGURAÇÃO DO BANCO DE DADOS
-- Controle de Finanças Pessoais - JvSoft
-- ============================================

-- 1. Tabela de Categorias
CREATE TABLE IF NOT EXISTS categorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  icone VARCHAR(50) DEFAULT '📁',
  cor VARCHAR(7) DEFAULT '#6b7280',
  tipo VARCHAR(20) DEFAULT 'despesa', -- 'receita' ou 'despesa'
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Tabela de Contas Bancárias
CREATE TABLE IF NOT EXISTS contas_bancarias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) DEFAULT 'corrente', -- 'corrente', 'poupanca', 'investimento', 'carteira'
  saldo_inicial DECIMAL(15,2) DEFAULT 0,
  instituicao VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 3. Tabela de Credores
CREATE TABLE IF NOT EXISTS credores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  emoji VARCHAR(10) DEFAULT '💰',
  cor VARCHAR(7) DEFAULT '#6b7280',
  tipo VARCHAR(50) DEFAULT 'outro',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 4. Tabela de Receitas Fixas
CREATE TABLE IF NOT EXISTS receitas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao VARCHAR(200) NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  dia_recebimento INTEGER, -- Dia do mês (1-31)
  categoria_id UUID REFERENCES categorias(id),
  conta_id UUID REFERENCES contas_bancarias(id),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 5. Tabela de Dívidas/Parcelamentos
CREATE TABLE IF NOT EXISTS dividas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credor_id UUID REFERENCES credores(id),
  descricao VARCHAR(200) NOT NULL,
  valor_total DECIMAL(15,2) NOT NULL,
  valor_parcela DECIMAL(15,2) NOT NULL,
  parcelas_restantes INTEGER DEFAULT 0,
  parcelas_totais INTEGER DEFAULT 0,
  dia_vencimento INTEGER, -- Dia do mês (1-31)
  data_inicio DATE,
  data_fim DATE,
  taxa_juros DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'pago', 'cancelado'
  observacoes TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 6. Tabela de Contas de Consumo (água, luz, etc.)
CREATE TABLE IF NOT EXISTS contas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credor_id UUID REFERENCES credores(id),
  descricao VARCHAR(200) NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  data_vencimento DATE,
  data_pagamento DATE,
  status_pago BOOLEAN DEFAULT false,
  categoria_id UUID REFERENCES categorias(id),
  conta_id UUID REFERENCES contas_bancarias(id),
  mes_referencia VARCHAR(7), -- Formato: MM/YYYY
  observacoes TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 7. Tabela de Transações
CREATE TABLE IF NOT EXISTS transacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL, -- 'receita' ou 'despesa'
  descricao VARCHAR(200) NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  data DATE NOT NULL,
  categoria_id UUID REFERENCES categorias(id),
  conta_id UUID REFERENCES contas_bancarias(id),
  divida_id UUID REFERENCES dividas(id),
  conta_consumo_id UUID REFERENCES contas(id),
  observacoes TEXT,
  recorrente BOOLEAN DEFAULT false,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 8. Tabela de Cartões de Crédito
CREATE TABLE IF NOT EXISTS cartoes_credito (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  numero_final VARCHAR(4),
  bandeira VARCHAR(50),
  limite_total DECIMAL(15,2) DEFAULT 0,
  limite_atual DECIMAL(15,2) DEFAULT 0,
  dia_vencimento INTEGER,
  dia_fechamento INTEGER,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 9. Tabela de Faturas de Cartão
CREATE TABLE IF NOT EXISTS cartao_faturas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cartao_id UUID REFERENCES cartoes_credito(id),
  mes_referencia VARCHAR(7) NOT NULL, -- Formato: MM/YYYY
  valor_total DECIMAL(15,2) DEFAULT 0,
  valor_minimo DECIMAL(15,2) DEFAULT 0,
  valor_pago DECIMAL(15,2) DEFAULT 0,
  vencimento DATE,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'aberta', -- 'aberta', 'fechada', 'paga', 'atrasada'
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 10. Tabela de Metas Financeiras
CREATE TABLE IF NOT EXISTS metas_financeiras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  valor_alvo DECIMAL(15,2) NOT NULL,
  valor_economizado DECIMAL(15,2) DEFAULT 0,
  prazo DATE,
  prioridade VARCHAR(20) DEFAULT 'media', -- 'alta', 'media', 'baixa'
  categoria VARCHAR(50), -- 'viagem', 'casa', 'carro', 'emergencia', 'investimento'
  concluida BOOLEAN DEFAULT false,
  data_conclusao DATE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 11. Tabela de Orçamentos
CREATE TABLE IF NOT EXISTS orcamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id UUID REFERENCES categorias(id) NOT NULL,
  valor_limite DECIMAL(15,2) NOT NULL,
  valor_gasto DECIMAL(15,2) DEFAULT 0,
  mes INTEGER NOT NULL, -- 1-12
  ano INTEGER NOT NULL,
  alerta_percentual INTEGER DEFAULT 80, -- Alertar quando atingir X% do orçamento
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(categoria_id, mes, ano),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 12. Tabela de Investimentos
CREATE TABLE IF NOT EXISTS investimentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL, -- 'acao', 'fiis', 'tesouro', 'cdb', 'cripto'
  nome VARCHAR(100) NOT NULL,
  ticker VARCHAR(20),
  quantidade DECIMAL(15,6) NOT NULL,
  preco_medio DECIMAL(15,2) NOT NULL,
  preco_atual DECIMAL(15,2),
  valor_total DECIMAL(15,2) DEFAULT 0,
  rentabilidade DECIMAL(10,4) DEFAULT 0,
  corretora VARCHAR(100),
  observacoes TEXT,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================
-- INSERÇÃO DE DADOS INICIAIS
-- ============================================

-- Categorias Padrão
INSERT INTO categorias (nome, icone, cor, tipo) VALUES
('Moradia', '🏠', '#1e40af', 'despesa'),
('Alimentação', '🍔', '#0891b2', 'despesa'),
('Transporte', '🚗', '#059669', 'despesa'),
('Saúde', '💊', '#dc2626', 'despesa'),
('Educação', '📚', '#7c3aed', 'despesa'),
('Lazer', '🎉', '#db2777', 'despesa'),
('Compras', '🛍️', '#ea580c', 'despesa'),
('Serviços', '🔧', '#6b7280', 'despesa'),
('Empréstimos', '💳', '#9333ea', 'despesa'),
('Impostos', '📄', '#b91c1c', 'despesa'),
('Salário', '💰', '#16a34a', 'receita'),
('Investimentos', '📈', '#0d9488', 'receita'),
('Extras', '🎁', '#f59e0b', 'receita'),
('Outros', '📁', '#6b7280', 'despesa');

-- Credores Padrão
INSERT INTO credores (nome, emoji, cor, tipo) VALUES
('Santander', '💳', '#ef4444', 'banco'),
('Nubank', '💳', '#820ad1', 'banco'),
('Mercado Pago', '💳', '#009ee3', 'banco'),
('Caixa', '🏦', '#00a650', 'banco'),
('Banco do Brasil', '🏦', '#005ca9', 'banco'),
('Enel', '⚡', '#00aeef', 'servico'),
('Sabesp', '💧', '#0066cc', 'servico'),
('Claro', '📱', '#cc0000', 'servico'),
('Vivo', '📱', '#003399', 'servico'),
('Tim', '📱', '#ffcc00', 'servico'),
('Net/Claro', '📺', '#cc0000', 'servico'),
('Supermercado', '🛒', '#00a650', 'mercado'),
('Posto', '⛽', '#ff6600', 'transporte'),
('Farmácia', '💊', '#00a650', 'saude');

-- ============================================
-- POLICY DE SEGURANÇA (RLS)
-- ============================================

-- Habilitar Row Level Security em todas as tabelas
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE credores ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartao_faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE investimentos ENABLE ROW LEVEL SECURITY;

-- Criar políticas para permitir acesso total (em produção, ajuste conforme autenticação)
DROP POLICY IF EXISTS "Acesso total às categorias" ON categorias;
CREATE POLICY "Acesso total às categorias" ON categorias
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Acesso total às contas bancárias" ON contas_bancarias;
CREATE POLICY "Acesso total às contas bancárias" ON contas_bancarias
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Acesso total aos credores" ON credores;
CREATE POLICY "Acesso total aos credores" ON credores
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Acesso total às receitas" ON receitas;
CREATE POLICY "Acesso total às receitas" ON receitas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Acesso total às dívidas" ON dividas;
CREATE POLICY "Acesso total às dívidas" ON dividas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Acesso total às contas" ON contas;
CREATE POLICY "Acesso total às contas" ON contas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Acesso total às transações" ON transacoes;
CREATE POLICY "Acesso total às transações" ON transacoes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Acesso total aos cartões" ON cartoes_credito;
CREATE POLICY "Acesso total aos cartões" ON cartoes_credito
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Acesso total às faturas" ON cartao_faturas;
CREATE POLICY "Acesso total às faturas" ON cartao_faturas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Acesso total às metas" ON metas_financeiras;
CREATE POLICY "Acesso total às metas" ON metas_financeiras
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Acesso total aos orçamentos" ON orcamentos;
CREATE POLICY "Acesso total aos orçamentos" ON orcamentos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Acesso total aos investimentos" ON investimentos;
CREATE POLICY "Acesso total aos investimentos" ON investimentos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes(data);
CREATE INDEX IF NOT EXISTS idx_transacoes_tipo ON transacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_transacoes_categoria ON transacoes(categoria_id);
CREATE INDEX IF NOT EXISTS idx_contas_vencimento ON contas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_dividas_vencimento ON dividas(dia_vencimento);
CREATE INDEX IF NOT EXISTS idx_metas_prazo ON metas_financeiras(prazo);
CREATE INDEX IF NOT EXISTS idx_orcamentos_mes_ano ON orcamentos(mes, ano);

-- ============================================
-- VIEW PARA RESUMO FINANCEIRO
-- ============================================

CREATE OR REPLACE VIEW resumo_financeiro AS
SELECT 
  COALESCE(SUM(CASE WHEN t.tipo = 'receita' THEN t.valor ELSE 0 END), 0) as total_receitas,
  COALESCE(SUM(CASE WHEN t.tipo = 'despesa' THEN t.valor ELSE 0 END), 0) as total_despesas,
  COALESCE(SUM(CASE WHEN t.tipo = 'receita' THEN t.valor ELSE -t.valor END), 0) as saldo
FROM transacoes t;

-- ============================================
-- FUNÇÃO PARA ATUALIZAR SALDO DA CONTA
-- ============================================

CREATE OR REPLACE FUNCTION atualizar_saldo_conta()
RETURNS TRIGGER AS $$
BEGIN
  -- Implementar lógica de atualização de saldo
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar saldo após transação
-- CREATE TRIGGER trigger_atualizar_saldo
--   AFTER INSERT OR UPDATE OR DELETE ON transacoes
--   FOR EACH ROW EXECUTE FUNCTION atualizar_saldo_conta();

-- ============================================
-- FIM DO SCRIPT
-- ============================================


-- ============================================
-- TRIGGER PARA PREENCHER USER_ID AUTOMATICAMENTE
-- ============================================

CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id := auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_user_id_categorias ON categorias;
CREATE TRIGGER set_user_id_categorias BEFORE INSERT ON categorias
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_contas_bancarias ON contas_bancarias;
CREATE TRIGGER set_user_id_contas_bancarias BEFORE INSERT ON contas_bancarias
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_credores ON credores;
CREATE TRIGGER set_user_id_credores BEFORE INSERT ON credores
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_receitas ON receitas;
CREATE TRIGGER set_user_id_receitas BEFORE INSERT ON receitas
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_dividas ON dividas;
CREATE TRIGGER set_user_id_dividas BEFORE INSERT ON dividas
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_contas ON contas;
CREATE TRIGGER set_user_id_contas BEFORE INSERT ON contas
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_transacoes ON transacoes;
CREATE TRIGGER set_user_id_transacoes BEFORE INSERT ON transacoes
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_cartoes_credito ON cartoes_credito;
CREATE TRIGGER set_user_id_cartoes_credito BEFORE INSERT ON cartoes_credito
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_cartao_faturas ON cartao_faturas;
CREATE TRIGGER set_user_id_cartao_faturas BEFORE INSERT ON cartao_faturas
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_metas_financeiras ON metas_financeiras;
CREATE TRIGGER set_user_id_metas_financeiras BEFORE INSERT ON metas_financeiras
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_orcamentos ON orcamentos;
CREATE TRIGGER set_user_id_orcamentos BEFORE INSERT ON orcamentos
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_investimentos ON investimentos;
CREATE TRIGGER set_user_id_investimentos BEFORE INSERT ON investimentos
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

-- ============================================
-- 13. Tabela de Inscrições de Push
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total às inscrições de push" ON push_subscriptions;
CREATE POLICY "Acesso total às inscrições de push" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_user_id_push_subscriptions ON push_subscriptions;
CREATE TRIGGER set_user_id_push_subscriptions BEFORE INSERT ON push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================
-- 14. CRON para disparo diário de Push
-- ============================================
-- Extensões necessárias para Cron Jobs e para o Vault (segurança)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- =================================================================================
-- ATENÇÃO: CONFIGURAÇÃO DE SEGURANÇA (SUPABASE VAULT)
-- Antes de ativar ou rodar este job, execute os seguintes comandos no SQL Editor
-- para salvar de forma segura a sua URL e a Service Role Key:
--
-- SELECT vault.create_secret('https://SEU_PROJETO_ID.supabase.co', 'supabase_project_url');
-- SELECT vault.create_secret('SUA_SERVICE_ROLE_KEY_AQUI', 'supabase_service_role_key');
-- =================================================================================

-- Remover o job antigo se existir, para evitar conflitos na recriação
SELECT cron.unschedule('enviar-notificacoes-push');

-- Criar a Job para executar a Edge Function diariamente as 8h da manhã
SELECT cron.schedule(
  'enviar-notificacoes-push',
  '0 8 * * *', -- Todos os dias as 08:00
  $$
  DO $do$
  DECLARE
    v_url text;
    v_key text;
  BEGIN
    -- Busca a URL base do projeto e a Service Role Key do Supabase Vault
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
  $$
);

-- ============================================
-- 15. HABILITAR REALTIME (SUBSCRIPTIONS)
-- ============================================
-- Adicionar as tabelas na publicação supabase_realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE categorias;
ALTER PUBLICATION supabase_realtime ADD TABLE contas_bancarias;
ALTER PUBLICATION supabase_realtime ADD TABLE credores;
ALTER PUBLICATION supabase_realtime ADD TABLE receitas;
ALTER PUBLICATION supabase_realtime ADD TABLE dividas;
ALTER PUBLICATION supabase_realtime ADD TABLE contas;
ALTER PUBLICATION supabase_realtime ADD TABLE transacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE cartoes_credito;
ALTER PUBLICATION supabase_realtime ADD TABLE cartao_faturas;
ALTER PUBLICATION supabase_realtime ADD TABLE metas_financeiras;
ALTER PUBLICATION supabase_realtime ADD TABLE orcamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE investimentos;
CREATE OR REPLACE FUNCTION lancar_gasto_cartao(
  p_valor_gasto DECIMAL(15,2),
  p_num_parcelas INTEGER,
  p_descricao_original VARCHAR,
  p_cartao_id UUID,
  p_cartao_nome VARCHAR,
  p_cartao_dia_fechamento INTEGER,
  p_cartao_dia_vencimento INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_categoria_id UUID;
  v_user_id UUID;
  i INTEGER;
  v_valor_fatura DECIMAL(15,2);
  v_descricao_tx VARCHAR;
  v_data_base DATE;
  v_data_vencimento_fatura DATE;
  v_data_venc_string DATE;
  v_mes_ano VARCHAR;
  v_descricao_fatura VARCHAR;
  v_fatura_id UUID;
  v_fatura_existente RECORD;
  v_mes_ajuste INTEGER;
  v_ano_ajuste INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- 1. Achar/criar categoria padrão para Cartão
  SELECT id INTO v_categoria_id FROM categorias WHERE nome = 'Cartão' AND user_id = v_user_id LIMIT 1;
  IF v_categoria_id IS NULL THEN
    INSERT INTO categorias (nome, tipo, cor, user_id) VALUES ('Cartão', 'despesa', '#ef4444', v_user_id) RETURNING id INTO v_categoria_id;
  END IF;

  v_data_base := CURRENT_DATE;

  FOR i IN 0..(p_num_parcelas - 1) LOOP
    IF p_num_parcelas > 1 THEN
      v_valor_fatura := ROUND((p_valor_gasto / p_num_parcelas), 2);
      v_descricao_tx := p_descricao_original || ' - Parcela ' || (i + 1) || '/' || p_num_parcelas;
    ELSE
      v_valor_fatura := p_valor_gasto;
      v_descricao_tx := p_descricao_original;
    END IF;

    -- Lógica de vencimento da fatura equivalente ao JS frontend
    IF p_cartao_dia_fechamento IS NOT NULL AND p_cartao_dia_vencimento IS NOT NULL THEN
      v_mes_ajuste := EXTRACT(MONTH FROM v_data_base)::integer + i;
      IF i = 0 AND EXTRACT(DAY FROM v_data_base)::integer >= p_cartao_dia_fechamento THEN
        v_mes_ajuste := v_mes_ajuste + 1;
      END IF;

      -- Ajustar ano se mês passar de 12
      v_ano_ajuste := EXTRACT(YEAR FROM v_data_base)::integer;

      WHILE v_mes_ajuste > 12 LOOP
        v_mes_ajuste := v_mes_ajuste - 12;
        v_ano_ajuste := v_ano_ajuste + 1;
      END LOOP;

      BEGIN
        v_data_vencimento_fatura := make_date(v_ano_ajuste, v_mes_ajuste, p_cartao_dia_vencimento);
      EXCEPTION WHEN OTHERS THEN
        v_data_vencimento_fatura := make_date(v_ano_ajuste, v_mes_ajuste, 1) + interval '1 month' - interval '1 day';
      END;

    ELSE
      v_data_vencimento_fatura := v_data_base + (i || ' month')::interval;
    END IF;

    v_data_venc_string := v_data_vencimento_fatura::DATE;
    v_mes_ano := lpad(EXTRACT(MONTH FROM v_data_vencimento_fatura)::text, 2, '0') || '/' || EXTRACT(YEAR FROM v_data_vencimento_fatura)::text;
    v_descricao_fatura := 'Fatura: ' || p_cartao_nome;

    -- Procurar Fatura Aberta no mês exato
    SELECT id, valor INTO v_fatura_existente
    FROM contas
    WHERE descricao = v_descricao_fatura
      AND status_pago = false
      AND EXTRACT(MONTH FROM data_vencimento) = EXTRACT(MONTH FROM v_data_vencimento_fatura)
      AND EXTRACT(YEAR FROM data_vencimento) = EXTRACT(YEAR FROM v_data_vencimento_fatura)
      AND user_id = v_user_id
    LIMIT 1;

    IF v_fatura_existente.id IS NOT NULL THEN
      UPDATE contas SET valor = valor + v_valor_fatura WHERE id = v_fatura_existente.id;
      v_fatura_id := v_fatura_existente.id;
    ELSE
      INSERT INTO contas (descricao, valor, data_vencimento, status_pago, categoria_id, mes_referencia, user_id)
      VALUES (v_descricao_fatura, v_valor_fatura, v_data_venc_string, false, v_categoria_id, v_mes_ano, v_user_id)
      RETURNING id INTO v_fatura_id;
    END IF;

    INSERT INTO transacoes (tipo, descricao, valor, data, categoria_id, cartao_id, conta_consumo_id, user_id)
    VALUES (
      'despesa',
      v_descricao_tx,
      v_valor_fatura,
      CASE WHEN p_num_parcelas > 1 THEN v_data_venc_string ELSE CURRENT_DATE END,
      v_categoria_id,
      p_cartao_id,
      v_fatura_id,
      v_user_id
    );

  END LOOP;
END;
$$;
