import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/shifts — list recent shifts
router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit  || 20), 100);
    const offset = Number(req.query.offset || 0);
    const { rows } = await pool.query(
      `SELECT s.*,
              p.name AS cashier_name,
              (SELECT COUNT(*) FROM orders o
               WHERE o.source = 'pos'
                 AND o.created_at >= s.opened_at
                 AND (s.closed_at IS NULL OR o.created_at <= s.closed_at)
                 AND o.status NOT IN ('cancelled')) AS order_count,
              (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o
               WHERE o.source = 'pos'
                 AND o.created_at >= s.opened_at
                 AND (s.closed_at IS NULL OR o.created_at <= s.closed_at)
                 AND o.status NOT IN ('cancelled')) AS total_sales
       FROM pos_shifts s
       LEFT JOIN profiles p ON p.id = s.cashier_id
       ORDER BY s.opened_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/shifts/current — get open shift for the current user
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
              (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o
               WHERE o.source = 'pos'
                 AND o.created_at >= s.opened_at
                 AND o.status NOT IN ('cancelled')) AS total_sales,
              (SELECT COUNT(*) FROM orders o
               WHERE o.source = 'pos'
                 AND o.created_at >= s.opened_at
                 AND o.status NOT IN ('cancelled')) AS order_count
       FROM pos_shifts s
       WHERE s.cashier_id = $1 AND s.closed_at IS NULL
       ORDER BY s.opened_at DESC
       LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) return res.json(null);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/shifts/start — open a new shift
router.post('/start', authMiddleware, async (req, res) => {
  try {
    // Close any existing open shift for this user first
    await pool.query(
      `UPDATE pos_shifts SET closed_at = NOW(), notes = COALESCE(notes,'') || ' [auto-fechado]'
       WHERE cashier_id = $1 AND closed_at IS NULL`,
      [req.user.id]
    );

    const { initialAmount = 0, locationId = null, notes = '' } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO pos_shifts (cashier_id, initial_amount, location_id, notes, opened_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [req.user.id, Number(initialAmount), locationId, notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/shifts/:id/end — close a shift
router.post('/:id/end', authMiddleware, async (req, res) => {
  try {
    const { rows: shifts } = await pool.query(
      'SELECT * FROM pos_shifts WHERE id = $1',
      [req.params.id]
    );
    if (!shifts.length) return res.status(404).json({ error: 'Turno não encontrado' });
    const shift = shifts[0];
    if (shift.closed_at) return res.status(400).json({ error: 'Turno já fechado' });

    // Compute sales totals
    const { rows: sales } = await pool.query(
      `SELECT
         payment_method,
         COUNT(*) AS count,
         COALESCE(SUM(total_amount), 0) AS total
       FROM orders
       WHERE source = 'pos'
         AND created_at >= $1
         AND status NOT IN ('cancelled')
       GROUP BY payment_method`,
      [shift.opened_at]
    );

    const totalSales = sales.reduce((s, r) => s + Number(r.total), 0);
    const cashSales  = sales.find(r => r.payment_method === 'cash')?.total || 0;
    const expectedCash = Number(shift.initial_amount || 0) + Number(cashSales);

    const { countedAmount = null, notes = '' } = req.body;
    const variance = countedAmount !== null ? Number(countedAmount) - expectedCash : null;

    const summary = {
      byMethod: sales.map(r => ({
        method: r.payment_method,
        count:  Number(r.count),
        total:  Number(r.total),
      })),
      totalSales,
      expectedCash,
      countedAmount: countedAmount !== null ? Number(countedAmount) : null,
      variance,
    };

    const { rows } = await pool.query(
      `UPDATE pos_shifts
       SET closed_at = NOW(),
           total_sales = $1,
           expected_cash = $2,
           counted_amount = $3,
           variance = $4,
           summary = $5,
           notes = $6
       WHERE id = $7
       RETURNING *`,
      [totalSales, expectedCash, countedAmount, variance, JSON.stringify(summary), notes, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/shifts/:id — get a single shift with full details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, p.name AS cashier_name FROM pos_shifts s
       LEFT JOIN profiles p ON p.id = s.cashier_id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Turno não encontrado' });

    const shift = rows[0];
    const { rows: orders } = await pool.query(
      `SELECT id, order_number, total_amount, payment_method, created_at, status
       FROM orders
       WHERE source = 'pos'
         AND created_at >= $1
         AND ($2::timestamptz IS NULL OR created_at <= $2)
         AND status NOT IN ('cancelled')
       ORDER BY created_at ASC`,
      [shift.opened_at, shift.closed_at || null]
    );

    res.json({ ...shift, orders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
