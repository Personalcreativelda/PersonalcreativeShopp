import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// GET /api/roles — roles with their permissions
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows: roles } = await pool.query(
      'SELECT id, name, display_name, description, is_system_role FROM roles ORDER BY display_name'
    );
    const { rows: rolePermissions } = await pool.query(`
      SELECT rp.role_id, p.id, p.name, p.description, p.category
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
    `);

    const formattedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      display_name: role.display_name,
      description: role.description,
      is_system_role: role.is_system_role,
      role_permissions: rolePermissions
        .filter(rp => rp.role_id === role.id)
        .map(rp => ({
          permission_id: rp.id,
          permissions: { id: rp.id, name: rp.name, description: rp.description, category: rp.category }
        }))
    }));

    res.json(formattedRoles);
  } catch (err) {
    console.error('Erro ao buscar roles:', err);
    res.status(500).json({ error: 'Erro ao buscar roles' });
  }
});

// GET /api/roles/permissions — all available permissions
router.get('/permissions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, description, category FROM permissions ORDER BY category, name'
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar permissions:', err);
    res.status(500).json({ error: 'Erro ao buscar permissions' });
  }
});

// POST /api/roles — create role + assign permissions
router.post('/', authMiddleware, async (req, res) => {
  const { name, displayName, description, permissionIds = [] } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Nome do role é obrigatório' });
  if (!displayName?.trim()) return res.status(400).json({ error: 'Nome de exibição é obrigatório' });

  const normalizedName = name.toUpperCase().replace(/\s+/g, '_');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT id FROM roles WHERE name = $1', [normalizedName]
    );
    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Já existe um role com este nome' });
    }

    const { rows } = await client.query(
      `INSERT INTO roles (name, display_name, description, is_system_role)
       VALUES ($1, $2, $3, false) RETURNING *`,
      [normalizedName, displayName.trim(), description?.trim() || null]
    );
    const newRole = rows[0];

    if (permissionIds.length > 0) {
      const values = permissionIds.map((pid, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`,
        [newRole.id, ...permissionIds]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...newRole, display_name: newRole.display_name });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar role:', err);
    res.status(500).json({ error: 'Erro ao criar role' });
  } finally {
    client.release();
  }
});

// PUT /api/roles/:id — update role display_name, description + replace permissions
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { displayName, description, permissionIds } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: current } = await client.query('SELECT * FROM roles WHERE id = $1', [id]);
    if (!current.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Role não encontrado' });
    }

    if (displayName !== undefined || description !== undefined) {
      await client.query(
        `UPDATE roles SET
           display_name = COALESCE($2, display_name),
           description  = $3
         WHERE id = $1`,
        [id, displayName?.trim() ?? null, description?.trim() ?? null]
      );
    }

    if (Array.isArray(permissionIds)) {
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);
      if (permissionIds.length > 0) {
        const values = permissionIds.map((pid, i) => `($1, $${i + 2})`).join(', ');
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`,
          [id, ...permissionIds]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar role:', err);
    res.status(500).json({ error: 'Erro ao atualizar role' });
  } finally {
    client.release();
  }
});

// DELETE /api/roles/:id — cascade delete
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT is_system_role FROM roles WHERE id = $1', [id]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Role não encontrado' });
    }
    if (rows[0].is_system_role) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Roles do sistema não podem ser apagados' });
    }

    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);
    await client.query('DELETE FROM user_roles WHERE role_id = $1', [id]);
    await client.query('DELETE FROM roles WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao apagar role:', err);
    res.status(500).json({ error: 'Erro ao apagar role' });
  } finally {
    client.release();
  }
});

export default router;
