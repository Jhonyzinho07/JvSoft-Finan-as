CREATE TABLE IF NOT EXISTS public.termos_aceites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  versao_termos text NOT NULL DEFAULT '1.0',
  aceito_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.termos_aceites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus próprios aceites"
  ON public.termos_aceites
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários registram seu próprio aceite"
  ON public.termos_aceites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
