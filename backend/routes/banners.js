import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_banners (
      id SERIAL PRIMARY KEY,
      image_url TEXT,
      title TEXT NOT NULL DEFAULT 'Saúde Natural & Bem-Estar',
      subtitle TEXT DEFAULT 'Descubra o poder da natureza com produtos 100% naturais e selecionados',
      button_text TEXT DEFAULT 'Ver Produto',
      product_slug TEXT,
      product_id TEXT,
      bg_color TEXT DEFAULT '#14532d',
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Migração: adicionar colunas novas se não existirem
  await pool.query(`ALTER TABLE shop_banners ADD COLUMN IF NOT EXISTS bg_color TEXT DEFAULT '#14532d'`);
  await pool.query(`ALTER TABLE shop_banners ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0`);
  await pool.query(`ALTER TABLE shop_banners ADD COLUMN IF NOT EXISTS banner_type TEXT DEFAULT 'hero'`);
};

const mapBanner = (b) => ({
  id: b.id,
  imageUrl: b.image_url,
  title: b.title,
  subtitle: b.subtitle,
  buttonText: b.button_text,
  productSlug: b.product_slug,
  productId: b.product_id,
  bgColor: b.bg_color || '#14532d',
  sortOrder: b.sort_order ?? 0,
  isActive: b.is_active,
});

// GET /api/banners/mid — banner de meio de página (público)
router.get('/mid', async (req, res) => {
  try {
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT * FROM shop_banners WHERE is_active = true AND banner_type = 'mid' ORDER BY updated_at DESC LIMIT 1`
    );
    if (!rows.length) return res.json(null);
    res.json(mapBanner(rows[0]));
  } catch (err) {
    console.error('[Banners GET mid]', err);
    res.status(500).json({ error: 'Erro ao carregar banner' });
  }
});

// PUT /api/banners/mid — guardar banner de meio de página (admin)
router.put('/mid', authMiddleware, async (req, res) => {
  try {
    await ensureTable();
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const { imageUrl, title, subtitle, buttonText, productSlug, productId, bgColor } = req.body;
    const { rows: existing } = await pool.query(`SELECT id FROM shop_banners WHERE banner_type = 'mid' LIMIT 1`);
    if (existing.length > 0) {
      await pool.query(
        `UPDATE shop_banners SET image_url=$1, title=$2, subtitle=$3, button_text=$4,
         product_slug=$5, product_id=$6, bg_color=$7, is_active=true, updated_at=NOW() WHERE id=$8`,
        [imageUrl || null, title, subtitle, buttonText, productSlug || null, productId || null, bgColor || '#ea580c', existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO shop_banners (image_url, title, subtitle, button_text, product_slug, product_id, bg_color, banner_type, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'mid',true)`,
        [imageUrl || null, title, subtitle, buttonText, productSlug || null, productId || null, bgColor || '#ea580c']
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Banners PUT mid]', err);
    res.status(500).json({ error: 'Erro ao guardar banner' });
  }
});

// GET /api/banners/active — todos os slides hero ativos (público)
router.get('/active', async (req, res) => {
  try {
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT * FROM shop_banners WHERE is_active = true AND (banner_type = 'hero' OR banner_type IS NULL) ORDER BY sort_order ASC, created_at ASC`
    );
    if (!rows.length) {
      return res.json([{
        id: null,
        imageUrl: null,
        title: 'Saúde Natural & Bem-Estar',
        subtitle: 'Descubra o poder da natureza com produtos 100% naturais e selecionados',
        buttonText: 'Explorar Produtos',
        productSlug: null,
        productId: null,
        bgColor: '#14532d',
        sortOrder: 0,
        isActive: true,
      }]);
    }
    res.json(rows.map(mapBanner));
  } catch (err) {
    console.error('[Banners GET active]', err);
    res.status(500).json({ error: 'Erro ao carregar banners' });
  }
});

// GET /api/banners — todos os banners (admin)
router.get('/', authMiddleware, async (req, res) => {
  try {
    await ensureTable();
    const { rows } = await pool.query(`SELECT * FROM shop_banners ORDER BY sort_order ASC, created_at ASC`);
    res.json(rows.map(mapBanner));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar banners' });
  }
});

// POST /api/banners — criar novo slide
router.post('/', authMiddleware, async (req, res) => {
  try {
    await ensureTable();
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const { imageUrl, title, subtitle, buttonText, productSlug, productId, bgColor } = req.body;
    const { rows: count } = await pool.query(`SELECT COUNT(*) FROM shop_banners`);
    const sortOrder = parseInt(count[0].count) || 0;

    const { rows } = await pool.query(
      `INSERT INTO shop_banners (image_url, title, subtitle, button_text, product_slug, product_id, bg_color, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
      [imageUrl || null, title, subtitle, buttonText, productSlug || null, productId || null, bgColor || '#14532d', sortOrder]
    );
    res.json(mapBanner(rows[0]));
  } catch (err) {
    console.error('[Banners POST]', err);
    res.status(500).json({ error: 'Erro ao criar banner' });
  }
});

// PUT /api/banners/:id — atualizar slide específico
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    await ensureTable();
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const { imageUrl, title, subtitle, buttonText, productSlug, productId, bgColor, isActive } = req.body;
    const { id } = req.params;
    await pool.query(
      `UPDATE shop_banners SET
        image_url = $1, title = $2, subtitle = $3, button_text = $4,
        product_slug = $5, product_id = $6, bg_color = $7,
        is_active = $8, updated_at = NOW()
       WHERE id = $9`,
      [imageUrl || null, title, subtitle, buttonText, productSlug || null, productId || null, bgColor || '#14532d', isActive !== false, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Banners PUT]', err);
    res.status(500).json({ error: 'Erro ao atualizar banner' });
  }
});

// Compatibilidade: PUT /api/banners sem ID (legado)
router.put('/', authMiddleware, async (req, res) => {
  try {
    await ensureTable();
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const { imageUrl, title, subtitle, buttonText, productSlug, productId, bgColor } = req.body;
    const { rows: existing } = await pool.query(`SELECT id FROM shop_banners ORDER BY sort_order ASC LIMIT 1`);
    if (existing.length > 0) {
      await pool.query(
        `UPDATE shop_banners SET image_url=$1, title=$2, subtitle=$3, button_text=$4,
         product_slug=$5, product_id=$6, bg_color=$7, is_active=true, updated_at=NOW() WHERE id=$8`,
        [imageUrl || null, title, subtitle, buttonText, productSlug || null, productId || null, bgColor || '#14532d', existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO shop_banners (image_url, title, subtitle, button_text, product_slug, product_id, bg_color, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
        [imageUrl || null, title, subtitle, buttonText, productSlug || null, productId || null, bgColor || '#14532d']
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Banners PUT legacy]', err);
    res.status(500).json({ error: 'Erro ao guardar banner' });
  }
});

// PATCH /api/banners/:id/order — reordenar
router.patch('/:id/order', authMiddleware, async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const { sortOrder } = req.body;
    await pool.query(`UPDATE shop_banners SET sort_order = $1 WHERE id = $2`, [sortOrder, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao reordenar' });
  }
});

// GET /api/banners/slot/:index — banner inline entre produtos (público)
router.get('/slot/:index', async (req, res) => {
  try {
    await ensureTable();
    const bannerType = `slot:${req.params.index}`;
    const { rows } = await pool.query(
      `SELECT * FROM shop_banners WHERE is_active = true AND banner_type = $1 ORDER BY updated_at DESC LIMIT 1`,
      [bannerType]
    );
    if (!rows.length) return res.json(null);
    res.json(mapBanner(rows[0]));
  } catch (err) {
    console.error('[Banners GET slot]', err);
    res.status(500).json({ error: 'Erro ao carregar banner' });
  }
});

// PUT /api/banners/slot/:index — guardar banner inline (admin)
router.put('/slot/:index', authMiddleware, async (req, res) => {
  try {
    await ensureTable();
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const bannerType = `slot:${req.params.index}`;
    const { imageUrl, title, subtitle, buttonText, productSlug, productId, bgColor } = req.body;
    const { rows: existing } = await pool.query(`SELECT id FROM shop_banners WHERE banner_type = $1 LIMIT 1`, [bannerType]);
    if (existing.length > 0) {
      await pool.query(
        `UPDATE shop_banners SET image_url=$1, title=$2, subtitle=$3, button_text=$4,
         product_slug=$5, product_id=$6, bg_color=$7, is_active=true, updated_at=NOW() WHERE id=$8`,
        [imageUrl || null, title, subtitle, buttonText || '', productSlug || null, productId || null, bgColor || '#14532d', existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO shop_banners (image_url, title, subtitle, button_text, product_slug, product_id, bg_color, banner_type, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
        [imageUrl || null, title, subtitle, buttonText || '', productSlug || null, productId || null, bgColor || '#14532d', bannerType]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Banners PUT slot]', err);
    res.status(500).json({ error: 'Erro ao guardar banner' });
  }
});

// GET /api/banners/page/:key — banner de cabeçalho de página institucional (público)
router.get('/page/:key', async (req, res) => {
  try {
    await ensureTable();
    const bannerType = `page:${req.params.key}`;
    const { rows } = await pool.query(
      `SELECT * FROM shop_banners WHERE is_active = true AND banner_type = $1 ORDER BY updated_at DESC LIMIT 1`,
      [bannerType]
    );
    if (!rows.length) return res.json(null);
    res.json(mapBanner(rows[0]));
  } catch (err) {
    console.error('[Banners GET page]', err);
    res.status(500).json({ error: 'Erro ao carregar banner' });
  }
});

// PUT /api/banners/page/:key — guardar banner de cabeçalho de página (admin)
router.put('/page/:key', authMiddleware, async (req, res) => {
  try {
    await ensureTable();
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const bannerType = `page:${req.params.key}`;
    const { imageUrl, title, subtitle, bgColor } = req.body;
    const { rows: existing } = await pool.query(`SELECT id FROM shop_banners WHERE banner_type = $1 LIMIT 1`, [bannerType]);
    if (existing.length > 0) {
      await pool.query(
        `UPDATE shop_banners SET image_url=$1, title=$2, subtitle=$3, bg_color=$4, is_active=true, updated_at=NOW() WHERE id=$5`,
        [imageUrl || null, title, subtitle, bgColor || '#14532d', existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO shop_banners (image_url, title, subtitle, bg_color, banner_type, button_text, is_active)
         VALUES ($1,$2,$3,$4,$5,'',true)`,
        [imageUrl || null, title, subtitle, bgColor || '#14532d', bannerType]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Banners PUT page]', err);
    res.status(500).json({ error: 'Erro ao guardar banner' });
  }
});

// DELETE /api/banners/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    await pool.query(`DELETE FROM shop_banners WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao eliminar banner' });
  }
});

export default router;
