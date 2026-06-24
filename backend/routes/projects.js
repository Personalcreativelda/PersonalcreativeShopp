import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

async function migrate() {
  const run = async (sql, label) => {
    try { await pool.query(sql); }
    catch (e) { console.error(`[projects] migrate ${label}:`, e.message); }
  };
  await run(`CREATE TABLE IF NOT EXISTS projects (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    status      VARCHAR(20) DEFAULT 'active',
    priority    VARCHAR(20) DEFAULT 'medium',
    start_date  DATE,
    end_date    DATE,
    manager_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    color       VARCHAR(7) DEFAULT '#635BFF',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  )`, 'projects');
  await run(`CREATE TABLE IF NOT EXISTS tasks (
    id           SERIAL PRIMARY KEY,
    project_id   INT REFERENCES projects(id) ON DELETE CASCADE,
    title        VARCHAR(200) NOT NULL,
    description  TEXT,
    status       VARCHAR(30) DEFAULT 'todo',
    priority     VARCHAR(20) DEFAULT 'medium',
    assigned_to  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    due_date     DATE,
    completed_at TIMESTAMPTZ,
    position     INT DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  )`, 'tasks');
  await run(`CREATE TABLE IF NOT EXISTS task_comments (
    id         SERIAL PRIMARY KEY,
    task_id    INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`, 'task_comments');
  // Sem FK para employees — employee_id é referência soft para evitar dependência de ordem de migração
  await run(`CREATE TABLE IF NOT EXISTS timesheet_entries (
    id          SERIAL PRIMARY KEY,
    employee_id INT,
    project_id  INT REFERENCES projects(id) ON DELETE SET NULL,
    task_id     INT REFERENCES tasks(id) ON DELETE SET NULL,
    date        DATE NOT NULL,
    hours       DECIMAL(4,2) NOT NULL DEFAULT 0,
    description TEXT,
    billable    BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`, 'timesheet_entries');
}
migrate();

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTANTE: rotas específicas (literais) ANTES das parametrizadas (/:id)
// Express avalia em ordem — /:id capturaria /timesheets, /tasks, etc. primeiro
// ═══════════════════════════════════════════════════════════════════════════════

// ── TIMESHEETS ────────────────────────────────────────────────────────────────
router.get('/timesheets', authMiddleware, async (req, res) => {
  const { employee_id, project_id, from, to } = req.query;
  const filters = []; const params = [];
  if (employee_id) { params.push(employee_id); filters.push(`t.employee_id=$${params.length}`); }
  if (project_id)  { params.push(project_id);  filters.push(`t.project_id=$${params.length}`); }
  if (from)        { params.push(from);         filters.push(`t.date>=$${params.length}`); }
  if (to)          { params.push(to);           filters.push(`t.date<=$${params.length}`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(`
      SELECT t.*,
             e.full_name AS employee_name,
             p.name AS project_name,
             tk.title AS task_title
      FROM timesheet_entries t
      LEFT JOIN employees e ON e.id = t.employee_id
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN tasks tk ON tk.id = t.task_id
      ${where}
      ORDER BY t.date DESC, t.created_at DESC
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/timesheets', authMiddleware, async (req, res) => {
  const { employee_id, project_id, task_id, date, hours, description, billable } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO timesheet_entries (employee_id, project_id, task_id, date, hours, description, billable)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [employee_id||null, project_id||null, task_id||null, date, hours,
        description||null, billable||false]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/timesheets/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM timesheet_entries WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TASK COMMENTS ─────────────────────────────────────────────────────────────
router.get('/tasks/:taskId/comments', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, p.name AS user_name, p.avatar_url
      FROM task_comments c LEFT JOIN profiles p ON p.id = c.user_id
      WHERE c.task_id=$1 ORDER BY c.created_at
    `, [req.params.taskId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/tasks/:taskId/comments', authMiddleware, async (req, res) => {
  const { content } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO task_comments (task_id, user_id, content) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.taskId, req.user?.id || null, content]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TASKS (update/delete — literal "/tasks" antes de "/:id") ──────────────────
router.put('/tasks/:taskId', authMiddleware, async (req, res) => {
  const { title, description, status, priority, assigned_to, due_date, position } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE tasks
        SET title=$1, description=$2, status=$3, priority=$4,
            assigned_to=$5, due_date=$6,
            position=COALESCE($7, position),
            completed_at=CASE WHEN $3='done' THEN NOW() ELSE NULL END,
            updated_at=NOW()
      WHERE id=$8 RETURNING *
    `, [title, description||null, status||'todo', priority||'medium',
        assigned_to||null, due_date||null, position||null, req.params.taskId]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM tasks WHERE id=$1`, [req.params.taskId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PROJECTS (rotas parametrizadas — vêm DEPOIS das literais) ─────────────────
router.get('/', authMiddleware, async (req, res) => {
  const { status } = req.query;
  const where  = status ? `WHERE p.status = $1` : '';
  const params = status ? [status] : [];
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
             pr.name AS manager_name,
             COUNT(DISTINCT t.id)::int AS task_count,
             COUNT(DISTINCT t.id) FILTER (WHERE t.status='done')::int AS done_count
      FROM projects p
      LEFT JOIN profiles pr ON pr.id = p.manager_id
      LEFT JOIN tasks t ON t.project_id = p.id
      ${where}
      GROUP BY p.id, pr.name
      ORDER BY p.updated_at DESC
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
  const { name, description, status, priority, start_date, end_date, manager_id, color } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO projects (name, description, status, priority, start_date, end_date, manager_id, color)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [name, description||null, status||'active', priority||'medium',
        start_date||null, end_date||null, manager_id||null, color||'#635BFF']);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/tasks', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, pr.name AS assigned_name
      FROM tasks t LEFT JOIN profiles pr ON pr.id = t.assigned_to
      WHERE t.project_id = $1 ORDER BY t.position, t.created_at
    `, [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/tasks', authMiddleware, async (req, res) => {
  const { title, description, status, priority, assigned_to, due_date } = req.body;
  try {
    const pos = await pool.query(
      `SELECT COALESCE(MAX(position),0)+1 AS p FROM tasks WHERE project_id=$1`,
      [req.params.id]
    );
    const { rows } = await pool.query(`
      INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, position)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [req.params.id, title, description||null, status||'todo', priority||'medium',
        assigned_to||null, due_date||null, pos.rows[0].p]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, pr.name AS manager_name
      FROM projects p LEFT JOIN profiles pr ON pr.id = p.manager_id
      WHERE p.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    const tasks = await pool.query(`
      SELECT t.*, pr.name AS assigned_name
      FROM tasks t LEFT JOIN profiles pr ON pr.id = t.assigned_to
      WHERE t.project_id = $1 ORDER BY t.position, t.created_at
    `, [req.params.id]);
    res.json({ ...rows[0], tasks: tasks.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { name, description, status, priority, start_date, end_date, manager_id, color } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE projects
        SET name=$1, description=$2, status=$3, priority=$4,
            start_date=$5, end_date=$6, manager_id=$7, color=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *
    `, [name, description||null, status||'active', priority||'medium',
        start_date||null, end_date||null, manager_id||null, color||'#635BFF', req.params.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM projects WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
