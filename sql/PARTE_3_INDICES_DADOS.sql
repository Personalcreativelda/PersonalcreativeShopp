-- ============================================================
-- PARTE 3: ÍNDICES, TRIGGERS E DADOS INICIAIS
-- Execute DEPOIS da Parte 2
-- ============================================================

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_show_in_shop ON products(show_in_shop);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customer_actions_customer_id ON customer_actions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_customer_id ON customer_feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_product_id ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created_at ON stock_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_id ON stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_audit_items_audit_id ON stock_audit_items(audit_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

-- FUNÇÃO UPDATE_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_variants_updated_at ON product_variants;
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchases_updated_at ON purchases;
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_movements_updated_at ON stock_movements;
CREATE TRIGGER update_stock_movements_updated_at BEFORE UPDATE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_audit_items_updated_at ON stock_audit_items;
CREATE TRIGGER update_stock_audit_items_updated_at BEFORE UPDATE ON stock_audit_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_requests_updated_at ON purchase_requests;
CREATE TRIGGER update_purchase_requests_updated_at BEFORE UPDATE ON purchase_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- DADOS INICIAIS - ROLES
INSERT INTO roles (name, display_name, level, is_system_role) VALUES
('SUPER_ADMIN', 'Super Administrador', 0, TRUE),
('ADMIN', 'Administrador', 1, TRUE),
('GERENTE', 'Gerente', 2, TRUE),
('CONTABILISTA', 'Contabilista', 3, TRUE),
('GESTOR_STOCK', 'Gestor de Stock', 4, TRUE),
('GESTOR_VENDAS', 'Gestor de Vendas', 4, TRUE),
('VENDEDOR', 'Vendedor', 5, TRUE),
('CLIENTE', 'Cliente', 6, TRUE)
ON CONFLICT (name) DO NOTHING;

-- DADOS INICIAIS - UNITS
INSERT INTO units (name, abbreviation, type) VALUES
('Quilograma', 'kg', 'weight'),
('Grama', 'g', 'weight'),
('Litro', 'l', 'volume'),
('Mililitro', 'ml', 'volume'),
('Unidade', 'un', 'unit'),
('Dúzia', 'dz', 'unit'),
('Pacote', 'pct', 'unit')
ON CONFLICT (abbreviation) DO NOTHING;

-- DADOS INICIAIS - CATEGORIES
INSERT INTO categories (name) VALUES
('Carne'),
('Polpa'),
('Verdura'),
('Ovos'),
('Óleo'),
('Geral')
ON CONFLICT (name) DO NOTHING;

-- RESUMO FINAL
SELECT 
    '✅ SCHEMA COMPLETO!' as status,
    COUNT(*) as total_tabelas,
    (SELECT COUNT(*) FROM roles) as roles_criados,
    (SELECT COUNT(*) FROM units) as unidades_criadas,
    (SELECT COUNT(*) FROM categories) as categorias_criadas
FROM information_schema.tables 
WHERE table_schema = 'public';
