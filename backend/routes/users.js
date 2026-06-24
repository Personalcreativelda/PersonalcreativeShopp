import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { uploadToMinio } from '../storage/minio.js';

const router = express.Router();

const mapUser = (profile) => {
  const roleNames = Array.isArray(profile.role_names) ? profile.role_names.filter(Boolean) : [];
  return {
    id: profile.id,
    name: profile.name || profile.email?.split('@')[0] || 'Utilizador',
    email: profile.email || '',
    phone: profile.phone || undefined,
    role: roleNames[0] || profile.role || 'STAFF',
    roles: roleNames.length > 0 ? roleNames : [profile.role || 'STAFF'],
    avatar: profile.avatar_url,
    isActive: profile.is_active !== false,
    lastLogin: profile.last_login || undefined,
    locationId: profile.location_id || undefined,
    locationIds: profile.location_ids || [],
    isSuperAdmin: profile.is_super_admin || false
  };
};

// GET /api/users
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
        COALESCE(
          array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL),
          ARRAY[]::text[]
        ) AS role_names
      FROM profiles p
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN roles r ON r.id = ur.role_id
      GROUP BY p.id
      ORDER BY p.name
    `);
    res.json(rows.map(mapUser));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar utilizadores' });
  }
});

// GET /api/users/sales-managers
router.get('/sales-managers', authMiddleware, async (req, res) => {
  try {
    // Tentar via user_roles
    let rows = [];
    try {
      const { rows: roleRows } = await pool.query(
        `SELECT p.* FROM profiles p
         JOIN user_roles ur ON ur.user_id = p.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.name = 'GESTOR_VENDAS'
         ORDER BY p.name`
      );
      rows = roleRows;
    } catch {}

    // Fallback: campo role em profiles
    if (!rows.length) {
      const { rows: fallback } = await pool.query(
        "SELECT * FROM profiles WHERE role = 'GESTOR_VENDAS' ORDER BY name"
      );
      rows = fallback;
    }

    res.json(rows.map(u => ({ ...mapUser(u), role: 'GESTOR_VENDAS' })));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar gestores' });
  }
});

// GET /api/users/order-vendors
router.get('/order-vendors', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT p.* FROM profiles p
       INNER JOIN orders o ON o.created_by = p.id
       WHERE o.created_by IS NOT NULL
       ORDER BY p.name`
    );
    res.json(rows.map(mapUser));
  } catch (err) {
    res.json([]);
  }
});

// GET /api/users/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
        COALESCE(
          array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL),
          ARRAY[]::text[]
        ) AS role_names
      FROM profiles p
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });
    res.json(mapUser(rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar utilizador' });
  }
});

// POST /api/users
router.post('/', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, email, phone, password, role_ids, is_active, is_super_admin, location_id, location_ids } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Nome, email e password são obrigatórios' });
    }

    // Verificar se o email já existe
    const { rows: existing } = await client.query('SELECT id FROM profiles WHERE email = $1', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Já existe um utilizador com este email' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await client.query('BEGIN');

    // Determinar o role primário a partir dos role_ids
    let primaryRole = 'STAFF';
    if (role_ids && role_ids.length > 0) {
      const { rows: rr } = await client.query('SELECT name FROM roles WHERE id = $1', [role_ids[0]]);
      if (rr.length) primaryRole = rr[0].name;
    }

    // Inserir na tabela profiles
    const { rows: newProfile } = await client.query(
      `INSERT INTO profiles (email, name, phone, role, password_hash, is_active, is_super_admin, location_id, location_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [email, name, phone, primaryRole, passwordHash, is_active !== false, is_super_admin || false, location_id || null, location_ids || '[]']
    );

    const userId = newProfile[0].id;

    // Inserir em user_roles
    if (role_ids && role_ids.length > 0) {
      for (const roleId of role_ids) {
        await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(mapUser(newProfile[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar utilizador:', err);
    res.status(500).json({ error: 'Erro ao criar utilizador' });
  } finally {
    client.release();
  }
});

// PUT /api/users/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const u = req.body;
    const userId = req.params.id;
    
    await client.query('BEGIN');
    
    const fields = [];
    const values = [];
    let i = 1;

    if (u.name !== undefined) { fields.push(`name = $${i++}`); values.push(u.name); }
    if (u.phone !== undefined) { fields.push(`phone = $${i++}`); values.push(u.phone); }
    if (u.role !== undefined) { fields.push(`role = $${i++}`); values.push(u.role); }
    if (u.isActive !== undefined) { fields.push(`is_active = $${i++}`); values.push(u.isActive); }
    if (u.locationId !== undefined) { fields.push(`location_id = $${i++}`); values.push(u.locationId); }
    if (u.locationIds !== undefined) { fields.push(`location_ids = $${i++}`); values.push(u.locationIds); }
    if (u.isSuperAdmin !== undefined) { fields.push(`is_super_admin = $${i++}`); values.push(u.isSuperAdmin); }
    if (u.avatar !== undefined) { fields.push(`avatar_url = $${i++}`); values.push(u.avatar); }
    
    if (u.password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(u.password, salt);
      fields.push(`password_hash = $${i++}`); values.push(passwordHash);
    }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(userId);
      await client.query(`UPDATE profiles SET ${fields.join(', ')} WHERE id = $${i}`, values);
    }

    if (u.role_ids !== undefined) {
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      if (u.role_ids.length > 0) {
        for (const roleId of u.role_ids) {
          await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
        }
        // Sincronizar profiles.role com o role primário
        const { rows: rr } = await client.query('SELECT name FROM roles WHERE id = $1', [u.role_ids[0]]);
        if (rr.length) {
          await client.query('UPDATE profiles SET role = $1 WHERE id = $2', [rr[0].name, userId]);
        }
      }
    }

    await client.query('COMMIT');

    // Devolver o utilizador atualizado com os roles correctos
    const { rows: updated } = await pool.query(`
      SELECT p.*,
        COALESCE(array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS role_names
      FROM profiles p
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE p.id = $1 GROUP BY p.id`, [userId]);

    res.json({ success: true, user: updated.length ? mapUser(updated[0]) : null });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar utilizador:', err);
    res.status(500).json({ error: 'Erro ao atualizar utilizador' });
  } finally {
    client.release();
  }
});

// DELETE /api/users/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.params.id;
    if (req.user && req.user.id === userId) {
      return res.status(400).json({ error: 'Não é possível remover a própria conta.' });
    }

    const { rows } = await client.query('SELECT id FROM profiles WHERE id = $1', [userId]);
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado.' });

    // Função auxiliar: executa query com SAVEPOINT para não abortar a transação se falhar
    let spIdx = 0;
    const safe = async (sql, params = []) => {
      const sp = `sp_${++spIdx}`;
      await client.query(`SAVEPOINT ${sp}`);
      try {
        await client.query(sql, params);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
      } catch {
        await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      }
    };

    await client.query('BEGIN');

    await safe('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    await safe('DELETE FROM admin_activity_log WHERE user_id = $1', [userId]);
    await safe('DELETE FROM shop_visits WHERE user_id = $1', [userId]);
    await safe('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    await safe('UPDATE orders SET created_by = NULL WHERE created_by = $1', [userId]);
    await safe('UPDATE sales SET user_id = NULL WHERE user_id = $1', [userId]);
    await safe('UPDATE refund_requests SET user_id = NULL WHERE user_id = $1', [userId]);
    await safe('UPDATE refund_requests SET reviewed_by = NULL WHERE reviewed_by = $1', [userId]);
    await safe('UPDATE coupons SET created_by = NULL WHERE created_by = $1', [userId]);
    await safe('UPDATE marketing_campaigns SET created_by = NULL WHERE created_by = $1', [userId]);
    await safe('UPDATE blog_posts SET author_id = NULL WHERE author_id = $1', [userId]);
    await safe('DELETE FROM affiliate_referrals WHERE referred_profile_id = $1', [userId]);
    await safe('DELETE FROM affiliates WHERE user_id = $1', [userId]);

    await client.query('DELETE FROM profiles WHERE id = $1', [userId]);
    await client.query('COMMIT');

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao remover utilizador:', err);
    res.status(500).json({ error: 'Erro ao remover utilizador: ' + err.message });
  } finally {
    client.release();
  }
});

// POST /api/users/:id/avatar — upload de foto de perfil para MinIO
router.post('/:id/avatar', authMiddleware, async (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) return res.status(400).json({ error: 'imageData obrigatório' });

    const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Formato base64 inválido' });

    const [, mime, b64] = match;
    const buffer = Buffer.from(b64, 'base64');
    const { url } = await uploadToMinio(buffer, 'avatars', mime);

    await pool.query('UPDATE profiles SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [url, req.params.id]);
    res.json({ url });
  } catch (err) {
    console.error('[POST /users/:id/avatar]', err);
    res.status(500).json({ error: 'Erro ao fazer upload do avatar' });
  }
});

export default router;
