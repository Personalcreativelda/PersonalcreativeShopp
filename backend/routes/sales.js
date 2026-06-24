import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const mapSale = (row) => {
  const items = Array.isArray(row.items) ? row.items.map(it => ({
    id: it.id || `item-${Math.random().toString(36).slice(2, 9)}`,
    productId: it.productId ?? it.product_id ?? '',
    productName: it.productName ?? it.product_name ?? '',
    variantId: it.variantId ?? it.variant_id,
    variantName: it.variantName ?? it.variant_name,
    quantity: Number(it.quantity) || 0,
    price: Number(it.price) || 0,
    unit: it.unit,
    total: it.total != null ? Number(it.total) : undefined
  })) : [];
  return {
    id: row.id,
    date: row.date ? (typeof row.date === 'string' ? row.date.split('T')[0] : row.date) : undefined,
    items,
    totalSales: row.total_sales != null ? Number(row.total_sales) : 0,
    totalDeliveries: row.total_deliveries != null ? Number(row.total_deliveries) : 0,
    valueReceived: row.value_received != null ? Number(row.value_received) : undefined,
    difference: row.difference != null ? Number(row.difference) : undefined,
    notes: row.notes ?? undefined,
    saleType: row.sale_type ?? undefined,
    createdAt: row.created_at || new Date().toISOString()
  };
};

// GET /api/sales
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sales ORDER BY date DESC');
    res.json(rows.map(mapSale));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar vendas' });
  }
});

// GET /api/sales/count
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM sales');
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao contar vendas' });
  }
});

// GET /api/sales/by-date/:date
router.get('/by-date/:date', authMiddleware, async (req, res) => {
  try {
    const dateOnly = req.params.date.split('T')[0];
    const { rows } = await pool.query(
      'SELECT * FROM sales WHERE date = $1 ORDER BY created_at ASC LIMIT 1',
      [dateOnly]
    );
    res.json(rows.length ? mapSale(rows[0]) : null);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar venda por data' });
  }
});

// POST /api/sales
router.post('/', authMiddleware, async (req, res) => {
  try {
    const s = req.body;
    const dateOnly = (s.date || new Date().toISOString()).split('T')[0];
    const { rows } = await pool.query(
      `INSERT INTO sales (date, total_sales, total_deliveries, value_received, difference, notes, items, sale_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [dateOnly, s.totalSales || 0, s.totalDeliveries || 0,
       s.valueReceived ?? null, s.difference ?? null, s.notes || null,
       JSON.stringify(s.items || []), s.saleType || null]
    );
    res.status(201).json(mapSale(rows[0]));
  } catch (err) {
    console.error('[POST /sales]', err);
    res.status(500).json({ error: 'Erro ao criar venda' });
  }
});

// PUT /api/sales/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const s = req.body;
    const fields = [];
    const values = [];
    let i = 1;

    if (s.date !== undefined) { fields.push(`date = $${i++}`); values.push(s.date.split?.('T')[0] ?? s.date); }
    if (s.totalSales !== undefined) { fields.push(`total_sales = $${i++}`); values.push(s.totalSales); }
    if (s.totalDeliveries !== undefined) { fields.push(`total_deliveries = $${i++}`); values.push(s.totalDeliveries); }
    if (s.valueReceived !== undefined) { fields.push(`value_received = $${i++}`); values.push(s.valueReceived); }
    if (s.difference !== undefined) { fields.push(`difference = $${i++}`); values.push(s.difference); }
    if (s.notes !== undefined) { fields.push(`notes = $${i++}`); values.push(s.notes); }
    if (s.saleType !== undefined) { fields.push(`sale_type = $${i++}`); values.push(s.saleType); }
    if (s.items !== undefined) { fields.push(`items = $${i++}`); values.push(JSON.stringify(s.items)); }

    if (fields.length === 0) return res.json({ success: true });
    values.push(req.params.id);

    await pool.query(`UPDATE sales SET ${fields.join(', ')} WHERE id = $${i}`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar venda' });
  }
});

// DELETE /api/sales/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM sales WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao apagar venda' });
  }
});

// DELETE /api/sales (bulk)
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.json({ success: true, deleted: 0 });
    await pool.query('DELETE FROM sales WHERE id = ANY($1)', [ids]);
    res.json({ success: true, deleted: ids.length });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao apagar vendas' });
  }
});

export default router;
