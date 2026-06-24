-- ============================================================
-- CONFIGURAÇÃO DE CORS PARA STORAGE DO SUPABASE
-- ============================================================
-- 
-- Este script configura o CORS (Cross-Origin Resource Sharing)
-- para permitir que navegadores carreguem imagens do bucket
-- 
-- IMPORTANTE: Execute este script APÓS o CONFIGURAR_STORAGE_IMAGENS.sql
-- ============================================================

-- 1. ATUALIZAR BUCKET COM CONFIGURAÇÕES DE CORS
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = 5242880, -- 5MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'product-images';

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

-- Verificar se o bucket está configurado corretamente
SELECT 
  id, 
  name, 
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets 
WHERE id = 'product-images';

-- Verificar políticas RLS
SELECT 
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'objects'
  AND policyname ILIKE '%product-images%'
ORDER BY policyname;

-- ============================================================
-- NOTA IMPORTANTE
-- ============================================================
-- 
-- Se após executar este script ainda houver erro 400:
-- 
-- Vá para: Supabase Dashboard > Storage > product-images > Configuration
-- 
-- Certifique-se de que:
-- ✅ "Public bucket" está ATIVADO
-- ✅ "File size limit" = 5242880 (5MB)
-- ✅ "Allowed MIME types" inclui: image/jpeg, image/png, image/webp, image/gif
-- 
-- Depois, vá para: Settings > API > Storage
-- E verifique se o CORS está configurado para permitir seu domínio
-- ============================================================
