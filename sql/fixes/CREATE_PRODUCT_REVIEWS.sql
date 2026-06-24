-- ============================================================
-- Tabela de avaliações de produtos
-- ============================================================
CREATE TABLE IF NOT EXISTS product_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_name    TEXT NOT NULL CHECK (char_length(user_name) BETWEEN 1 AND 50),
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 500),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index para queries por produto
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode ler avaliações
CREATE POLICY "reviews_select_public"
  ON product_reviews FOR SELECT
  USING (true);

-- Qualquer pessoa (incluindo anónimos) pode inserir
CREATE POLICY "reviews_insert_public"
  ON product_reviews FOR INSERT
  WITH CHECK (true);

-- Apenas admins podem eliminar
CREATE POLICY "reviews_delete_admin"
  ON product_reviews FOR DELETE
  USING (auth.role() = 'authenticated');
