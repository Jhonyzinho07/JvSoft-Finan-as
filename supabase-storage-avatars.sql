-- =====================================================================
-- MIGRATION: Bucket de avatares no Supabase Storage
-- =====================================================================
-- Necessário para o upload de foto de perfil em Configurações.
-- Execute no SQL Editor do Supabase.
-- =====================================================================

-- 1. Cria o bucket público "avatars" (se ainda não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 3145728, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- 2. Qualquer pessoa pode VISUALIZAR os avatares (é uma foto de perfil pública)
CREATE POLICY IF NOT EXISTS "Avatares são publicamente visíveis"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- 3. Um usuário só pode enviar/atualizar/excluir arquivos dentro da SUA
--    própria pasta (o app salva em "<user_id>/avatar.<ext>")
CREATE POLICY IF NOT EXISTS "Usuários enviam apenas seu próprio avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "Usuários atualizam apenas seu próprio avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "Usuários excluem apenas seu próprio avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
