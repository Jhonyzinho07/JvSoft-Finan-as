-- Remove políticas redundantes (resíduo de múltiplos scripts SQL aplicados ao
-- longo do tempo). Mantém uma política funcionalmente idêntica por tabela.
DROP POLICY IF EXISTS "Acesso total do usuario" ON public.cartoes;
DROP POLICY IF EXISTS "Privacidade Cartoes" ON public.cartoes;

DROP POLICY IF EXISTS "Acesso total do usuario" ON public.categorias;

DROP POLICY IF EXISTS "Acesso total do usuario" ON public.metas;
DROP POLICY IF EXISTS "Privacidade Metas" ON public.metas;

DROP POLICY IF EXISTS "Acesso total do usuario" ON public.orcamentos;

DROP POLICY IF EXISTS "Acesso total do usuario" ON public.transacoes;
DROP POLICY IF EXISTS "Privacidade Transacoes" ON public.transacoes;
