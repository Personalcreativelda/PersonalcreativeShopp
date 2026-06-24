import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Auto-cria tabelas se não existirem
pool.query(`
  CREATE TABLE IF NOT EXISTS tax_config (
    id              INTEGER      PRIMARY KEY DEFAULT 1,
    company_name    VARCHAR(200) NOT NULL DEFAULT 'NaturErva',
    company_nuit    VARCHAR(30)  NOT NULL DEFAULT '',
    company_address TEXT         NOT NULL DEFAULT '',
    company_phone   VARCHAR(50)  NOT NULL DEFAULT '',
    company_email   VARCHAR(100) NOT NULL DEFAULT '',
    vat_rate        DECIMAL(5,2) NOT NULL DEFAULT 16.00,
    invoice_prefix  VARCHAR(20)  NOT NULL DEFAULT 'FACT',
    invoice_counter INTEGER      NOT NULL DEFAULT 0,
    vd_prefix       VARCHAR(20)  NOT NULL DEFAULT 'VD',
    vd_counter      INTEGER      NOT NULL DEFAULT 0,
    quote_prefix    VARCHAR(20)  NOT NULL DEFAULT 'COT',
    quote_counter   INTEGER      NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
  );
  INSERT INTO tax_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
`).catch(e => console.error('[TAX] init:', e.message));

// Adicionar colunas a instâncias existentes
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS vd_prefix VARCHAR(20) NOT NULL DEFAULT 'VD'`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS vd_counter INTEGER NOT NULL DEFAULT 0`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS quote_prefix VARCHAR(20) NOT NULL DEFAULT 'COT'`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS quote_counter INTEGER NOT NULL DEFAULT 0`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200) NOT NULL DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100) NOT NULL DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS bank_iban VARCHAR(100) NOT NULL DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(200) NOT NULL DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS bank_swift VARCHAR(50) NOT NULL DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) NOT NULL DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS logo_icon_url VARCHAR(500) NOT NULL DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS bank_accounts JSONB NOT NULL DEFAULT '[]'`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS theme_primary_color VARCHAR(20) DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS theme_font VARCHAR(100) DEFAULT ''`).catch(() => {});
pool.query(`ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS theme_radius VARCHAR(20) DEFAULT ''`).catch(() => {});

const mapConfig = (r) => ({
  companyName:        r.company_name,
  companyNuit:        r.company_nuit,
  companyAddress:     r.company_address,
  companyPhone:       r.company_phone,
  companyEmail:       r.company_email,
  vatRate:            Number(r.vat_rate),
  invoicePrefix:      r.invoice_prefix,
  invoiceCounter:     Number(r.invoice_counter),
  vdPrefix:           r.vd_prefix || 'VD',
  vdCounter:          Number(r.vd_counter || 0),
  quotePrefix:        r.quote_prefix || 'COT',
  quoteCounter:       Number(r.quote_counter || 0),
  bankName:           r.bank_name || '',
  bankAccount:        r.bank_account || '',
  bankIban:           r.bank_iban || '',
  bankAccountHolder:  r.bank_account_holder || '',
  bankSwift:          r.bank_swift || '',
  logoUrl:            r.logo_url || '',
  logoIconUrl:        r.logo_icon_url || '',
  bankAccounts:       Array.isArray(r.bank_accounts) ? r.bank_accounts : (r.bank_accounts ? JSON.parse(r.bank_accounts) : []),
  themePrimaryColor:  r.theme_primary_color || '',
  themeFont:          r.theme_font || '',
  themeRadius:        r.theme_radius || '',
});

// GET /api/tax/config
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tax_config WHERE id = 1');
    res.json(rows[0] ? mapConfig(rows[0]) : {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/tax/config
router.put('/config', authMiddleware, async (req, res) => {
  try {
    const c = req.body;

    // Logo fields restricted to ADMIN / SUPER_ADMIN
    const LOGO_ROLES = ['SUPER_ADMIN', 'ADMIN'];
    const userRoles = [
      ...(Array.isArray(req.user.roles) ? req.user.roles : []),
      req.user.role,
    ].filter(Boolean).map(r => r.toUpperCase());
    const isLogoAdmin = userRoles.some(r => LOGO_ROLES.includes(r));

    if ((c.logoUrl !== undefined || c.logoIconUrl !== undefined) && !isLogoAdmin) {
      return res.status(403).json({ error: 'Sem permissão para alterar o logotipo' });
    }
    await pool.query(
      `UPDATE tax_config SET
        company_name         = COALESCE($1, company_name),
        company_nuit         = COALESCE($2, company_nuit),
        company_address      = COALESCE($3, company_address),
        company_phone        = COALESCE($4, company_phone),
        company_email        = COALESCE($5, company_email),
        vat_rate             = COALESCE($6, vat_rate),
        invoice_prefix       = COALESCE($7, invoice_prefix),
        bank_name            = COALESCE($8, bank_name),
        bank_account         = COALESCE($9, bank_account),
        bank_iban            = COALESCE($10, bank_iban),
        bank_account_holder  = COALESCE($11, bank_account_holder),
        bank_swift           = COALESCE($12, bank_swift),
        logo_url             = COALESCE($13, logo_url),
        logo_icon_url        = COALESCE($14, logo_icon_url),
        bank_accounts        = COALESCE($15, bank_accounts),
        theme_primary_color  = COALESCE($16, theme_primary_color),
        theme_font           = COALESCE($17, theme_font),
        theme_radius         = COALESCE($18, theme_radius),
        updated_at           = NOW()
       WHERE id = 1`,
      [c.companyName, c.companyNuit, c.companyAddress, c.companyPhone,
       c.companyEmail, c.vatRate, c.invoicePrefix,
       c.bankName ?? null, c.bankAccount ?? null, c.bankIban ?? null,
       c.bankAccountHolder ?? null, c.bankSwift ?? null,
       c.logoUrl || null, c.logoIconUrl || null,
       c.bankAccounts !== undefined ? JSON.stringify(c.bankAccounts) : null,
       c.themePrimaryColor || null, c.themeFont || null, c.themeRadius || null]
    );
    const { rows } = await pool.query('SELECT * FROM tax_config WHERE id = 1');
    res.json(mapConfig(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tax/invoice/number — incrementa e retorna próximo nº de factura
router.post('/invoice/number', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE tax_config
         SET invoice_counter = invoice_counter + 1, updated_at = NOW()
       WHERE id = 1
       RETURNING invoice_prefix, invoice_counter, EXTRACT(YEAR FROM NOW())::int AS yr`
    );
    const { invoice_prefix, invoice_counter, yr } = rows[0];
    const number = `${invoice_prefix}/${yr}/${String(invoice_counter).padStart(4, '0')}`;
    res.json({ number });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tax/vd/number — próximo número VD sequencial
router.post('/vd/number', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE tax_config
         SET vd_counter = vd_counter + 1, updated_at = NOW()
       WHERE id = 1
       RETURNING vd_prefix, vd_counter, EXTRACT(YEAR FROM NOW())::int AS yr`
    );
    const { vd_prefix, vd_counter, yr } = rows[0];
    res.json({ number: `${vd_prefix}/${yr}/${String(vd_counter).padStart(4, '0')}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tax/quote/number — próximo número de Cotação sequencial
router.post('/quote/number', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE tax_config
         SET quote_counter = quote_counter + 1, updated_at = NOW()
       WHERE id = 1
       RETURNING quote_prefix, quote_counter, EXTRACT(YEAR FROM NOW())::int AS yr`
    );
    const { quote_prefix, quote_counter, yr } = rows[0];
    res.json({ number: `${quote_prefix}/${yr}/${String(quote_counter).padStart(4, '0')}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tax/setup-invoices — cria tabela invoices se não existir (idempotent)
router.post('/setup-invoices', authMiddleware, async (req, res) => {
  try {
    await pool.query(`
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
      CREATE INDEX IF NOT EXISTS invoices_order_id_idx    ON invoices(order_id);
      CREATE INDEX IF NOT EXISTS invoices_customer_id_idx ON invoices(customer_id);
      CREATE INDEX IF NOT EXISTS invoices_status_idx      ON invoices(status);
      CREATE INDEX IF NOT EXISTS invoices_issued_at_idx   ON invoices(issued_at DESC);
    `);
    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM invoices');
    res.json({ ok: true, invoicesCount: Number(rows[0].n), message: 'Tabela invoices pronta' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tax/report?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/report', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start e end obrigatórios' });

    const { rows: cfg } = await pool.query('SELECT vat_rate FROM tax_config WHERE id = 1');
    const vatRate = Number(cfg[0]?.vat_rate ?? 16);
    const vatMult = 1 + vatRate / 100;

    // Totais globais
    const { rows: totals } = await pool.query(
      `SELECT
         COUNT(*)::int                             AS orders_count,
         COALESCE(SUM(total_amount), 0)            AS total_inc_vat,
         COALESCE(SUM(total_amount / $3), 0)       AS total_ex_vat,
         COALESCE(SUM(total_amount - total_amount / $3), 0) AS total_vat
       FROM orders
       WHERE created_at::date BETWEEN $1 AND $2
         AND status NOT IN ('cancelled')`,
      [start, end, vatMult]
    );

    // Quebra por mês
    const { rows: byMonth } = await pool.query(
      `SELECT
         TO_CHAR(created_at, 'YYYY-MM')           AS month,
         COUNT(*)::int                             AS count,
         COALESCE(SUM(total_amount), 0)            AS inc_vat,
         COALESCE(SUM(total_amount / $3), 0)       AS ex_vat,
         COALESCE(SUM(total_amount - total_amount / $3), 0) AS vat
       FROM orders
       WHERE created_at::date BETWEEN $1 AND $2
         AND status NOT IN ('cancelled')
       GROUP BY TO_CHAR(created_at, 'YYYY-MM')
       ORDER BY month ASC`,
      [start, end, vatMult]
    );

    const t = totals[0];
    res.json({
      vatRate,
      ordersCount:   t.orders_count,
      totalIncVat:   Math.round(Number(t.total_inc_vat) * 100) / 100,
      totalExVat:    Math.round(Number(t.total_ex_vat)  * 100) / 100,
      totalVat:      Math.round(Number(t.total_vat)     * 100) / 100,
      byMonth: byMonth.map(r => ({
        month:    r.month,
        count:    r.count,
        incVat:   Math.round(Number(r.inc_vat) * 100) / 100,
        exVat:    Math.round(Number(r.ex_vat)  * 100) / 100,
        vat:      Math.round(Number(r.vat)     * 100) / 100,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
