-- Migration: POS Shifts + Loyalty System
-- Run via: cd backend && node run-migration.js

-- ─── pos_shifts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_shifts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  location_id    UUID        REFERENCES locations(id) ON DELETE SET NULL,
  opened_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at      TIMESTAMPTZ,
  initial_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_sales    NUMERIC(12,2),
  expected_cash  NUMERIC(12,2),
  counted_amount NUMERIC(12,2),
  variance       NUMERIC(12,2),
  summary        JSONB,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pos_shifts_cashier_idx ON pos_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS pos_shifts_opened_at_idx ON pos_shifts(opened_at DESC);

-- ─── loyalty columns on profiles ──────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_tier   VARCHAR(20) NOT NULL DEFAULT 'Semente';

-- ─── loyalty_log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  order_id    UUID        REFERENCES orders(id)   ON DELETE SET NULL,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('earn','redeem','expire','adjust')),
  points      INTEGER     NOT NULL,
  description TEXT,
  expires_at  TIMESTAMPTZ,
  expired     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS loyalty_log_customer_idx ON loyalty_log(customer_id);
CREATE INDEX IF NOT EXISTS loyalty_log_order_idx    ON loyalty_log(order_id);
CREATE INDEX IF NOT EXISTS loyalty_log_expires_idx  ON loyalty_log(expires_at) WHERE expired = false;
