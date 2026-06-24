import express from 'express';
import pool from '../db.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

const mapCoupon = (row) => ({
  id: row.id,
  code: row.code,
  description: row.description,
  type: row.type,
  value: Number(row.value) || 0,
  minOrderAmount: Number(row.min_order_amount) || 0,
  maxDiscountAmount: row.max_discount_amount ? Number(row.max_discount_amount) : null,
  maxUses: row.max_uses,
  currentUses: Number(row.current_uses) || 0,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  isActive: row.is_active,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// GET /api/coupons — listar todos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json(rows.map(mapCoupon));
  } catch (err) {
    console.error('[GET /coupons]', err);
    res.status(500).json({ error: 'Erro ao buscar cupões' });
  }
});

// POST /api/coupons/validate — validar código (sem auth obrigatória)
router.post('/validate', optionalAuth, async (req, res) => {
  try {
    const { code, totalAmount = 0, deliveryFee = 0 } = req.body;
    if (!code?.trim()) return res.status(400).json({ valid: false, message: 'Código inválido' });

    const { rows } = await pool.query(
      'SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) LIMIT 1',
      [code.trim()]
    );

    if (!rows.length) return res.json({ valid: false, message: 'Cupão não encontrado' });

    const coupon = rows[0];

    if (!coupon.is_active) return res.json({ valid: false, message: 'Este cupão não está ativo' });

    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now)
      return res.json({ valid: false, message: 'Este cupão ainda não está válido' });
    if (coupon.valid_until && new Date(coupon.valid_until) < now)
      return res.json({ valid: false, message: 'Este cupão expirou' });

    if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses)
      return res.json({ valid: false, message: 'Este cupão já atingiu o limite de utilizações' });

    const minOrder = Number(coupon.min_order_amount) || 0;
    if (totalAmount < minOrder)
      return res.json({ valid: false, message: `Valor mínimo do pedido: ${minOrder.toFixed(2)} MT` });

    let discountAmount = 0;
    if (coupon.type === 'percentage') {
      discountAmount = (totalAmount * Number(coupon.value)) / 100;
      if (coupon.max_discount_amount) {
        discountAmount = Math.min(discountAmount, Number(coupon.max_discount_amount));
      }
    } else if (coupon.type === 'free_shipping') {
      discountAmount = Number(deliveryFee) || 0;
    }

    discountAmount = Math.round(discountAmount * 100) / 100;

    res.json({
      valid: true,
      type: coupon.type,
      value: Number(coupon.value),
      discountAmount,
      code: coupon.code,
      message: coupon.type === 'free_shipping' ? 'Envio grátis aplicado!' : `Desconto de ${coupon.value}% aplicado!`
    });
  } catch (err) {
    console.error('[POST /coupons/validate]', err);
    res.status(500).json({ valid: false, message: 'Erro ao validar cupão' });
  }
});

// POST /api/coupons — criar
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { code, description, type, value, minOrderAmount, maxDiscountAmount, maxUses, validFrom, validUntil, isActive } = req.body;
    if (!code?.trim() || !type || value === undefined)
      return res.status(400).json({ error: 'Campos obrigatórios: code, type, value' });

    const { rows } = await pool.query(
      `INSERT INTO coupons (code, description, type, value, min_order_amount, max_discount_amount, max_uses, valid_from, valid_until, is_active, created_by)
       VALUES (UPPER($1),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [code.trim(), description || null, type, value, minOrderAmount || 0, maxDiscountAmount || null,
       maxUses || null, validFrom || null, validUntil || null, isActive !== false, req.user?.id || null]
    );
    res.status(201).json(mapCoupon(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe um cupão com este código' });
    console.error('[POST /coupons]', err);
    res.status(500).json({ error: 'Erro ao criar cupão' });
  }
});

// PUT /api/coupons/:id — editar
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { code, description, type, value, minOrderAmount, maxDiscountAmount, maxUses, validFrom, validUntil, isActive } = req.body;
    const { rows } = await pool.query(
      `UPDATE coupons SET
        code = UPPER($1), description = $2, type = $3, value = $4,
        min_order_amount = $5, max_discount_amount = $6, max_uses = $7,
        valid_from = $8, valid_until = $9, is_active = $10, updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [code?.trim(), description || null, type, value, minOrderAmount || 0, maxDiscountAmount || null,
       maxUses || null, validFrom || null, validUntil || null, isActive !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cupão não encontrado' });
    res.json(mapCoupon(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe um cupão com este código' });
    console.error('[PUT /coupons]', err);
    res.status(500).json({ error: 'Erro ao atualizar cupão' });
  }
});

// DELETE /api/coupons/:id — apagar
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM coupons WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /coupons]', err);
    res.status(500).json({ error: 'Erro ao apagar cupão' });
  }
});

export default router;
