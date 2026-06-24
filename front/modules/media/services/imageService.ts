import { supabase, isSupabaseConfigured } from '../../core/services/supabaseClient';

const BUCKET_NAME = 'product-images';

// Flag para mostrar aviso apenas uma vez por sessão
let configWarningShown = false;

/**
 * Cria o bucket de imagens se néo existir
 */
export const ensureBucketExists = async (): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase néo configurado' };
  }

  try {
    // Verificar se o bucket existe
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('[ensureBucketExists] Erro ao listar buckets:', listError);
      return { success: false, error: `Erro ao verificar buckets: ${listError.message}` };
    }

    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
    
    if (!bucketExists) {
      // Criar bucket (requer permisséµes de admin)
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
      });

      if (createError) {
        console.error('[ensureBucketExists] Erro ao criar bucket:', createError);
        
        // Verificar novamente se o bucket foi criado (pode ter sido criado por outro processo)
        const { data: bucketsAfterCreate } = await supabase.storage.listBuckets();
        const existsAfterCreate = bucketsAfterCreate?.some(b => b.name === BUCKET_NAME);
        
        if (!existsAfterCreate) {
          return { 
            success: false, 
            error: `Bucket '${BUCKET_NAME}' néo existe e néo pé´de ser criado automaticamente. Por favor, crie o bucket manualmente no Supabase Dashboard > Storage. Nome do bucket: ${BUCKET_NAME}` 
          };
        }
      } else {
        // Verificar se foi criado com sucesso
        const { data: bucketsAfterCreate } = await supabase.storage.listBuckets();
        const existsAfterCreate = bucketsAfterCreate?.some(b => b.name === BUCKET_NAME);
        if (!existsAfterCreate) {
          return { 
            success: false, 
            error: `Bucket '${BUCKET_NAME}' néo foi criado. Por favor, crie o bucket manualmente no Supabase Dashboard > Storage.` 
          };
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('[ensureBucketExists] Erro:', error);
    return { success: false, error: error.message || 'Erro desconhecido ao verificar/criar bucket' };
  }
};

/**
 * Faz upload de uma imagem para o Supabase Storage
 * @param file Arquivo de imagem
 * @param productId ID do produto (opcional, para organizar por produto)
 * @returns URL péºblica da imagem ou null em caso de erro
 */
export const uploadProductImage = async (
  file: File,
  productId?: string
): Promise<string | null> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[uploadProductImage] Supabase néo configurado');
    return null;
  }

  try {
    // Tentar garantir que o bucket existe (mas néo bloquear se falhar a verificaçéo)
    const bucketCheck = await ensureBucketExists();
    if (!bucketCheck.success) {
      // Se a verificaçéo falhar, ainda tentamos fazer o upload
      // O bucket pode existir mas néo estar visé­vel na listagem por questéµes de permissão
      console.warn('[uploadProductImage] Aviso na verificaçéo do bucket:', bucketCheck.error);
    }

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Tipo de arquivo néo suportado. Use JPEG, PNG, WEBP ou GIF.');
    }

    // Validar tamanho (mé¡ximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. Tamanho mé¡ximo: 5MB.');
    }

    // Gerar nome éºnico para o arquivo
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = productId 
      ? `${productId}/${timestamp}-${randomString}.${fileExtension}`
      : `${timestamp}-${randomString}.${fileExtension}`;

    // Fazer upload
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[uploadProductImage] Erro no upload:', error);
      
      // Mensagens de erro mais especé­ficas
      if (error.message && error.message.includes('Bucket not found')) {
        throw new Error(`Bucket '${BUCKET_NAME}' néo encontrado. Por favor, verifique se o bucket foi criado e salvo no Supabase Dashboard > Storage.`);
      } else if (error.message && error.message.includes('new row violates row-level security')) {
        throw new Error('Erro de permissão. Verifique se as polé­ticas RLS estéo configuradas corretamente para o bucket.');
      } else {
        throw error;
      }
    }

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error('Erro ao obter URL pública da imagem');
    }

    console.log('[uploadProductImage] Upload concluído com sucesso:', {
      fileName,
      publicUrl: urlData.publicUrl,
      bucket: BUCKET_NAME
    });

    // Aviso sobre configuração do bucket (mostrar apenas uma vez por sessão)
    if (!configWarningShown) {
      configWarningShown = true;
      console.info(`
╔════════════════════════════════════════════════════════════════╗
║  ℹ️  CONFIGURAÇÃO DO BUCKET SUPABASE                          ║
╚════════════════════════════════════════════════════════════════╝

Para garantir que as imagens sejam acessíveis:

1. Abra o arquivo: sql/fixes/README_SOLUCAO_IMAGENS.md
2. Siga as instruções para executar o script SQL
3. Ou execute: sql/fixes/CONFIGURAR_STORAGE_IMAGENS.sql

Bucket: ${BUCKET_NAME}
`);
    }

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('[uploadProductImage] Erro:', error);
    throw error;
  }
};

/**
 * Faz upload de uma imagem de variação de produto para o Supabase Storage
 * @param file Arquivo de imagem
 * @param productId ID do produto
 * @param variantId ID da variação
 * @returns URL péºblica da imagem ou null em caso de erro
 */
export const uploadVariantImage = async (
  file: File,
  productId: string,
  variantId: string
): Promise<string | null> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[uploadVariantImage] Supabase néo configurado');
    return null;
  }

  try {
    // Tentar garantir que o bucket existe
    const bucketCheck = await ensureBucketExists();
    if (!bucketCheck.success) {
      console.warn('[uploadVariantImage] Aviso na verificaçéo do bucket:', bucketCheck.error);
    }

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Tipo de arquivo néo suportado. Use JPEG, PNG, WEBP ou GIF.');
    }

    // Validar tamanho (mé¡ximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. Tamanho mé¡ximo: 5MB.');
    }

    // Gerar nome éºnico para o arquivo
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `products/${productId}/variants/${variantId}/${timestamp}-${randomString}.${fileExtension}`;

    // Fazer upload
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[uploadVariantImage] Erro no upload:', error);
      
      // Mensagens de erro mais especé­ficas
      if (error.message && error.message.includes('Bucket not found')) {
        throw new Error(`Bucket '${BUCKET_NAME}' néo encontrado. Por favor, verifique se o bucket foi criado e salvo no Supabase Dashboard > Storage.`);
      } else if (error.message && error.message.includes('new row violates row-level security')) {
        throw new Error('Erro de permissão. Verifique se as polé­ticas RLS estéo configuradas corretamente para o bucket.');
      } else {
        throw error;
      }
    }

    // Obter URL péºblica
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error('Erro ao obter URL péºblica da imagem');
    }

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('[uploadVariantImage] Erro:', error);
    throw error;
  }
};

/**
 * Remove uma imagem do Supabase Storage
 * @param imageUrl URL da imagem a ser removida
 * @returns true se removido com sucesso, false caso contré¡rio
 */
export const deleteProductImage = async (imageUrl: string): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[deleteProductImage] Supabase néo configurado');
    return false;
  }

  try {
    // Extrair o nome do arquivo da URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/product-images/[path]
    const urlParts = imageUrl.split('/');
    const fileNameIndex = urlParts.findIndex(part => part === 'product-images');
    
    if (fileNameIndex === -1 || fileNameIndex === urlParts.length - 1) {
      console.error('[deleteProductImage] URL invé¡lida:', imageUrl);
      return false;
    }

    const fileName = urlParts.slice(fileNameIndex + 1).join('/');

    // Remover arquivo
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([fileName]);

    if (error) {
      console.error('[deleteProductImage] Erro ao remover:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[deleteProductImage] Erro:', error);
    return false;
  }
};

/**
 * Valida se um arquivo é© uma imagem vé¡lida
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  // Verificar por tipo MIME
  const isValidType = validTypes.includes(file.type);
  
  // Verificar por extensão (para casos onde o tipo MIME néo é© detectado corretamente)
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  const isValidExtension = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'ico'].includes(fileExtension || '');

  if (!isValidType && !isValidExtension) {
    return {
      valid: false,
      error: 'Tipo de arquivo néo suportado. Use JPEG, PNG, WEBP, GIF, SVG ou ICO.'
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Arquivo muito grande. Tamanho mé¡ximo: 5MB.'
    };
  }

  return { valid: true };
};

/**
 * Faz upload de logo ou favicon para o Supabase Storage
 * @param file Arquivo de imagem
 * @param type Tipo de arquivo: 'logo_light', 'logo_dark', 'logo_icon', ou 'favicon'
 * @returns URL péºblica da imagem ou null em caso de erro
 */
export const uploadSystemImage = async (
  file: File,
  type: 'logo_light' | 'logo_dark' | 'logo_icon' | 'favicon'
): Promise<string | null> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[uploadSystemImage] Supabase néo configurado');
    return null;
  }

  try {
    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Tipo de arquivo néo suportado. Use JPEG, PNG, WEBP, GIF, SVG ou ICO.');
    }

    // Validar tamanho (mé¡ximo 2MB para logos/favicons)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. Tamanho mé¡ximo: 2MB.');
    }

    // Gerar nome éºnico para o arquivo
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop() || 'png';
    const fileName = `system/${type}/${timestamp}-${randomString}.${fileExtension}`;

    // Fazer upload
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[uploadSystemImage] Erro no upload:', error);
      
      if (error.message && error.message.includes('Bucket not found')) {
        throw new Error(`Bucket '${BUCKET_NAME}' néo encontrado. Por favor, verifique se o bucket foi criado e salvo no Supabase Dashboard > Storage.`);
      } else if (error.message && error.message.includes('new row violates row-level security')) {
        throw new Error('Erro de permissão. Verifique se as polé­ticas RLS estéo configuradas corretamente para o bucket.');
      } else {
        throw error;
      }
    }

    // Obter URL péºblica
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error('Erro ao obter URL péºblica da imagem');
    }

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('[uploadSystemImage] Erro:', error);
    throw error;
  }
};

/**
 * Remove uma imagem do sistema do Supabase Storage
 * @param imageUrl URL da imagem a ser removida
 * @returns true se removido com sucesso, false caso contré¡rio
 */
export const deleteSystemImage = async (imageUrl: string): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[deleteSystemImage] Supabase néo configurado');
    return false;
  }

  try {
    // Extrair o nome do arquivo da URL
    const urlParts = imageUrl.split('/');
    const fileNameIndex = urlParts.findIndex(part => part === 'product-images');
    
    if (fileNameIndex === -1 || fileNameIndex === urlParts.length - 1) {
      console.error('[deleteSystemImage] URL invé¡lida:', imageUrl);
      return false;
    }

    const fileName = urlParts.slice(fileNameIndex + 1).join('/');

    // Verificar se é© uma imagem do sistema antes de remover
    if (!fileName.startsWith('system/')) {
      console.warn('[deleteSystemImage] Tentativa de remover imagem que néo é© do sistema:', fileName);
      return false;
    }

    // Remover arquivo
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([fileName]);

    if (error) {
      console.error('[deleteSystemImage] Erro ao remover:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[deleteSystemImage] Erro:', error);
    return false;
  }
};

/**
 * Faz upload de um comprovativo de pagamento para o Supabase Storage
 * @param file Arquivo de imagem
 * @returns URL péºblica da imagem ou null em caso de erro
 */
export const uploadPaymentProof = async (
  file: File
): Promise<string | null> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[uploadPaymentProof] Supabase néo configurado');
    return null;
  }

  try {
    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Tipo de arquivo néo suportado. Use JPEG, PNG, WEBP, GIF ou PDF.');
    }

    // Validar tamanho (mé¡ximo 10MB para comprovativos)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. Tamanho mé¡ximo: 10MB.');
    }

    // Gerar nome éºnico para o arquivo
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `payment-proofs/${timestamp}-${randomString}.${fileExtension}`;

    // Fazer upload (usar o mesmo bucket de imagens ou criar um especé­fico)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[uploadPaymentProof] Erro no upload:', error);
      throw error;
    }

    // Obter URL péºblica
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error('Erro ao obter URL péºblica do comprovativo');
    }

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('[uploadPaymentProof] Erro:', error);
    throw error;
  }
};

/**
 * Faz upload de uma foto de perfil (avatar) para o Supabase Storage
 * @param file Arquivo de imagem
 * @param userId ID do usué¡rio (para organizar por usué¡rio)
 * @returns URL péºblica da imagem ou null em caso de erro
 */
/**
 * Upload de avatar via backend → MinIO (não usa Supabase)
 */
export const uploadAvatar = async (
  file: File,
  userId: string
): Promise<string | null> => {
  try {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type))
      throw new Error('Tipo não suportado. Use JPEG, PNG, WEBP ou GIF.');
    if (file.size > 2 * 1024 * 1024)
      throw new Error('Ficheiro demasiado grande. Máximo: 2MB.');

    const imageData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = () => reject(new Error('Erro ao ler ficheiro'));
      reader.readAsDataURL(file);
    });

    const { default: api } = await import('../../core/services/apiClient');
    const result = await (api as any).post(`/users/${userId}/avatar`, { imageData });
    return result?.url || null;
  } catch (error: any) {
    console.error('[uploadAvatar]', error);
    throw error;
  }
};



