import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Create table on first load if absent
pool.query(`
  CREATE TABLE IF NOT EXISTS product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(e => console.warn('[reviews] table init skipped:', e.message));

// GET /api/reviews?limit=24  — public
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 24, 100);
  try {
    const { rows } = await pool.query(`
      SELECT id::text, product_id, user_name, rating, comment, created_at
      FROM product_reviews
      WHERE comment IS NOT NULL AND comment <> '' AND rating >= 4
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    res.json(rows);
  } catch (e) {
    console.error('[reviews] GET /', e.message);
    res.json([]);
  }
});

// GET /api/reviews/product/:productId  — public
router.get('/product/:productId', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id::text, product_id, user_name, rating, comment, created_at
      FROM product_reviews
      WHERE product_id = $1
      ORDER BY created_at DESC
    `, [req.params.productId]);
    res.json(rows);
  } catch (e) {
    console.error('[reviews] GET /product/:id', e.message);
    res.json([]);
  }
});

// GET /api/reviews/stats/:productId  — public
router.get('/stats/:productId', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::float AS average
      FROM product_reviews
      WHERE product_id = $1
    `, [req.params.productId]);
    res.json(rows[0] || { total: 0, average: 0 });
  } catch (e) {
    res.json({ total: 0, average: 0 });
  }
});

// POST /api/reviews  — auth required
router.post('/', authMiddleware, async (req, res) => {
  const { product_id, user_name, rating, comment } = req.body;
  if (!product_id || !user_name || !rating) {
    return res.status(400).json({ error: 'product_id, user_name, rating required' });
  }
  try {
    const { rows } = await pool.query(`
      INSERT INTO product_reviews (product_id, user_name, rating, comment)
      VALUES ($1, $2, $3, $4)
      RETURNING id::text, product_id, user_name, rating, comment, created_at
    `, [product_id, user_name.trim(), Number(rating), (comment || '').trim()]);
    res.json(rows[0]);
  } catch (e) {
    console.error('[reviews] POST /', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
