-- ============================================================
-- SCHEMA COMPLETO - NATURERVA ERP
-- PostgreSQL Independente (sem Supabase)
-- ============================================================
-- 
-- Execute este script num PostgreSQL 12+ para criar toda a estrutura
-- do banco de dados independente do Supabase.
--
-- ============================================================

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TABELAS DE AUTENTICAÇÃO E UTILIZADORES
-- ============================================================

-- Tabela de perfis (utilizadores)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar TEXT,
    role VARCHAR(50) DEFAULT 'CLIENTE',
    is_super_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    customer_id UUID,
    location_id UUID,
    requires_strong_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Tabela de roles (funções)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 99,
    is_system_role BOOLEAN DEFAULT FALSE,
    tenant_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de permissões
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de associação user_roles
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- Tabela de associação role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

-- ============================================================
-- 2. TABELAS DE PRODUTOS
-- ============================================================

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de unidades
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    abbreviation VARCHAR(10) UNIQUE NOT NULL,
    type VARCHAR(20), -- 'weight', 'volume', 'unit'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    description_long TEXT,
    category VARCHAR(100),
    price DECIMAL(10,2) DEFAULT 0,
    cost_price DECIMAL(10,2) DEFAULT 0,
    stock DECIMAL(10,3) DEFAULT 0,
    min_stock DECIMAL(10,3) DEFAULT 0,
    unit VARCHAR(10) DEFAULT 'un',
    image TEXT,
    type VARCHAR(20) DEFAULT 'GERAL',
    show_in_shop BOOLEAN DEFAULT FALSE,
    has_variants BOOLEAN DEFAULT FALSE,
    landing_page_enabled BOOLEAN DEFAULT FALSE,
    landing_page_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de variações de produtos
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) DEFAULT 0,
    stock DECIMAL(10,3) DEFAULT 0,
    min_stock DECIMAL(10,3) DEFAULT 0,
    unit VARCHAR(10),
    image TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de avaliações de produtos
CREATE TABLE IF NOT EXISTS product_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_name VARCHAR(50) NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT CHECK (char_length(comment) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TABELAS DE CLIENTES
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    tier VARCHAR(20) DEFAULT 'Bronze',
    total_spent DECIMAL(12,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    last_order_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de ações de clientes
CREATE TABLE IF NOT EXISTS customer_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    action_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pendente',
    scheduled_date TIMESTAMPTZ,
    completed_date TIMESTAMPTZ,
    notes TEXT,
    priority VARCHAR(10) DEFAULT 'medium',
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de feedback de clientes
CREATE TABLE IF NOT EXISTS customer_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de insights de clientes
CREATE TABLE IF NOT EXISTS customer_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR(255),
    tier VARCHAR(20),
    risk_level VARCHAR(10),
    days_since_last_order INTEGER,
    total_spent DECIMAL(12,2),
    total_orders INTEGER,
    last_order_date TIMESTAMPTZ,
    suggested_action TEXT,
    insight_type VARCHAR(50),
    value DECIMAL(12,2),
    value_text TEXT,
    period VARCHAR(50),
    metadata JSONB,
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. TABELAS DE VENDAS E PEDIDOS
-- ============================================================

-- Tabela de zonas de entrega
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    location_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    items JSONB NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    amount_paid DECIMAL(12,2) DEFAULT 0,
    payment_proof TEXT,
    payment_proof_text TEXT,
    payment_method VARCHAR(50),
    delivery_address TEXT,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    is_delivery BOOLEAN DEFAULT FALSE,
    delivery_location TEXT,
    delivery_zone_id UUID REFERENCES delivery_zones(id),
    delivery_zone_name VARCHAR(100),
    delivery_latitude DECIMAL(10,7),
    delivery_longitude DECIMAL(10,7),
    delivery_address_formatted TEXT,
    notes TEXT,
    order_number VARCHAR(50),
    external_id VARCHAR(100),
    source VARCHAR(50) DEFAULT 'dashboard',
    location_id UUID,
    created_by UUID REFERENCES profiles(id),
    created_by_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

-- Tabela de vendas
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(255),
    items JSONB NOT NULL,
    total_amount DECIMAL(12,2),
    total_sales DECIMAL(12,2),
    total_deliveries DECIMAL(12,2),
    value_received DECIMAL(12,2),
    difference DECIMAL(12,2),
    notes TEXT,
    sale_type VARCHAR(20) DEFAULT 'LOJA',
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'paid',
    user_id UUID REFERENCES profiles(id),
    location_id UUID,
    date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. TABELAS DE COMPRAS E FORNECEDORES
-- ============================================================

-- Tabela de fornecedores
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(255),
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de compras
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    supplier_name VARCHAR(255),
    supplier_location_id UUID,
    supplier_location_name VARCHAR(255),
    items JSONB NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    order_date TIMESTAMPTZ,
    date TIMESTAMPTZ,
    expected_delivery_date TIMESTAMPTZ,
    received_date TIMESTAMPTZ,
    notes TEXT,
    invoice_number VARCHAR(100),
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    amount_paid DECIMAL(12,2) DEFAULT 0,
    payment_date TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id),
    location_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de requisições de compra
CREATE TABLE IF NOT EXISTS purchase_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requested_by UUID NOT NULL REFERENCES profiles(id),
    requested_by_name VARCHAR(255),
    items JSONB NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    priority VARCHAR(10) DEFAULT 'medium',
    notes TEXT,
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    location_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. TABELAS DE STOCK E INVENTÁRIO
-- ============================================================

-- Tabela de movimentos de stock
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TIMESTAMPTZ NOT NULL,
    items JSONB NOT NULL,
    notes TEXT,
    source VARCHAR(30),
    source_reference JSONB,
    created_by UUID REFERENCES profiles(id),
    location_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de transações de stock (histórico detalhado)
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    quantity DECIMAL(10,3) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'in' ou 'out'
    source_type VARCHAR(30), -- 'purchase', 'sale', 'adjustment', 'order'
    source_id UUID,
    unit_price DECIMAL(10,2),
    location_id UUID,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de ajustes de stock
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255),
    variant_id UUID REFERENCES product_variants(id),
    variant_name VARCHAR(255),
    quantity DECIMAL(10,3) NOT NULL,
    reason VARCHAR(30) NOT NULL,
    notes TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de auditorias de stock
CREATE TABLE IF NOT EXISTS stock_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_date TIMESTAMPTZ NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    scope VARCHAR(20) DEFAULT 'all',
    scope_filter JSONB,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ
);

-- Tabela de itens de auditoria de stock
CREATE TABLE IF NOT EXISTS stock_audit_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID NOT NULL REFERENCES stock_audits(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255),
    variant_id UUID REFERENCES product_variants(id),
    variant_name VARCHAR(255),
    system_quantity DECIMAL(10,3) NOT NULL,
    counted_quantity DECIMAL(10,3),
    discrepancy DECIMAL(10,3),
    unit VARCHAR(10),
    cost_price DECIMAL(10,2),
    notes TEXT,
    adjustment_reason VARCHAR(30),
    adjustment_notes TEXT,
    approved BOOLEAN DEFAULT FALSE,
    adjustment_id UUID REFERENCES stock_adjustments(id),
    category_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. TABELAS DE LOCALIZAÇÕES E GESTÃO
-- ============================================================

-- Tabela de localizações (lojas/armazéns)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    phone VARCHAR(20),
    manager_id UUID REFERENCES profiles(id),
    is_active BOOLEAN DEFAULT TRUE,
    type VARCHAR(20) DEFAULT 'store', -- 'store', 'warehouse', 'office'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de objetivos semanais
CREATE TABLE IF NOT EXISTS weekly_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    target_amount DECIMAL(12,2) NOT NULL,
    current_amount DECIMAL(12,2) DEFAULT 0,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. TABELAS DE APROVAÇÕES E AUDITORIA
-- ============================================================

-- Tabela de aprovações pendentes
CREATE TABLE IF NOT EXISTS pending_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    entity_data JSONB,
    requested_by UUID NOT NULL REFERENCES profiles(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    approval_level INTEGER DEFAULT 1,
    tenant_id UUID
);

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    entity_name VARCHAR(255),
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de atividades
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    user_name VARCHAR(255),
    category VARCHAR(30) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================

-- Produtos
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_show_in_shop ON products(show_in_shop);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);

-- Clientes
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customer_actions_customer_id ON customer_actions(customer_id);
CREATE INDEX idx_customer_feedback_customer_id ON customer_feedback(customer_id);

-- Pedidos e Vendas
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_date ON sales(date DESC);

-- Stock
CREATE INDEX idx_stock_movements_date ON stock_movements(date DESC);
CREATE INDEX idx_stock_transactions_product_id ON stock_transactions(product_id);
CREATE INDEX idx_stock_transactions_created_at ON stock_transactions(created_at DESC);
CREATE INDEX idx_stock_adjustments_product_id ON stock_adjustments(product_id);
CREATE INDEX idx_stock_audit_items_audit_id ON stock_audit_items(audit_id);

-- Compras
CREATE INDEX idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX idx_purchases_date ON purchases(date DESC);

-- Auditoria
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DADOS INICIAIS
-- ============================================================

-- Inserir roles padrão
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

-- Inserir unidades padrão
INSERT INTO units (name, abbreviation, type) VALUES
('Quilograma', 'kg', 'weight'),
('Grama', 'g', 'weight'),
('Litro', 'l', 'volume'),
('Mililitro', 'ml', 'volume'),
('Unidade', 'un', 'unit'),
('Dúzia', 'dz', 'unit'),
('Pacote', 'pct', 'unit')
ON CONFLICT (abbreviation) DO NOTHING;

-- Inserir categorias padrão
INSERT INTO categories (name) VALUES
('Carne'),
('Polpa'),
('Verdura'),
('Ovos'),
('Óleo'),
('Geral')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================

-- Exibir resumo
SELECT 
    schemaname, 
    tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Comentário do database (execute separadamente se necessário)
-- COMMENT ON DATABASE naturerva_erp IS 'NATURERVA ERP - Schema Completo PostgreSQL';
