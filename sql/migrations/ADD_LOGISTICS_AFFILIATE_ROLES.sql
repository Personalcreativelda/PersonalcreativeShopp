-- Adicionar roles de Logística e Afiliado + permissão logistics.manage

-- Roles novos
INSERT INTO roles (name, display_name, description, level, is_system_role) VALUES
  ('LOGISTICA',  'Logística',  'Gestão de entregas e atualização de status de encomendas', 5, TRUE),
  ('AFILIADO',   'Afiliado',   'Participante do programa de afiliados',                    7, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Permissão nova
INSERT INTO permissions (name, display_name, category) VALUES
  ('logistics.manage', 'Gerir Logística e Entregas', 'orders')
ON CONFLICT (name) DO NOTHING;

-- Atribuir permissão logistics.manage ao role LOGISTICA
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'LOGISTICA' AND p.name = 'logistics.manage'
ON CONFLICT DO NOTHING;

-- LOGISTICA também pode ver encomendas
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'LOGISTICA' AND p.name IN ('orders.view', 'orders.edit', 'admin.access')
ON CONFLICT DO NOTHING;

SELECT '✅ Roles LOGISTICA e AFILIADO criados' AS status;
