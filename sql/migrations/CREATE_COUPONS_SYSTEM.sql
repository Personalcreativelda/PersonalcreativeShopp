-- Sistema de Cupões e Pedidos de Reembolso — NaturErva ERP
-- Seguro para executar múltiplas vezes (IF NOT EXISTS / ON CONFLICT DO NOTHING)

-- ── Tabela coupons ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(50) UNIQUE NOT NULL,
  description      TEXT,
  type             VARCHAR(20) NOT NULL CHECK (type IN ('percentage','free_shipping')),
  value            DECIMAL(5,2) NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(12,2) DEFAULT 0,
  max_discount_amount DECIMAL(12,2),
  max_uses         INTEGER,
  current_uses     INTEGER NOT NULL DEFAULT 0,
  valid_from       TIMESTAMPTZ,
  valid_until      TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons (code);

-- ── Adicionar colunas de cupão à tabela orders ────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code     VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0;

-- ── Tabela refund_requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refund_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id),
  customer_id UUID REFERENCES customers(id),
  user_id     UUID REFERENCES profiles(id),
  reason      VARCHAR(100) NOT NULL,
  details     TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_order_id    ON refund_requests (order_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_customer_id ON refund_requests (customer_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id     ON refund_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status      ON refund_requests (status);

-- ── Verificação ───────────────────────────────────────────────────────────────
SELECT
  '✅ Migração completa!' AS status,
  (SELECT COUNT(*) FROM coupons)          AS coupons,
  (SELECT COUNT(*) FROM refund_requests)  AS refund_requests;
