-- ============================================================
-- PARTE 2: TABELAS DE TRANSAÇÕES
-- Execute DEPOIS da Parte 1
-- ============================================================

-- Orders
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

-- Sales
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

-- Purchases
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

-- Purchase Requests
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

-- Stock Movements
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

-- Stock Transactions
CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    quantity DECIMAL(10,3) NOT NULL,
    type VARCHAR(20) NOT NULL,
    source_type VARCHAR(30),
    source_id UUID,
    unit_price DECIMAL(10,2),
    location_id UUID,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Adjustments
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

-- Stock Audits
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

-- Stock Audit Items
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

-- Weekly Goals
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

-- Pending Approvals
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

-- Audit Logs
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

-- Activities
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

SELECT '✅ PARTE 2 CONCLUÍDA - ' || COUNT(*) || ' tabelas total' 
FROM information_schema.tables 
WHERE table_schema = 'public';
