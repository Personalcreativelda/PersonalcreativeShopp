/**
 * uploadService.ts — Upload via backend REST → MinIO
 */
import { getApiToken } from '../modules/core/services/apiClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3060/api';
const MINIO_PUBLIC_URL = (import.meta.env.VITE_MINIO_PUBLIC_URL || 'http://localhost:9000').replace(/\/$/, '');
const MINIO_BUCKET = import.meta.env.VITE_MINIO_BUCKET || 'naturerva';

export interface UploadResult {
  url: string;
  path: string;
  publicUrl: string;
}

// Redimensiona e comprime a imagem no browser antes de enviar
function compressImage(file: File, maxSize = 1200, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    // SVG não precisa de redimensionamento — enviar directamente
    if (file.type === 'image/svg+xml') { resolve(file); return; }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // PNG pode ter transparência — preservar formato para não tornar fundo preto
      const isPng = file.type === 'image/png';
      const outputMime = isPng ? 'image/png' : 'image/jpeg';

      if (!isPng) {
        // Para JPEG preencher fundo branco (evita artefactos em imagens com alpha)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: outputMime }) : file),
        outputMime,
        isPng ? undefined : quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

/** Extrai o objectKey de uma URL MinIO.
 *  Ex: 'http://localhost:9000/naturerva/products/abc.jpg' → 'products/abc.jpg'
 */
function extractObjectKey(urlOrPath: string): string | null {
  if (!urlOrPath || urlOrPath.startsWith('data:')) return null;
  if (urlOrPath.startsWith('http')) {
    try {
      const parsed = new URL(urlOrPath);
      const parts = parsed.pathname.split('/').filter(Boolean);
      // parts = [bucket, folder, filename] — remove o bucket
      if (parts.length > 1) return parts.slice(1).join('/');
    } catch {
      return null;
    }
  }
  // Já é um objectKey directo (ex: 'products/abc.jpg')
  return urlOrPath;
}

export const uploadService = {
  async uploadImage(file: File, folder = 'products', maxSize = 1200): Promise<UploadResult | null> {
    try {
      const compressed = await compressImage(file, maxSize);

      const formData = new FormData();
      formData.append('image', compressed);
      formData.append('folder', folder);

      const token = getApiToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erro de upload' }));
        throw new Error(err.error || `Upload falhou: ${response.status}`);
      }

      const data = await response.json();
      return {
        url: data.url || data.publicUrl,
        path: data.path || data.filename,
        publicUrl: data.publicUrl || data.url,
      };
    } catch (err: any) {
      console.error('[uploadService] uploadImage:', err.message);
      return null;
    }
  },

  async deleteImage(urlOrPath: string): Promise<boolean> {
    if (!urlOrPath || urlOrPath.startsWith('data:')) return true;

    try {
      const objectKey = extractObjectKey(urlOrPath);
      if (!objectKey) return true;

      const token = getApiToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(
        `${API_BASE}/upload?key=${encodeURIComponent(objectKey)}`,
        { method: 'DELETE', headers }
      );

      return response.ok;
    } catch {
      return false;
    }
  },

  getPublicUrl(path: string): string {
    if (!path) return '';
    // Imagens base64 legacy ou URLs completas retornam directo
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    // objectKey guardado directamente (ex: 'products/abc.jpg')
    return `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${path}`;
  },

  isLocalUrl(url: string): boolean {
    return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('/uploads/');
  },
};

export const uploadProductImage = async (file: File) => {
  const result = await uploadService.uploadImage(file, 'products');
  return result?.url || null;
};

export const deleteProductImage = uploadService.deleteImage;

export default uploadService;
