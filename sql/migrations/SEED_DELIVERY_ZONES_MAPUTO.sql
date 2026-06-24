-- Adicionar colunas se não existirem
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Semear províncias de Moçambique (só insere se tabela estiver vazia)
INSERT INTO delivery_zones (name, price, is_active, display_order)
SELECT * FROM (VALUES
  ('Maputo Cidade',  150, true,  1),
  ('Maputo Província', 300, true,  2),
  ('Gaza',           500, true,  3),
  ('Inhambane',      600, true,  4),
  ('Sofala',         700, true,  5),
  ('Manica',         750, true,  6),
  ('Tete',           800, true,  7),
  ('Zambézia',       850, true,  8),
  ('Nampula',        900, true,  9),
  ('Cabo Delgado',   950, true, 10),
  ('Niassa',        1000, true, 11)
) AS t(name, price, is_active, display_order)
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones LIMIT 1);
