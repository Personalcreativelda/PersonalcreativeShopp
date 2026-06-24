import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import pool from '../db.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'naturerva_erp_jwt_secret_2025_super_secure_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildTokenPayload(profile, roles) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role || 'CLIENTE',
    roles,
    isSuperAdmin: profile.is_super_admin || false
  };
}

function buildUserResponse(profile, roles) {
  return {
    id: profile.id,
    email: profile.email || '',
    name: profile.name || '',
    phone: profile.phone || undefined,
    role: roles[0] || profile.role || 'STAFF',  // user_roles tem prioridade sobre profiles.role
    roles,
    avatar: profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || profile.email || 'U')}&background=random`,
    customerId: profile.customer_id || undefined,
    isActive: profile.is_active !== false,
    isSuperAdmin: profile.is_super_admin || false,
    lastLogin: profile.last_login || new Date().toISOString(),
    requiresStrongPassword: profile.requires_strong_password === true,
    points: profile.points || 0,
    totalPointsEarned: profile.total_points_earned || 0
  };
}

async function getRoles(profileId, fallbackRole) {
  try {
    const { rows } = await pool.query(
      `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
      [profileId]
    );
    if (rows.length) return rows.map(r => r.name);
  } catch {}
  return [fallbackRole || 'STAFF'];
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, referralCode } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ error: 'Nome, Email e password são obrigatórios' });
    if (password.length < 6)
      return res.status(400).json({ error: 'A password deve ter pelo menos 6 caracteres' });

    const { rows: existing } = await pool.query(
      'SELECT id FROM profiles WHERE LOWER(email) = LOWER($1)', [email.trim()]
    );
    if (existing.length)
      return res.status(400).json({ error: 'Este email já está registado. Por favor faça login.' });

    const hash = await bcrypt.hash(password, 12);
    const { rows: newRows } = await pool.query(
      `INSERT INTO profiles (email, name, phone, role, password_hash, is_active)
       VALUES ($1, $2, $3, 'CLIENTE', $4, true) RETURNING id, email, name, role`,
      [email.trim(), name.trim(), phone || null, hash]
    );
    const profile = newRows[0];

    // Criar customer associado
    try {
      await pool.query(
        `INSERT INTO customers (name, email, phone, profile_id) VALUES ($1, $2, $3, $4)`,
        [name.trim(), email.trim(), phone || null, profile.id]
      );
    } catch (e) {
      console.warn('[Register] customer insert warn:', e.message);
    }

    // Código de afiliado
    if (referralCode) {
      try {
        const code = referralCode.trim().toUpperCase();
        const { rows: affRows } = await pool.query(
          "SELECT id FROM affiliates WHERE referral_code = $1 AND status = 'active'", [code]
        );
        if (affRows.length) {
          await pool.query(
            'INSERT INTO affiliate_referrals (affiliate_id, referred_profile_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [affRows[0].id, profile.id]
          );
          await pool.query('UPDATE affiliates SET total_referrals = total_referrals + 1 WHERE id = $1', [affRows[0].id]);
          await pool.query('UPDATE profiles SET referred_by_code = $1 WHERE id = $2', [code, profile.id]);
        }
      } catch (e) {
        console.warn('[Register] referral warn:', e.message);
      }
    }

    // Email de boas-vindas (best-effort)
    sendWelcomeEmail({ name: profile.name, email: profile.email }).catch(() => {});

    const roles = ['CLIENTE'];
    const token = jwt.sign(buildTokenPayload(profile, roles), JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({ token, user: buildUserResponse(profile, roles) });
  } catch (err) {
    console.error('[Auth Register]', err);
    res.status(500).json({ error: 'Erro interno ao registar conta' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email e password são obrigatórios' });

    const { rows } = await pool.query(
      `SELECT * FROM profiles WHERE (LOWER(email) = LOWER($1) OR phone = $1) AND is_active = true LIMIT 1`,
      [email.trim()]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique o email e a password.' });

    const profile = rows[0];
    if (!profile.password_hash)
      return res.status(401).json({ error: 'Conta sem password configurada. Contacte o administrador.' });

    const ok = await bcrypt.compare(password, profile.password_hash);
    if (!ok)
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique o email e a password.' });

    const roles = await getRoles(profile.id, profile.role);
    await pool.query('UPDATE profiles SET last_login = NOW() WHERE id = $1', [profile.id]).catch(() => {});

    const token = jwt.sign(buildTokenPayload(profile, roles), JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, user: buildUserResponse(profile, roles) });
  } catch (err) {
    console.error('[Auth Login]', err);
    res.status(500).json({ error: 'Erro interno ao fazer login' });
  }
});

// ─── POST /api/auth/google ────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Token Google obrigatório' });
    if (!process.env.GOOGLE_CLIENT_ID)
      return res.status(501).json({ error: 'Google Auth não configurado no servidor' });

    // Verificar token com Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    if (!email) return res.status(400).json({ error: 'Email não disponível na conta Google' });

    // Encontrar ou criar perfil
    let profile;
    const { rows: existing } = await pool.query(
      'SELECT * FROM profiles WHERE LOWER(email) = LOWER($1) AND is_active = true LIMIT 1', [email]
    );

    if (existing.length) {
      profile = existing[0];
      // Guardar google_id se ainda não estiver guardado
      if (!profile.google_id) {
        await pool.query('UPDATE profiles SET google_id = $1, last_login = NOW() WHERE id = $2', [googleId, profile.id]);
      } else {
        await pool.query('UPDATE profiles SET last_login = NOW() WHERE id = $1', [profile.id]);
      }
    } else {
      // Criar nova conta
      const { rows: newRows } = await pool.query(
        `INSERT INTO profiles (email, name, role, is_active, google_id, avatar_url)
         VALUES ($1, $2, 'CLIENTE', true, $3, $4) RETURNING *`,
        [email, name || email.split('@')[0], googleId, picture || null]
      );
      profile = newRows[0];

      try {
        await pool.query(
          `INSERT INTO customers (name, email, profile_id) VALUES ($1, $2, $3)`,
          [profile.name, email, profile.id]
        );
      } catch {}

      sendWelcomeEmail({ name: profile.name, email }).catch(() => {});
    }

    const roles = await getRoles(profile.id, profile.role || 'CLIENTE');
    const token = jwt.sign(buildTokenPayload(profile, roles), JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, user: buildUserResponse(profile, roles) });
  } catch (err) {
    console.error('[Auth Google]', err);
    if (err.message?.includes('Token used too late') || err.message?.includes('Invalid token'))
      return res.status(401).json({ error: 'Token Google inválido ou expirado' });
    res.status(500).json({ error: 'Erro ao autenticar com Google' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Não autenticado' });

    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const { rows } = await pool.query('SELECT * FROM profiles WHERE id = $1', [decoded.id]);
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });

    const profile = rows[0];
    const roles = await getRoles(profile.id, profile.role);
    res.json(buildUserResponse(profile, roles));
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ success: true });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Não autenticado' });
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Passwords obrigatórias' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'Nova password deve ter pelo menos 6 caracteres' });

    const { rows } = await pool.query('SELECT password_hash FROM profiles WHERE id = $1', [decoded.id]);
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash || '');
    if (!match) return res.status(400).json({ error: 'Password atual incorreta' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE profiles SET password_hash = $1, requires_strong_password = false, updated_at = NOW() WHERE id = $2',
      [hash, decoded.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth ChangePassword]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email obrigatório' });

    const { rows } = await pool.query(
      'SELECT id, name, email FROM profiles WHERE LOWER(email) = LOWER($1) AND is_active = true LIMIT 1',
      [email.trim()]
    );

    // Sempre responder com sucesso para não revelar se o email existe
    if (!rows.length) {
      return res.json({ success: true });
    }

    const profile = rows[0];
    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Invalidar tokens anteriores
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false', [profile.id]);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [profile.id, token, expiresAt]
    );

    await sendPasswordResetEmail({ to: profile.email, name: profile.name, resetToken: token });
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth ForgotPassword]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword)
      return res.status(400).json({ error: 'Token e nova password são obrigatórios' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'A password deve ter pelo menos 6 caracteres' });

    const { rows } = await pool.query(
      `SELECT t.user_id, t.expires_at FROM password_reset_tokens t
       WHERE t.token = $1 AND t.used = false AND t.expires_at > NOW()`,
      [token]
    );
    if (!rows.length)
      return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });

    const { user_id } = rows[0];
    const hash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE profiles SET password_hash = $1, requires_strong_password = false, updated_at = NOW() WHERE id = $2',
      [hash, user_id]
    );
    await pool.query(
      'UPDATE password_reset_tokens SET used = true WHERE token = $1', [token]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[Auth ResetPassword]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── GET /api/auth/my-permissions ────────────────────────────────────────────
// Retorna as permissões do utilizador autenticado baseadas nos seus roles (sem Supabase)
router.get('/my-permissions', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Não autenticado' });

    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const { rows: roleRows } = await pool.query(
      `SELECT r.name AS role_name, p.name AS permission_name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1`,
      [decoded.id]
    );

    const roleNames = [...new Set(roleRows.map(r => r.role_name).filter(Boolean))];
    const permNames = [...new Set(roleRows.map(r => r.permission_name).filter(Boolean))];

    // Qualquer utilizador com pelo menos um role de staff tem acesso à dashboard admin
    const isStaff = roleNames.length > 0 && !roleNames.every(r => r === 'CLIENTE');
    if (isStaff && !permNames.includes('admin.access')) {
      permNames.push('admin.access');
    }

    res.json({ roles: roleNames, permissions: permNames });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token inválido' });
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── POST /api/auth/refresh-token ─────────────────────────────────────────────
// Devolve um novo JWT com os roles/permissões actualizados da BD
router.post('/refresh-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Não autenticado' });

    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const { rows } = await pool.query('SELECT * FROM profiles WHERE id = $1', [decoded.id]);
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' });

    const profile = rows[0];
    const roles = await getRoles(profile.id, profile.role);
    const token = jwt.sign(buildTokenPayload(profile, roles), JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, user: buildUserResponse(profile, roles) });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token inválido' });
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
