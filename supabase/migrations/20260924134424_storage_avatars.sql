-- Bucket de avatares (foto de perfil em Configurações). Idempotente:
-- reproduz exatamente o que já existe em produção.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 3145728, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatares são publicamente visíveis" ON storage.objects;
CREATE POLICY "Avatares são publicamente visíveis"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- O app salva em "<user_id>/avatar.<ext>": cada usuário só mexe na própria pasta
DROP POLICY IF EXISTS "Usuários enviam apenas seu próprio avatar" ON storage.objects;
CREATE POLICY "Usuários enviam apenas seu próprio avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Usuários atualizam apenas seu próprio avatar" ON storage.objects;
CREATE POLICY "Usuários atualizam apenas seu próprio avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Usuários excluem apenas seu próprio avatar" ON storage.objects;
CREATE POLICY "Usuários excluem apenas seu próprio avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
