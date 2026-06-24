-- ============================================================
-- CONFIGURAÇÃO DE STORAGE PARA IMAGENS DE PRODUTOS
-- ============================================================
-- 
-- Execute este script no Supabase SQL Editor para configurar
-- o acesso público às imagens de produtos
--
-- Caminho: Dashboard > SQL Editor > New query > Cole e Execute
-- ============================================================

-- 1. CRIAR BUCKET (se não existir)
-- Nota: Você também pode criar via Dashboard > Storage > New bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true, -- PÚBLICO
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- ============================================================
-- 2. POLÍTICAS RLS - Permitir leitura pública
-- ============================================================

-- Remover política antiga (se existir)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Leitura Pública - product-images" ON storage.objects;

-- Criar política de LEITURA pública
CREATE POLICY "Leitura Pública - product-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- ============================================================
-- 3. POLÍTICAS RLS - Permitir upload autenticado
-- ============================================================

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Upload autenticado - product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;

-- Criar política de UPLOAD para usuários autenticados
CREATE POLICY "Upload autenticado - product-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- ============================================================
-- 4. POLÍTICAS RLS - Permitir atualização autenticada
-- ============================================================

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Update autenticado - product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;

-- Criar política de UPDATE para usuários autenticados
CREATE POLICY "Update autenticado - product-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- ============================================================
-- 5. POLÍTICAS RLS - Permitir deleção autenticada
-- ============================================================

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Delete autenticado - product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- Criar política de DELETE para usuários autenticados
CREATE POLICY "Delete autenticado - product-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

-- Verificar se o bucket foi criado e está público
SELECT 
  id, 
  name, 
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'product-images';

-- Listar todas as políticas do bucket
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects'
  AND policyname ILIKE '%product-images%'
ORDER BY policyname;

-- ============================================================
-- TESTE FINAL
-- ============================================================
-- 
-- Após executar este script:
-- 1. Volte para a aplicação
-- 2. Tente fazer upload de uma imagem
-- 3. A imagem deve aparecer imediatamente
-- 4. Verifique o console - deve mostrar: "✅ Imagem acessível e carregando corretamente!"
--
-- Se ainda não funcionar, verifique:
-- - Sua conexão com o Supabase
-- - As credenciais no arquivo .env
-- - Se o projeto Supabase está ativo
-- ============================================================
