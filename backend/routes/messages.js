import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

async function migrate() {
  const run = async (sql, label) => {
    try { await pool.query(sql); }
    catch (e) { console.error(`[messages] migrate ${label}:`, e.message); }
  };

  // Detecta se as tabelas existem com schema errado (FK INT em vez de UUID).
  // Se created_by em message_channels for integer, as tabelas são da versão antiga.
  let needRebuild = false;
  try {
    const { rows } = await pool.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'message_channels' AND column_name = 'created_by'
    `);
    if (rows.length > 0 && rows[0].data_type === 'integer') {
      needRebuild = true;
      console.log('[messages] Schema antigo detectado (INT FK) — a recriar tabelas…');
    }
  } catch (_) {}

  if (needRebuild) {
    // Remove tabelas antigas com schema errado (sem dados úteis)
    for (const t of ['message_reads', 'messages', 'channel_members', 'message_channels']) {
      await run(`DROP TABLE IF EXISTS ${t} CASCADE`, `drop ${t}`);
    }
  }

  await run(`CREATE TABLE IF NOT EXISTS message_channels (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100),
    description TEXT,
    type        VARCHAR(20) DEFAULT 'group',
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`, 'message_channels');
  await run(`CREATE TABLE IF NOT EXISTS channel_members (
    channel_id INT  NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(id)          ON DELETE CASCADE,
    joined_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
  )`, 'channel_members');
  await run(`CREATE TABLE IF NOT EXISTS messages (
    id         SERIAL PRIMARY KEY,
    channel_id INT  NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
    sender_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content    TEXT NOT NULL,
    edited_at  TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`, 'messages');
  await run(`CREATE TABLE IF NOT EXISTS message_reads (
    message_id INT  NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    read_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
  )`, 'message_reads');

  // Seed canal Geral se não existir
  try {
    const { rows } = await pool.query(`SELECT id FROM message_channels WHERE name='Geral' LIMIT 1`);
    if (!rows.length) {
      await pool.query(`INSERT INTO message_channels (name, type) VALUES ('Geral', 'group')`);
      console.log('[messages] Canal "Geral" criado.');
    }
  } catch (_) {}
}
migrate();

// ── USERS (para seleção ao criar conversa) ────────────────────────────────────
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, avatar_url FROM profiles
      ORDER BY name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CONVERSATIONS (= channels) ────────────────────────────────────────────────
router.get('/conversations', authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.type,
        c.name,
        (SELECT m.content FROM messages m WHERE m.channel_id = c.id ORDER BY m.created_at DESC LIMIT 1)  AS last_message,
        (SELECT m.created_at FROM messages m WHERE m.channel_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
        COALESCE((
          SELECT COUNT(*)::int FROM messages m
          WHERE m.channel_id = c.id
            AND ($1::uuid IS NULL OR m.sender_id != $1)
            AND NOT EXISTS (
              SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.user_id = $1
            )
        ), 0) AS unread_count,
        COALESCE((
          SELECT json_agg(json_build_object('id', p.id, 'name', p.name, 'avatar_url', p.avatar_url))
          FROM channel_members cm JOIN profiles p ON p.id = cm.user_id
          WHERE cm.channel_id = c.id
        ), '[]'::json) AS members
      FROM message_channels c
      ORDER BY last_message_at DESC NULLS LAST, c.id DESC
    `, [userId || null]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/conversations', authMiddleware, async (req, res) => {
  const { name, type, member_ids } = req.body;
  const userId = req.user?.id;
  try {
    const { rows } = await pool.query(`
      INSERT INTO message_channels (name, type, created_by) VALUES ($1,$2,$3) RETURNING *
    `, [name || null, type || 'group', userId || null]);
    const channel = rows[0];

    // Adicionar membros selecionados
    const allMembers = [...new Set([...(Array.isArray(member_ids) ? member_ids : []), ...(userId ? [userId] : [])])];
    for (const uid of allMembers) {
      await pool.query(
        `INSERT INTO channel_members (channel_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [channel.id, uid]
      );
    }

    // Retornar com shape completo
    const full = await pool.query(`
      SELECT c.*,
        COALESCE((
          SELECT json_agg(json_build_object('id', p.id, 'name', p.name, 'avatar_url', p.avatar_url))
          FROM channel_members cm JOIN profiles p ON p.id = cm.user_id WHERE cm.channel_id = c.id
        ), '[]'::json) AS members,
        NULL AS last_message, NULL AS last_message_at, 0 AS unread_count
      FROM message_channels c WHERE c.id = $1
    `, [channel.id]);
    res.status(201).json(full.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MESSAGES dentro de uma conversa ───────────────────────────────────────────
router.get('/conversations/:id/messages', authMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '60'), 200);
  const before = req.query.before;
  const params = [req.params.id, limit];
  const beforeClause = before ? `AND m.id < $3` : '';
  if (before) params.push(before);
  try {
    const { rows } = await pool.query(`
      SELECT m.*, p.name AS sender_name, p.avatar_url AS sender_avatar
      FROM messages m LEFT JOIN profiles p ON p.id = m.sender_id
      WHERE m.channel_id = $1 ${beforeClause}
      ORDER BY m.created_at DESC LIMIT $2
    `, params);
    res.json(rows.reverse());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/conversations/:id/messages', authMiddleware, async (req, res) => {
  const { content } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO messages (channel_id, sender_id, content) VALUES ($1,$2,$3) RETURNING *
    `, [req.params.id, req.user?.id || null, content]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EDITAR / APAGAR MENSAGEM ──────────────────────────────────────────────────
router.put('/messages/:id', authMiddleware, async (req, res) => {
  const { content } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE messages SET content=$1, edited_at=NOW() WHERE id=$2 AND sender_id=$3 RETURNING *`,
      [content, req.params.id, req.user?.id]
    );
    if (!rows.length) return res.status(403).json({ error: 'Não autorizado' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/messages/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM messages WHERE id=$1 AND sender_id=$2`, [req.params.id, req.user?.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MARCAR COMO LIDO ──────────────────────────────────────────────────────────
router.post('/conversations/:id/read', authMiddleware, async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO message_reads (message_id, user_id)
      SELECT m.id, $2 FROM messages m
      WHERE m.channel_id = $1
        AND NOT EXISTS (SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.user_id = $2)
    `, [req.params.id, req.user?.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
