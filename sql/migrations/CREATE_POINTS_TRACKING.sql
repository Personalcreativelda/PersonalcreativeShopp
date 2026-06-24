-- Adicionar código de rastreio às encomendas
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(20);

-- Índice para buscas rápidas por tracking code
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_code ON orders (tracking_code) WHERE tracking_code IS NOT NULL;

-- Gerar tracking codes para encomendas existentes (retroactivo)
UPDATE orders
SET tracking_code = 'NE-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' ||
  UPPER(SUBSTRING(MD5(id::text) FROM 1 FOR 6))
WHERE tracking_code IS NULL;

-- Adicionar pontos ao perfil do utilizador
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_points_earned INTEGER NOT NULL DEFAULT 0;
