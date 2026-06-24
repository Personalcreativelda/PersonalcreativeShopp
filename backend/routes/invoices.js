import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const CREATE_INVOICES_SQL = `
  CREATE TABLE IF NOT EXISTS invoices (
    id                BIGSERIAL     PRIMARY KEY,
    invoice_number    VARCHAR(50)   NOT NULL,
    order_id          BIGINT        REFERENCES orders(id)     ON DELETE SET NULL,
    customer_id       BIGINT        REFERENCES customers(id)  ON DELETE SET NULL,
    customer_name     VARCHAR(200),
    customer_phone    VARCHAR(50),
    customer_email    VARCHAR(100),
    customer_nuit     VARCHAR(20),
    customer_address  TEXT,
    status            VARCHAR(20)   NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','issued','paid','partial','overdue','cancelled')),
    issued_at         DATE,
    due_date          DATE,
    paid_at           TIMESTAMPTZ,
    items             JSONB         NOT NULL DEFAULT '[]',
    subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    delivery_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,
    vat_rate          NUMERIC(5,2)  NOT NULL DEFAULT 16,
    vat_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_method    VARCHAR(50),
    amount_paid       NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes             TEXT,
    internal_notes    TEXT,
    created_by        BIGINT        REFERENCES profiles(id)   ON DELETE SET NULL,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS invoices_order_id_idx      ON invoices(order_id);
  CREATE INDEX IF NOT EXISTS invoices_customer_id_idx   ON invoices(customer_id);
  CREATE INDEX IF NOT EXISTS invoices_status_idx        ON invoices(status);
  CREATE INDEX IF NOT EXISTS invoices_issued_at_idx     ON invoices(issued_at DESC);
`;

// Auto-migrate: create invoices table if missing (inline SQL — no file dependency)
pool.query(CREATE_INVOICES_SQL)
  .then(() => {
    console.log('[invoices] ✅ tabela invoices OK');
    pool.query(`UPDATE invoices SET status = 'overdue' WHERE status = 'issued' AND due_date < CURRENT_DATE`).catch(() => {});
  })
  .catch(err => console.error('[invoices] ❌ setup:', err.message));

const mapInvoice = (r) => ({
  id:              r.id,
  invoiceNumber:   r.invoice_number,
  orderId:         r.order_id,
  customerId:      r.customer_id,
  customerName:    r.customer_name,
  customerPhone:   r.customer_phone,
  customerEmail:   r.customer_email,
  customerNuit:    r.customer_nuit,
  customerAddress: r.customer_address,
  status:          r.status,
  issuedAt:        r.issued_at,
  dueDate:         r.due_date,
  paidAt:          r.paid_at,
  items:           r.items || [],
  subtotal:        Number(r.subtotal  || 0),
  discountAmount:  Number(r.discount_amount || 0),
  deliveryFee:     Number(r.delivery_fee    || 0),
  vatRate:         Number(r.vat_rate  || 16),
  vatAmount:       Number(r.vat_amount || 0),
  totalAmount:     Number(r.total_amount || 0),
  paymentMethod:   r.payment_method,
  amountPaid:      Number(r.amount_paid || 0),
  notes:           r.notes,
  internalNotes:   r.internal_notes,
  createdBy:       r.created_by,
  createdByName:   r.creator_name,
  createdAt:       r.created_at,
  updatedAt:       r.updated_at,
  orderNumber:     r.order_number,
});

const BASE_SELECT = `
  SELECT i.*,
         p.name AS creator_name,
         o.order_number
  FROM invoices i
  LEFT JOIN profiles p ON p.id = i.created_by
  LEFT JOIN orders   o ON o.id = i.order_id
`;

// ── Next invoice number ────────────────────────────────────────────────────────
async function nextInvoiceNumber(client) {
  const { rows } = await client.query(
    `UPDATE tax_config
       SET invoice_counter = invoice_counter + 1, updated_at = NOW()
     WHERE id = 1
     RETURNING invoice_prefix, invoice_counter, EXTRACT(YEAR FROM NOW())::int AS yr`
  );
  const { invoice_prefix, invoice_counter, yr } = rows[0];
  return `${invoice_prefix}/${yr}/${String(invoice_counter).padStart(4, '0')}`;
}

// ── Error helper ──────────────────────────────────────────────────────────────
const PG_MESSAGES = {
  '22P02': [400, 'ID ou valor com formato inválido'],
  '22003': [400, 'Valor fora do intervalo permitido'],
  '23502': [400, 'Campo obrigatório em falta'],
  '23503': [400, 'Referência inválida — registo relacionado não existe'],
  '23505': [409, 'Já existe um registo com esses dados (duplicado)'],
  '42P01': [500, 'Tabela não encontrada — execute a migração'],
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errReply(res, err, ctx = '') {
  console.error(`[invoices]${ctx ? ' ' + ctx : ''}`, err.code ? `PG(${err.code})` : '', err.message);
  const [status, msg] = PG_MESSAGES[err.code] || [500, err.message];
  res.status(status).json({ error: msg });
}

// ── Compute totals from items ──────────────────────────────────────────────────
function computeTotals(items = [], discount = 0, deliveryFee = 0, vatRate = 16) {
  const subtotal = items.reduce((s, i) => s + (Number(i.quantity || 1) * Number(i.unitPrice || i.price || 0)), 0);
  const taxable  = Math.max(0, subtotal - discount + deliveryFee);
  const vatAmount = taxable * vatRate / (100 + vatRate);
  const total = subtotal - discount + deliveryFee;
  return { subtotal, vatAmount: Math.round(vatAmount * 100) / 100, total: Math.round(total * 100) / 100 };
}

// GET /api/invoices?status=&from=&to=&search=&limit=&offset=
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, from, to, search, limit = 50, offset = 0 } = req.query;

    // Auto-update overdue
    await pool.query(`UPDATE invoices SET status = 'overdue' WHERE status = 'issued' AND due_date < CURRENT_DATE`);

    const conditions = [];
    const params = [];

    if (status) { conditions.push(`i.status = $${params.length + 1}`); params.push(status); }
    if (from)   { conditions.push(`i.issued_at >= $${params.length + 1}`); params.push(from); }
    if (to)     { conditions.push(`i.issued_at <= $${params.length + 1}`); params.push(to); }
    if (search) {
      conditions.push(`(i.invoice_number ILIKE $${params.length + 1} OR i.customer_name ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [data, countRow] = await Promise.all([
      pool.query(`${BASE_SELECT} ${where} ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, Number(limit), Number(offset)]),
      pool.query(`SELECT COUNT(*) FROM invoices i ${where}`, params),
    ]);

    // Totals for filtered set
    const { rows: totals } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN i.total_amount END), 0) AS total_invoiced,
         COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount END), 0) AS total_paid,
         COALESCE(SUM(CASE WHEN i.status IN ('issued','overdue','partial') THEN i.total_amount - i.amount_paid END), 0) AS total_outstanding
       FROM invoices i ${where}`, params
    );

    res.json({
      invoices:         data.rows.map(mapInvoice),
      total:            Number(countRow.rows[0]?.count || 0),
      totalInvoiced:    Number(totals[0]?.total_invoiced    || 0),
      totalPaid:        Number(totals[0]?.total_paid        || 0),
      totalOutstanding: Number(totals[0]?.total_outstanding || 0),
    });
  } catch (err) { errReply(res, err, 'GET /'); }
});

// GET /api/invoices/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`${BASE_SELECT} WHERE i.id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Fatura não encontrada' });
    res.json(mapInvoice(rows[0]));
  } catch (err) { errReply(res, err, 'GET /:id'); }
});

// POST /api/invoices — create (draft or immediately issue)
router.post('/', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const b = req.body;
    const vatRate = b.vatRate != null
      ? Number(b.vatRate)
      : Number((await client.query('SELECT vat_rate FROM tax_config WHERE id = 1')).rows[0]?.vat_rate || 16);
    const { subtotal, vatAmount, total } = computeTotals(b.items, Number(b.discountAmount || 0), Number(b.deliveryFee || 0), vatRate);
    const status  = b.status === 'issued' ? 'issued' : 'draft';
    const issuedAt = status === 'issued' ? (b.issuedAt || new Date().toISOString().slice(0, 10)) : (b.issuedAt || null);
    const dueDate  = b.dueDate || (issuedAt ? new Date(new Date(issuedAt).getTime() + 30 * 86400000).toISOString().slice(0, 10) : null);

    // Auto-generate invoice number only when issuing
    const invoiceNumber = status === 'issued'
      ? await nextInvoiceNumber(client)
      : (b.invoiceNumber || `RASCUNHO-${Date.now()}`);

    const { rows } = await client.query(
      `INSERT INTO invoices
         (invoice_number, order_id, customer_id, customer_name, customer_phone, customer_email,
          customer_nuit, customer_address, status, issued_at, due_date,
          items, subtotal, discount_amount, delivery_fee, vat_rate, vat_amount, total_amount,
          payment_method, amount_paid, notes, internal_notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING *`,
      [invoiceNumber, b.orderId || null, b.customerId || null, b.customerName || null,
       b.customerPhone || null, b.customerEmail || null, b.customerNuit || null,
       b.customerAddress || null, status, issuedAt, dueDate,
       JSON.stringify(b.items || []), subtotal, Number(b.discountAmount || 0),
       Number(b.deliveryFee || 0), vatRate, vatAmount, total,
       b.paymentMethod || null, Number(b.amountPaid || 0),
       b.notes || null, b.internalNotes || null, req.user.id]
    );

    // If created from an order, link invoice_number back to order
    if (b.orderId && status === 'issued') {
      await client.query(`UPDATE orders SET invoice_number = $1 WHERE id = $2`, [invoiceNumber, b.orderId]);
    }

    await client.query('COMMIT');
    const { rows: full } = await pool.query(`${BASE_SELECT} WHERE i.id = $1`, [rows[0].id]);
    res.status(201).json(mapInvoice(full[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    errReply(res, err, 'POST /');
  } finally { client.release(); }
});

// PUT /api/invoices/:id — update (draft only for most fields)
router.put('/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Fatura não encontrada' });

    const inv = existing[0];
    const b   = req.body;
    const vatRate = Number(b.vatRate ?? inv.vat_rate ?? 16);
    const items   = b.items ?? inv.items;
    const { subtotal, vatAmount, total } = computeTotals(items, Number(b.discountAmount ?? inv.discount_amount ?? 0), Number(b.deliveryFee ?? inv.delivery_fee ?? 0), vatRate);

    const { rows } = await client.query(
      `UPDATE invoices SET
         customer_name    = COALESCE($1, customer_name),
         customer_phone   = COALESCE($2, customer_phone),
         customer_email   = COALESCE($3, customer_email),
         customer_nuit    = COALESCE($4, customer_nuit),
         customer_address = COALESCE($5, customer_address),
         items            = $6,
         subtotal         = $7,
         discount_amount  = $8,
         delivery_fee     = $9,
         vat_rate         = $10,
         vat_amount       = $11,
         total_amount     = $12,
         notes            = COALESCE($13, notes),
         internal_notes   = COALESCE($14, internal_notes),
         issued_at        = COALESCE($15, issued_at),
         due_date         = COALESCE($16, due_date),
         updated_at       = NOW()
       WHERE id = $17 RETURNING *`,
      [b.customerName ?? null, b.customerPhone ?? null, b.customerEmail ?? null,
       b.customerNuit ?? null, b.customerAddress ?? null,
       JSON.stringify(items), subtotal, Number(b.discountAmount ?? inv.discount_amount ?? 0),
       Number(b.deliveryFee ?? inv.delivery_fee ?? 0), vatRate, vatAmount, total,
       b.notes ?? null, b.internalNotes ?? null, b.issuedAt ?? null, b.dueDate ?? null,
       req.params.id]
    );
    await client.query('COMMIT');
    const { rows: full } = await pool.query(`${BASE_SELECT} WHERE i.id = $1`, [rows[0].id]);
    res.json(mapInvoice(full[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    errReply(res, err, 'PUT /:id');
  } finally { client.release(); }
});

// POST /api/invoices/:id/issue — draft → issued (generates number)
router.post('/:id/issue', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!existing.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Fatura não encontrada' }); }
    const inv = existing[0];
    if (inv.status !== 'draft') { await client.query('ROLLBACK'); return res.status(400).json({ error: `Não pode emitir uma fatura com estado '${inv.status}'` }); }

    const number = await nextInvoiceNumber(client);
    const issuedAt = req.body.issuedAt || new Date().toISOString().slice(0, 10);
    const dueDate  = req.body.dueDate  || new Date(new Date(issuedAt).getTime() + 30 * 86400000).toISOString().slice(0, 10);

    const { rows } = await client.query(
      `UPDATE invoices SET invoice_number = $1, status = 'issued', issued_at = $2, due_date = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [number, issuedAt, dueDate, req.params.id]
    );
    if (inv.order_id) {
      await client.query(`UPDATE orders SET invoice_number = $1 WHERE id = $2`, [number, inv.order_id]);
    }
    await client.query('COMMIT');
    const { rows: full } = await pool.query(`${BASE_SELECT} WHERE i.id = $1`, [rows[0].id]);
    res.json(mapInvoice(full[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    errReply(res, err, 'POST /:id/issue');
  } finally { client.release(); }
});

// POST /api/invoices/:id/pay — mark as paid/partial
router.post('/:id/pay', authMiddleware, async (req, res) => {
  try {
    const { amountPaid, paymentMethod, paidAt } = req.body;
    const { rows: existing } = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Fatura não encontrada' });

    const inv     = existing[0];
    const paid    = Number(amountPaid ?? inv.total_amount);
    const newStatus = paid >= Number(inv.total_amount) ? 'paid' : 'partial';

    const { rows } = await pool.query(
      `UPDATE invoices SET
         amount_paid    = $1,
         payment_method = COALESCE($2, payment_method),
         paid_at        = COALESCE($3, NOW()),
         status         = $4,
         updated_at     = NOW()
       WHERE id = $5 RETURNING *`,
      [paid, paymentMethod || null, paidAt || null, newStatus, req.params.id]
    );

    // Update linked order payment_status
    if (inv.order_id && newStatus === 'paid') {
      await pool.query(`UPDATE orders SET payment_status = 'paid', amount_paid = $1 WHERE id = $2`, [paid, inv.order_id]);
    }

    const { rows: full } = await pool.query(`${BASE_SELECT} WHERE i.id = $1`, [rows[0].id]);
    res.json(mapInvoice(full[0]));
  } catch (err) { errReply(res, err, 'POST /:id/pay'); }
});

// POST /api/invoices/:id/cancel
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE invoices SET status = 'cancelled', internal_notes = COALESCE($1, internal_notes), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.body.reason || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Fatura não encontrada' });
    const { rows: full } = await pool.query(`${BASE_SELECT} WHERE i.id = $1`, [rows[0].id]);
    res.json(mapInvoice(full[0]));
  } catch (err) { errReply(res, err, 'POST /:id/cancel'); }
});

// POST /api/invoices/from-order/:orderId — create invoice from existing order
router.post('/from-order/:orderId', authMiddleware, async (req, res) => {
  const { orderId } = req.params;
  if (!UUID_RE.test(orderId)) {
    return res.status(400).json({ error: `ID de encomenda inválido: "${orderId}" — deve ser um UUID` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orders } = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!orders.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Encomenda não encontrada' }); }
    const o = orders[0];

    // Check if already has an issued invoice
    const { rows: existing } = await client.query(
      `SELECT id FROM invoices WHERE order_id = $1 AND status != 'cancelled'`, [o.id]
    );
    if (existing.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Esta encomenda já tem fatura emitida', invoiceId: existing[0].id }); }

    const { rows: taxRows } = await client.query('SELECT * FROM tax_config WHERE id = 1');
    const vatRate = Number(taxRows[0]?.vat_rate || 16);
    const items   = (o.items || []).map(i => ({
      name:      i.productName || i.name || '',
      variantName: i.variantName,
      quantity:  i.quantity || 1,
      unitPrice: Number(i.price || 0),
      total:     (i.quantity || 1) * Number(i.price || 0),
    }));

    const discountAmount = Number(o.discount_amount || 0);
    const deliveryFee    = Number(o.delivery_fee    || 0);
    const { subtotal, vatAmount, total } = computeTotals(items, discountAmount, deliveryFee, vatRate);
    const number = await nextInvoiceNumber(client);
    const issuedAt = new Date().toISOString().slice(0, 10);
    const dueDate  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const { rows } = await client.query(
      `INSERT INTO invoices
         (invoice_number, order_id, customer_id, customer_name, customer_phone,
          status, issued_at, due_date, items, subtotal, discount_amount, delivery_fee,
          vat_rate, vat_amount, total_amount, payment_method, amount_paid, created_by)
       VALUES ($1,$2,$3,$4,$5,'issued',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [number, o.id, o.customer_id || null, o.customer_name, o.customer_phone,
       issuedAt, dueDate, JSON.stringify(items), subtotal, discountAmount, deliveryFee,
       vatRate, vatAmount, total,
       o.payment_method || null, o.payment_status === 'paid' ? total : 0,
       req.user.id]
    );

    await client.query(`UPDATE orders SET invoice_number = $1 WHERE id = $2`, [number, o.id]);
    await client.query('COMMIT');
    const { rows: full } = await pool.query(`${BASE_SELECT} WHERE i.id = $1`, [rows[0].id]);
    res.status(201).json(mapInvoice(full[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    errReply(res, err, 'POST /from-order/:orderId');
  } finally { client.release(); }
});

// DELETE /api/invoices/:id — only drafts
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT status FROM invoices WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Fatura não encontrada' });
    if (rows[0].status !== 'draft') return res.status(400).json({ error: 'Só rascunhos podem ser eliminados. Cancele a fatura em vez disso.' });
    await pool.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { errReply(res, err, 'DELETE /:id'); }
});

// GET /api/invoices/stats/summary — KPIs for AR dashboard
router.get('/stats/summary', authMiddleware, async (req, res) => {
  try {
    await pool.query(`UPDATE invoices SET status = 'overdue' WHERE status = 'issued' AND due_date < CURRENT_DATE`);

    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status != 'cancelled') AS total_count,
        COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0) AS total_invoiced,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) AS total_paid,
        COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE status IN ('issued','partial','overdue')), 0) AS total_outstanding,
        COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE status = 'overdue'), 0) AS total_overdue,
        COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
        COUNT(*) FILTER (WHERE status = 'issued' AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS due_soon_count
      FROM invoices
    `);
    res.json(rows[0]);
  } catch (err) { errReply(res, err, 'GET /stats/summary'); }
});

export default router;
