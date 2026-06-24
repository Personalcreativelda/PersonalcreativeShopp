import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadToMinio } from '../storage/minio.js';

const router = express.Router();

const mapCategory = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description || null,
  color: r.color || '#3B82F6',
  icon: r.icon || null,
  imageUrl: r.image_url || null,
  displayOrder: r.display_order ?? 0,
  isActive: r.is_active !== false,
  createdAt: r.created_at
});

async function processImageData(imageData) {
  if (!imageData) return null;
  try {
    const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const [, mime, b64] = match;
    const buffer = Buffer.from(b64, 'base64');
    const { url } = await uploadToMinio(buffer, 'categories', mime);
    return url;
  } catch (e) {
    console.warn('[categories] Erro ao fazer upload de imagem:', e.message);
    return null;
  }
}

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM categories ORDER BY display_order ASC, name ASC'
    );
    res.json(rows.map(mapCategory));
  } catch (err) {
    console.error('[GET /categories]', err);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

// POST /api/categories
router.post('/', authMiddleware, async (req, res) => {
  const { name, description, color, icon, displayOrder, isActive, imageData } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome da categoria é obrigatório' });

  try {
    const imageUrl = await processImageData(imageData);
    const { rows } = await pool.query(
      `INSERT INTO categories (name, description, color, icon, display_order, is_active, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        name.trim(),
        description?.trim() || null,
        color || '#3B82F6',
        icon?.trim() || null,
        displayOrder ?? 0,
        isActive !== false,
        imageUrl
      ]
    );
    res.status(201).json(mapCategory(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe uma categoria com este nome' });
    console.error('[POST /categories]', err);
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// PUT /api/categories/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, description, color, icon, displayOrder, isActive, imageData } = req.body;

  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (name !== undefined)         { fields.push(`name = $${i++}`);          values.push(name.trim()); }
    if (description !== undefined)  { fields.push(`description = $${i++}`);   values.push(description?.trim() || null); }
    if (color !== undefined)        { fields.push(`color = $${i++}`);         values.push(color); }
    if (icon !== undefined)         { fields.push(`icon = $${i++}`);          values.push(icon?.trim() || null); }
    if (displayOrder !== undefined) { fields.push(`display_order = $${i++}`); values.push(displayOrder); }
    if (isActive !== undefined)     { fields.push(`is_active = $${i++}`);     values.push(isActive); }

    if (imageData !== undefined) {
      const imageUrl = await processImageData(imageData);
      if (imageUrl) {
        fields.push(`image_url = $${i++}`);
        values.push(imageUrl);
      }
    }

    if (!fields.length) return res.json({ success: true });

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json(mapCategory(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe uma categoria com este nome' });
    console.error('[PUT /categories]', err);
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /categories]', err);
    res.status(500).json({ error: 'Erro ao apagar categoria' });
  }
});

export default router;
