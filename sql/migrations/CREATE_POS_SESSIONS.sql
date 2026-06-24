CREATE TABLE IF NOT EXISTS pos_sessions (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id     UUID,
  cashier_name   VARCHAR(150)  NOT NULL DEFAULT 'Caixa',
  opened_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  closed_at      TIMESTAMPTZ,
  initial_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_open        BOOLEAN       NOT NULL DEFAULT TRUE,
  summary        JSONB
);

CREATE INDEX IF NOT EXISTS idx_pos_sessions_open
  ON pos_sessions(is_open) WHERE is_open = TRUE;
