ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_deadline        DATE;
