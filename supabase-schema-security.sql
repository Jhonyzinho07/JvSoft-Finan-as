-- =====================================================
-- SCRIPT DE SEGURANÇA E ISOLAMENTO DE DADOS - JvSoft
-- =====================================================
-- Este script garante que cada usuário acesse APENAS seus próprios dados
-- através de Row Level Security (RLS) no Supabase.
-- =====================================================

-- 1. Habilitar extensão UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 2. ALTERAR TABELAS EXISTENTES PARA ADICIONAR user_id
-- =====================================================

-- Função para adicionar coluna user_id se não existir
DO $$
BEGIN
    -- Tabela: categorias
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categorias' AND column_name = 'user_id') THEN
        ALTER TABLE categorias ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: contas_bancarias
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contas_bancarias' AND column_name = 'user_id') THEN
        ALTER TABLE contas_bancarias ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: credores
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credores' AND column_name = 'user_id') THEN
        ALTER TABLE credores ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: receitas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receitas' AND column_name = 'user_id') THEN
        ALTER TABLE receitas ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: dividas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dividas' AND column_name = 'user_id') THEN
        ALTER TABLE dividas ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: contas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contas' AND column_name = 'user_id') THEN
        ALTER TABLE contas ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: transacoes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes' AND column_name = 'user_id') THEN
        ALTER TABLE transacoes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: cartoes_credito
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cartoes_credito' AND column_name = 'user_id') THEN
        ALTER TABLE cartoes_credito ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: cartao_faturas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cartao_faturas' AND column_name = 'user_id') THEN
        ALTER TABLE cartao_faturas ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: metas_financeiras
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'metas_financeiras' AND column_name = 'user_id') THEN
        ALTER TABLE metas_financeiras ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: orcamentos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamentos' AND column_name = 'user_id') THEN
        ALTER TABLE orcamentos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: investimentos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investimentos' AND column_name = 'user_id') THEN
        ALTER TABLE investimentos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 3. HABILITAR ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- =====================================================

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

-- =====================================================
-- 4. CRIAR POLÍTICAS DE SEGURANÇA
-- =====================================================

-- Política genérica: Usuário só vê/altera seus próprios dados
-- Para todas as tabelas com user_id

-- CATEGORIAS
DROP POLICY IF EXISTS "Usuários veem apenas suas categorias" ON categorias;
CREATE POLICY "Usuários veem apenas suas categorias"
    ON categorias FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- CONTAS BANCÁRIAS
DROP POLICY IF EXISTS "Usuários veem apenas suas contas bancárias" ON contas_bancarias;
CREATE POLICY "Usuários veem apenas suas contas bancárias"
    ON contas_bancarias FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- CREDORES
DROP POLICY IF EXISTS "Usuários veem apenas seus credores" ON credores;
CREATE POLICY "Usuários veem apenas seus credores"
    ON credores FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- RECEITAS
DROP POLICY IF EXISTS "Usuários veem apenas suas receitas" ON receitas;
CREATE POLICY "Usuários veem apenas suas receitas"
    ON receitas FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- DÍVIDAS
DROP POLICY IF EXISTS "Usuários veem apenas suas dívidas" ON dividas;
CREATE POLICY "Usuários veem apenas suas dívidas"
    ON dividas FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- CONTAS A PAGAR
DROP POLICY IF EXISTS "Usuários veem apenas suas contas" ON contas;
CREATE POLICY "Usuários veem apenas suas contas"
    ON contas FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- TRANSAÇÕES
DROP POLICY IF EXISTS "Usuários veem apenas suas transações" ON transacoes;
CREATE POLICY "Usuários veem apenas suas transações"
    ON transacoes FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- CARTÕES DE CRÉDITO
DROP POLICY IF EXISTS "Usuários veem apenas seus cartões" ON cartoes_credito;
CREATE POLICY "Usuários veem apenas seus cartões"
    ON cartoes_credito FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- FATURAS DE CARTÃO
DROP POLICY IF EXISTS "Usuários veem apenas suas faturas" ON cartao_faturas;
CREATE POLICY "Usuários veem apenas suas faturas"
    ON cartao_faturas FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- METAS FINANCEIRAS
DROP POLICY IF EXISTS "Usuários veem apenas suas metas" ON metas_financeiras;
CREATE POLICY "Usuários veem apenas suas metas"
    ON metas_financeiras FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ORÇAMENTOS
DROP POLICY IF EXISTS "Usuários veem apenas seus orçamentos" ON orcamentos;
CREATE POLICY "Usuários veem apenas seus orçamentos"
    ON orcamentos FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- INVESTIMENTOS
DROP POLICY IF EXISTS "Usuários veem apenas seus investimentos" ON investimentos;
CREATE POLICY "Usuários veem apenas seus investimentos"
    ON investimentos FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 5. CRIAR TRIGGERS PARA PREENCHIMENTO AUTOMÁTICO DO user_id
-- =====================================================

-- Função para setar user_id automaticamente em INSERT
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id := auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar triggers em todas as tabelas
DROP TRIGGER IF EXISTS set_user_id_categorias ON categorias;
CREATE TRIGGER set_user_id_categorias
    BEFORE INSERT ON categorias
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_contas_bancarias ON contas_bancarias;
CREATE TRIGGER set_user_id_contas_bancarias
    BEFORE INSERT ON contas_bancarias
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_credores ON credores;
CREATE TRIGGER set_user_id_credores
    BEFORE INSERT ON credores
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_receitas ON receitas;
CREATE TRIGGER set_user_id_receitas
    BEFORE INSERT ON receitas
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_dividas ON dividas;
CREATE TRIGGER set_user_id_dividas
    BEFORE INSERT ON dividas
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_contas ON contas;
CREATE TRIGGER set_user_id_contas
    BEFORE INSERT ON contas
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_transacoes ON transacoes;
CREATE TRIGGER set_user_id_transacoes
    BEFORE INSERT ON transacoes
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_cartoes_credito ON cartoes_credito;
CREATE TRIGGER set_user_id_cartoes_credito
    BEFORE INSERT ON cartoes_credito
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_cartao_faturas ON cartao_faturas;
CREATE TRIGGER set_user_id_cartao_faturas
    BEFORE INSERT ON cartao_faturas
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_metas_financeiras ON metas_financeiras;
CREATE TRIGGER set_user_id_metas_financeiras
    BEFORE INSERT ON metas_financeiras
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_orcamentos ON orcamentos;
CREATE TRIGGER set_user_id_orcamentos
    BEFORE INSERT ON orcamentos
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_investimentos ON investimentos;
CREATE TRIGGER set_user_id_investimentos
    BEFORE INSERT ON investimentos
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

-- =====================================================
-- 6. ATUALIZAR REGISTROS EXISTENTES PARA O USUÁRIO ATUAL
-- =====================================================
-- Nota: Isso só funciona se já houver um usuário logado
-- Para dados existentes sem user_id, será necessário atualizar manualmente
-- ou o trigger cuidará dos novos registros

-- =====================================================
-- 7. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_categorias_user_id ON categorias(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_user_id ON contas_bancarias(user_id);
CREATE INDEX IF NOT EXISTS idx_credores_user_id ON credores(user_id);
CREATE INDEX IF NOT EXISTS idx_receitas_user_id ON receitas(user_id);
CREATE INDEX IF NOT EXISTS idx_dividas_user_id ON dividas(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_user_id ON contas(user_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_user_id ON transacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_cartoes_credito_user_id ON cartoes_credito(user_id);
CREATE INDEX IF NOT EXISTS idx_cartao_faturas_user_id ON cartao_faturas(user_id);
CREATE INDEX IF NOT EXISTS idx_metas_financeiras_user_id ON metas_financeiras(user_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_user_id ON orcamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_investimentos_user_id ON investimentos(user_id);

-- =====================================================
-- FIM DO SCRIPT DE SEGURANÇA
-- =====================================================
