import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { uploadToMinio, deleteFromMinio, objectKeyFromUrl } from '../storage/minio.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas imagens são permitidas'));
    }
    cb(null, true);
  },
});

const router = express.Router();

// POST /api/upload — faz upload para o MinIO e devolve a URL pública
router.post('/', authMiddleware, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      console.error('[Upload] Erro multer:', err.message);
      return res.status(400).json({ error: err.message || 'Erro no upload' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum ficheiro enviado' });
    }

    try {
      const folder = (req.body.folder || 'products').replace(/[^a-z0-9_-]/gi, '');
      const { url, objectKey } = await uploadToMinio(req.file.buffer, folder, req.file.mimetype);

      res.json({
        url,
        publicUrl: url,
        path: objectKey,
        filename: objectKey,
      });
    } catch (err) {
      console.error('[Upload] Erro MinIO:', err.message);
      res.status(500).json({ error: 'Erro ao fazer upload. Verifique a ligação ao MinIO.' });
    }
  });
});

// DELETE /api/upload?key=products/abc.jpg  OU  ?url=https://...
router.delete('/', authMiddleware, async (req, res) => {
  const key = req.query.key || objectKeyFromUrl(req.query.url || '');
  if (!key) return res.json({ success: true });

  try {
    await deleteFromMinio(key);
    res.json({ success: true });
  } catch (err) {
    console.error('[Upload] Erro ao apagar:', err.message);
    res.status(500).json({ error: 'Erro ao apagar ficheiro do MinIO' });
  }
});

// POST /api/upload/base64 — converte base64 → MinIO (usado pelo editor de blog)
router.post('/base64', authMiddleware, async (req, res) => {
  try {
    const { imageData, folder = 'blog' } = req.body;
    if (!imageData) return res.status(400).json({ error: 'imageData obrigatório' });
    const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Formato inválido' });
    const [, mime, b64] = match;
    const buffer = Buffer.from(b64, 'base64');
    const { url } = await uploadToMinio(buffer, folder, mime);
    res.json({ url });
  } catch (err) {
    console.error('[POST /upload/base64]', err);
    res.status(500).json({ error: 'Erro ao fazer upload' });
  }
});

// Rota de retrocompatibilidade (ignora ficheiros base64 antigos)
router.delete('/:filename', authMiddleware, (req, res) => {
  res.json({ success: true });
});

export default router;
