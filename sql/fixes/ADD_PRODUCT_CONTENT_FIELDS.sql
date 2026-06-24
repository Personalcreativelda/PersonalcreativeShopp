-- Adiciona campos de conteúdo ao produto: benefícios, como usar, ingredientes
-- Execute este script no banco de dados PostgreSQL

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS benefits       TEXT,
  ADD COLUMN IF NOT EXISTS how_to_use     TEXT,
  ADD COLUMN IF NOT EXISTS ingredients    TEXT;
