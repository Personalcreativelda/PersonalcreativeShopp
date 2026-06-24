-- Migration: tabelas de configuração e snapshot de stock
-- Run via: node migrate.js

-- ── Stock config (registo de resets de stock) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reset_reason TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Stock initial snapshot ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_initial_snapshot (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  product_id    UUID NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  variant_id    UUID          REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity      NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_date, product_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_snapshot_date      ON stock_initial_snapshot (snapshot_date);
CREATE INDEX IF NOT EXISTS idx_stock_snapshot_product   ON stock_initial_snapshot (product_id);
