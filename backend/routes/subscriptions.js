import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

async function migrate() {
  const run = async (sql, label) => {
    try { await pool.query(sql); }
    catch (e) { console.error(`[subscriptions] migrate ${label}:`, e.message); }
  };
  await run(`CREATE TABLE IF NOT EXISTS subscription_plans (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    price         DECIMAL(10,2) DEFAULT 0,
    billing_cycle VARCHAR(20) DEFAULT 'monthly',
    features      JSONB DEFAULT '[]',
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
  )`, 'subscription_plans');
  await run(`CREATE TABLE IF NOT EXISTS subscriptions (
    id             SERIAL PRIMARY KEY,
    customer_id    UUID REFERENCES customers(id) ON DELETE CASCADE,
    plan_id        INT REFERENCES subscription_plans(id) ON DELETE SET NULL,
    status         VARCHAR(20) DEFAULT 'active',
    start_date     DATE NOT NULL,
    end_date       DATE,
    next_billing   DATE,
    amount         DECIMAL(10,2) DEFAULT 0,
    auto_renew     BOOLEAN DEFAULT true,
    notes          TEXT,
    cancelled_at   TIMESTAMPTZ,
    cancel_reason  TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
  )`, 'subscriptions');
  await run(`CREATE TABLE IF NOT EXISTS subscription_payments (
    id              SERIAL PRIMARY KEY,
    subscription_id INT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    amount          DECIMAL(10,2) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',
    payment_date    DATE,
    method          VARCHAR(50),
    reference       VARCHAR(100),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`, 'subscription_payments');
}
migrate();

// ── PLANS ─────────────────────────────────────────────────────────────────────
router.get('/plans', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
             (SELECT COUNT(*)::int FROM subscriptions s WHERE s.plan_id=p.id AND s.status='active') AS subscriber_count
      FROM subscription_plans p
      ORDER BY p.price
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/plans', authMiddleware, async (req, res) => {
  const { name, description, price, billing_cycle, features } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO subscription_plans (name, description, price, billing_cycle, features)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [name, description||null, price||0, billing_cycle||'monthly', JSON.stringify(features||[])]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/plans/:id', authMiddleware, async (req, res) => {
  const { name, description, price, billing_cycle, features, is_active } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE subscription_plans SET name=$1, description=$2, price=$3, billing_cycle=$4,
        features=$5, is_active=$6, updated_at=NOW()
      WHERE id=$7 RETURNING *
    `, [name, description||null, price||0, billing_cycle||'monthly',
        JSON.stringify(features||[]), is_active ?? true, req.params.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/plans/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM subscription_plans WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const { status, plan_id, q } = req.query;
  const filters = []; const params = [];
  if (status)  { params.push(status);  filters.push(`s.status=$${params.length}`); }
  if (plan_id) { params.push(plan_id); filters.push(`s.plan_id=$${params.length}`); }
  if (q)       { params.push(`%${q}%`); filters.push(`c.name ILIKE $${params.length}`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
             s.amount            AS price,
             s.next_billing      AS next_billing_date,
             p.billing_cycle,
             c.name              AS customer_name,
             c.email             AS customer_email,
             p.name              AS plan_name
      FROM subscriptions s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN subscription_plans p ON p.id = s.plan_id
      ${where}
      ORDER BY s.updated_at DESC
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [active, total, cancelled, mrr, expiring] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM subscriptions WHERE status='active'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM subscriptions`),
      pool.query(`SELECT COUNT(*)::int AS n FROM subscriptions WHERE status='cancelled'`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS n FROM subscriptions WHERE status='active'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM subscriptions WHERE status='active' AND next_billing <= NOW() + INTERVAL '7 days'`),
    ]);
    res.json({
      active: active.rows[0].n, total: total.rows[0].n,
      cancelled: cancelled.rows[0].n, mrr: mrr.rows[0].n, expiring: expiring.rows[0].n,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, c.name AS customer_name, c.email AS customer_email, p.name AS plan_name
      FROM subscriptions s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    const payments = await pool.query(
      `SELECT * FROM subscription_payments WHERE subscription_id=$1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ ...rows[0], payments: payments.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
  const { customer_id, plan_id, start_date, end_date, next_billing, amount, auto_renew, notes } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO subscriptions (customer_id, plan_id, start_date, end_date, next_billing, amount, auto_renew, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [customer_id, plan_id||null, start_date, end_date||null, next_billing||null,
        amount||0, auto_renew ?? true, notes||null]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { status, plan_id, start_date, end_date, next_billing, amount, auto_renew, notes, cancel_reason } = req.body;
  try {
    // Usa COALESCE para que campos omitidos mantenham o valor actual da BD
    const { rows } = await pool.query(`
      UPDATE subscriptions SET
        status      = COALESCE($1, status),
        plan_id     = COALESCE($2::int, plan_id),
        start_date  = COALESCE($3::date, start_date),
        end_date    = COALESCE($4::date, end_date),
        next_billing= COALESCE($5::date, next_billing),
        amount      = COALESCE($6::numeric, amount),
        auto_renew  = COALESCE($7::boolean, auto_renew),
        notes       = COALESCE($8, notes),
        cancelled_at= CASE WHEN $1='cancelled' THEN NOW() ELSE cancelled_at END,
        cancel_reason= COALESCE($9, cancel_reason),
        updated_at  = NOW()
      WHERE id=$10 RETURNING *
    `, [status||null, plan_id||null, start_date||null, end_date||null,
        next_billing||null, amount != null ? amount : null,
        auto_renew != null ? auto_renew : null,
        notes||null, cancel_reason||null, req.params.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM subscriptions WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PAYMENTS ──────────────────────────────────────────────────────────────────
router.post('/:id/payments', authMiddleware, async (req, res) => {
  const { amount, status, payment_date, method, reference, notes } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO subscription_payments (subscription_id, amount, status, payment_date, method, reference, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [req.params.id, amount, status||'paid', payment_date||null, method||null, reference||null, notes||null]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
