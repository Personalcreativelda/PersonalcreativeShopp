-- ============================================================
-- SCRIPT DE BACKUP - EXPORTAR DADOS DO SUPABASE
-- ============================================================
--
-- Execute este script no Supabase SQL Editor para gerar
-- INSERT statements com todos os seus dados atuais
--
-- ============================================================

-- Ativar formato de saída para copiar/colar
\o backup_dados.sql

-- ============================================================
-- 1. BACKUP DE PRODUTOS
-- ============================================================
SELECT 'INSERT INTO products (id, name, slug, category, price, cost_price, stock, min_stock, unit, image, type, show_in_shop, description, description_long, has_variants, landing_page_enabled, landing_page_data, created_at, updated_at) VALUES' || E'\n' ||
string_agg(
  format(
    E'(%L, %L, %L, %L, %s, %s, %s, %s, %L, %L, %L, %s, %L, %L, %s, %s, %L, %L, %L)',
    id::text,
    name,
    slug,
    category,
    COALESCE(price, 0),
    COALESCE(cost_price, 0),
    COALESCE(stock, 0),
    COALESCE(min_stock, 0),
    unit,
    image,
    type,
    COALESCE(show_in_shop, false),
    description,
    description_long,
    COALESCE(has_variants, false),
    COALESCE(landing_page_enabled, false),
    COALESCE(landing_page_data::text, 'null'),
    created_at,
    updated_at
  ),
  E',\n'
) || ';'
FROM products;

-- ============================================================
-- 2. BACKUP DE VARIAÇÕES DE PRODUTOS
-- ============================================================
SELECT 'INSERT INTO product_variants (id, product_id, name, price, cost_price, stock, min_stock, unit, image, is_default, display_order, created_at, updated_at) VALUES' || E'\n' ||
string_agg(
  format(
    E'(%L, %L, %L, %s, %s, %s, %s, %L, %L, %s, %s, %L, %L)',
    id::text,
    product_id::text,
    name,
    price,
    COALESCE(cost_price, 0),
    COALESCE(stock, 0),
    COALESCE(min_stock, 0),
    unit,
    image,
    COALESCE(is_default, false),
    COALESCE(display_order, 0),
    created_at,
    updated_at
  ),
  E',\n'
) || ';'
FROM product_variants;

-- ============================================================
-- 3. BACKUP DE CLIENTES
-- ============================================================
SELECT 'INSERT INTO customers (id, name, phone, email, address, notes, tier, total_spent, total_orders, loyalty_points, last_order_date, created_at, updated_at) VALUES' || E'\n' ||
string_agg(
  format(
    E'(%L, %L, %L, %L, %L, %L, %L, %s, %s, %s, %L, %L, %L)',
    id::text,
    name,
    phone,
    email,
    address,
    notes,
    COALESCE(tier, 'Bronze'),
    COALESCE(total_spent, 0),
    COALESCE(total_orders, 0),
    COALESCE(loyalty_points, 0),
    last_order_date,
    created_at,
    updated_at
  ),
  E',\n'
) || ';'
FROM customers;

-- ============================================================
-- 4. BACKUP DE PEDIDOS
-- ============================================================
SELECT 'INSERT INTO orders (id, customer_id, customer_name, customer_phone, items, total_amount, status, payment_status, amount_paid, delivery_address, delivery_fee, is_delivery, notes, created_at, updated_at, delivered_at) VALUES' || E'\n' ||
string_agg(
  format(
    E'(%L, %L, %L, %L, %L, %s, %L, %L, %s, %L, %s, %s, %L, %L, %L, %L)',
    id::text,
    customer_id::text,
    customer_name,
    customer_phone,
    items::text,
    total_amount,
    status,
    COALESCE(payment_status, 'unpaid'),
    COALESCE(amount_paid, 0),
    delivery_address,
    COALESCE(delivery_fee, 0),
    COALESCE(is_delivery, false),
    notes,
    created_at,
    updated_at,
    delivered_at
  ),
  E',\n'
) || ';'
FROM orders
WHERE created_at > NOW() - INTERVAL '6 months'; -- Últimos 6 meses

-- ============================================================
-- 5. BACKUP DE FORNECEDORES
-- ============================================================
SELECT 'INSERT INTO suppliers (id, name, contact, contact_person, phone, email, address, notes, is_active, created_at, updated_at) VALUES' || E'\n' ||
string_agg(
  format(
    E'(%L, %L, %L, %L, %L, %L, %L, %L, %s, %L, %L)',
    id::text,
    name,
    contact,
    contact_person,
    phone,
    email,
    address,
    notes,
    COALESCE(is_active, true),
    created_at,
    updated_at
  ),
  E',\n'
) || ';'
FROM suppliers;

-- ============================================================
-- 6. BACKUP DE CATEGORIAS
-- ============================================================
SELECT 'INSERT INTO categories (id, name, description, display_order, is_active, created_at) VALUES' || E'\n' ||
string_agg(
  format(
    E'(%L, %L, %L, %s, %s, %L)',
    id::text,
    name,
    description,
    COALESCE(display_order, 0),
    COALESCE(is_active, true),
    created_at
  ),
  E',\n'
) || ';'
FROM categories;

-- ============================================================
-- 7. BACKUP DE UNIDADES
-- ============================================================
SELECT 'INSERT INTO units (id, name, abbreviation, type, created_at) VALUES' || E'\n' ||
string_agg(
  format(
    E'(%L, %L, %L, %L, %L)',
    id::text,
    name,
    abbreviation,
    type,
    created_at
  ),
  E',\n'
) || ';'
FROM units;

-- ============================================================
-- INSTRUÇÕES
-- ============================================================

/*
COMO USAR ESTE BACKUP:

1. Execute este script no Supabase SQL Editor
2. Copie todo o resultado (pode ser grande!)
3. Salve em um arquivo: backup_dados.sql
4. Após criar o schema no PostgreSQL novo, execute:
   
   psql -U postgres -d naturerva_erp -f backup_dados.sql

5. Verifique se os dados foram importados:
   
   psql -U postgres -d naturerva_erp
   SELECT COUNT(*) FROM products;
   SELECT COUNT(*) FROM customers;
   SELECT COUNT(*) FROM orders;

NOTAS:
- Este script exporta apenas os últimos 6 meses de pedidos
- Ajuste o filtro se quiser mais/menos histórico
- UUIDs são preservados para manter referências
- Imagens precisam ser migradas separadamente
*/
