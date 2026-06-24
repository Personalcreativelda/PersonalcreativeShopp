import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

pool.query(
  `UPDATE supplier_invoices SET status = 'overdue'
   WHERE status IN ('received','approved') AND due_date < CURRENT_DATE`
).catch(() => {});

const mapBill = (r) => ({
  id:             r.id,
  billNumber:     r.bill_number,
  purchaseId:     r.purchase_id,
  purchaseNumber: r.po_number,
  supplierId:     r.supplier_id,
  supplierName:   r.supplier_name,
  supplierNuit:   r.supplier_nuit,
  supplierEmail:  r.supplier_email,
  supplierPhone:  r.supplier_phone,
  status:         r.status,
  billDate:       r.bill_date,
  dueDate:        r.due_date,
  receivedDate:   r.received_date,
  paidAt:         r.paid_at,
  items:          r.items || [],
  subtotal:       Number(r.subtotal      || 0),
  vatRate:        Number(r.vat_rate      || 16),
  vatAmount:      Number(r.vat_amount    || 0),
  totalAmount:    Number(r.total_amount  || 0),
  amountPaid:     Number(r.amount_paid   || 0),
  paymentMethod:  r.payment_method,
  accountId:      r.account_id,
  notes:          r.notes,
  internalNotes:  r.internal_notes,
  createdByName:  r.creator_name,
  approvedByName: r.approver_name,
  approvedAt:     r.approved_at,
  createdAt:      r.created_at,
  updatedAt:      r.updated_at,
});

const BASE = `
  SELECT si.*,
         pc.name  AS creator_name,
         pa.name  AS approver_name,
         pu.po_number
  FROM supplier_invoices si
  LEFT JOIN profiles  pc ON pc.id = si.created_by
  LEFT JOIN profiles  pa ON pa.id = si.approved_by
  LEFT JOIN purchases pu ON pu.id = si.purchase_id
`;

async function nextBillNumber(client) {
  const { rows } = await client.query(
    `UPDATE tax_config
       SET ap_bill_counter = ap_bill_counter + 1, updated_at = NOW()
     WHERE id = 1
     RETURNING ap_bill_prefix, ap_bill_counter, EXTRACT(YEAR FROM NOW())::int AS yr`
  );
  const { ap_bill_prefix, ap_bill_counter, yr } = rows[0];
  return `${ap_bill_prefix}/${yr}/${String(ap_bill_counter).padStart(4, '0')}`;
}

function computeTotals(items = [], vatRate = 16) {
  const subtotal  = items.reduce((s, i) => s + Number(i.quantity || 1) * Number(i.unitPrice || i.price || 0), 0);
  const vatAmount = subtotal * vatRate / 100;
  const total     = subtotal + vatAmount;
  return {
    subtotal:  Math.round(subtotal  * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    total:     Math.round(total     * 100) / 100,
  };
}

// GET /api/ap?status=&search=&from=&to=&limit=&offset=
router.get('/', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `UPDATE supplier_invoices SET status = 'overdue'
       WHERE status IN ('received','approved') AND due_date < CURRENT_DATE`
    );
    const { status, search, from, to, limit = 50, offset = 0 } = req.query;
    const conds = [], params = [];

    if (status) { conds.push(`si.status = $${params.length + 1}`); params.push(status); }
    if (from)   { conds.push(`si.bill_date >= $${params.length + 1}`); params.push(from); }
    if (to)     { conds.push(`si.bill_date <= $${params.length + 1}`); params.push(to); }
    if (search) {
      conds.push(`(si.bill_number ILIKE $${params.length + 1} OR si.supplier_name ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const [data, cnt, totals] = await Promise.all([
      pool.query(
        `${BASE} ${where} ORDER BY si.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, Number(limit), Number(offset)]
      ),
      pool.query(`SELECT COUNT(*) FROM supplier_invoices si ${where}`, params),
      pool.query(
        `SELECT
           COALESCE(SUM(si.total_amount) FILTER (WHERE si.status != 'cancelled'), 0)                                                   AS total_billed,
           COALESCE(SUM(si.total_amount - si.amount_paid) FILTER (WHERE si.status IN ('received','approved','partial','overdue')), 0)  AS total_outstanding,
           COALESCE(SUM(si.total_amount) FILTER (WHERE si.status = 'paid'), 0)                                                         AS total_paid,
           COALESCE(SUM(si.total_amount - si.amount_paid) FILTER (WHERE si.status = 'overdue'), 0)                                    AS total_overdue
         FROM supplier_invoices si ${where}`,
        params
      ),
    ]);

    res.json({
      bills:            data.rows.map(mapBill),
      total:            Number(cnt.rows[0].count),
      totalBilled:      Number(totals.rows[0].total_billed),
      totalOutstanding: Number(totals.rows[0].total_outstanding),
      totalPaid:        Number(totals.rows[0].total_paid),
      totalOverdue:     Number(totals.rows[0].total_overdue),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/ap/aging — AP aging by supplier
router.get('/aging', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `UPDATE supplier_invoices SET status = 'overdue'
       WHERE status IN ('received','approved') AND due_date < CURRENT_DATE`
    );
    const { rows } = await pool.query(`
      SELECT
        supplier_name,
        COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE due_date >= CURRENT_DATE), 0)                                  AS current_due,
        COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE due_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE - 1), 0)  AS days_1_30,
        COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE due_date BETWEEN CURRENT_DATE - 60 AND CURRENT_DATE - 31), 0) AS days_31_60,
        COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE due_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 61), 0) AS days_61_90,
        COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE due_date < CURRENT_DATE - 90), 0)                             AS days_90_plus,
        COALESCE(SUM(total_amount - amount_paid), 0)                                                                          AS total_outstanding
      FROM supplier_invoices
      WHERE status IN ('received','approved','partial','overdue')
      GROUP BY supplier_name
      ORDER BY total_outstanding DESC
    `);

    const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0, total: 0 };
    for (const r of rows) {
      buckets.current   += Number(r.current_due);
      buckets.days1_30  += Number(r.days_1_30);
      buckets.days31_60 += Number(r.days_31_60);
      buckets.days61_90 += Number(r.days_61_90);
      buckets.days90Plus += Number(r.days_90_plus);
      buckets.total     += Number(r.total_outstanding);
    }

    res.json({
      suppliers: rows.map(r => ({
        supplierName:     r.supplier_name,
        current:          Number(r.current_due),
        days1_30:         Number(r.days_1_30),
        days31_60:        Number(r.days_31_60),
        days61_90:        Number(r.days_61_90),
        days90Plus:       Number(r.days_90_plus),
        totalOutstanding: Number(r.total_outstanding),
      })),
      buckets,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/ap/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`${BASE} WHERE si.id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Factura de fornecedor não encontrada' });
    res.json(mapBill(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ap — create
router.post('/', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body;
    const vatRate = Number(b.vatRate ?? 16);
    const { subtotal, vatAmount, total } = computeTotals(b.items || [], vatRate);
    const status     = b.status === 'received' ? 'received' : 'draft';
    const billNumber = status === 'received'
      ? await nextBillNumber(client)
      : (b.billNumber || `RASCUNHO-${Date.now()}`);
    const dueDate = b.dueDate || (b.billDate
      ? new Date(new Date(b.billDate).getTime() + 30 * 86400000).toISOString().slice(0, 10)
      : null);

    const { rows } = await client.query(
      `INSERT INTO supplier_invoices
         (bill_number, purchase_id, supplier_id, supplier_name, supplier_nuit, supplier_email, supplier_phone,
          status, bill_date, due_date, received_date, items, subtotal, vat_rate, vat_amount, total_amount,
          payment_method, account_id, notes, internal_notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [billNumber, b.purchaseId || null, b.supplierId || null, b.supplierName || null,
       b.supplierNuit || null, b.supplierEmail || null, b.supplierPhone || null,
       status, b.billDate || null, dueDate, b.receivedDate || null,
       JSON.stringify(b.items || []), subtotal, vatRate, vatAmount, total,
       b.paymentMethod || null, b.accountId || null, b.notes || null, b.internalNotes || null,
       req.user.id]
    );
    await client.query('COMMIT');
    const { rows: full } = await pool.query(`${BASE} WHERE si.id = $1`, [rows[0].id]);
    res.status(201).json(mapBill(full[0]));
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// PUT /api/ap/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: ex } = await client.query('SELECT * FROM supplier_invoices WHERE id = $1', [req.params.id]);
    if (!ex.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Não encontrada' }); }
    const b = req.body;
    const vatRate = Number(b.vatRate ?? ex[0].vat_rate ?? 16);
    const items   = b.items ?? ex[0].items;
    const { subtotal, vatAmount, total } = computeTotals(items, vatRate);

    const { rows } = await client.query(
      `UPDATE supplier_invoices SET
         supplier_name   = COALESCE($1,  supplier_name),
         supplier_nuit   = COALESCE($2,  supplier_nuit),
         supplier_email  = COALESCE($3,  supplier_email),
         supplier_phone  = COALESCE($4,  supplier_phone),
         bill_date       = COALESCE($5,  bill_date),
         due_date        = COALESCE($6,  due_date),
         items           = $7,  subtotal = $8, vat_rate = $9, vat_amount = $10, total_amount = $11,
         notes           = COALESCE($12, notes),
         account_id      = COALESCE($13, account_id),
         updated_at      = NOW()
       WHERE id = $14 RETURNING *`,
      [b.supplierName ?? null, b.supplierNuit ?? null, b.supplierEmail ?? null, b.supplierPhone ?? null,
       b.billDate ?? null, b.dueDate ?? null,
       JSON.stringify(items), subtotal, vatRate, vatAmount, total,
       b.notes ?? null, b.accountId ?? null, req.params.id]
    );
    await client.query('COMMIT');
    const { rows: full } = await pool.query(`${BASE} WHERE si.id = $1`, [rows[0].id]);
    res.json(mapBill(full[0]));
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// POST /api/ap/:id/receive — draft → received
router.post('/:id/receive', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: ex } = await client.query('SELECT * FROM supplier_invoices WHERE id = $1', [req.params.id]);
    if (!ex.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Não encontrada' }); }
    if (ex[0].status !== 'draft') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Só rascunhos podem ser recebidos' }); }

    const number  = await nextBillNumber(client);
    const today   = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const { rows } = await client.query(
      `UPDATE supplier_invoices
         SET bill_number = $1, status = 'received', bill_date = $2,
             due_date = COALESCE(due_date, $3), received_date = $2, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [number, today, dueDate, req.params.id]
    );
    await client.query('COMMIT');
    const { rows: full } = await pool.query(`${BASE} WHERE si.id = $1`, [rows[0].id]);
    res.json(mapBill(full[0]));
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// POST /api/ap/:id/approve
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { rows: ex } = await pool.query('SELECT status FROM supplier_invoices WHERE id = $1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Não encontrada' });
    if (!['draft', 'received'].includes(ex[0].status)) return res.status(400).json({ error: `Estado inválido: ${ex[0].status}` });
    const { rows } = await pool.query(
      `UPDATE supplier_invoices
         SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    const { rows: full } = await pool.query(`${BASE} WHERE si.id = $1`, [rows[0].id]);
    res.json(mapBill(full[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ap/:id/pay
router.post('/:id/pay', authMiddleware, async (req, res) => {
  try {
    const { rows: ex } = await pool.query('SELECT * FROM supplier_invoices WHERE id = $1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Não encontrada' });
    const inv       = ex[0];
    const paid      = Number(req.body.amountPaid ?? inv.total_amount);
    const newStatus = paid >= Number(inv.total_amount) ? 'paid' : 'partial';
    const { rows } = await pool.query(
      `UPDATE supplier_invoices
         SET amount_paid = $1, payment_method = COALESCE($2, payment_method),
             paid_at = COALESCE($3, NOW()), status = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [paid, req.body.paymentMethod || null, req.body.paidAt || null, newStatus, req.params.id]
    );
    const { rows: full } = await pool.query(`${BASE} WHERE si.id = $1`, [rows[0].id]);
    res.json(mapBill(full[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ap/:id/cancel
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE supplier_invoices
         SET status = 'cancelled', internal_notes = COALESCE($1, internal_notes), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.body.reason || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrada' });
    const { rows: full } = await pool.query(`${BASE} WHERE si.id = $1`, [rows[0].id]);
    res.json(mapBill(full[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
