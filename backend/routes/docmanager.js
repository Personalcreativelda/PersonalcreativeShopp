import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

async function migrate() {
  const run = async (sql, label) => {
    try { await pool.query(sql); }
    catch (e) { console.error(`[docmanager] migrate ${label}:`, e.message); }
  };
  await run(`CREATE TABLE IF NOT EXISTS doc_folders (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    parent_id   INT REFERENCES doc_folders(id) ON DELETE CASCADE,
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`, 'doc_folders');
  await run(`CREATE TABLE IF NOT EXISTS documents (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    folder_id   INT REFERENCES doc_folders(id) ON DELETE SET NULL,
    file_url    TEXT,
    file_size   INT DEFAULT 0,
    mime_type   VARCHAR(100),
    version     INT DEFAULT 1,
    tags        TEXT[],
    created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  )`, 'documents');
  await run(`CREATE TABLE IF NOT EXISTS document_versions (
    id          SERIAL PRIMARY KEY,
    document_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version     INT NOT NULL,
    file_url    TEXT,
    file_size   INT DEFAULT 0,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`, 'document_versions');
  await run(`CREATE TABLE IF NOT EXISTS document_access (
    document_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    permission  VARCHAR(20) DEFAULT 'view',
    granted_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (document_id, user_id)
  )`, 'document_access');
}
migrate();

// ── FOLDERS ───────────────────────────────────────────────────────────────────
router.get('/folders', authMiddleware, async (req, res) => {
  const { folder_id } = req.query;
  const params = [];
  let where = '';
  if (folder_id) {
    params.push(folder_id);
    where = `WHERE f.parent_id=$1`;
  } else {
    where = `WHERE f.parent_id IS NULL`;
  }
  try {
    const { rows } = await pool.query(`
      SELECT f.*,
             p.name AS created_by_name,
             (SELECT COUNT(*)::int FROM documents d WHERE d.folder_id = f.id)     AS doc_count,
             (SELECT COUNT(*)::int FROM doc_folders sf WHERE sf.parent_id = f.id) AS subfolder_count
      FROM doc_folders f
      LEFT JOIN profiles p ON p.id = f.created_by
      ${where}
      ORDER BY f.name
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/folders', authMiddleware, async (req, res) => {
  const { name, parent_id } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO doc_folders (name, parent_id, created_by) VALUES ($1,$2,$3) RETURNING *`,
      [name, parent_id||null, req.user?.id || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/folders/:id', authMiddleware, async (req, res) => {
  const { name, parent_id } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE doc_folders SET name=$1, parent_id=$2 WHERE id=$3 RETURNING *`,
      [name, parent_id||null, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/folders/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM doc_folders WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DOCUMENTS ─────────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const { folder_id, q, tag } = req.query;
  const filters = []; const params = [];
  if (folder_id === 'null' || folder_id === '') {
    filters.push(`d.folder_id IS NULL`);
  } else if (folder_id) {
    params.push(folder_id); filters.push(`d.folder_id=$${params.length}`);
  }
  if (q)   { params.push(`%${q}%`); filters.push(`(d.name ILIKE $${params.length} OR d.description ILIKE $${params.length})`); }
  if (tag) { params.push(tag);      filters.push(`$${params.length} = ANY(d.tags)`); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(`
      SELECT d.*, p.name AS created_by_name, f.name AS folder_name
      FROM documents d
      LEFT JOIN profiles p ON p.id = d.created_by
      LEFT JOIN doc_folders f ON f.id = d.folder_id
      ${where}
      ORDER BY d.updated_at DESC
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SEARCH — antes de /:id ────────────────────────────────────────────────────
router.get('/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  try {
    const { rows } = await pool.query(`
      SELECT d.*, p.name AS created_by_name, f.name AS folder_name
      FROM documents d
      LEFT JOIN profiles p ON p.id = d.created_by
      LEFT JOIN doc_folders f ON f.id = d.folder_id
      WHERE d.name ILIKE $1 OR d.description ILIKE $1
      ORDER BY d.updated_at DESC
      LIMIT 50
    `, [`%${q}%`]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [total, folders, recent, size] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM documents`),
      pool.query(`SELECT COUNT(*)::int AS n FROM doc_folders`),
      pool.query(`SELECT COUNT(*)::int AS n FROM documents WHERE created_at >= NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COALESCE(SUM(file_size),0)::bigint AS n FROM documents`),
    ]);
    res.json({ total: total.rows[0].n, folders: folders.rows[0].n, recent: recent.rows[0].n, total_size: size.rows[0].n });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.*, p.name AS created_by_name, f.name AS folder_name
      FROM documents d
      LEFT JOIN profiles p ON p.id = d.created_by
      LEFT JOIN doc_folders f ON f.id = d.folder_id
      WHERE d.id=$1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    const versions = await pool.query(
      `SELECT v.*, p.name AS uploader_name FROM document_versions v
       LEFT JOIN profiles p ON p.id = v.uploaded_by
       WHERE v.document_id=$1 ORDER BY v.version DESC`,
      [req.params.id]
    );
    res.json({ ...rows[0], versions: versions.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
  const { name, description, folder_id, file_url, file_size, mime_type, tags } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO documents (name, description, folder_id, file_url, file_size, mime_type, tags, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *
    `, [name, description||null, folder_id||null, file_url||null, file_size||0,
        mime_type||null, tags||[], req.user?.id || null]);
    if (file_url) {
      await pool.query(
        `INSERT INTO document_versions (document_id, version, file_url, file_size, uploaded_by) VALUES ($1,1,$2,$3,$4)`,
        [rows[0].id, file_url, file_size||0, req.user?.id || null]
      );
    }
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { name, description, folder_id, file_url, file_size, mime_type, tags } = req.body;
  try {
    const current = await pool.query(`SELECT version FROM documents WHERE id=$1`, [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Não encontrado' });
    const newVersion = file_url ? current.rows[0].version + 1 : current.rows[0].version;
    const { rows } = await pool.query(`
      UPDATE documents SET name=$1, description=$2, folder_id=$3,
        file_url=COALESCE($4, file_url), file_size=COALESCE($5, file_size),
        mime_type=COALESCE($6, mime_type), tags=$7, version=$8,
        updated_by=$9, updated_at=NOW()
      WHERE id=$10 RETURNING *
    `, [name, description||null, folder_id||null, file_url||null, file_size||null,
        mime_type||null, tags||[], newVersion, req.user?.id || null, req.params.id]);
    if (file_url) {
      await pool.query(
        `INSERT INTO document_versions (document_id, version, file_url, file_size, uploaded_by) VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, newVersion, file_url, file_size||0, req.user?.id || null]
      );
    }
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM documents WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
