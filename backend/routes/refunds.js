import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadToMinio } from '../storage/minio.js';

const router = express.Router();

const mapRefund = (row) => ({
  id: row.id,
  orderId: row.order_id,
  orderNumber: row.order_number,
  customerId: row.customer_id,
  userId: row.user_id,
  customerName: row.customer_name,
  reason: row.reason,
  details: row.details,
  photos: row.photos || [],
  status: row.status,
  adminNotes: row.admin_notes,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  createdAt: row.created_at
});

// GET /api/refunds/my-refunds — reembolsos do cliente logado
router.get('/my-refunds', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      `SELECT r.*, o.order_number, o.customer_name
       FROM refund_requests r
       JOIN orders o ON o.id = r.order_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    res.json(rows.map(mapRefund));
  } catch (err) {
    console.error('[GET /refunds/my-refunds]', err);
    res.status(500).json({ error: 'Erro ao buscar reembolsos' });
  }
});

// GET /api/refunds — admin lista todos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, o.order_number, o.customer_name
       FROM refund_requests r
       JOIN orders o ON o.id = r.order_id
       ORDER BY r.created_at DESC`
    );
    res.json(rows.map(mapRefund));
  } catch (err) {
    console.error('[GET /refunds]', err);
    res.status(500).json({ error: 'Erro ao buscar reembolsos' });
  }
});

// POST /api/refunds — cliente submete pedido
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { orderId, reason, details, photos } = req.body;
    if (!orderId || !reason?.trim())
      return res.status(400).json({ error: 'orderId e reason são obrigatórios' });

    const userId = req.user.id;

    // Aceitar UUID ou número de pedido (ex: "8", "Pedido#8")
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    let orderRows;
    if (isUUID) {
      ({ rows: orderRows } = await pool.query(
        'SELECT id, customer_id FROM orders WHERE id = $1', [orderId]
      ));
    } else {
      const numStr = orderId.replace(/\D/g, '') || orderId.trim();
      ({ rows: orderRows } = await pool.query(
        'SELECT id, customer_id FROM orders WHERE order_number = $1 OR order_number = $2 LIMIT 1',
        [orderId.trim(), numStr]
      ));
    }
    if (!orderRows.length) return res.status(404).json({ error: 'Pedido não encontrado. Verifica o número do pedido.' });

    // Verificar se já existe pedido de reembolso para este pedido
    const { rows: existing } = await pool.query(
      'SELECT id FROM refund_requests WHERE order_id = $1 AND user_id = $2 AND status = $3 LIMIT 1',
      [orderId, userId, 'pending']
    );
    if (existing.length) return res.status(409).json({ error: 'Já existe um pedido de reembolso pendente para este pedido' });

    // Fazer upload das fotos para o MinIO
    const photoUrls = [];
    if (Array.isArray(photos) && photos.length > 0) {
      for (const dataUrl of photos.slice(0, 3)) {
        try {
          const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!match) continue;
          const [, mime, b64] = match;
          const buffer = Buffer.from(b64, 'base64');
          const { url } = await uploadToMinio(buffer, 'refunds', mime);
          photoUrls.push(url);
        } catch (e) {
          console.warn('[POST /refunds] Erro ao fazer upload de foto:', e.message);
        }
      }
    }

    const customerId = orderRows[0].customer_id;
    const { rows } = await pool.query(
      `INSERT INTO refund_requests (order_id, customer_id, user_id, reason, details, photos)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [orderId, customerId, userId, reason.trim(), details?.trim() || null, photoUrls]
    );

    const { rows: full } = await pool.query(
      `SELECT r.*, o.order_number, o.customer_name
       FROM refund_requests r JOIN orders o ON o.id = r.order_id
       WHERE r.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(mapRefund(full[0]));
  } catch (err) {
    console.error('[POST /refunds]', err);
    res.status(500).json({ error: 'Erro ao criar pedido de reembolso' });
  }
});

// PUT /api/refunds/:id/status — admin: aprovar ou rejeitar
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Status deve ser approved ou rejected' });

    const { rows } = await pool.query(
      `UPDATE refund_requests
       SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, admin_notes || null, req.user.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pedido de reembolso não encontrado' });

    const { rows: full } = await pool.query(
      `SELECT r.*, o.order_number, o.customer_name
       FROM refund_requests r JOIN orders o ON o.id = r.order_id
       WHERE r.id = $1`,
      [rows[0].id]
    );
    res.json(mapRefund(full[0]));
  } catch (err) {
    console.error('[PUT /refunds/:id/status]', err);
    res.status(500).json({ error: 'Erro ao atualizar reembolso' });
  }
});

export default router;
