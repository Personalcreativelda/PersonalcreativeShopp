-- ====================================================================
-- CREATE_AP_LEDGER.sql — Contas a Pagar (AP) + Razão Geral (GL)
-- Run: cd backend && node run-migration-ap-ledger.js
-- ====================================================================

-- ── Supplier Invoices (Contas a Pagar) ───────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number      VARCHAR(60),
  purchase_id      UUID          REFERENCES purchases(id) ON DELETE SET NULL,
  supplier_id      UUID,
  supplier_name    VARCHAR(200),
  supplier_nuit    VARCHAR(30),
  supplier_email   VARCHAR(100),
  supplier_phone   VARCHAR(50),

  status           VARCHAR(20)   NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','received','approved','paid','partial','overdue','cancelled')),

  bill_date        DATE,
  due_date         DATE,
  received_date    DATE,
  paid_at          TIMESTAMPTZ,

  items            JSONB         NOT NULL DEFAULT '[]',
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate         NUMERIC(5,2)  NOT NULL DEFAULT 16,
  vat_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid      NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method   VARCHAR(30),

  account_id       UUID,
  notes            TEXT,
  internal_notes   TEXT,

  created_by       UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by      UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplier_invoices_status_idx      ON supplier_invoices(status);
CREATE INDEX IF NOT EXISTS supplier_invoices_due_date_idx    ON supplier_invoices(due_date);
CREATE INDEX IF NOT EXISTS supplier_invoices_bill_date_idx   ON supplier_invoices(bill_date DESC);
CREATE INDEX IF NOT EXISTS supplier_invoices_purchase_idx    ON supplier_invoices(purchase_id);

-- ── Chart of Accounts (Plano de Contas) ──────────────────────────────
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20)   NOT NULL UNIQUE,
  name        VARCHAR(200)  NOT NULL,
  type        VARCHAR(20)   NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense','cogs')),
  parent_id   UUID          REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  is_active   BOOLEAN       NOT NULL DEFAULT true,
  is_system   BOOLEAN       NOT NULL DEFAULT false,
  description TEXT,
  sort_order  INTEGER       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Journal Entries (Lançamentos Contabilísticos) ─────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number VARCHAR(30),
  date         DATE          NOT NULL DEFAULT CURRENT_DATE,
  description  TEXT,
  reference    VARCHAR(200),
  source       VARCHAR(30),   -- 'order','supplier_invoice','purchase','manual'
  source_id    UUID,
  status       VARCHAR(20)   NOT NULL DEFAULT 'posted'
               CHECK (status IN ('draft','posted','voided')),
  total_debit  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by   UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journal_entries_date_idx    ON journal_entries(date DESC);
CREATE INDEX IF NOT EXISTS journal_entries_source_idx  ON journal_entries(source, source_id);
CREATE INDEX IF NOT EXISTS journal_entries_status_idx  ON journal_entries(status);

-- ── Journal Entry Lines ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID          NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id  UUID          NOT NULL REFERENCES chart_of_accounts(id),
  description TEXT,
  debit       NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jel_entry_idx   ON journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS jel_account_idx ON journal_entry_lines(account_id);

-- ── AP counters in tax_config ─────────────────────────────────────────
ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS ap_bill_prefix  VARCHAR(20) NOT NULL DEFAULT 'BILL';
ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS ap_bill_counter INTEGER     NOT NULL DEFAULT 0;

-- ── Seed: Plano de Contas Simplificado (Moçambique) ──────────────────
INSERT INTO chart_of_accounts (code, name, type, is_system, sort_order) VALUES
-- ACTIVOS
('1000', 'Caixa e Equivalentes',          'asset',     true, 10),
('1100', 'Caixa',                          'asset',     true, 11),
('1200', 'Banco',                          'asset',     true, 12),
('1300', 'M-Pesa / e-Money',              'asset',     true, 13),
('1400', 'Contas a Receber (AR)',          'asset',     true, 14),
('1500', 'Stock / Inventário',             'asset',     true, 15),
('1600', 'Adiantamentos a Fornecedores',   'asset',     true, 16),
('1700', 'Outros Activos Correntes',       'asset',     true, 17),
-- PASSIVOS
('2000', 'Passivos Correntes',             'liability', true, 20),
('2100', 'Contas a Pagar (AP)',            'liability', true, 21),
('2200', 'IVA a Pagar',                    'liability', true, 22),
('2300', 'Empréstimos de Curto Prazo',     'liability', true, 23),
('2400', 'Adiantamentos de Clientes',      'liability', true, 24),
('2500', 'Outras Obrigações',              'liability', true, 25),
-- CAPITAL PRÓPRIO
('3000', 'Capital Próprio',                'equity',    true, 30),
('3100', 'Capital Social',                 'equity',    true, 31),
('3200', 'Resultados Transitados',         'equity',    true, 32),
('3300', 'Resultado do Exercício',         'equity',    true, 33),
-- RECEITAS
('4000', 'Receitas',                       'revenue',   true, 40),
('4100', 'Vendas de Mercadorias',          'revenue',   true, 41),
('4200', 'Vendas de Produtos Acabados',    'revenue',   true, 42),
('4300', 'Prestação de Serviços',          'revenue',   true, 43),
('4400', 'Outras Receitas Operacionais',   'revenue',   true, 44),
-- CUSTO DAS VENDAS
('5000', 'Custo das Mercadorias Vendidas', 'cogs',      true, 50),
('5100', 'Custo de Compras',               'cogs',      true, 51),
('5200', 'Frete e Logística de Compras',   'cogs',      true, 52),
-- DESPESAS OPERACIONAIS
('6000', 'Despesas Operacionais',          'expense',   true, 60),
('6100', 'Fornecimentos e Serviços Ext.',  'expense',   true, 61),
('6200', 'Pessoal e Salários',             'expense',   true, 62),
('6300', 'Rendas e Alugueres',             'expense',   true, 63),
('6400', 'Comunicações e Internet',        'expense',   true, 64),
('6500', 'Transportes e Deslocações',      'expense',   true, 65),
('6600', 'Marketing e Publicidade',        'expense',   true, 66),
('6700', 'Manutenção e Reparações',        'expense',   true, 67),
('6800', 'Impostos e Taxas',               'expense',   true, 68),
('6900', 'Amortizações e Depreciações',    'expense',   true, 69),
('6950', 'Outras Despesas',                'expense',   true, 70)
ON CONFLICT (code) DO NOTHING;
