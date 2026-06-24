import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadToMinio } from '../storage/minio.js';

const router = express.Router();

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200);
}

const mapPost = (r) => ({
  id: r.id,
  title: r.title,
  slug: r.slug,
  summary: r.summary || null,
  content: r.content || null,
  coverImage: r.cover_image || null,
  authorId: r.author_id || null,
  authorName: r.author_name || null,
  status: r.status,
  tags: r.tags || [],
  views: r.views || 0,
  publishedAt: r.published_at || null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// GET /api/blog — lista posts (público: só published; admin: todos)
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.headers.authorization?.startsWith('Bearer ');
    const where = isAdmin ? '' : "WHERE b.status = 'published'";
    const { rows } = await pool.query(`
      SELECT b.*, p.name AS author_name
      FROM blog_posts b
      LEFT JOIN profiles p ON p.id = b.author_id
      ${where}
      ORDER BY b.created_at DESC
    `);
    res.json(rows.map(mapPost));
  } catch (err) {
    console.error('[GET /blog]', err);
    res.status(500).json({ error: 'Erro ao buscar posts' });
  }
});

// GET /api/blog/:slug — post individual (público)
router.get('/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*, p.name AS author_name
      FROM blog_posts b
      LEFT JOIN profiles p ON p.id = b.author_id
      WHERE b.slug = $1
    `, [req.params.slug]);
    if (!rows.length) return res.status(404).json({ error: 'Post não encontrado' });

    // Incrementar views
    await pool.query('UPDATE blog_posts SET views = views + 1 WHERE id = $1', [rows[0].id]).catch(() => {});
    res.json(mapPost(rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar post' });
  }
});

// POST /api/blog — criar post
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, summary, content, tags, status, coverImageData, publishedAt } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Título obrigatório' });

    let baseSlug = slugify(title);
    let slug = baseSlug;
    let attempt = 1;
    while (true) {
      const { rows } = await pool.query('SELECT id FROM blog_posts WHERE slug = $1', [slug]);
      if (!rows.length) break;
      slug = `${baseSlug}-${attempt++}`;
    }

    let coverImage = null;
    if (coverImageData) {
      try {
        const match = coverImageData.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const buffer = Buffer.from(match[2], 'base64');
          const { url } = await uploadToMinio(buffer, 'blog', match[1]);
          coverImage = url;
        }
      } catch (e) {
        console.warn('[Blog] cover upload error:', e.message);
      }
    }

    const pub = status === 'published' ? (publishedAt || new Date().toISOString()) : null;

    const { rows } = await pool.query(`
      INSERT INTO blog_posts(title, slug, summary, content, cover_image, author_id, status, tags, published_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title.trim(), slug, summary?.trim() || null, content || null, coverImage,
       req.user.id, status || 'draft', tags || [], pub]
    );

    const full = await pool.query(`SELECT b.*, p.name AS author_name FROM blog_posts b LEFT JOIN profiles p ON p.id = b.author_id WHERE b.id = $1`, [rows[0].id]);
    res.status(201).json(mapPost(full.rows[0]));
  } catch (err) {
    console.error('[POST /blog]', err);
    res.status(500).json({ error: 'Erro ao criar post' });
  }
});

// PUT /api/blog/:id — editar post
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, summary, content, tags, status, coverImageData, publishedAt } = req.body;
    const fields = [];
    const values = [];
    let i = 1;

    if (title !== undefined) { fields.push(`title=$${i++}`); values.push(title.trim()); }
    if (summary !== undefined) { fields.push(`summary=$${i++}`); values.push(summary?.trim() || null); }
    if (content !== undefined) { fields.push(`content=$${i++}`); values.push(content); }
    if (tags !== undefined) { fields.push(`tags=$${i++}`); values.push(tags); }

    if (status !== undefined) {
      fields.push(`status=$${i++}`);
      values.push(status);
      if (status === 'published') {
        fields.push(`published_at=$${i++}`);
        values.push(publishedAt || new Date().toISOString());
      }
    }

    if (coverImageData) {
      try {
        const match = coverImageData.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const buffer = Buffer.from(match[2], 'base64');
          const { url } = await uploadToMinio(buffer, 'blog', match[1]);
          fields.push(`cover_image=$${i++}`);
          values.push(url);
        }
      } catch {}
    }

    if (!fields.length) return res.json({ success: true });

    fields.push(`updated_at=NOW()`);
    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE blog_posts SET ${fields.join(',')} WHERE id=$${i} RETURNING *`, values
    );
    if (!rows.length) return res.status(404).json({ error: 'Post não encontrado' });
    const full = await pool.query(`SELECT b.*, p.name AS author_name FROM blog_posts b LEFT JOIN profiles p ON p.id = b.author_id WHERE b.id = $1`, [rows[0].id]);
    res.json(mapPost(full.rows[0]));
  } catch (err) {
    console.error('[PUT /blog]', err);
    res.status(500).json({ error: 'Erro ao atualizar post' });
  }
});

// DELETE /api/blog/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM blog_posts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao apagar post' });
  }
});

// ─── Comentários ──────────────────────────────────────────────────────────────

const mapComment = (r) => ({
  id: r.id,
  postId: r.post_id,
  userId: r.user_id || null,
  authorName: r.author_name || r.profile_name || 'Anónimo',
  authorAvatar: r.avatar_url || null,
  content: r.content,
  status: r.status,
  createdAt: r.created_at,
});

// GET /api/blog/:postId/comments
router.get('/:postId/comments', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, p.name AS profile_name, p.avatar_url
       FROM blog_comments c
       LEFT JOIN profiles p ON p.id = c.user_id
       WHERE c.post_id = $1 AND c.status = 'approved'
       ORDER BY c.created_at ASC`,
      [req.params.postId]
    );
    res.json(rows.map(mapComment));
  } catch (err) {
    console.error('[GET /blog/:id/comments]', err);
    res.status(500).json({ error: 'Erro ao buscar comentários' });
  }
});

// POST /api/blog/:postId/comments — autenticado OU anónimo (nome + email)
router.post('/:postId/comments', async (req, res) => {
  try {
    const { content, authorName, authorEmail } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Conteúdo obrigatório' });

    // Verificar se o post existe e está publicado
    const { rows: post } = await pool.query(
      `SELECT id FROM blog_posts WHERE id = $1 AND status = 'published'`,
      [req.params.postId]
    );
    if (!post.length) return res.status(404).json({ error: 'Post não encontrado' });

    // Tentar identificar utilizador pelo token (opcional)
    let userId = null;
    let name = authorName?.trim() || 'Anónimo';
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const { default: jwt } = await import('jsonwebtoken');
        const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET || 'naturerva_erp_jwt_secret_2025_super_secure_key');
        userId = decoded.id;
        name = decoded.name || name;
      } catch {}
    }

    const { rows } = await pool.query(
      `INSERT INTO blog_comments(post_id, user_id, author_name, author_email, content, status)
       VALUES($1,$2,$3,$4,$5,'approved') RETURNING *`,
      [req.params.postId, userId, name, authorEmail?.trim() || null, content.trim()]
    );

    // Buscar com dados do perfil
    const { rows: full } = await pool.query(
      `SELECT c.*, p.name AS profile_name, p.avatar_url
       FROM blog_comments c LEFT JOIN profiles p ON p.id = c.user_id
       WHERE c.id = $1`, [rows[0].id]
    );
    res.status(201).json(mapComment(full[0]));
  } catch (err) {
    console.error('[POST /blog/:id/comments]', err);
    res.status(500).json({ error: 'Erro ao publicar comentário' });
  }
});

// DELETE /api/blog/:postId/comments/:commentId — admin ou autor
router.delete('/:postId/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM blog_comments WHERE id = $1', [req.params.commentId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao apagar comentário' });
  }
});

export default router;
