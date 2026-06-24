-- Fase 4: Purchase workflow — approval, GRN, three-way matching

-- Extend purchases table with approval and matching columns
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS po_number VARCHAR(20);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(255);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_invoice_number VARCHAR(100) UNIQUE;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_invoice_amount DECIMAL(12,2);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_invoice_date DATE;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS match_status VARCHAR(20) DEFAULT 'pending';

-- PO auto-number counter
CREATE TABLE IF NOT EXISTS po_counter (
  id INTEGER PRIMARY KEY DEFAULT 1,
  counter INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT po_single_row CHECK (id = 1)
);
INSERT INTO po_counter (id, counter) VALUES (1, 0) ON CONFLICT DO NOTHING;

-- Goods Received Notes (GRN / Notas de Recepção)
CREATE TABLE IF NOT EXISTS purchase_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  received_by UUID,
  received_by_name VARCHAR(255),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_purchase_id ON purchase_receipts(purchase_id);
