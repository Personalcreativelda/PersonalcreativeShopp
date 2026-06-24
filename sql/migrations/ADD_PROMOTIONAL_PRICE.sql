-- Adiciona preço promocional aos produtos
ALTER TABLE products ADD COLUMN IF NOT EXISTS promotional_price DECIMAL(12,2);
