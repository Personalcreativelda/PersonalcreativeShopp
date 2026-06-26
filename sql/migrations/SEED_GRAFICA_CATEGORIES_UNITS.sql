-- Categorias e unidades para gráfica e serigrafia
-- Seguro para correr múltiplas vezes (ON CONFLICT DO NOTHING)

-- Novas unidades relevantes para gráfica
INSERT INTO units (name, abbreviation, type) VALUES
('Caixa',          'cx',  'unit'),
('Resma',          'rm',  'unit'),
('Rolo',           'rl',  'unit'),
('Metro',          'm',   'unit'),
('Metro Quadrado', 'm2',  'unit')
ON CONFLICT (abbreviation) DO NOTHING;

-- Novas categorias para gráfica e material de escritório
INSERT INTO categories (name) VALUES
('Papel e Cartão'),
('Tintas e Toners'),
('Serigrafia'),
('Impressão Digital'),
('Plastificação e Acabamento'),
('Encadernação'),
('Material de Escritório'),
('Geral')
ON CONFLICT (name) DO NOTHING;
