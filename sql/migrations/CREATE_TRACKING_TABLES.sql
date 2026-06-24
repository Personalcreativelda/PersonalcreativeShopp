-- Tracking tables for NaturErva ERP
-- Run this once against the PostgreSQL database.

-- ── Shop visits ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_visits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id       TEXT,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id          UUID REFERENCES profiles(id)  ON DELETE SET NULL,
  page_path        TEXT NOT NULL,
  page_title       TEXT,
  referrer         TEXT,
  ip_address       TEXT,
  user_agent       TEXT,
  device_type      TEXT CHECK (device_type IN ('desktop','mobile','tablet')),
  browser          TEXT,
  browser_version  TEXT,
  os               TEXT,
  os_version       TEXT,
  screen_resolution TEXT,
  language         TEXT,
  timezone         TEXT,
  session_id       TEXT,
  visit_duration   INTEGER,
  products_viewed  JSONB  NOT NULL DEFAULT '[]',
  actions          JSONB  NOT NULL DEFAULT '[]',
  metadata         JSONB  NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_visits_created_at   ON shop_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_visits_visitor_id   ON shop_visits (visitor_id);
CREATE INDEX IF NOT EXISTS idx_shop_visits_session_id   ON shop_visits (session_id);
CREATE INDEX IF NOT EXISTS idx_shop_visits_customer_id  ON shop_visits (customer_id);

-- ── Admin activity log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  page_path       TEXT NOT NULL,
  page_title      TEXT,
  action_type     TEXT NOT NULL DEFAULT 'view',
  action_details  JSONB NOT NULL DEFAULT '{}',
  ip_address      TEXT,
  user_agent      TEXT,
  device_type     TEXT,
  browser         TEXT,
  browser_version TEXT,
  os              TEXT,
  os_version      TEXT,
  session_id      TEXT,
  duration        INTEGER,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_user_id    ON admin_activity_log (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_type       ON admin_activity_log (action_type);
