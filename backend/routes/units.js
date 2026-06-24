import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const mapUnit = (r) => ({
  id: r.id,
  name: r.name,
  abbreviation: r.abbreviation,
  description: r.description || null,
  type: r.type || null,
  isActive: r.is_active !== false,
  createdAt: r.created_at
});

// GET /api/units
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM units ORDER BY name ASC'
    );
    res.json(rows.map(mapUnit));
  } catch (err) {
    console.error('[GET /units]', err);
    res.status(500).json({ error: 'Erro ao buscar unidades' });
  }
});

// POST /api/units
router.post('/', authMiddleware, async (req, res) => {
  const { name, abbreviation, description, type, isActive } = req.body;
  if (!name?.trim())         return res.status(400).json({ error: 'Nome da unidade é obrigatório' });
  if (!abbreviation?.trim()) return res.status(400).json({ error: 'Abreviação é obrigatória' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO units (name, abbreviation, description, type, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        name.trim(),
        abbreviation.trim().toLowerCase(),
        description?.trim() || null,
        type || null,
        isActive !== false
      ]
    );
    res.status(201).json(mapUnit(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe uma unidade com esta abreviação' });
    console.error('[POST /units]', err);
    res.status(500).json({ error: 'Erro ao criar unidade' });
  }
});

// PUT /api/units/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, abbreviation, description, type, isActive } = req.body;

  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (name !== undefined)        { fields.push(`name = $${i++}`);         values.push(name.trim()); }
    if (abbreviation !== undefined){ fields.push(`abbreviation = $${i++}`); values.push(abbreviation.trim().toLowerCase()); }
    if (description !== undefined) { fields.push(`description = $${i++}`);  values.push(description?.trim() || null); }
    if (type !== undefined)        { fields.push(`type = $${i++}`);         values.push(type || null); }
    if (isActive !== undefined)    { fields.push(`is_active = $${i++}`);    values.push(isActive); }

    if (!fields.length) return res.json({ success: true });

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE units SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Unidade não encontrada' });
    res.json(mapUnit(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe uma unidade com esta abreviação' });
    console.error('[PUT /units]', err);
    res.status(500).json({ error: 'Erro ao atualizar unidade' });
  }
});

// DELETE /api/units/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM units WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /units]', err);
    res.status(500).json({ error: 'Erro ao apagar unidade' });
  }
});

export default router;
