import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const mapAccount = (r) => ({
  id: r.id, code: r.code, name: r.name, type: r.type,
  parentId: r.parent_id, isActive: r.is_active, isSystem: r.is_system,
  description: r.description, sortOrder: r.sort_order,
});

const mapEntry = (r) => ({
  id: r.id, entryNumber: r.entry_number, date: r.date,
  description: r.description, reference: r.reference,
  source: r.source, sourceId: r.source_id, status: r.status,
  totalDebit: Number(r.total_debit || 0), totalCredit: Number(r.total_credit || 0),
  createdByName: r.creator_name, createdAt: r.created_at,
  lines: r.lines || [],
});

// ── Chart of Accounts ─────────────────────────────────────────────────

// GET /api/ledger/accounts
router.get('/accounts', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM chart_of_accounts ORDER BY sort_order, code`
    );
    res.json(rows.map(mapAccount));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ledger/accounts
router.post('/accounts', authMiddleware, async (req, res) => {
  try {
    const { code, name, type, parentId, description } = req.body;
    if (!code || !name || !type) return res.status(400).json({ error: 'code, name e type são obrigatórios' });
    const { rows: mx } = await pool.query(
      `SELECT COALESCE(MAX(sort_order),0) AS max FROM chart_of_accounts WHERE type = $1`, [type]
    );
    const { rows } = await pool.query(
      `INSERT INTO chart_of_accounts (code, name, type, parent_id, description, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [code, name, type, parentId || null, description || null, Number(mx[0].max) + 1]
    );
    res.status(201).json(mapAccount(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/ledger/accounts/:id
router.put('/accounts/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    const { rows } = await pool.query(
      `UPDATE chart_of_accounts
         SET name        = COALESCE($1, name),
             description = COALESCE($2, description),
             is_active   = COALESCE($3, is_active)
       WHERE id = $4 AND is_system = false RETURNING *`,
      [name || null, description || null, isActive ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Conta não encontrada ou é conta de sistema' });
    res.json(mapAccount(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Journal Entries ───────────────────────────────────────────────────

// GET /api/ledger/entries?from=&to=&account=&source=&status=&limit=&offset=
router.get('/entries', authMiddleware, async (req, res) => {
  try {
    const { from, to, account, source, status, limit = 50, offset = 0 } = req.query;
    const conds = [], params = [];

    if (status) { conds.push(`je.status = $${params.length + 1}`); params.push(status); }
    else        { conds.push(`je.status != 'voided'`); }
    if (from)   { conds.push(`je.date >= $${params.length + 1}`); params.push(from); }
    if (to)     { conds.push(`je.date <= $${params.length + 1}`); params.push(to); }
    if (source) { conds.push(`je.source = $${params.length + 1}`); params.push(source); }
    if (account) {
      conds.push(
        `EXISTS (SELECT 1 FROM journal_entry_lines jl WHERE jl.entry_id = je.id AND jl.account_id = $${params.length + 1})`
      );
      params.push(account);
    }

    const where = `WHERE ${conds.join(' AND ')}`;
    const { rows } = await pool.query(
      `SELECT je.*, p.name AS creator_name,
         (SELECT json_agg(json_build_object(
           'id',          jl.id,
           'accountId',   jl.account_id,
           'accountCode', ca.code,
           'accountName', ca.name,
           'description', jl.description,
           'debit',       jl.debit,
           'credit',      jl.credit
         ) ORDER BY jl.debit DESC)
          FROM journal_entry_lines jl
          LEFT JOIN chart_of_accounts ca ON ca.id = jl.account_id
          WHERE jl.entry_id = je.id) AS lines
       FROM journal_entries je
       LEFT JOIN profiles p ON p.id = je.created_by
       ${where}
       ORDER BY je.date DESC, je.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), Number(offset)]
    );
    const cnt = await pool.query(
      `SELECT COUNT(*) FROM journal_entries je ${where}`, params
    );
    res.json({ entries: rows.map(mapEntry), total: Number(cnt.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ledger/entries — manual balanced journal entry
router.post('/entries', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { date, description, reference, lines = [] } = req.body;
    if (!lines.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Linhas de lançamento em falta' }); }

    const totalDebit  = lines.reduce((s, l) => s + Number(l.debit  || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Débitos (${totalDebit.toFixed(2)}) ≠ Créditos (${totalCredit.toFixed(2)}). Lançamento desequilibrado.`
      });
    }

    const { rows: je } = await client.query(
      `INSERT INTO journal_entries (date, description, reference, source, status, total_debit, total_credit, created_by)
       VALUES ($1,$2,$3,'manual','posted',$4,$5,$6) RETURNING *`,
      [date || new Date().toISOString().slice(0, 10), description || null, reference || null,
       totalDebit, totalCredit, req.user.id]
    );
    for (const l of lines) {
      await client.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, description, debit, credit)
         VALUES ($1,$2,$3,$4,$5)`,
        [je[0].id, l.accountId, l.description || null, Number(l.debit || 0), Number(l.credit || 0)]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(mapEntry(je[0]));
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// POST /api/ledger/entries/:id/void
router.post('/entries/:id/void', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE journal_entries SET status = 'voided', updated_at = NOW()
       WHERE id = $1 AND status = 'posted' RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Lançamento não encontrado ou já anulado' });
    res.json(mapEntry(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── P&L — Demonstração de Resultados ─────────────────────────────────

// GET /api/ledger/pnl?from=&to=
router.get('/pnl', authMiddleware, async (req, res) => {
  try {
    const thisYear  = new Date().getFullYear();
    const from = req.query.from || `${thisYear}-01-01`;
    const to   = req.query.to   || new Date().toISOString().slice(0, 10);

    const [revR, cogsR, apExpR, prevRevR, prevCogsR] = await Promise.all([
      // Receita: encomendas confirmadas
      pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM orders WHERE status NOT IN ('cancelled')
           AND created_at::date BETWEEN $1 AND $2`, [from, to]
      ),
      // COGS: compras recebidas
      pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM purchases WHERE status IN ('received','partially_received')
           AND COALESCE(received_date, created_at::date) BETWEEN $1 AND $2`, [from, to]
      ),
      // Despesas: facturas de fornecedores aprovadas/pagas
      pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM supplier_invoices WHERE status IN ('approved','paid','partial','overdue')
           AND COALESCE(bill_date, created_at::date) BETWEEN $1 AND $2`, [from, to]
      ),
      // Receita período anterior (para comparação)
      pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM orders WHERE status NOT IN ('cancelled')
           AND created_at::date BETWEEN $1::date - INTERVAL '1 year' AND $2::date - INTERVAL '1 year'`,
        [from, to]
      ),
      pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM purchases WHERE status IN ('received','partially_received')
           AND COALESCE(received_date, created_at::date) BETWEEN $1::date - INTERVAL '1 year' AND $2::date - INTERVAL '1 year'`,
        [from, to]
      ),
    ]);

    // Evolução mensal de receita
    const { rows: monthly } = await pool.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
              COALESCE(SUM(total_amount), 0)                      AS revenue
       FROM orders WHERE status NOT IN ('cancelled')
         AND created_at::date BETWEEN $1 AND $2
       GROUP BY 1 ORDER BY 1`, [from, to]
    );

    // Top despesas por categoria (se houver journal entries)
    const { rows: expByAccount } = await pool.query(
      `SELECT ca.name AS account, ca.code, SUM(jel.debit) AS total
       FROM journal_entry_lines jel
       JOIN chart_of_accounts ca ON ca.id = jel.account_id
       JOIN journal_entries je ON je.id = jel.entry_id
       WHERE ca.type IN ('expense','cogs') AND je.status = 'posted'
         AND je.date BETWEEN $1 AND $2
       GROUP BY ca.name, ca.code ORDER BY total DESC LIMIT 10`, [from, to]
    );

    const revenue       = Number(revR.rows[0].total);
    const cogs          = Number(cogsR.rows[0].total);
    const opExpenses    = Number(apExpR.rows[0].total);
    const grossProfit   = revenue - cogs;
    const operatingProfit = grossProfit - opExpenses;
    const grossMargin   = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;
    const netMargin     = revenue > 0 ? Math.round((operatingProfit / revenue) * 1000) / 10 : 0;
    const prevRevenue   = Number(prevRevR.rows[0].total);
    const prevCogs      = Number(prevCogsR.rows[0].total);
    const revenueGrowth = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null;

    res.json({
      period: { from, to },
      revenue, cogs, grossProfit, opExpenses, operatingProfit,
      grossMargin, netMargin,
      prevRevenue, prevCogs, revenueGrowth,
      monthlyRevenue: monthly,
      expensesByAccount: expByAccount.map(r => ({ account: r.account, code: r.code, total: Number(r.total) })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Balance Sheet — Balanço Simplificado ──────────────────────────────

// GET /api/ledger/balance-sheet?asOf=
router.get('/balance-sheet', authMiddleware, async (req, res) => {
  try {
    const asOf = req.query.asOf || new Date().toISOString().slice(0, 10);

    const [arR, stockR, apR, cashLedgerR] = await Promise.all([
      // AR: total encomendas - total pago em facturas
      pool.query(
        `SELECT
           COALESCE(SUM(o.total_amount) FILTER (WHERE o.status NOT IN ('cancelled')), 0) AS billed,
           COALESCE(SUM(i.amount_paid)  FILTER (WHERE i.status IN ('paid','partial')),  0) AS collected
         FROM orders o
         LEFT JOIN invoices i ON i.order_id = o.id
         WHERE o.created_at::date <= $1`, [asOf]
      ),
      // Stock value (stock × cost_price)
      pool.query(
        `SELECT COALESCE(SUM(stock * COALESCE(cost_price, price * 0.6, 0)), 0) AS total FROM products`
      ),
      // AP: contas a pagar abertas
      pool.query(
        `SELECT COALESCE(SUM(total_amount - amount_paid), 0) AS total
         FROM supplier_invoices
         WHERE status NOT IN ('cancelled','paid')
           AND COALESCE(bill_date, created_at::date) <= $1`, [asOf]
      ),
      // Cash from journal entries (debit cash accounts - credit cash accounts)
      pool.query(
        `SELECT
           COALESCE(SUM(jel.debit)  FILTER (WHERE ca.code LIKE '11%' OR ca.code LIKE '12%' OR ca.code LIKE '13%'), 0) AS cash_debit,
           COALESCE(SUM(jel.credit) FILTER (WHERE ca.code LIKE '11%' OR ca.code LIKE '12%' OR ca.code LIKE '13%'), 0) AS cash_credit
         FROM journal_entry_lines jel
         JOIN chart_of_accounts ca ON ca.id = jel.account_id
         JOIN journal_entries je ON je.id = jel.entry_id
         WHERE je.status = 'posted' AND je.date <= $1`, [asOf]
      ),
    ]);

    const ar    = Math.max(0, Number(arR.rows[0].billed) - Number(arR.rows[0].collected));
    const stock = Number(stockR.rows[0].total);
    const ap    = Number(apR.rows[0].total);
    const cashDebit  = Number(cashLedgerR.rows[0].cash_debit);
    const cashCredit = Number(cashLedgerR.rows[0].cash_credit);
    const cash  = Math.max(0, cashDebit - cashCredit);

    const totalAssets      = ar + stock + cash;
    const totalLiabilities = ap;
    const equity           = totalAssets - totalLiabilities;

    res.json({
      asOf,
      assets: {
        cash,
        ar,
        stock,
        total: totalAssets,
      },
      liabilities: {
        ap,
        total: totalLiabilities,
      },
      equity: {
        retained: equity,
        total: equity,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/ledger/account-balances?from=&to= — saldo por conta para razão
router.get('/account-balances', authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    const conds = ["je.status = 'posted'"], params = [];
    if (from) { conds.push(`je.date >= $${params.length + 1}`); params.push(from); }
    if (to)   { conds.push(`je.date <= $${params.length + 1}`); params.push(to); }
    const where = `WHERE ${conds.join(' AND ')}`;

    const { rows } = await pool.query(
      `SELECT ca.id, ca.code, ca.name, ca.type,
              COALESCE(SUM(jel.debit),  0) AS total_debit,
              COALESCE(SUM(jel.credit), 0) AS total_credit,
              COALESCE(SUM(jel.debit),  0) - COALESCE(SUM(jel.credit), 0) AS balance
       FROM chart_of_accounts ca
       LEFT JOIN journal_entry_lines jel ON jel.account_id = ca.id
       LEFT JOIN journal_entries je ON je.id = jel.entry_id ${where.replace('WHERE', 'AND')}
       GROUP BY ca.id, ca.code, ca.name, ca.type
       ORDER BY ca.sort_order, ca.code`,
      params
    );
    res.json(rows.map(r => ({
      id: r.id, code: r.code, name: r.name, type: r.type,
      totalDebit: Number(r.total_debit), totalCredit: Number(r.total_credit), balance: Number(r.balance),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
