import * as Minio from 'minio';
import { randomUUID } from 'crypto';

let _client = null;

function getClient() {
  if (_client) return _client;

  // Strip any scheme from the endpoint (minio SDK expects hostname only)
  const rawEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
  const endPoint = rawEndpoint.replace(/^https?:\/\//, '');

  _client = new Minio.Client({
    endPoint,
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  });

  return _client;
}

export const BUCKET = () => process.env.MINIO_BUCKET || 'naturerva';
export const PUBLIC_URL = () => (process.env.MINIO_PUBLIC_URL || 'http://localhost:9000').replace(/\/$/, '');

async function ensureBucket() {
  const client = getClient();
  const bucket = BUCKET();
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket, 'us-east-1');
    console.log(`[MinIO] Bucket '${bucket}' criado`);
  }

  // Política de leitura pública para que imagens sejam acessíveis sem auth
  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${bucket}/*`],
    }],
  });

  try {
    await client.setBucketPolicy(bucket, policy);
  } catch (err) {
    // Se a política já existe e é igual, ignorar o erro
    if (!err.message?.includes('already')) {
      console.warn('[MinIO] Aviso ao definir política pública:', err.message);
    }
  }
}

/**
 * Faz upload de um buffer para o MinIO e devolve a URL pública.
 * @param {Buffer} buffer
 * @param {string} folder  Ex: 'products', 'banners'
 * @param {string} mimetype Ex: 'image/jpeg'
 * @returns {Promise<{url: string, objectKey: string}>}
 */
export async function uploadToMinio(buffer, folder, mimetype) {
  await ensureBucket();

  const ext = mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const filename = `${Date.now()}-${randomUUID().split('-')[0]}.${ext}`;
  const objectKey = `${folder}/${filename}`;

  const client = getClient();
  await client.putObject(BUCKET(), objectKey, buffer, buffer.length, {
    'Content-Type': mimetype,
  });

  const url = `${PUBLIC_URL()}/${BUCKET()}/${objectKey}`;
  console.log(`[MinIO] Upload OK → ${objectKey} (${(buffer.length / 1024).toFixed(1)} KB)`);
  return { url, objectKey };
}

/**
 * Apaga um objecto do MinIO dado o seu objectKey.
 * @param {string} objectKey  Ex: 'products/abc.jpg'
 */
export async function deleteFromMinio(objectKey) {
  if (!objectKey) return;
  const client = getClient();
  await client.removeObject(BUCKET(), objectKey);
  console.log(`[MinIO] Apagado: ${objectKey}`);
}

/**
 * Extrai o objectKey de uma URL pública do MinIO.
 * Ex: 'http://localhost:9000/naturerva/products/abc.jpg' → 'products/abc.jpg'
 * @param {string} url
 * @returns {string|null}
 */
export function objectKeyFromUrl(url) {
  if (!url || url.startsWith('data:')) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    // pathname = /naturerva/products/abc.jpg → parts = ['naturerva','products','abc.jpg']
    // remove o bucket (primeiro segmento)
    if (parts.length > 1) return parts.slice(1).join('/');
  } catch {
    // Pode já ser um objectKey directo
    if (!url.startsWith('http')) return url;
  }
  return null;
}
