import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// ── Auto-create table ──────────────────────────────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS quotes (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number    VARCHAR(50)  NOT NULL UNIQUE,
    customer_name   VARCHAR(200) DEFAULT '',
    customer_phone  VARCHAR(50)  DEFAULT '',
    customer_nuit   VARCHAR(30)  DEFAULT '',
    customer_email  VARCHAR(100) DEFAULT '',
    items           JSONB        NOT NULL DEFAULT '[]',
    subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount        DECIMAL(12,2) NOT NULL DEFAULT 0,
    total           DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes           TEXT         DEFAULT '',
    status          VARCHAR(20)  NOT NULL DEFAULT 'rascunho',
    valid_until     DATE,
    validity_days   INTEGER      NOT NULL DEFAULT 15,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),
    created_by      UUID
  );
  CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
  CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at DESC);
`).catch(e => console.error('[QUOTES] init:', e.message));

const mapQuote = (r) => ({
  id:            r.id,
  quoteNumber:   r.quote_number,
  customerName:  r.customer_name,
  customerPhone: r.customer_phone,
  customerNuit:  r.customer_nuit,
  customerEmail: r.customer_email,
  items:         r.items || [],
  subtotal:      Number(r.subtotal),
  discount:      Number(r.discount),
  total:         Number(r.total),
  notes:         r.notes || '',
  status:        r.status,
  validUntil:    r.valid_until ? r.valid_until.toISOString().slice(0, 10) : null,
  validityDays:  Number(r.validity_days),
  createdAt:     r.created_at,
  updatedAt:     r.updated_at,
});

// GET /api/quotes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, search, from, to, limit = 100, offset = 0 } = req.query;
    const conditions = [];
    const values = [];
    let i = 1;

    if (status && status !== 'todos') {
      conditions.push(`status = $${i++}`);
      values.push(status);
    }
    if (search) {
      conditions.push(`(customer_name ILIKE $${i} OR quote_number ILIKE $${i})`);
      values.push(`%${search}%`); i++;
    }
    if (from) { conditions.push(`created_at::date >= $${i++}`); values.push(from); }
    if (to)   { conditions.push(`created_at::date <= $${i++}`); values.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM quotes ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset]
    );
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM quotes ${where}`,
      values
    );
    res.json({ quotes: rows.map(mapQuote), total: count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/quotes/stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int                                                  AS total,
        COUNT(*) FILTER (WHERE status = 'rascunho')::int              AS rascunho,
        COUNT(*) FILTER (WHERE status = 'enviada')::int               AS enviada,
        COUNT(*) FILTER (WHERE status = 'aceite')::int                AS aceite,
        COUNT(*) FILTER (WHERE status = 'convertida')::int            AS convertida,
        COUNT(*) FILTER (WHERE status = 'expirada' OR (valid_until IS NOT NULL AND valid_until < CURRENT_DATE AND status NOT IN ('aceite','convertida','rejeitada')))::int AS expirada,
        COALESCE(SUM(total) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())), 0)::DECIMAL AS total_mes
      FROM quotes
    `);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/quotes/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Cotação não encontrada' });
    res.json(mapQuote(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/quotes
router.post('/', authMiddleware, async (req, res) => {
  try {
    const q = req.body;

    // Gerar número sequencial
    const { rows: [cfg] } = await pool.query(
      `UPDATE tax_config SET quote_counter = quote_counter + 1, updated_at = NOW()
       WHERE id = 1
       RETURNING quote_prefix, quote_counter, EXTRACT(YEAR FROM NOW())::int AS yr`
    );
    const quoteNumber = q.quoteNumber || `${cfg.quote_prefix}/${cfg.yr}/${String(cfg.quote_counter).padStart(4, '0')}`;

    const validUntil = q.validUntil || (() => {
      const d = new Date();
      d.setDate(d.getDate() + (q.validityDays || 15));
      return d.toISOString().slice(0, 10);
    })();

    const { rows } = await pool.query(
      `INSERT INTO quotes (quote_number, customer_name, customer_phone, customer_nuit, customer_email,
         items, subtotal, discount, total, notes, status, valid_until, validity_days, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [quoteNumber, q.customerName || '', q.customerPhone || '',
       q.customerNuit || '', q.customerEmail || '',
       JSON.stringify(q.items || []),
       q.subtotal || 0, q.discount || 0, q.total || 0,
       q.notes || '', q.status || 'rascunho',
       validUntil, q.validityDays || 15,
       req.user?.id || null]
    );
    res.status(201).json(mapQuote(rows[0]));
  } catch (err) {
    console.error('[POST /quotes]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/quotes/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const q = req.body;
    const { rows } = await pool.query(
      `UPDATE quotes SET
         customer_name  = COALESCE($1, customer_name),
         customer_phone = COALESCE($2, customer_phone),
         customer_nuit  = COALESCE($3, customer_nuit),
         customer_email = COALESCE($4, customer_email),
         items          = COALESCE($5, items),
         subtotal       = COALESCE($6, subtotal),
         discount       = COALESCE($7, discount),
         total          = COALESCE($8, total),
         notes          = COALESCE($9, notes),
         status         = COALESCE($10, status),
         valid_until    = COALESCE($11, valid_until),
         validity_days  = COALESCE($12, validity_days),
         updated_at     = NOW()
       WHERE id = $13 RETURNING *`,
      [q.customerName, q.customerPhone, q.customerNuit, q.customerEmail,
       q.items ? JSON.stringify(q.items) : null,
       q.subtotal, q.discount, q.total, q.notes, q.status,
       q.validUntil || null, q.validityDays,
       req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cotação não encontrada' });
    res.json(mapQuote(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/quotes/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM quotes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
