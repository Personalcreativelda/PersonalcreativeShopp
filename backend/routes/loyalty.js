import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getCustomerLoyalty,
  awardOrderPoints,
  redeemPoints,
  expirePoints,
  TIERS,
} from '../services/loyaltyService.js';
import pool from '../db.js';

const router = Router();

// GET /api/loyalty/me — customer's own loyalty summary
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const data = await getCustomerLoyalty(req.user.id);
    if (!data) return res.status(404).json({ error: 'Perfil não encontrado' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/loyalty/customer/:id — admin: see any customer's loyalty
router.get('/customer/:id', authMiddleware, async (req, res) => {
  try {
    const data = await getCustomerLoyalty(req.params.id);
    if (!data) return res.status(404).json({ error: 'Perfil não encontrado' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/loyalty/award/:orderId — award points for a completed order
router.post('/award/:orderId', authMiddleware, async (req, res) => {
  try {
    const result = await awardOrderPoints(req.params.orderId);
    if (!result) return res.json({ message: 'Sem pontos atribuídos (já processado ou sem cliente)' });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/loyalty/redeem — redeem points for a discount
router.post('/redeem', authMiddleware, async (req, res) => {
  try {
    const { customerId = req.user.id, points } = req.body;
    if (!points || points <= 0) return res.status(400).json({ error: 'Pontos inválidos' });
    const result = await redeemPoints(customerId, Number(points));
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/loyalty/adjust — admin: manually adjust points
router.post('/adjust', authMiddleware, async (req, res) => {
  try {
    const { customerId, points, description = 'Ajuste manual' } = req.body;
    if (!customerId || !points) return res.status(400).json({ error: 'customerId e points são obrigatórios' });

    await pool.query(
      `UPDATE profiles SET loyalty_points = GREATEST(0, COALESCE(loyalty_points,0) + $1) WHERE id = $2`,
      [Number(points), customerId]
    );
    await pool.query(
      `INSERT INTO loyalty_log (customer_id, type, points, description)
       VALUES ($1, 'adjust', $2, $3)`,
      [customerId, Number(points), description]
    );

    const { rows } = await pool.query('SELECT loyalty_points FROM profiles WHERE id = $1', [customerId]);
    res.json({ success: true, newPoints: rows[0]?.loyalty_points });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/loyalty/expire — admin/cron: expire stale points
router.post('/expire', authMiddleware, async (req, res) => {
  try {
    const result = await expirePoints();
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/loyalty/tiers — tier constants (public config)
router.get('/tiers', async (_req, res) => {
  res.json(TIERS);
});

export default router;
