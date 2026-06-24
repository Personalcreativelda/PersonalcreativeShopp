import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

function generateReferralCode(name) {
  const prefix = name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  return prefix + suffix;
}

// GET /api/affiliates/me — perfil do afiliado autenticado
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.* FROM affiliates a WHERE a.profile_id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não é afiliado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar perfil de afiliado' });
  }
});

// POST /api/affiliates/join — aderir ao programa
router.post('/join', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(
      'SELECT id FROM affiliates WHERE profile_id = $1', [req.user.id]
    );
    if (existing.length) return res.status(400).json({ error: 'Já é afiliado' });

    const { rows: profile } = await client.query('SELECT name FROM profiles WHERE id = $1', [req.user.id]);
    const name = profile[0]?.name || 'USER';

    // Gerar código único (retry até 10x)
    let code;
    for (let i = 0; i < 10; i++) {
      const candidate = generateReferralCode(name);
      const { rows: taken } = await client.query('SELECT id FROM affiliates WHERE referral_code = $1', [candidate]);
      if (!taken.length) { code = candidate; break; }
    }
    if (!code) return res.status(500).json({ error: 'Erro ao gerar código. Tente novamente.' });

    await client.query('BEGIN');
    const { rows: newAff } = await client.query(
      `INSERT INTO affiliates (profile_id, referral_code) VALUES ($1, $2) RETURNING *`,
      [req.user.id, code]
    );
    await client.query('COMMIT');
    res.status(201).json(newAff[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Affiliates] join:', err);
    res.status(500).json({ error: 'Erro ao registar como afiliado' });
  } finally {
    client.release();
  }
});

// GET /api/affiliates/commissions — comissões do afiliado autenticado
router.get('/commissions', authMiddleware, async (req, res) => {
  try {
    const { rows: aff } = await pool.query('SELECT id FROM affiliates WHERE profile_id = $1', [req.user.id]);
    if (!aff.length) return res.json([]);
    const { rows } = await pool.query(
      `SELECT ac.*, o.order_number, p.name AS referred_name
       FROM affiliate_commissions ac
       LEFT JOIN orders o ON o.id = ac.order_id
       LEFT JOIN profiles p ON p.id = ac.referred_profile_id
       WHERE ac.affiliate_id = $1
       ORDER BY ac.created_at DESC`,
      [aff[0].id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar comissões' });
  }
});

// GET /api/affiliates/withdrawals — levantamentos do afiliado autenticado
router.get('/withdrawals', authMiddleware, async (req, res) => {
  try {
    const { rows: aff } = await pool.query('SELECT id FROM affiliates WHERE profile_id = $1', [req.user.id]);
    if (!aff.length) return res.json([]);
    const { rows } = await pool.query(
      'SELECT * FROM affiliate_withdrawals WHERE affiliate_id = $1 ORDER BY created_at DESC',
      [aff[0].id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar levantamentos' });
  }
});

// GET /api/affiliates/referrals — lista de referidos
router.get('/referrals', authMiddleware, async (req, res) => {
  try {
    const { rows: aff } = await pool.query('SELECT id FROM affiliates WHERE profile_id = $1', [req.user.id]);
    if (!aff.length) return res.json([]);
    const { rows } = await pool.query(
      `SELECT ar.referred_at, p.name, p.email
       FROM affiliate_referrals ar
       JOIN profiles p ON p.id = ar.referred_profile_id
       WHERE ar.affiliate_id = $1
       ORDER BY ar.referred_at DESC`,
      [aff[0].id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar referidos' });
  }
});

// POST /api/affiliates/withdraw — solicitar levantamento
router.post('/withdraw', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { amount, method, accountInfo } = req.body;
    if (!amount || Number(amount) < 100) return res.status(400).json({ error: 'Valor mínimo de levantamento é 100 MT' });
    if (!method || !accountInfo?.trim()) return res.status(400).json({ error: 'Método e conta são obrigatórios' });

    const { rows: aff } = await client.query(
      'SELECT id, available_balance FROM affiliates WHERE profile_id = $1', [req.user.id]
    );
    if (!aff.length) return res.status(404).json({ error: 'Não é afiliado' });
    if (Number(aff[0].available_balance) < Number(amount)) return res.status(400).json({ error: 'Saldo insuficiente' });

    const { rows: pending } = await client.query(
      "SELECT id FROM affiliate_withdrawals WHERE affiliate_id = $1 AND status = 'pending'", [aff[0].id]
    );
    if (pending.length) return res.status(400).json({ error: 'Já existe um pedido de levantamento pendente' });

    await client.query('BEGIN');
    const { rows: wd } = await client.query(
      `INSERT INTO affiliate_withdrawals (affiliate_id, amount, method, account_info)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [aff[0].id, Number(amount), method, accountInfo.trim()]
    );
    await client.query(
      'UPDATE affiliates SET available_balance = available_balance - $1, updated_at = NOW() WHERE id = $2',
      [Number(amount), aff[0].id]
    );
    await client.query('COMMIT');
    res.status(201).json(wd[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Affiliates] withdraw:', err);
    res.status(500).json({ error: 'Erro ao solicitar levantamento' });
  } finally {
    client.release();
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

// GET /api/affiliates — lista todos (admin)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, p.name, p.email, p.phone
      FROM affiliates a
      JOIN profiles p ON p.id = a.profile_id
      ORDER BY a.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar afiliados' });
  }
});

// PUT /api/affiliates/:id/status — activar/suspender (admin)
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Status inválido' });
    await pool.query('UPDATE affiliates SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao actualizar status' });
  }
});

// PUT /api/affiliates/:id/rate — alterar taxa de comissão (admin)
router.put('/:id/rate', authMiddleware, async (req, res) => {
  try {
    const { rate } = req.body;
    if (!rate || Number(rate) < 0 || Number(rate) > 100) return res.status(400).json({ error: 'Taxa inválida (0-100%)' });
    await pool.query('UPDATE affiliates SET commission_rate = $1, updated_at = NOW() WHERE id = $2', [Number(rate), req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao actualizar taxa' });
  }
});

// GET /api/affiliates/admin/commissions — todas as comissões (admin)
router.get('/admin/commissions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ac.*, p.name AS affiliate_name, o.order_number, pr.name AS referred_name
      FROM affiliate_commissions ac
      JOIN affiliates a ON a.id = ac.affiliate_id
      JOIN profiles p ON p.id = a.profile_id
      LEFT JOIN orders o ON o.id = ac.order_id
      LEFT JOIN profiles pr ON pr.id = ac.referred_profile_id
      ORDER BY ac.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar comissões' });
  }
});

// PUT /api/affiliates/commissions/:id/status — aprovar/rejeitar comissão (admin)
router.put('/commissions/:id/status', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { status, notes } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status inválido' });

    const { rows: comm } = await client.query('SELECT * FROM affiliate_commissions WHERE id = $1', [req.params.id]);
    if (!comm.length) return res.status(404).json({ error: 'Comissão não encontrada' });
    if (comm[0].status !== 'pending') return res.status(400).json({ error: 'Comissão já processada' });

    await client.query('BEGIN');
    await client.query(
      `UPDATE affiliate_commissions SET status = $1, notes = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $4`,
      [status, notes || null, req.user.id, req.params.id]
    );
    if (status === 'approved') {
      await client.query(
        `UPDATE affiliates SET
          pending_balance = pending_balance - $1,
          available_balance = available_balance + $1,
          total_earned = total_earned + $1,
          updated_at = NOW()
         WHERE id = $2`,
        [comm[0].commission_amount, comm[0].affiliate_id]
      );
    } else {
      await client.query(
        `UPDATE affiliates SET pending_balance = pending_balance - $1, updated_at = NOW() WHERE id = $2`,
        [comm[0].commission_amount, comm[0].affiliate_id]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Affiliates] commission status:', err);
    res.status(500).json({ error: 'Erro ao processar comissão' });
  } finally {
    client.release();
  }
});

// GET /api/affiliates/admin/withdrawals — todos os levantamentos (admin)
router.get('/admin/withdrawals', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT aw.*, p.name AS affiliate_name, p.phone AS affiliate_phone
      FROM affiliate_withdrawals aw
      JOIN affiliates a ON a.id = aw.affiliate_id
      JOIN profiles p ON p.id = a.profile_id
      ORDER BY aw.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar levantamentos' });
  }
});

// PUT /api/affiliates/withdrawals/:id/process — processar levantamento (admin)
router.put('/withdrawals/:id/process', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { status, adminNotes } = req.body;
    if (!['approved', 'rejected', 'paid'].includes(status)) return res.status(400).json({ error: 'Status inválido' });

    const { rows: wd } = await client.query('SELECT * FROM affiliate_withdrawals WHERE id = $1', [req.params.id]);
    if (!wd.length) return res.status(404).json({ error: 'Levantamento não encontrado' });
    if (!['pending', 'approved'].includes(wd[0].status)) return res.status(400).json({ error: 'Levantamento já processado' });

    await client.query('BEGIN');
    await client.query(
      `UPDATE affiliate_withdrawals SET status = $1, admin_notes = $2, processed_by = $3, processed_at = NOW() WHERE id = $4`,
      [status, adminNotes || null, req.user.id, req.params.id]
    );
    if (status === 'rejected') {
      await client.query(
        `UPDATE affiliates SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [wd[0].amount, wd[0].affiliate_id]
      );
    } else if (status === 'paid') {
      await client.query(
        `UPDATE affiliates SET withdrawn_balance = withdrawn_balance + $1, updated_at = NOW() WHERE id = $2`,
        [wd[0].amount, wd[0].affiliate_id]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Affiliates] withdrawal process:', err);
    res.status(500).json({ error: 'Erro ao processar levantamento' });
  } finally {
    client.release();
  }
});

export default router;
