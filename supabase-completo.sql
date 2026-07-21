-- ==========================================================
-- SCRIPT MESTRE: CRIAÇÃO, SEGURANÇA E RLS
-- Execute este script INTEIRO no SQL Editor do Supabase
-- ==========================================================

-- 1. CRIAÇÃO DAS TABELAS (Se não existirem)
-- Tabela: Categorias
CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('receita', 'despesa')) NOT NULL,
    icone TEXT,
    cor TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: Contas Bancárias
CREATE TABLE IF NOT EXISTS contas_bancarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    saldo_inicial DECIMAL(15,2) DEFAULT 0,
    instituicao TEXT,
    tipo TEXT DEFAULT 'corrente',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: Metas Financeiras
CREATE TABLE IF NOT EXISTS metas_financeiras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    valor_alvo DECIMAL(15,2) NOT NULL,
    valor_atual DECIMAL(15,2) DEFAULT 0,
    prazo DATE,
    prioridade TEXT DEFAULT 'media',
    criada_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: Orçamentos
CREATE TABLE IF NOT EXISTS orcamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id UUID REFERENCES categorias(id),
    limite_mensal DECIMAL(15,2) NOT NULL,
    mes INTEGER,
    ano INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: Transações (Principal)
CREATE TABLE IF NOT EXISTS transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    descricao TEXT NOT NULL,
    valor DECIMAL(15,2) NOT NULL,
    tipo TEXT CHECK (tipo IN ('receita', 'despesa')) NOT NULL,
    categoria_id UUID REFERENCES categorias(id),
    data_transacao DATE NOT NULL DEFAULT CURRENT_DATE,
    paga BOOLEAN DEFAULT FALSE,
    conta_id UUID REFERENCES contas_bancarias(id),
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ADICIONAR COLUNA USER_ID E HABILITAR RLS
-- Função auxiliar para adicionar colunas com segurança
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Lista de tabelas que precisam de user_id
    FOR r IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('categorias', 'contas_bancarias', 'metas_financeiras', 'orcamentos', 'transacoes')
    LOOP
        -- Adiciona coluna user_id se não existir
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE', r.tablename);
        
        -- Habilita RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

-- 3. CRIAR POLÍTICAS DE SEGURANÇA (RLS)
-- Política Genérica: Usuário só vê/edita seus próprios dados

-- Políticas para Categorias
DROP POLICY IF EXISTS "Usuarios veem apenas suas categorias" ON categorias;
CREATE POLICY "Usuarios veem apenas suas categorias" ON categorias
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas para Contas Bancárias
DROP POLICY IF EXISTS "Usuarios veem apenas suas contas" ON contas_bancarias;
CREATE POLICY "Usuarios veem apenas suas contas" ON contas_bancarias
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas para Metas
DROP POLICY IF EXISTS "Usuarios veem apenas suas metas" ON metas_financeiras;
CREATE POLICY "Usuarios veem apenas suas metas" ON metas_financeiras
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas para Orçamentos
DROP POLICY IF EXISTS "Usuarios veem apenas seus orçamentos" ON orcamentos;
CREATE POLICY "Usuarios veem apenas seus orçamentos" ON orcamentos
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Políticas para Transações
DROP POLICY IF EXISTS "Usuarios veem apenas suas transacoes" ON transacoes;
CREATE POLICY "Usuarios veem apenas suas transacoes" ON transacoes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. CRIAR TRIGGER PARA PREENCHER USER_ID AUTOMATICAMENTE
-- Função Trigger
CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id := auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar Trigger nas tabelas
DROP TRIGGER IF EXISTS set_user_id_categorias ON categorias;
CREATE TRIGGER set_user_id_categorias BEFORE INSERT ON categorias
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_contas ON contas_bancarias;
CREATE TRIGGER set_user_id_contas BEFORE INSERT ON contas_bancarias
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_metas ON metas_financeiras;
CREATE TRIGGER set_user_id_metas BEFORE INSERT ON metas_financeiras
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_orcamentos ON orcamentos;
CREATE TRIGGER set_user_id_orcamentos BEFORE INSERT ON orcamentos
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_user_id_transacoes ON transacoes;
CREATE TRIGGER set_user_id_transacoes BEFORE INSERT ON transacoes
    FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();

-- 5. DADOS INICIAIS (SEED) - Opcional, cria categorias padrão
INSERT INTO categorias (nome, tipo, icone, cor) VALUES
    ('Salário', 'receita', 'Wallet', '#10B981'),
    ('Freelance', 'receita', 'Briefcase', '#3B82F6'),
    ('Investimentos', 'receita', 'TrendingUp', '#8B5CF6'),
    ('Alimentação', 'despesa', 'Utensils', '#EF4444'),
    ('Moradia', 'despesa', 'Home', '#F59E0B'),
    ('Transporte', 'despesa', 'Car', '#3B82F6'),
    ('Lazer', 'despesa', 'Smile', '#EC4899'),
    ('Saúde', 'despesa', 'Heart', '#EF4444'),
    ('Educação', 'despesa', 'BookOpen', '#6366F1')
ON CONFLICT DO NOTHING; -- Evita duplicatas se rodar múltiplas vezes

-- ==========================================================
-- FIM DO SCRIPT
-- Seu banco agora está seguro e isolado por usuário!
-- ==========================================================
