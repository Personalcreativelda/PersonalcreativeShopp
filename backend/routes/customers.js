import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const mapCustomer = (c) => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  email: c.email,
  address: c.address,
  totalOrders: c.total_orders,
  totalSpent: c.total_spent,
  tier: c.tier,
  lastOrderDate: c.last_order_date,
  notes: c.notes
});

// GET /api/customers
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM customers ORDER BY name ASC');
    res.json(rows.map(mapCustomer));
  } catch (err) {
    console.error('[GET /customers]', err);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});

// GET /api/customers/count
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM customers');
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao contar clientes' });
  }
});

// GET /api/customers/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(mapCustomer(rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

// POST /api/customers
router.post('/', authMiddleware, async (req, res) => {
  try {
    const c = req.body;
    const cleanPhone = (c.phone || '').replace(/\D/g, '');
    const phoneToSave = cleanPhone.length > 5 ? cleanPhone : `no_phone_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const { rows } = await pool.query(
      `INSERT INTO customers (name, phone, email, address, total_orders, total_spent, tier, last_order_date)
       VALUES ($1, $2, $3, $4, 0, 0, 'BRONZE', NULL) RETURNING *`,
      [c.name, phoneToSave, c.email || null, c.address || null]
    );
    res.status(201).json(mapCustomer(rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Cliente com este telefone já existe' });
    }
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
});

// PUT /api/customers/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const c = req.body;
    const fields = [];
    const values = [];
    let i = 1;

    if (c.name !== undefined) { fields.push(`name = $${i++}`); values.push(c.name); }
    if (c.phone !== undefined) {
      const clean = c.phone.replace(/\D/g, '');
      fields.push(`phone = $${i++}`); values.push(clean.length > 5 ? clean : c.phone);
    }
    if (c.email !== undefined) { fields.push(`email = $${i++}`); values.push(c.email); }
    if (c.address !== undefined) { fields.push(`address = $${i++}`); values.push(c.address); }
    if (c.tier !== undefined) { fields.push(`tier = $${i++}`); values.push(c.tier); }
    if (c.lastOrderDate !== undefined) {
      fields.push(`last_order_date = $${i++}`);
      values.push(c.lastOrderDate || null);
    }
    if (c.notes !== undefined) { fields.push(`notes = $${i++}`); values.push(c.notes); }
    if (c.totalOrders !== undefined) { fields.push(`total_orders = $${i++}`); values.push(c.totalOrders); }
    if (c.totalSpent !== undefined) { fields.push(`total_spent = $${i++}`); values.push(c.totalSpent); }

    if (fields.length === 0) return res.json({ success: true });

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE customers SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(mapCustomer(rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao apagar cliente' });
  }
});

// DELETE /api/customers (bulk)
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.json({ success: true });
    await pool.query('DELETE FROM customers WHERE id = ANY($1)', [ids]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao apagar clientes' });
  }
});

// POST /api/customers/merge
router.post('/merge', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { primaryId, duplicateId } = req.body;
    await client.query('BEGIN');

    // Transferir pedidos
    const { rowCount: transferred } = await client.query(
      `UPDATE orders SET customer_id = $1 WHERE customer_id = $2`,
      [primaryId, duplicateId]
    );

    // Recalcular totais do cliente principal
    const { rows: ordersRows } = await client.query(
      'SELECT total_amount, created_at FROM orders WHERE customer_id = $1',
      [primaryId]
    );
    const newTotal = ordersRows.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const newCount = ordersRows.length;
    const sortedDates = ordersRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const lastDate = sortedDates[0]?.created_at || null;

    await client.query(
      'UPDATE customers SET total_orders = $1, total_spent = $2, last_order_date = $3 WHERE id = $4',
      [newCount, newTotal, lastDate, primaryId]
    );

    await client.query('DELETE FROM customers WHERE id = $1', [duplicateId]);
    await client.query('COMMIT');

    res.json({ success: true, ordersTransferred: transferred });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
