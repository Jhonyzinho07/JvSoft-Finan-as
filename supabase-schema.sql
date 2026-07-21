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
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Contas Bancárias
CREATE TABLE IF NOT EXISTS contas_bancarias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) DEFAULT 'corrente', -- 'corrente', 'poupanca', 'investimento', 'carteira'
  saldo_inicial DECIMAL(15,2) DEFAULT 0,
  instituicao VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Credores
CREATE TABLE IF NOT EXISTS credores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  emoji VARCHAR(10) DEFAULT '💰',
  cor VARCHAR(7) DEFAULT '#6b7280',
  tipo VARCHAR(50) DEFAULT 'outro',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  UNIQUE(categoria_id, mes, ano)
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
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
CREATE POLICY "Acesso total às categorias" ON categorias FOR ALL USING (true);
CREATE POLICY "Acesso total às contas bancárias" ON contas_bancarias FOR ALL USING (true);
CREATE POLICY "Acesso total aos credores" ON credores FOR ALL USING (true);
CREATE POLICY "Acesso total às receitas" ON receitas FOR ALL USING (true);
CREATE POLICY "Acesso total às dívidas" ON dividas FOR ALL USING (true);
CREATE POLICY "Acesso total às contas" ON contas FOR ALL USING (true);
CREATE POLICY "Acesso total às transações" ON transacoes FOR ALL USING (true);
CREATE POLICY "Acesso total aos cartões" ON cartoes_credito FOR ALL USING (true);
CREATE POLICY "Acesso total às faturas" ON cartao_faturas FOR ALL USING (true);
CREATE POLICY "Acesso total às metas" ON metas_financeiras FOR ALL USING (true);
CREATE POLICY "Acesso total aos orçamentos" ON orcamentos FOR ALL USING (true);
CREATE POLICY "Acesso total aos investimentos" ON investimentos FOR ALL USING (true);

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
