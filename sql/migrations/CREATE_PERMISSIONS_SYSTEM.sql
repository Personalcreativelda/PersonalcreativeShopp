-- Sistema de Roles e Permissões — NaturErva ERP
-- Seguro para executar múltiplas vezes (IF NOT EXISTS / ON CONFLICT DO NOTHING)

-- ── Extensões ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tabela profiles (garante colunas necessárias) ────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email            VARCHAR(255) UNIQUE NOT NULL,
    name             VARCHAR(255) NOT NULL DEFAULT '',
    phone            VARCHAR(50),
    avatar           TEXT,
    avatar_url       TEXT,
    role             VARCHAR(50)  NOT NULL DEFAULT 'STAFF',
    is_super_admin   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    customer_id      UUID,
    location_id      TEXT,
    location_ids     JSONB        NOT NULL DEFAULT '[]',
    password_hash    TEXT,
    requires_strong_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_login       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Adicionar colunas em falta (caso a tabela já exista sem elas)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_ids     JSONB        NOT NULL DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active        BOOLEAN      NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin   BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_id      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone            VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login       TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ  DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS requires_strong_password BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Roles ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(50)  UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description  TEXT,
    level        INTEGER      NOT NULL DEFAULT 99,
    is_system_role BOOLEAN    NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Permissions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description  TEXT,
    category     VARCHAR(50),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── User → Roles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id)     ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role_id)
);

-- ── Role → Permissions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id       UUID NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE (role_id, permission_id)
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id  ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id  ON user_roles (role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email      ON profiles   (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role       ON profiles   (role);

-- ── Roles iniciais ────────────────────────────────────────────────────────────
INSERT INTO roles (name, display_name, description, level, is_system_role) VALUES
  ('SUPER_ADMIN',    'Super Administrador',  'Acesso total ao sistema',                  0, TRUE),
  ('ADMIN',          'Administrador',        'Gestão completa do ERP',                   1, TRUE),
  ('GERENTE',        'Gerente',              'Gestão operacional',                       2, TRUE),
  ('CONTABILISTA',   'Contabilista',         'Acesso a finanças e relatórios',           3, TRUE),
  ('GESTOR_STOCK',   'Gestor de Stock',      'Gestão de inventário e stock',             4, TRUE),
  ('GESTOR_VENDAS',  'Gestor de Vendas',     'Gestão de vendas e encomendas',            4, TRUE),
  ('VENDEDOR',       'Vendedor',             'Criação de vendas e consulta de produtos', 5, TRUE),
  ('STAFF',          'Staff',                'Utilizador interno sem role específica',   8, TRUE),
  ('CLIENTE',        'Cliente',              'Utilizador da loja online',                9, TRUE)
ON CONFLICT (name) DO NOTHING;

-- ── Permissões iniciais ───────────────────────────────────────────────────────
INSERT INTO permissions (name, display_name, category) VALUES
  -- Utilizadores
  ('users.view',           'Ver Utilizadores',          'users'),
  ('users.create',         'Criar Utilizadores',        'users'),
  ('users.edit',           'Editar Utilizadores',       'users'),
  ('users.delete',         'Apagar Utilizadores',       'users'),
  -- Produtos
  ('products.view',        'Ver Produtos',              'products'),
  ('products.create',      'Criar Produtos',            'products'),
  ('products.edit',        'Editar Produtos',           'products'),
  ('products.delete',      'Apagar Produtos',           'products'),
  -- Encomendas
  ('orders.view',          'Ver Encomendas',            'orders'),
  ('orders.create',        'Criar Encomendas',          'orders'),
  ('orders.edit',          'Editar Encomendas',         'orders'),
  ('orders.delete',        'Apagar Encomendas',         'orders'),
  -- Clientes
  ('customers.view',       'Ver Clientes',              'customers'),
  ('customers.create',     'Criar Clientes',            'customers'),
  ('customers.edit',       'Editar Clientes',           'customers'),
  ('customers.delete',     'Apagar Clientes',           'customers'),
  -- Stock
  ('stock.view',           'Ver Stock',                 'stock'),
  ('stock.manage',         'Gerir Stock',               'stock'),
  -- Financeiro
  ('finance.view',         'Ver Finanças',              'finance'),
  ('finance.manage',       'Gerir Finanças',            'finance'),
  -- Relatórios
  ('reports.view',         'Ver Relatórios',            'reports'),
  -- Admin
  ('admin.access',         'Acesso ao Painel Admin',    'admin'),
  ('roles.manage',         'Gerir Roles e Permissões',  'admin')
ON CONFLICT (name) DO NOTHING;

-- ── Verificação ───────────────────────────────────────────────────────────────
SELECT
  '✅ Permissões criadas!' AS status,
  (SELECT COUNT(*) FROM roles)       AS roles,
  (SELECT COUNT(*) FROM permissions) AS permissions;
