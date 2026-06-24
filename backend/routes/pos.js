import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Cria a tabela automaticamente se não existir
pool.query(`
  CREATE TABLE IF NOT EXISTS pos_sessions (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    cashier_id     UUID,
    cashier_name   VARCHAR(150)  NOT NULL DEFAULT 'Caixa',
    opened_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    closed_at      TIMESTAMPTZ,
    initial_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_open        BOOLEAN       NOT NULL DEFAULT TRUE,
    summary        JSONB
  )
`).catch(err => console.error('[POS] Erro ao criar tabela pos_sessions:', err.message));

// GET /api/pos/sessions — listar todas as sessões (para o admin)
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
         COALESCE(
           (SELECT SUM(o.total_amount) FROM orders o
            WHERE o.source = 'pos' AND o.created_at >= s.opened_at
              AND (s.closed_at IS NULL OR o.created_at <= s.closed_at)
              AND o.status NOT IN ('cancelled')),
           0
         ) AS total_sales,
         COALESCE(
           (SELECT COUNT(*) FROM orders o
            WHERE o.source = 'pos' AND o.created_at >= s.opened_at
              AND (s.closed_at IS NULL OR o.created_at <= s.closed_at)
              AND o.status NOT IN ('cancelled')),
           0
         ) AS total_orders
       FROM pos_sessions s
       ORDER BY s.opened_at DESC
       LIMIT 100`
    );
    res.json(rows.map(r => ({
      id:            r.id,
      cashierName:   r.cashier_name,
      cashierId:     r.cashier_id,
      openedAt:      r.opened_at,
      closedAt:      r.closed_at,
      initialAmount: Number(r.initial_amount),
      isOpen:        r.is_open,
      summary:       r.summary,
      totalSales:    Math.round(Number(r.total_sales) * 100) / 100,
      totalOrders:   Number(r.total_orders),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/pos/session/current
router.get('/session/current', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM pos_sessions WHERE is_open = TRUE ORDER BY opened_at DESC LIMIT 1'
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pos/session/open
router.post('/session/open', authMiddleware, async (req, res) => {
  try {
    const { initialAmount = 0 } = req.body;
    const cashierName = req.user?.name || 'Caixa';
    const cashierId  = req.user?.id   || null;

    // Fecha qualquer sessão aberta anterior
    await pool.query(
      'UPDATE pos_sessions SET is_open = FALSE, closed_at = NOW() WHERE is_open = TRUE'
    );

    const { rows } = await pool.query(
      `INSERT INTO pos_sessions (cashier_id, cashier_name, initial_amount)
       VALUES ($1, $2, $3) RETURNING *`,
      [cashierId, cashierName, Number(initialAmount) || 0]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pos/session/close
router.post('/session/close', authMiddleware, async (req, res) => {
  try {
    const { rows: sessions } = await pool.query(
      'SELECT * FROM pos_sessions WHERE is_open = TRUE ORDER BY opened_at DESC LIMIT 1'
    );
    if (!sessions.length) return res.status(404).json({ error: 'Nenhuma sessão aberta' });

    const session = sessions[0];

    // Totais das vendas POS desta sessão por método de pagamento
    const { rows: byMethod } = await pool.query(
      `SELECT
         COALESCE(payment_method, 'cash') AS method,
         COUNT(*)::int                    AS count,
         SUM(total_amount)                AS total
       FROM orders
       WHERE source = 'pos' AND created_at >= $1
       GROUP BY COALESCE(payment_method, 'cash')`,
      [session.opened_at]
    );

    const totalSales  = byMethod.reduce((s, r) => s + parseFloat(r.total  || 0), 0);
    const totalOrders = byMethod.reduce((s, r) => s + parseInt (r.count   || 0), 0);
    const cashSales   = byMethod.filter(r => r.method === 'cash')
                                .reduce((s, r) => s + parseFloat(r.total || 0), 0);

    const summary = {
      totalSales:   Math.round(totalSales   * 100) / 100,
      totalOrders,
      byMethod: byMethod.map(r => ({
        method: r.method,
        count:  parseInt(r.count),
        total:  Math.round(parseFloat(r.total) * 100) / 100,
      })),
      expectedCash: Math.round((parseFloat(String(session.initial_amount)) + cashSales) * 100) / 100,
    };

    const { rows } = await pool.query(
      `UPDATE pos_sessions
         SET is_open = FALSE, closed_at = NOW(), summary = $1
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(summary), session.id]
    );

    res.json({ session: rows[0], summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SCAN RELAY (telemóvel → computador) ──────────────────────────────────────
// Store em memória: sessionId → { codes: string[], expiresAt: number }
const scanRelay = new Map();

// Limpar sessões expiradas a cada 5 min
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of scanRelay.entries()) {
    if (now > s.expiresAt) scanRelay.delete(id);
  }
}, 300_000);

// POST /api/pos/scan-relay — criar sessão (autenticado, computador)
router.post('/scan-relay', authMiddleware, (req, res) => {
  const sessionId = Math.random().toString(36).slice(2, 10).toUpperCase();
  scanRelay.set(sessionId, { codes: [], expiresAt: Date.now() + 3_600_000 });
  res.json({ sessionId, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
});

// POST /api/pos/scan-relay/:sessionId — telemóvel envia código (sem auth)
router.post('/scan-relay/:sessionId', (req, res) => {
  const session = scanRelay.get(req.params.sessionId);
  if (!session || Date.now() > session.expiresAt) {
    return res.status(404).json({ error: 'Sessão expirada ou inválida' });
  }
  const code = (req.body.code || '').trim();
  if (code) session.codes.push(code);
  res.json({ success: true });
});

// GET /api/pos/scan-relay/:sessionId — computador lê e limpa fila (autenticado)
router.get('/scan-relay/:sessionId', authMiddleware, (req, res) => {
  const session = scanRelay.get(req.params.sessionId);
  if (!session) return res.json({ codes: [], active: false });
  const codes = [...session.codes];
  session.codes = [];
  res.json({ codes, active: true, expiresAt: new Date(session.expiresAt).toISOString() });
});

export default router;
