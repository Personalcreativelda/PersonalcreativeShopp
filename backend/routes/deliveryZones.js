import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const mapZone = (z) => ({
  id: z.id,
  name: z.name,
  price: Number(z.price),
  isActive: z.is_active,
  displayOrder: z.display_order || 0,
  createdAt: z.created_at,
  updatedAt: z.updated_at
});

// GET /api/delivery-zones  (público — loja precisa sem auth)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM delivery_zones WHERE is_active = true ORDER BY display_order ASC, name ASC'
    );
    res.json(rows.map(mapZone));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar zonas de entrega' });
  }
});

// GET /api/delivery-zones/all  (admin — todas, incluindo inativas)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM delivery_zones ORDER BY display_order ASC, name ASC'
    );
    res.json(rows.map(mapZone));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar zonas de entrega' });
  }
});

// POST /api/delivery-zones
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, price, isActive = true, displayOrder = 0 } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO delivery_zones (name, price, is_active, display_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, price, isActive, displayOrder]
    );
    res.status(201).json(mapZone(rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar zona de entrega' });
  }
});

// PUT /api/delivery-zones/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, price, isActive, displayOrder } = req.body;
    const fields = [];
    const values = [];
    let i = 1;

    if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name); }
    if (price !== undefined) { fields.push(`price = $${i++}`); values.push(price); }
    if (isActive !== undefined) { fields.push(`is_active = $${i++}`); values.push(isActive); }
    if (displayOrder !== undefined) { fields.push(`display_order = $${i++}`); values.push(displayOrder); }

    if (fields.length === 0) return res.json({ success: true });

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE delivery_zones SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Zona não encontrada' });
    res.json(mapZone(rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao actualizar zona de entrega' });
  }
});

// DELETE /api/delivery-zones/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM delivery_zones WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao apagar zona de entrega' });
  }
});

export default router;
