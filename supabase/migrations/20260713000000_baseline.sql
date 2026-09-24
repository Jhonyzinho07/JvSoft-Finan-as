-- =====================================================================
-- BASELINE: estrutura que já existia no banco antes das migrations
-- versionadas (as tabelas foram criadas pelo SQL Editor).
--
-- Reconstruída a partir do catálogo do banco de produção em 2026-09-24.
-- Em produção esta versão é marcada como "já aplicada" — ela só roda de
-- verdade em bancos novos (branches de preview / ambiente local).
-- Tudo é idempotente (IF NOT EXISTS / CREATE OR REPLACE).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ── Tabelas ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.categorias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL,
  icone text,
  cor text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT categorias_tipo_check CHECK ((tipo = ANY (ARRAY['receita'::text, 'despesa'::text]))),
  CONSTRAINT categorias_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.credores (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  nome text NOT NULL,
  emoji text,
  cor text DEFAULT '#3b82f6'::text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id uuid,
  CONSTRAINT credores_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  saldo_inicial numeric(15,2) DEFAULT 0,
  instituicao text,
  tipo text DEFAULT 'corrente'::text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT contas_bancarias_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.receitas (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL,
  dia_recebimento integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id uuid,
  CONSTRAINT receitas_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.cartoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  limite numeric DEFAULT 0 NOT NULL,
  fatura_atual numeric DEFAULT 0 NOT NULL,
  dia_fechamento integer NOT NULL,
  dia_vencimento integer NOT NULL,
  cor text DEFAULT '#1e40af'::text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  user_id uuid DEFAULT auth.uid(),
  CONSTRAINT cartoes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.metas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  titulo text NOT NULL,
  valor_objetivo numeric NOT NULL,
  valor_atual numeric DEFAULT 0,
  data_limite date,
  cor text DEFAULT '#3b82f6'::text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  user_id uuid DEFAULT auth.uid(),
  icone text,
  CONSTRAINT metas_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.metas_financeiras (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  nome text NOT NULL,
  valor_alvo numeric(15,2) NOT NULL,
  valor_atual numeric(15,2) DEFAULT 0,
  prazo date,
  prioridade text DEFAULT 'media'::text,
  criada_em timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT metas_financeiras_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.transacoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  descricao text NOT NULL,
  valor numeric(15,2) NOT NULL,
  tipo text NOT NULL,
  categoria_id uuid,
  data_transacao date DEFAULT CURRENT_DATE NOT NULL,
  paga boolean DEFAULT false,
  conta_id uuid,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  cartao_id uuid,
  conta_vinculada_id uuid,
  CONSTRAINT transacoes_tipo_check CHECK ((tipo = ANY (ARRAY['receita'::text, 'despesa'::text]))),
  CONSTRAINT transacoes_pkey PRIMARY KEY (id)
);

COMMENT ON COLUMN public.transacoes.conta_vinculada_id IS
  'ID da conta (tabela contas) ou dívida (tabela dividas) que originou esta transação via pagamento em Contas a Pagar.';

CREATE TABLE IF NOT EXISTS public.contas (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  credor_id uuid,
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL,
  data_vencimento date,
  status_pago boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  dia_vencimento integer DEFAULT 10,
  categoria_id uuid,
  user_id uuid DEFAULT auth.uid(),
  status text DEFAULT 'pendente'::text,
  id_parcelamento uuid,
  numero_parcela integer,
  total_parcelas integer,
  transacao_id uuid,
  CONSTRAINT contas_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.dividas (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  credor_id uuid,
  descricao text NOT NULL,
  valor_parcela numeric(10,2) NOT NULL,
  parcelas_restantes integer NOT NULL,
  dia_vencimento integer,
  valor_total numeric(10,2),
  observacao text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  status text DEFAULT 'pendente'::text,
  transacao_id uuid,
  user_id uuid,
  CONSTRAINT dividas_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.orcamentos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  categoria_id uuid,
  limite_mensal numeric(15,2) NOT NULL,
  mes integer,
  ano integer,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT orcamentos_pkey PRIMARY KEY (id)
);

-- ── Foreign keys ─────────────────────────────────────────────────────

DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN SELECT * FROM (VALUES
    ('cartoes',           'cartoes_user_id_fkey',           'FOREIGN KEY (user_id) REFERENCES auth.users(id)'),
    ('categorias',        'categorias_user_id_fkey',        'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('contas_bancarias',  'contas_bancarias_user_id_fkey',  'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('contas',            'contas_categoria_id_fkey',       'FOREIGN KEY (categoria_id) REFERENCES public.categorias(id)'),
    ('contas',            'contas_credor_id_fkey',          'FOREIGN KEY (credor_id) REFERENCES public.credores(id) ON DELETE SET NULL'),
    ('contas',            'contas_transacao_id_fkey',       'FOREIGN KEY (transacao_id) REFERENCES public.transacoes(id) ON DELETE SET NULL'),
    ('contas',            'contas_user_id_fkey',            'FOREIGN KEY (user_id) REFERENCES auth.users(id)'),
    ('credores',          'credores_user_id_fkey',          'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('dividas',           'dividas_credor_id_fkey',         'FOREIGN KEY (credor_id) REFERENCES public.credores(id) ON DELETE CASCADE'),
    ('dividas',           'dividas_transacao_id_fkey',      'FOREIGN KEY (transacao_id) REFERENCES public.transacoes(id) ON DELETE SET NULL'),
    ('dividas',           'dividas_user_id_fkey',           'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('metas_financeiras', 'metas_financeiras_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('metas',             'metas_user_id_fkey',             'FOREIGN KEY (user_id) REFERENCES auth.users(id)'),
    ('orcamentos',        'orcamentos_categoria_id_fkey',   'FOREIGN KEY (categoria_id) REFERENCES public.categorias(id)'),
    ('orcamentos',        'orcamentos_user_id_fkey',        'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('receitas',          'receitas_user_id_fkey',          'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('transacoes',        'transacoes_cartao_id_fkey',      'FOREIGN KEY (cartao_id) REFERENCES public.cartoes(id)'),
    ('transacoes',        'transacoes_categoria_id_fkey',   'FOREIGN KEY (categoria_id) REFERENCES public.categorias(id)'),
    ('transacoes',        'transacoes_conta_id_fkey',       'FOREIGN KEY (conta_id) REFERENCES public.contas_bancarias(id)'),
    ('transacoes',        'transacoes_user_id_fkey',        'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE')
  ) AS t(tabela, nome, def)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk.nome) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', fk.tabela, fk.nome, fk.def);
    END IF;
  END LOOP;
END $$;

-- ── Índices ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dividas_user_id ON public.dividas USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_conta_vinculada ON public.transacoes USING btree (conta_vinculada_id) WHERE (conta_vinculada_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_contas_data_vencimento ON public.contas USING btree (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_metas_user_id ON public.metas USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_cartoes_user_id ON public.cartoes USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_receitas_user_id ON public.receitas USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_contas_id_parcelamento ON public.contas USING btree (id_parcelamento);
CREATE INDEX IF NOT EXISTS idx_credores_user_id ON public.credores USING btree (user_id);

-- ── Funções ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    NEW.user_id := auth.uid();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    NEW.user_id := auth.uid();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_parcelamento(p_descricao text, p_valor_total numeric, p_total_parcelas integer, p_data_inicio date, p_categoria_id uuid DEFAULT NULL::uuid, p_credor_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_id_parcelamento UUID := gen_random_uuid();
  v_valor_parcela NUMERIC;
  v_soma_parcial NUMERIC := 0;
  v_valor_linha NUMERIC;
  v_data DATE;
  i INT;
BEGIN
  IF p_total_parcelas < 1 THEN
    RAISE EXCEPTION 'Número de parcelas deve ser pelo menos 1';
  END IF;

  -- Arredonda para baixo em centavos; a diferença acumulada
  -- (por causa de dízimas tipo 1000/3) vai inteira na última parcela,
  -- garantindo que a soma das parcelas bate exatamente com o valor total.
  v_valor_parcela := TRUNC(p_valor_total / p_total_parcelas, 2);

  FOR i IN 1..p_total_parcelas LOOP
    v_data := p_data_inicio + (INTERVAL '1 month' * (i - 1));

    IF i = p_total_parcelas THEN
      v_valor_linha := p_valor_total - v_soma_parcial;
    ELSE
      v_valor_linha := v_valor_parcela;
      v_soma_parcial := v_soma_parcial + v_valor_parcela;
    END IF;

    INSERT INTO contas (
      descricao, valor, data_vencimento, dia_vencimento,
      categoria_id, credor_id, status_pago,
      id_parcelamento, numero_parcela, total_parcelas
    ) VALUES (
      p_descricao, v_valor_linha, v_data, EXTRACT(DAY FROM v_data)::INT,
      p_categoria_id, p_credor_id, false,
      v_id_parcelamento, i, p_total_parcelas
    );
  END LOOP;

  RETURN v_id_parcelamento;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancelar_parcelamento(p_id_parcelamento uuid, p_apagar_pagas boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF p_apagar_pagas THEN
    DELETE FROM contas WHERE id_parcelamento = p_id_parcelamento;
  ELSE
    -- Por padrão, preserva o histórico do que já foi pago
    DELETE FROM contas WHERE id_parcelamento = p_id_parcelamento AND status_pago = false;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_categorias_padrao_novo_usuario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO categorias (user_id, nome, tipo, icone, cor) VALUES
    -- Despesas
    (NEW.id, 'Moradia',      'despesa', '🏠', '#3b82f6'),
    (NEW.id, 'Saúde',        'despesa', '💊', '#ef4444'),
    (NEW.id, 'Educação',     'despesa', '📚', '#06b6d4'),
    (NEW.id, 'Lazer',        'despesa', '🎉', '#8b5cf6'),
    (NEW.id, 'Compras',      'despesa', '🛍️', '#ec4899'),
    (NEW.id, 'Cartão',       'despesa', '💳', '#1e40af'),
    (NEW.id, 'Empréstimo',   'despesa', null, null),
    (NEW.id, 'Mercado',      'despesa', '🍔', '#f59e0b'),
    (NEW.id, 'Fast Food',    'despesa', null, null),
    (NEW.id, 'Investimento', 'despesa', null, null),
    (NEW.id, 'Outros',       'despesa', '🛒', '#64748b'),
    (NEW.id, 'Gasolina',     'despesa', '🚗', '#10b981'),
    -- Receitas
    (NEW.id, 'Renda Extra',   'receita', '✨', '#f59e0b'),
    (NEW.id, 'Investimentos', 'receita', '📈', '#3b82f6'),
    (NEW.id, 'Empréstimo',    'receita', null, null),
    (NEW.id, 'Outros',        'receita', '➕', '#64748b'),
    (NEW.id, 'Salário',       'receita', null, null)
  ON CONFLICT (user_id, nome, tipo) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ── Triggers ─────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created_categorias ON auth.users;
CREATE TRIGGER on_auth_user_created_categorias AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.criar_categorias_padrao_novo_usuario();

DROP TRIGGER IF EXISTS set_user_id_cartoes ON public.cartoes;
CREATE TRIGGER set_user_id_cartoes BEFORE INSERT ON public.cartoes FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
DROP TRIGGER IF EXISTS set_user_id_categorias ON public.categorias;
CREATE TRIGGER set_user_id_categorias BEFORE INSERT ON public.categorias FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
DROP TRIGGER IF EXISTS set_user_id_contas ON public.contas;
CREATE TRIGGER set_user_id_contas BEFORE INSERT ON public.contas FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
DROP TRIGGER IF EXISTS set_user_id_contas ON public.contas_bancarias;
CREATE TRIGGER set_user_id_contas BEFORE INSERT ON public.contas_bancarias FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
DROP TRIGGER IF EXISTS set_user_id_credores ON public.credores;
CREATE TRIGGER set_user_id_credores BEFORE INSERT ON public.credores FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
DROP TRIGGER IF EXISTS set_user_id_dividas ON public.dividas;
CREATE TRIGGER set_user_id_dividas BEFORE INSERT ON public.dividas FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
DROP TRIGGER IF EXISTS set_user_id_metas ON public.metas;
CREATE TRIGGER set_user_id_metas BEFORE INSERT ON public.metas FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
DROP TRIGGER IF EXISTS set_user_id_metas ON public.metas_financeiras;
CREATE TRIGGER set_user_id_metas BEFORE INSERT ON public.metas_financeiras FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
DROP TRIGGER IF EXISTS set_user_id_orcamentos ON public.orcamentos;
CREATE TRIGGER set_user_id_orcamentos BEFORE INSERT ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
DROP TRIGGER IF EXISTS set_user_id_receitas ON public.receitas;
CREATE TRIGGER set_user_id_receitas BEFORE INSERT ON public.receitas FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
DROP TRIGGER IF EXISTS set_user_id_transacoes ON public.transacoes;
CREATE TRIGGER set_user_id_transacoes BEFORE INSERT ON public.transacoes FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

-- ── Row Level Security ───────────────────────────────────────────────

ALTER TABLE public.categorias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_bancarias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem apenas seus cartões (cartoes)" ON public.cartoes;
CREATE POLICY "Usuários veem apenas seus cartões (cartoes)" ON public.cartoes AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Usuários veem apenas suas categorias" ON public.categorias;
CREATE POLICY "Usuários veem apenas suas categorias" ON public.categorias AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Privacidade Contas" ON public.contas;
CREATE POLICY "Privacidade Contas" ON public.contas AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Usuarios veem apenas suas contas" ON public.contas_bancarias;
CREATE POLICY "Usuarios veem apenas suas contas" ON public.contas_bancarias AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Usuários veem apenas seus credores (credores)" ON public.credores;
CREATE POLICY "Usuários veem apenas seus credores (credores)" ON public.credores AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Usuários veem apenas suas dívidas (dividas)" ON public.dividas;
CREATE POLICY "Usuários veem apenas suas dívidas (dividas)" ON public.dividas AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Usuários veem apenas suas metas (metas)" ON public.metas;
CREATE POLICY "Usuários veem apenas suas metas (metas)" ON public.metas AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Usuarios veem apenas suas metas" ON public.metas_financeiras;
CREATE POLICY "Usuarios veem apenas suas metas" ON public.metas_financeiras AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Usuarios veem apenas seus orçamentos" ON public.orcamentos;
CREATE POLICY "Usuarios veem apenas seus orçamentos" ON public.orcamentos AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Usuários veem apenas suas receitas" ON public.receitas;
CREATE POLICY "Usuários veem apenas suas receitas" ON public.receitas AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Usuarios veem apenas suas transacoes" ON public.transacoes;
CREATE POLICY "Usuarios veem apenas suas transacoes" ON public.transacoes AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
