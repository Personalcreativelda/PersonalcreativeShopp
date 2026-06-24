import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Helper: escape CSV cell
const csv = (v) => {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (...cols) => cols.map(csv).join(',');

// GET /api/reports/accounting?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|json
router.get('/accounting', authMiddleware, async (req, res) => {
  try {
    const from   = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to     = req.query.to   || new Date().toISOString().slice(0, 10);
    const format = req.query.format === 'json' ? 'json' : 'csv';

    const { rows: tcRows } = await pool.query('SELECT vat_rate FROM tax_config WHERE id = 1');
    const vatRate = Number(tcRows[0]?.vat_rate || 16);
    const divisor = 100 + vatRate;

    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.order_number,
         o.created_at,
         o.customer_name,
         o.customer_phone,
         o.payment_method,
         o.status,
         o.total_amount,
         o.discount_amount,
         o.delivery_fee,
         o.source,
         COALESCE(o.total_amount, 0) * $3 / $4 AS vat_amount,
         COALESCE(o.total_amount, 0) - COALESCE(o.total_amount, 0) * $3 / $4 AS net_amount
       FROM orders o
       WHERE o.created_at::date >= $1
         AND o.created_at::date <= $2
         AND o.status NOT IN ('cancelled')
       ORDER BY o.created_at ASC`,
      [from, to, vatRate, divisor]
    );

    if (format === 'json') {
      return res.json({ from, to, vatRate, count: rows.length, rows });
    }

    // CSV export
    const lines = [
      csvRow('ID', 'Nº Doc', 'Data', 'Cliente', 'Telefone', 'Pagamento', 'Estado', 'Origem',
             'Desconto (MT)', 'Entrega (MT)', 'Base Tributável (MT)', `IVA ${vatRate}% (MT)`, 'Total Bruto (MT)'),
      ...rows.map(r => csvRow(
        r.id,
        r.order_number || '',
        new Date(r.created_at).toLocaleString('pt-MZ'),
        r.customer_name || '',
        r.customer_phone || '',
        r.payment_method || '',
        r.status,
        r.source || 'online',
        Number(r.discount_amount || 0).toFixed(2),
        Number(r.delivery_fee   || 0).toFixed(2),
        Number(r.net_amount     || 0).toFixed(2),
        Number(r.vat_amount     || 0).toFixed(2),
        Number(r.total_amount   || 0).toFixed(2),
      )),
    ];

    // Totals footer
    const totals = rows.reduce((acc, r) => ({
      discount: acc.discount + Number(r.discount_amount || 0),
      delivery: acc.delivery + Number(r.delivery_fee   || 0),
      net:      acc.net     + Number(r.net_amount      || 0),
      vat:      acc.vat     + Number(r.vat_amount      || 0),
      total:    acc.total   + Number(r.total_amount    || 0),
    }), { discount: 0, delivery: 0, net: 0, vat: 0, total: 0 });

    lines.push(csvRow(
      '', '', '', '', '', '', `TOTAL (${rows.length})`, '',
      totals.discount.toFixed(2),
      totals.delivery.toFixed(2),
      totals.net.toFixed(2),
      totals.vat.toFixed(2),
      totals.total.toFixed(2),
    ));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="contabilidade-${from}-${to}.csv"`);
    res.send('﻿' + lines.join('\r\n')); // BOM for Excel
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/vat-summary?month=YYYY-MM
router.get('/vat-summary', authMiddleware, async (req, res) => {
  try {
    const month  = req.query.month || new Date().toISOString().slice(0, 7);
    const from   = `${month}-01`;
    const toDate = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0);
    const to     = toDate.toISOString().slice(0, 10);

    const { rows: tcRows } = await pool.query('SELECT vat_rate FROM tax_config WHERE id = 1');
    const vatRate = Number(tcRows[0]?.vat_rate || 16);
    const divisor = 100 + vatRate;

    const { rows } = await pool.query(
      `SELECT
         payment_method,
         COUNT(*) AS count,
         COALESCE(SUM(total_amount), 0) AS gross,
         COALESCE(SUM(total_amount * $3 / $4), 0) AS vat,
         COALESCE(SUM(total_amount - total_amount * $3 / $4), 0) AS net
       FROM orders
       WHERE created_at::date >= $1
         AND created_at::date <= $2
         AND status NOT IN ('cancelled')
       GROUP BY payment_method`,
      [from, to, vatRate, divisor]
    );

    const totals = rows.reduce(
      (acc, r) => ({
        count: acc.count + Number(r.count),
        gross: acc.gross + Number(r.gross),
        vat:   acc.vat   + Number(r.vat),
        net:   acc.net   + Number(r.net),
      }),
      { count: 0, gross: 0, vat: 0, net: 0 }
    );

    res.json({ month, from, to, vatRate, byPaymentMethod: rows, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/loyalty-tiers — distribution of customers by tier
router.get('/loyalty-tiers', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(loyalty_tier, 'Semente') AS tier,
         COUNT(*) AS customer_count,
         COALESCE(SUM(loyalty_points), 0) AS total_points,
         ROUND(AVG(loyalty_points)) AS avg_points
       FROM profiles
       WHERE role != 'SUPER_ADMIN'
       GROUP BY loyalty_tier
       ORDER BY total_points DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/sales-summary?from=&to=
router.get('/sales-summary', authMiddleware, async (req, res) => {
  try {
    const from = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to   = req.query.to   || new Date().toISOString().slice(0, 10);

    const [daily, byStatus, bySource, byProduct] = await Promise.all([
      pool.query(
        `SELECT
           created_at::date AS day,
           COUNT(*) AS count,
           SUM(total_amount) AS revenue
         FROM orders
         WHERE created_at::date >= $1 AND created_at::date <= $2
           AND status NOT IN ('cancelled')
         GROUP BY day ORDER BY day ASC`,
        [from, to]
      ),
      pool.query(
        `SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS revenue
         FROM orders WHERE created_at::date >= $1 AND created_at::date <= $2
         GROUP BY status`,
        [from, to]
      ),
      pool.query(
        `SELECT COALESCE(source,'online') AS source, COUNT(*) AS count,
                COALESCE(SUM(total_amount),0) AS revenue
         FROM orders WHERE created_at::date >= $1 AND created_at::date <= $2
           AND status NOT IN ('cancelled')
         GROUP BY source`,
        [from, to]
      ),
      pool.query(
        `SELECT
           item->>'productName' AS product_name,
           item->>'productId'   AS product_id,
           SUM((item->>'quantity')::int) AS qty_sold,
           SUM((item->>'quantity')::int * (item->>'price')::numeric) AS revenue
         FROM orders,
              jsonb_array_elements(items::jsonb) AS item
         WHERE created_at::date >= $1 AND created_at::date <= $2
           AND status NOT IN ('cancelled')
           AND jsonb_typeof(items::jsonb) = 'array'
         GROUP BY item->>'productName', item->>'productId'
         ORDER BY qty_sold DESC
         LIMIT 10`,
        [from, to]
      ),
    ]);

    res.json({
      from, to,
      daily:       daily.rows,
      byStatus:    byStatus.rows,
      bySource:    bySource.rows,
      topProducts: byProduct.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/ar-aging — Accounts Receivable aging buckets
router.get('/ar-aging', authMiddleware, async (req, res) => {
  try {
    // Auto-mark overdue
    await pool.query(`UPDATE invoices SET status = 'overdue' WHERE status = 'issued' AND due_date < CURRENT_DATE`);

    const { rows } = await pool.query(`
      SELECT
        i.id,
        i.invoice_number,
        i.customer_name,
        i.customer_phone,
        i.issued_at,
        i.due_date,
        i.total_amount,
        i.amount_paid,
        i.total_amount - i.amount_paid AS outstanding,
        i.status,
        CURRENT_DATE - i.due_date::date AS days_overdue,
        CASE
          WHEN i.due_date::date >= CURRENT_DATE                        THEN 'current'
          WHEN CURRENT_DATE - i.due_date::date BETWEEN 1  AND 30      THEN '1-30'
          WHEN CURRENT_DATE - i.due_date::date BETWEEN 31 AND 60      THEN '31-60'
          WHEN CURRENT_DATE - i.due_date::date BETWEEN 61 AND 90      THEN '61-90'
          ELSE '90+'
        END AS aging_bucket
      FROM invoices i
      WHERE i.status IN ('issued','partial','overdue')
      ORDER BY i.due_date ASC
    `);

    // Aggregate by bucket
    const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const r of rows) buckets[r.aging_bucket] = (buckets[r.aging_bucket] || 0) + Number(r.outstanding);

    res.json({
      invoices: rows.map(r => ({
        id:            r.id,
        invoiceNumber: r.invoice_number,
        customerName:  r.customer_name,
        customerPhone: r.customer_phone,
        issuedAt:      r.issued_at,
        dueDate:       r.due_date,
        totalAmount:   Number(r.total_amount),
        amountPaid:    Number(r.amount_paid),
        outstanding:   Number(r.outstanding),
        status:        r.status,
        daysOverdue:   Number(r.days_overdue || 0),
        agingBucket:   r.aging_bucket,
      })),
      buckets,
      totalOutstanding: rows.reduce((s, r) => s + Number(r.outstanding), 0),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/kpis?from=&to= — Advanced KPI summary
router.get('/kpis', authMiddleware, async (req, res) => {
  try {
    const to   = req.query.to   || new Date().toISOString().slice(0, 10);
    const from = req.query.from || (() => { const d = new Date(to); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); })();

    // Previous period (same length)
    const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
    const prevTo   = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10);
    const prevFrom = new Date(new Date(prevTo).getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);

    const [curr, prev, topCustomers, topProducts, arSummary, monthlyTrend, stockAlerts, purchaseCost] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status NOT IN ('cancelled')) AS order_count,
           COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled')), 0) AS revenue,
           COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled') AND source = 'pos'), 0) AS pos_revenue,
           COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled') AND source != 'pos'), 0) AS online_revenue,
           COALESCE(AVG(total_amount) FILTER (WHERE status NOT IN ('cancelled')), 0) AS avg_order_value,
           COUNT(DISTINCT customer_id) FILTER (WHERE status NOT IN ('cancelled') AND customer_id IS NOT NULL) AS unique_customers,
           COALESCE(SUM(discount_amount) FILTER (WHERE status NOT IN ('cancelled')), 0) AS total_discounts,
           COALESCE(SUM(delivery_fee)   FILTER (WHERE status NOT IN ('cancelled')), 0) AS total_delivery
         FROM orders WHERE created_at::date BETWEEN $1 AND $2`,
        [from, to]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled')), 0) AS revenue,
           COUNT(*) FILTER (WHERE status NOT IN ('cancelled')) AS order_count
         FROM orders WHERE created_at::date BETWEEN $1 AND $2`,
        [prevFrom, prevTo]
      ),
      pool.query(
        `SELECT customer_name, customer_id,
                COUNT(*) AS order_count,
                SUM(total_amount) AS revenue
         FROM orders
         WHERE created_at::date BETWEEN $1 AND $2
           AND status NOT IN ('cancelled')
           AND customer_name IS NOT NULL
         GROUP BY customer_name, customer_id
         ORDER BY revenue DESC LIMIT 5`,
        [from, to]
      ),
      pool.query(
        `SELECT item->>'productName' AS name,
                SUM((item->>'quantity')::int) AS qty,
                SUM((item->>'quantity')::int * (item->>'price')::numeric) AS revenue
         FROM orders, jsonb_array_elements(items::jsonb) AS item
         WHERE created_at::date BETWEEN $1 AND $2
           AND status NOT IN ('cancelled')
           AND jsonb_typeof(items::jsonb) = 'array'
         GROUP BY item->>'productName'
         ORDER BY revenue DESC LIMIT 5`,
        [from, to]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE status IN ('issued','partial','overdue')), 0) AS outstanding,
           COALESCE(SUM(total_amount - amount_paid) FILTER (WHERE status = 'overdue'), 0) AS overdue,
           COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count
         FROM invoices`
      ),
      pool.query(
        `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
                COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled')), 0) AS revenue,
                COUNT(*) FILTER (WHERE status NOT IN ('cancelled')) AS orders
         FROM orders
         WHERE created_at >= NOW() - INTERVAL '6 months'
         GROUP BY 1 ORDER BY 1`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM products
         WHERE is_active = true AND min_stock > 0 AND stock_quantity < min_stock`
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS cost
         FROM purchases
         WHERE received_date::date BETWEEN $1 AND $2
           AND status IN ('received', 'partially_received')`,
        [from, to]
      ).catch(() => ({ rows: [{ cost: 0 }] })),
    ]);

    const c = curr.rows[0];
    const p = prev.rows[0];
    const prevRevenue = Number(p.revenue || 0);
    const currRevenue = Number(c.revenue || 0);
    const growth = prevRevenue > 0 ? ((currRevenue - prevRevenue) / prevRevenue * 100) : null;

    res.json({
      period: { from, to, days },
      prevPeriod: { from: prevFrom, to: prevTo },
      revenue: {
        current:  currRevenue,
        previous: prevRevenue,
        growth:   growth !== null ? Math.round(growth * 10) / 10 : null,
        pos:      Number(c.pos_revenue    || 0),
        online:   Number(c.online_revenue || 0),
      },
      orders: {
        count:         Number(c.order_count  || 0),
        prevCount:     Number(p.order_count  || 0),
        avgValue:      Math.round(Number(c.avg_order_value || 0) * 100) / 100,
        uniqueCustomers: Number(c.unique_customers || 0),
        totalDiscounts:  Number(c.total_discounts  || 0),
        totalDelivery:   Number(c.total_delivery   || 0),
      },
      ar: {
        outstanding:  Number(arSummary.rows[0]?.outstanding || 0),
        overdue:      Number(arSummary.rows[0]?.overdue     || 0),
        overdueCount: Number(arSummary.rows[0]?.overdue_count || 0),
      },
      topCustomers: topCustomers.rows.map(r => ({
        name:       r.customer_name,
        customerId: r.customer_id,
        orders:     Number(r.order_count),
        revenue:    Number(r.revenue),
      })),
      topProducts: topProducts.rows.map(r => ({
        name:    r.name,
        qty:     Number(r.qty),
        revenue: Number(r.revenue),
      })),
      trend: monthlyTrend.rows.map(r => ({
        month:   r.month,
        revenue: Number(r.revenue),
        orders:  Number(r.orders),
      })),
      stockAlerts: Number(stockAlerts.rows[0]?.count || 0),
      grossMargin: (() => {
        const cogs = Number(purchaseCost.rows[0]?.cost || 0);
        const rev  = currRevenue;
        if (rev === 0) return null;
        return Math.round(((rev - cogs) / rev) * 1000) / 10;
      })(),
      cogs: Number(purchaseCost.rows[0]?.cost || 0),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
