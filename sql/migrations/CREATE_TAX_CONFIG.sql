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
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- Garante sempre 1 linha
INSERT INTO tax_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
