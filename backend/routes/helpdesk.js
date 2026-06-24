import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

async function migrate() {
  const run = async (sql, label) => {
    try { await pool.query(sql); }
    catch (e) { console.error(`[helpdesk] migrate ${label}:`, e.message); }
  };

  await run(`CREATE TABLE IF NOT EXISTS helpdesk_categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(50)  NOT NULL UNIQUE,
    color      VARCHAR(20)  DEFAULT '#6366f1',
    created_at TIMESTAMPTZ  DEFAULT NOW()
  )`, 'helpdesk_categories');

  // Adicionar UNIQUE a tabelas que já existam sem ele
  await run(`ALTER TABLE helpdesk_categories ADD CONSTRAINT helpdesk_categories_name_unique UNIQUE (name)`, 'categories_unique');

  // Seed categorias padrão (só se tabela vazia)
  await run(`
    INSERT INTO helpdesk_categories (name, color) VALUES
      ('Geral',      '#6366f1'),
      ('Faturação',  '#f59e0b'),
      ('Técnico',    '#ef4444'),
      ('Envio',      '#10b981'),
      ('Outro',      '#8b5cf6')
    ON CONFLICT (name) DO NOTHING
  `, 'seed_categories');

  await run(`CREATE TABLE IF NOT EXISTS helpdesk_tickets (
    id          SERIAL PRIMARY KEY,
    subject     VARCHAR(200) NOT NULL,
    description TEXT,
    status      VARCHAR(20) DEFAULT 'open',
    priority    VARCHAR(20) DEFAULT 'medium',
    category    VARCHAR(50) DEFAULT 'general',
    category_id INT REFERENCES helpdesk_categories(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  )`, 'helpdesk_tickets');

  // Adicionar category_id se a tabela já existia sem ela
  await run(`ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS category_id INT REFERENCES helpdesk_categories(id) ON DELETE SET NULL`, 'add_category_id');

  await run(`CREATE TABLE IF NOT EXISTS ticket_messages (
    id         SERIAL PRIMARY KEY,
    ticket_id  INT NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content    TEXT NOT NULL,
    is_staff   BOOLEAN DEFAULT false,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`, 'ticket_messages');

  await run(`ALTER TABLE ticket_messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false`, 'add_is_internal');

  await run(`CREATE TABLE IF NOT EXISTS ticket_attachments (
    id        SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
    filename  VARCHAR(200),
    url       TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`, 'ticket_attachments');
}
migrate();

// ── STATS — antes de /:id ──────────────────────────────────────────────────────
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [open, in_progress, resolved, urgent, total] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM helpdesk_tickets WHERE status='open'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM helpdesk_tickets WHERE status IN ('pending','in_progress')`),
      pool.query(`SELECT COUNT(*)::int AS n FROM helpdesk_tickets WHERE status='resolved'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM helpdesk_tickets WHERE priority='urgent' AND status NOT IN ('resolved','closed')`),
      pool.query(`SELECT COUNT(*)::int AS n FROM helpdesk_tickets`),
    ]);
    res.json({
      total:       total.rows[0].n,
      open:        open.rows[0].n,
      in_progress: in_progress.rows[0].n,
      pending:     in_progress.rows[0].n,
      resolved:    resolved.rows[0].n,
      urgent:      urgent.rows[0].n,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CATEGORIES — antes de /:id ─────────────────────────────────────────────────
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM helpdesk_categories ORDER BY id`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/categories', authMiddleware, async (req, res) => {
  const { name, color } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO helpdesk_categories (name, color) VALUES ($1,$2) RETURNING *`,
      [name, color || '#6366f1']
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TICKETS ───────────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const { status, priority, assigned_to, q } = req.query;
  const filters = []; const params = [];
  if (status)      { params.push(status);      filters.push(`t.status=$${params.length}`); }
  if (priority)    { params.push(priority);     filters.push(`t.priority=$${params.length}`); }
  if (assigned_to) { params.push(assigned_to);  filters.push(`t.assigned_to=$${params.length}`); }
  if (q)           { params.push(`%${q}%`);     filters.push(`t.subject ILIKE $${params.length}`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(`
      SELECT
        t.*,
        t.subject         AS title,
        c.name            AS customer_name,
        c.email           AS customer_email,
        p.name            AS assigned_name,
        cat.name          AS category_name,
        cat.color         AS category_color,
        (SELECT COUNT(*)::int FROM ticket_messages m WHERE m.ticket_id = t.id) AS message_count
      FROM helpdesk_tickets t
      LEFT JOIN customers           c ON c.id   = t.customer_id
      LEFT JOIN profiles            p ON p.id   = t.assigned_to
      LEFT JOIN helpdesk_categories cat ON cat.id = t.category_id
      ${where}
      ORDER BY
        CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        t.updated_at DESC
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        t.*,
        t.subject AS title,
        c.name    AS customer_name, c.email AS customer_email,
        p.name    AS assigned_name,
        cat.name  AS category_name, cat.color AS category_color
      FROM helpdesk_tickets t
      LEFT JOIN customers           c ON c.id   = t.customer_id
      LEFT JOIN profiles            p ON p.id   = t.assigned_to
      LEFT JOIN helpdesk_categories cat ON cat.id = t.category_id
      WHERE t.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    const messages = await pool.query(`
      SELECT m.*, p.name AS user_name, p.avatar_url
      FROM ticket_messages m LEFT JOIN profiles p ON p.id = m.user_id
      WHERE m.ticket_id=$1 ORDER BY m.created_at
    `, [req.params.id]);
    res.json({ ...rows[0], messages: messages.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
  // aceita tanto 'title' (frontend) como 'subject' (legado)
  const { title, subject, description, priority, category_id, category, customer_id, assigned_to } = req.body;
  const ticketSubject = title || subject || 'Sem título';
  try {
    const { rows } = await pool.query(`
      INSERT INTO helpdesk_tickets (subject, description, priority, category_id, category, customer_id, assigned_to)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [ticketSubject, description||null, priority||'medium',
        category_id||null, category||'general',
        customer_id||null, assigned_to||null]);
    res.status(201).json({ ...rows[0], title: rows[0].subject });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { title, subject, description, status, priority, category_id, category, assigned_to } = req.body;
  const ticketSubject = title || subject;
  try {
    const { rows } = await pool.query(`
      UPDATE helpdesk_tickets SET
        subject      = COALESCE($1, subject),
        description  = COALESCE($2, description),
        status       = COALESCE($3, status),
        priority     = COALESCE($4, priority),
        category_id  = COALESCE($5::int, category_id),
        category     = COALESCE($6, category),
        assigned_to  = COALESCE($7::uuid, assigned_to),
        updated_at   = NOW(),
        resolved_at  = CASE WHEN $3='resolved' THEN NOW() ELSE resolved_at END
      WHERE id=$8 RETURNING *
    `, [ticketSubject||null, description||null, status||null, priority||null,
        category_id||null, category||null, assigned_to||null, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ ...rows[0], title: rows[0].subject });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM helpdesk_tickets WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TICKET MESSAGES ───────────────────────────────────────────────────────────
router.post('/:id/messages', authMiddleware, async (req, res) => {
  const { content, is_internal, is_staff } = req.body;
  try {
    const internal = is_internal ?? is_staff ?? false;
    const { rows } = await pool.query(`
      INSERT INTO ticket_messages (ticket_id, user_id, content, is_internal, is_staff)
      VALUES ($1,$2,$3,$4,$4) RETURNING *
    `, [req.params.id, req.user?.id || null, content, internal]);
    await pool.query(`UPDATE helpdesk_tickets SET updated_at=NOW() WHERE id=$1`, [req.params.id]);
    // Adicionar nome do utilizador ao retorno
    const full = await pool.query(
      `SELECT m.*, p.name AS user_name, p.avatar_url FROM ticket_messages m LEFT JOIN profiles p ON p.id=m.user_id WHERE m.id=$1`,
      [rows[0].id]
    );
    res.status(201).json(full.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
