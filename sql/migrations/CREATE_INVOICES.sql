-- Migration: Invoices (Faturação Formal)
-- Run via: cd backend && node run-migration-invoices.js

CREATE TABLE IF NOT EXISTS invoices (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    VARCHAR(60)   NOT NULL UNIQUE,
  order_id          UUID          REFERENCES orders(id) ON DELETE SET NULL,
  customer_id       UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  customer_name     VARCHAR(200),
  customer_phone    VARCHAR(50),
  customer_email    VARCHAR(100),
  customer_nuit     VARCHAR(30),
  customer_address  TEXT,

  -- Estado do documento
  status            VARCHAR(20)   NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','issued','paid','partial','overdue','cancelled')),

  -- Datas
  issued_at         DATE,
  due_date          DATE,
  paid_at           TIMESTAMPTZ,

  -- Valores
  items             JSONB         NOT NULL DEFAULT '[]',
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate          NUMERIC(5,2)  NOT NULL DEFAULT 16,
  vat_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Pagamento
  payment_method    VARCHAR(30),
  amount_paid       NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Metadados
  notes             TEXT,
  internal_notes    TEXT,
  created_by        UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_order_id_idx      ON invoices(order_id);
CREATE INDEX IF NOT EXISTS invoices_customer_id_idx   ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx        ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_issued_at_idx     ON invoices(issued_at DESC);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx      ON invoices(due_date);

-- Add invoice_counter and bank/logo columns to tax_config if missing
ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS invoice_counter      INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS bank_name            VARCHAR(100)  NOT NULL DEFAULT '';
ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS bank_account         VARCHAR(60)   NOT NULL DEFAULT '';
ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS bank_iban            VARCHAR(40)   NOT NULL DEFAULT '';
ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS bank_account_holder  VARCHAR(200)  NOT NULL DEFAULT '';
ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS bank_accounts        JSONB         NOT NULL DEFAULT '[]';
ALTER TABLE tax_config ADD COLUMN IF NOT EXISTS logo_url             TEXT          NOT NULL DEFAULT '';

-- Auto-mark overdue invoices (run periodically or at query time)
-- UPDATE invoices SET status = 'overdue'
-- WHERE status = 'issued' AND due_date < CURRENT_DATE;
