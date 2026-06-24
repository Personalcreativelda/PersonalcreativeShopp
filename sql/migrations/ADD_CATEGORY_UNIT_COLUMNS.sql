-- Migration: extend categories and units tables, add variant_templates
-- Run once against the PostgreSQL database.

-- ── Categories: add color and icon ───────────────────────────────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color    VARCHAR(50)  DEFAULT '#3B82F6';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon     VARCHAR(100);

-- ── Units: add description and is_active ─────────────────────────────────────
ALTER TABLE units ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT TRUE;

-- ── Variant templates (new table) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS variant_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  values      JSONB        NOT NULL DEFAULT '[]',
  is_active   BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Seed default units if table is empty
INSERT INTO units (name, abbreviation, description, is_active)
SELECT name, abbreviation, description, TRUE
FROM (VALUES
  ('Unidade',    'un',  'Unidade genérica'),
  ('Kilograma',  'kg',  'Medida de peso'),
  ('Grama',      'g',   'Medida de peso'),
  ('Litro',      'l',   'Medida de volume'),
  ('Mililitro',  'ml',  'Medida de volume'),
  ('Dúzia',      'dz',  '12 unidades')
) AS v(name, abbreviation, description)
WHERE NOT EXISTS (SELECT 1 FROM units LIMIT 1);
