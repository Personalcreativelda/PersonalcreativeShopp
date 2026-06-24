import { supabase, isSupabaseConfigured, getSupabaseConfig } from '../../core/services/supabaseClient';
import { normalizeForSearch } from '../../core/services/serviceUtils';
import type { MediaFile } from '../../core/types/types';
import { MediaCategory, MediaType } from '../../core/types/types';

const BUCKET_NAME = 'product-images';

/**
 * Cache em memé³ria para listMediaFiles
 */
interface CacheEntry {
  data: MediaFile[];
  timestamp: number;
  category?: string;
}

const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Constroi URL péºblica manualmente (sem fazer requisiçéo HTTP)
 * Formato: https://{project-ref}.supabase.co/storage/v1/object/public/{bucket}/{path}
 */
const buildPublicUrl = (filePath: string): string => {
  const { url } = getSupabaseConfig();
  if (!url) return '';
  
  // Remover trailing slash se existir
  const baseUrl = url.replace(/\/$/, '');
  // O caminho do arquivo pode conter barras, entéo precisamos encodar apenas caracteres especiais
  // mas manter as barras como estéo
  const encodedPath = filePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  
  return `${baseUrl}/storage/v1/object/public/${BUCKET_NAME}/${encodedPath}`;
};

/**
 * Limpa cache expirado
 */
const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
};

/**
 * Obté©m chave de cache baseada nos paré¢metros
 */
const getCacheKey = (category?: string, limit?: number, offset?: number): string => {
  return `listMediaFiles_${category || 'all'}_${limit || 'none'}_${offset || 0}`;
};

/**
 * Invalida cache relacionado a uma categoria ou todo o cache
 */
export const invalidateMediaCache = (category?: string) => {
  if (category) {
    // Invalidar apenas cache da categoria especé­fica
    for (const [key] of cache.entries()) {
      if (key.includes(category)) {
        cache.delete(key);
      }
    }
    // Invalidar cache de pastas relacionadas
    for (const [key] of folderListCache.entries()) {
      if (key.includes(category)) {
        folderListCache.delete(key);
      }
    }
  } else {
    // Invalidar todo o cache
    cache.clear();
    folderListCache.clear();
  }
};

/**
 * Tipos MIME suportados para imagens
 */
const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon'
];

/**
 * Tipos MIME suportados para documentos
 */
const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain', // .txt
  'text/rtf', // .rtf
  'application/rtf'
];

/**
 * Extenséµes de arquivo suportadas para imagens
 */
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'ico'];

/**
 * Extenséµes de arquivo suportadas para documentos
 */
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'];

/**
 * Determina o tipo de mé­dia baseado no arquivo
 */
export const getMediaType = (file: File): MediaType => {
  const mimeType = file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (IMAGE_MIME_TYPES.includes(mimeType) || IMAGE_EXTENSIONS.includes(extension)) {
    return MediaType.IMAGE;
  }
  
  if (DOCUMENT_MIME_TYPES.includes(mimeType) || DOCUMENT_EXTENSIONS.includes(extension)) {
    return MediaType.DOCUMENT;
  }

  return MediaType.OTHER;
};

/**
 * Determina a categoria baseada no caminho do arquivo
 */
export const getMediaCategory = (filePath: string): MediaCategory => {
  if (filePath.startsWith('products/')) return MediaCategory.PRODUCTS;
  if (filePath.startsWith('avatars/')) return MediaCategory.AVATARS;
  if (filePath.startsWith('payment-proofs/')) return MediaCategory.PAYMENT_PROOFS;
  if (filePath.startsWith('system/')) return MediaCategory.SYSTEM;
  if (filePath.startsWith('documents/')) return MediaCategory.DOCUMENTS;
  if (filePath.startsWith('media-library/')) return MediaCategory.MEDIA_LIBRARY;
  return MediaCategory.OTHER;
};

/**
 * Valida um arquivo de mé­dia
 */
export const validateMediaFile = (file: File): { valid: boolean; error?: string } => {
  const mediaType = getMediaType(file);
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.type.toLowerCase();

  // Validar tipo de arquivo
  if (mediaType === 'other') {
    return {
      valid: false,
      error: 'Tipo de arquivo néo suportado. Use imagens (JPEG, PNG, WEBP, GIF, SVG, ICO) ou documentos (PDF, Word, Excel, PowerPoint, TXT, RTF).'
    };
  }

  // Validar tamanho baseado no tipo
  let maxSize: number;
  if (mediaType === 'image') {
    maxSize = 5 * 1024 * 1024; // 5MB para imagens
  } else if (mediaType === 'document') {
    // PDF e Office: 10MB, Textos: 5MB
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
      maxSize = 10 * 1024 * 1024; // 10MB
    } else {
      maxSize = 5 * 1024 * 1024; // 5MB para textos
    }
  } else {
    maxSize = 10 * 1024 * 1024; // 10MB padréo
  }

  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `Arquivo muito grande. Tamanho mé¡ximo: ${maxSizeMB}MB.`
    };
  }

  return { valid: true };
};

/**
 * Faz upload de um arquivo gené©rico para o Supabase Storage
 */
export const uploadMediaFile = async (
  file: File,
  category: MediaCategory = MediaCategory.MEDIA_LIBRARY,
  subfolder?: string
): Promise<MediaFile | null> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[uploadMediaFile] Supabase néo configurado');
    return null;
  }

  try {
    // Validar arquivo
    const validation = validateMediaFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Arquivo invé¡lido');
    }

    // Gerar nome éºnico para o arquivo
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop() || 'bin';
    const fileName = subfolder
      ? `${category}/${subfolder}/${timestamp}-${randomString}.${fileExtension}`
      : `${category}/${timestamp}-${randomString}.${fileExtension}`;

    // Fazer upload
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[uploadMediaFile] Erro no upload:', error);
      
      if (error.message && error.message.includes('Bucket not found')) {
        throw new Error(`Bucket '${BUCKET_NAME}' néo encontrado. Por favor, verifique se o bucket foi criado no Supabase Dashboard > Storage.`);
      } else if (error.message && error.message.includes('new row violates row-level security')) {
        throw new Error('Erro de permissão. Verifique se as polé­ticas RLS estéo configuradas corretamente para o bucket.');
      } else if (error.message && error.message.includes('mime type') && error.message.includes('is not supported')) {
        const mimeType = file.type || 'desconhecido';
        throw new Error(
          `Tipo MIME "${mimeType}" néo é© suportado pelo bucket. ` +
          `Por favor, atualize o bucket '${BUCKET_NAME}' no Supabase Dashboard > Storage > Settings ` +
          `e adicione "${mimeType}" na lista de "Allowed MIME types". ` +
          `Consulte o guia em docs/guides/ATUALIZAR_BUCKET_SVG.md para instruçéµes detalhadas.`
        );
      } else {
        throw error;
      }
    }

    // Construir URL péºblica manualmente (sem requisiçéo HTTP)
    const publicUrl = buildPublicUrl(fileName);

    if (!publicUrl) {
      throw new Error('Erro ao construir URL péºblica do arquivo');
    }

    // Criar objeto MediaFile
    const mediaFile: MediaFile = {
      id: `${timestamp}-${randomString}`,
      name: file.name,
      url: publicUrl,
      path: fileName,
      type: getMediaType(file),
      category: category,
      size: file.size,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Invalidar cache apé³s upload
    invalidateMediaCache(category);

    return mediaFile;
  } catch (error: any) {
    console.error('[uploadMediaFile] Erro:', error);
    throw error;
  }
};

/**
 * Faz upload méºltiplo de arquivos
 */
export const uploadMultipleMediaFiles = async (
  files: File[],
  category: MediaCategory = MediaCategory.MEDIA_LIBRARY,
  subfolder?: string
): Promise<{ success: MediaFile[]; failed: { file: File; error: string }[] }> => {
  const results = {
    success: [] as MediaFile[],
    failed: [] as { file: File; error: string }[]
  };

  for (const file of files) {
    try {
      const mediaFile = await uploadMediaFile(file, category, subfolder);
      if (mediaFile) {
        results.success.push(mediaFile);
      } else {
        results.failed.push({ file, error: 'Upload retornou null' });
      }
    } catch (error: any) {
      results.failed.push({ file, error: error.message || 'Erro desconhecido' });
    }
  }

  return results;
};

/**
 * Cache para requisiçéµes de listagem de pastas
 */
const folderListCache: Map<string, { data: any[]; timestamp: number }> = new Map();
const FOLDER_CACHE_TTL = 2 * 60 * 1000; // 2 minutos para cache de pastas

/**
 * Lista recursivamente arquivos de uma pasta com cache e processamento em lote
 */
const listFilesRecursively = async (
  folderPath: string = '',
  allFiles: MediaFile[] = [],
  visitedFolders: Set<string> = new Set()
): Promise<MediaFile[]> => {
  if (!isSupabaseConfigured() || !supabase) {
    return allFiles;
  }

  // Evitar loops infinitos
  if (visitedFolders.has(folderPath)) {
    return allFiles;
  }
  visitedFolders.add(folderPath);

  try {
    // Verificar cache de listagem de pasta
    const cacheKey = `folder_${folderPath}`;
    const cached = folderListCache.get(cacheKey);
    let data: any[] | null = null;

    if (cached && (Date.now() - cached.timestamp) < FOLDER_CACHE_TTL) {
      data = cached.data;
    } else {
      // Fazer requisiçéo apenas se néo estiver em cache
      const { data: listData, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folderPath, {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error(`[listFilesRecursively] Erro ao listar pasta "${folderPath}":`, error);
        return allFiles;
      }

      data = listData || [];
      
      // Salvar no cache
      folderListCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });
    }

    if (!data || data.length === 0) {
      return allFiles;
    }

    // Separar arquivos e pastas
    const files: any[] = [];
    const folders: string[] = [];

    for (const item of data) {
      const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;
      
      // Verificar se é© uma pasta ou arquivo
      const hasId = !!item.id;
      const hasMetadata = item.metadata && Object.keys(item.metadata).length > 0;
      const isFile = hasId || hasMetadata;
      
      if (!isFile) {
        folders.push(itemPath);
      } else {
        files.push({ ...item, itemPath });
      }
    }

    // Processar arquivos primeiro (mais ré¡pido)
    for (const item of files) {
      const publicUrl = buildPublicUrl(item.itemPath);

      const mediaFile: MediaFile = {
        id: item.id || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        name: item.name,
        url: publicUrl,
        path: item.itemPath,
        type: getMediaTypeFromPath(item.itemPath),
        category: getMediaCategory(item.itemPath),
        size: item.metadata?.size || 0,
        mimeType: item.metadata?.mimetype || '',
        createdAt: item.created_at || new Date().toISOString(),
        updatedAt: item.updated_at || item.created_at || new Date().toISOString()
      };

      allFiles.push(mediaFile);
    }

    // Processar pastas em paralelo (limitado a 5 requisiçéµes simulté¢neas)
    const BATCH_SIZE = 5;
    for (let i = 0; i < folders.length; i += BATCH_SIZE) {
      const batch = folders.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(folder => listFilesRecursively(folder, allFiles, visitedFolders))
      );
    }

    return allFiles;
  } catch (error: any) {
    console.error(`[listFilesRecursively] Erro ao processar pasta "${folderPath}":`, error);
    return allFiles;
  }
};

/**
 * Lista todos os arquivos do bucket com metadados
 */
export const listMediaFiles = async (
  category?: MediaCategory | string,
  limit?: number,
  offset?: number
): Promise<MediaFile[]> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[listMediaFiles] Supabase néo configurado');
    return [];
  }

  try {
    // Limpar cache expirado
    cleanExpiredCache();

    // Verificar cache
    const cacheKey = getCacheKey(category, limit, offset);
    const cached = cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      // Retornar dados do cache
      return cached.data;
    }

    let allFiles: MediaFile[] = [];

    if (category) {
      // Listar apenas de uma categoria especé­fica
      const folderPath = `${category}/`;
      allFiles = await listFilesRecursively(folderPath, []);
    } else {
      // Listar todos os arquivos recursivamente da raiz
      // Primeiro tentar listar da raiz
      allFiles = await listFilesRecursively('', []);
      
      // Se néo encontrou arquivos na raiz, tentar listar de cada categoria conhecida
      if (allFiles.length === 0) {
        const categories = [
          MediaCategory.PRODUCTS,
          MediaCategory.AVATARS,
          MediaCategory.PAYMENT_PROOFS,
          MediaCategory.SYSTEM,
          MediaCategory.DOCUMENTS,
          MediaCategory.MEDIA_LIBRARY
        ];
        
        for (const cat of categories) {
          const catFiles = await listFilesRecursively(`${cat}/`, []);
          allFiles.push(...catFiles);
        }
      }
    }

    // Ordenar por data de criaçéo (mais recente primeiro)
    allFiles.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    // Aplicar limite e offset se especificados
    let result = allFiles;
    if (limit || offset) {
      const start = offset || 0;
      const end = limit ? start + limit : undefined;
      result = allFiles.slice(start, end);
    }

    // Salvar no cache (salvar a versão completa antes de aplicar limit/offset)
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      category: category
    });

    // També©m salvar versão completa sem limit/offset para reutilizaçéo
    if (limit || offset) {
      const fullCacheKey = getCacheKey(category);
      if (!cache.has(fullCacheKey)) {
        cache.set(fullCacheKey, {
          data: allFiles,
          timestamp: Date.now(),
          category: category
        });
      }
    }

    return result;
  } catch (error: any) {
    console.error('[listMediaFiles] Erro:', error);
    return [];
  }
};

/**
 * Busca arquivos por nome
 */
export const searchMediaFiles = async (
  searchQuery: string,
  category?: MediaCategory | string
): Promise<MediaFile[]> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[searchMediaFiles] Supabase néo configurado');
    return [];
  }

  try {
    const allFiles = await listMediaFiles(category);
    const query = normalizeForSearch(searchQuery);
    
    return allFiles.filter(file => 
      normalizeForSearch(file.name).includes(query) ||
      normalizeForSearch(file.path).includes(query)
    );
  } catch (error: any) {
    console.error('[searchMediaFiles] Erro:', error);
    return [];
  }
};

/**
 * Deleta um arquivo do storage
 */
export const deleteMediaFile = async (filePath: string): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[deleteMediaFile] Supabase néo configurado');
    return false;
  }

  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('[deleteMediaFile] Erro ao remover:', error);
      return false;
    }

    // Invalidar cache apé³s deletar
    invalidateMediaCache();

    return true;
  } catch (error) {
    console.error('[deleteMediaFile] Erro:', error);
    return false;
  }
};

/**
 * Deleta méºltiplos arquivos
 */
export const deleteMultipleMediaFiles = async (filePaths: string[]): Promise<{
  success: string[];
  failed: { path: string; error: string }[];
}> => {
  const results = {
    success: [] as string[],
    failed: [] as { path: string; error: string }[]
  };

  for (const path of filePaths) {
    const success = await deleteMediaFile(path);
    if (success) {
      results.success.push(path);
    } else {
      results.failed.push({ path, error: 'Falha ao deletar' });
    }
  }

  return results;
};

/**
 * Deleta arquivo por URL
 */
export const deleteMediaFileByUrl = async (url: string): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[deleteMediaFileByUrl] Supabase néo configurado');
    return false;
  }

  try {
    // Extrair o caminho do arquivo da URL
    const urlParts = url.split('/');
    const fileNameIndex = urlParts.findIndex(part => part === BUCKET_NAME);
    
    if (fileNameIndex === -1 || fileNameIndex === urlParts.length - 1) {
      console.error('[deleteMediaFileByUrl] URL invé¡lida:', url);
      return false;
    }

    const filePath = urlParts.slice(fileNameIndex + 1).join('/');
    return await deleteMediaFile(filePath);
  } catch (error) {
    console.error('[deleteMediaFileByUrl] Erro:', error);
    return false;
  }
};

/**
 * Obté©m metadados de um arquivo
 */
export const getMediaFileMetadata = async (filePath: string): Promise<MediaFile | null> => {
  if (!isSupabaseConfigured() || !supabase) {
    console.error('[getMediaFileMetadata] Supabase néo configurado');
    return null;
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(filePath.split('/').slice(0, -1).join('/'));

    if (error || !data) {
      return null;
    }

    const fileName = filePath.split('/').pop() || '';
    const item = data.find(f => f.name === fileName);

    if (!item) {
      return null;
    }

    // Construir URL péºblica manualmente (sem requisiçéo HTTP)
    const publicUrl = buildPublicUrl(filePath);

    return {
      id: item.id || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      name: item.name,
      url: publicUrl,
      path: filePath,
      type: getMediaTypeFromPath(filePath),
      category: getMediaCategory(filePath),
      size: item.metadata?.size || 0,
      mimeType: item.metadata?.mimetype || '',
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || item.created_at || new Date().toISOString()
    };
  } catch (error: any) {
    console.error('[getMediaFileMetadata] Erro:', error);
    return null;
  }
};

/**
 * Helper para determinar tipo de mé­dia pelo caminho
 */
const getMediaTypeFromPath = (path: string): MediaType => {
  const extension = path.split('.').pop()?.toLowerCase() || '';
  
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return MediaType.IMAGE;
  }
  
  if (DOCUMENT_EXTENSIONS.includes(extension)) {
    return MediaType.DOCUMENT;
  }

  return MediaType.OTHER;
};

/**
 * Formata tamanho de arquivo para exibiçéo
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Obté©m é­cone baseado no tipo de arquivo
 */
export const getFileIcon = (mimeType: string, extension?: string): string => {
  const ext = extension?.toLowerCase() || '';
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'file-text';
  if (['doc', 'docx'].includes(ext) || mimeType.includes('word')) return 'file-text';
  if (['xls', 'xlsx'].includes(ext) || mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'file-spreadsheet';
  if (['ppt', 'pptx'].includes(ext) || mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'file-presentation';
  if (['txt', 'rtf'].includes(ext) || mimeType.includes('text')) return 'file-text';
  
  return 'file';
};



