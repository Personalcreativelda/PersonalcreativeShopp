import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// ── Auto-create tables ─────────────────────────────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS stock_adjustments (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID          NOT NULL,
    product_name TEXT          NOT NULL,
    variant_id   UUID,
    variant_name TEXT,
    quantity     NUMERIC(10,3) NOT NULL,
    reason       TEXT          NOT NULL,
    notes        TEXT,
    date         DATE          NOT NULL DEFAULT CURRENT_DATE,
    created_by   UUID,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  )
`).catch(e => console.error('[stock] stock_adjustments:', e.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS stock_audits (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_date   DATE          NOT NULL,
    description  TEXT,
    status       TEXT          NOT NULL DEFAULT 'draft',
    scope        TEXT          NOT NULL DEFAULT 'all',
    scope_filter JSONB,
    created_by   UUID,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    applied_at   TIMESTAMPTZ
  )
`).catch(e => console.error('[stock] stock_audits:', e.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS stock_audit_items (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id          UUID          NOT NULL,
    product_id        UUID          NOT NULL,
    product_name      TEXT          NOT NULL,
    variant_id        UUID,
    variant_name      TEXT,
    system_quantity   NUMERIC(10,3) NOT NULL DEFAULT 0,
    counted_quantity  NUMERIC(10,3),
    discrepancy       NUMERIC(10,3),
    unit              TEXT          DEFAULT 'un',
    cost_price        NUMERIC(12,4),
    notes             TEXT,
    adjustment_reason TEXT,
    adjustment_notes  TEXT,
    approved          BOOLEAN       DEFAULT false,
    adjustment_id     UUID,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  )
`).catch(e => console.error('[stock] stock_audit_items:', e.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS stock_lots (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID          NOT NULL,
    product_name TEXT          NOT NULL,
    variant_id   UUID,
    variant_name TEXT,
    unit         TEXT          DEFAULT 'un',
    quantity     NUMERIC(10,3) NOT NULL DEFAULT 0,
    unit_cost    NUMERIC(12,4) DEFAULT 0,
    source_type  TEXT          NOT NULL DEFAULT 'purchase',
    source_id    UUID,
    received_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    notes        TEXT,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  )
`).catch(e => console.error('[stock] stock_lots:', e.message));

// ── Mappers ────────────────────────────────────────────────────────────────────
const mapAdj = (r) => ({
  id: r.id,
  productId: r.product_id,
  productName: r.product_name,
  variantId: r.variant_id ?? undefined,
  variantName: r.variant_name ?? undefined,
  quantity: Number(r.quantity) || 0,
  reason: r.reason,
  notes: r.notes ?? undefined,
  date: r.date ? (typeof r.date === 'string' ? r.date.split('T')[0] : r.date.toISOString().slice(0, 10)) : undefined,
  createdBy: r.created_by ?? undefined,
  createdAt: r.created_at
});

const mapAudit = (r) => ({
  id: r.id,
  auditDate: r.audit_date ? (typeof r.audit_date === 'string' ? r.audit_date.split('T')[0] : r.audit_date.toISOString().slice(0, 10)) : undefined,
  description: r.description ?? undefined,
  status: r.status,
  scope: r.scope,
  scopeFilter: r.scope_filter ?? undefined,
  createdBy: r.created_by ?? undefined,
  createdAt: r.created_at,
  completedAt: r.completed_at ?? undefined,
  appliedAt: r.applied_at ?? undefined
});

const mapAuditItem = (r) => ({
  id: r.id,
  auditId: r.audit_id,
  productId: r.product_id,
  productName: r.product_name,
  variantId: r.variant_id ?? undefined,
  variantName: r.variant_name ?? undefined,
  systemQuantity: Number(r.system_quantity) || 0,
  countedQuantity: r.counted_quantity != null ? Number(r.counted_quantity) : undefined,
  discrepancy: r.discrepancy != null ? Number(r.discrepancy) : undefined,
  unit: r.unit ?? 'un',
  costPrice: r.cost_price != null ? Number(r.cost_price) : undefined,
  notes: r.notes ?? undefined,
  adjustmentReason: r.adjustment_reason ?? undefined,
  adjustmentNotes: r.adjustment_notes ?? undefined,
  approved: r.approved || false,
  adjustmentId: r.adjustment_id ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

const mapLot = (r) => ({
  id: r.id,
  productId: r.product_id,
  productName: r.product_name,
  variantId: r.variant_id ?? null,
  variantName: r.variant_name ?? '',
  unit: r.unit ?? 'un',
  quantity: Number(r.quantity) || 0,
  unitCost: Number(r.unit_cost) || 0,
  totalValue: (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0),
  sourceType: r.source_type ?? 'manual',
  sourceId: r.source_id ?? null,
  receivedAt: r.received_at ?? ''
});

// ── Helper: apply stock adjustment ────────────────────────────────────────────
async function applyStockDelta(variantId, productId, delta) {
  if (!delta || delta === 0) return;
  if (variantId) {
    await pool.query(
      'UPDATE product_variants SET stock = GREATEST(0, stock + $1), updated_at = NOW() WHERE id = $2',
      [delta, variantId]
    ).catch(() => {});
  } else {
    const { rows } = await pool.query(
      'SELECT id FROM product_variants WHERE product_id = $1 AND is_default = true LIMIT 1',
      [productId]
    ).catch(() => ({ rows: [] }));
    if (rows.length) {
      await pool.query(
        'UPDATE product_variants SET stock = GREATEST(0, stock + $1), updated_at = NOW() WHERE id = $2',
        [delta, rows[0].id]
      ).catch(() => {});
    }
  }
}

// === STOCK ADJUSTMENTS ===

// GET /api/stock/adjustments
router.get('/adjustments', authMiddleware, async (req, res) => {
  try {
    const { productId } = req.query;
    let q = 'SELECT * FROM stock_adjustments';
    const params = [];
    if (productId) { q += ' WHERE product_id = $1'; params.push(productId); }
    q += ' ORDER BY date DESC, created_at DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows.map(mapAdj));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar ajustes' });
  }
});

// POST /api/stock/adjustments
router.post('/adjustments', authMiddleware, async (req, res) => {
  try {
    const a = req.body;
    const qty = Number(a.quantity) || 0;
    if (qty === 0) return res.status(400).json({ error: 'Quantidade não pode ser zero' });
    const { rows } = await pool.query(
      `INSERT INTO stock_adjustments (product_id, product_name, variant_id, variant_name, quantity, reason, notes, date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [a.productId, a.productName, a.variantId || null, a.variantName || null,
       qty, a.reason, a.notes || null, a.date, a.createdBy || null]
    );
    // Create stock movement
    await pool.query(
      `INSERT INTO stock_movements (date, items, notes, source_reference, created_at)
       VALUES ($1,$2,$3,$4,NOW())`,
      [a.date, JSON.stringify([{ productId: a.productId, productName: a.productName, variantId: a.variantId, quantity: qty }]),
       `Ajuste: ${a.reason}${a.notes ? ' - ' + a.notes : ''}`,
       JSON.stringify({ type: 'adjustment', id: rows[0].id })]
    ).catch(() => {});
    // Update stock
    await applyStockDelta(a.variantId || null, a.productId, qty);
    res.status(201).json(mapAdj(rows[0]));
  } catch (err) {
    console.error('[POST /stock/adjustments]', err);
    res.status(500).json({ error: 'Erro ao criar ajuste' });
  }
});

// PUT /api/stock/adjustments/:id
router.put('/adjustments/:id', authMiddleware, async (req, res) => {
  try {
    const a = req.body;
    const { rows: old } = await pool.query('SELECT * FROM stock_adjustments WHERE id = $1', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'Ajuste não encontrado' });
    // Revert old stock delta
    await applyStockDelta(old[0].variant_id, old[0].product_id, -Number(old[0].quantity));
    const newQty = Number(a.quantity) || 0;
    await pool.query(
      `UPDATE stock_adjustments SET quantity=$1, reason=$2, notes=$3, date=$4 WHERE id=$5`,
      [newQty, a.reason, a.notes || null, a.date, req.params.id]
    );
    // Apply new delta
    await applyStockDelta(old[0].variant_id, old[0].product_id, newQty);
    // Update movement
    await pool.query(
      `UPDATE stock_movements SET date=$1, notes=$2, updated_at=NOW()
       WHERE source_reference->>'type'='adjustment' AND source_reference->>'id'=$3`,
      [a.date, `Ajuste: ${a.reason}${a.notes ? ' - ' + a.notes : ''}`, req.params.id]
    ).catch(() => {});
    const { rows } = await pool.query('SELECT * FROM stock_adjustments WHERE id = $1', [req.params.id]);
    res.json(mapAdj(rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao actualizar ajuste' });
  }
});

// DELETE /api/stock/adjustments (bulk) — must be before /:id
router.delete('/adjustments', authMiddleware, async (req, res) => {
  const ids = req.body?.ids || [];
  let deleted = 0;
  const errors = [];
  for (const id of ids) {
    try {
      const { rows } = await pool.query('SELECT * FROM stock_adjustments WHERE id = $1', [id]);
      if (rows.length) {
        await applyStockDelta(rows[0].variant_id, rows[0].product_id, -Number(rows[0].quantity));
        await pool.query(`DELETE FROM stock_movements WHERE source_reference->>'type'='adjustment' AND source_reference->>'id'=$1`, [id]).catch(() => {});
        await pool.query('DELETE FROM stock_adjustments WHERE id = $1', [id]);
      }
      deleted++;
    } catch (e) { errors.push(`${id}: ${e.message}`); }
  }
  res.json({ success: !errors.length, deleted, errors });
});

// DELETE /api/stock/adjustments/:id
router.delete('/adjustments/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM stock_adjustments WHERE id = $1', [req.params.id]);
    if (rows.length) {
      await applyStockDelta(rows[0].variant_id, rows[0].product_id, -Number(rows[0].quantity));
      await pool.query(`DELETE FROM stock_movements WHERE source_reference->>'type'='adjustment' AND source_reference->>'id'=$1`, [req.params.id]).catch(() => {});
      await pool.query('DELETE FROM stock_adjustments WHERE id = $1', [req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao apagar ajuste' });
  }
});

// === STOCK AUDITS ===

// GET /api/stock/audits
router.get('/audits', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM stock_audits ORDER BY audit_date DESC, created_at DESC');
    res.json(rows.map(mapAudit));
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar auditorias' }); }
});

// GET /api/stock/audits/:id — with items
router.get('/audits/:id', authMiddleware, async (req, res) => {
  try {
    const { rows: [audit] } = await pool.query('SELECT * FROM stock_audits WHERE id = $1', [req.params.id]);
    if (!audit) return res.status(404).json({ error: 'Auditoria não encontrada' });
    const { rows: items } = await pool.query('SELECT * FROM stock_audit_items WHERE audit_id = $1 ORDER BY product_name, variant_name', [req.params.id]);
    res.json({ ...mapAudit(audit), items: items.map(mapAuditItem) });
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar auditoria' }); }
});

// POST /api/stock/audits
router.post('/audits', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { auditDate, description, scope, scopeFilter, items: auditItems } = req.body;
    await client.query('BEGIN');
    const { rows: [audit] } = await client.query(
      `INSERT INTO stock_audits (audit_date, description, scope, scope_filter, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [auditDate, description || null, scope || 'all', scopeFilter ? JSON.stringify(scopeFilter) : null, req.user?.id || null]
    );
    // Insert items
    if (Array.isArray(auditItems) && auditItems.length > 0) {
      for (const it of auditItems) {
        await client.query(
          `INSERT INTO stock_audit_items (audit_id, product_id, product_name, variant_id, variant_name, system_quantity, unit, cost_price)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [audit.id, it.productId, it.productName, it.variantId || null, it.variantName || null,
           it.systemQuantity || 0, it.unit || 'un', it.costPrice || null]
        );
      }
    }
    await client.query('COMMIT');
    const { rows: items } = await pool.query('SELECT * FROM stock_audit_items WHERE audit_id = $1', [audit.id]);
    res.status(201).json({ ...mapAudit(audit), items: items.map(mapAuditItem) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /stock/audits]', err);
    res.status(500).json({ error: 'Erro ao criar auditoria' });
  } finally { client.release(); }
});

// PUT /api/stock/audits/:id/complete
router.put('/audits/:id/complete', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      `UPDATE stock_audits SET status='completed', completed_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao completar auditoria' }); }
});

// PUT /api/stock/audits/:id/apply — apply discrepancies as adjustments
router.put('/audits/:id/apply', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: [audit] } = await pool.query('SELECT * FROM stock_audits WHERE id = $1', [req.params.id]);
    if (!audit) return res.status(404).json({ error: 'Auditoria não encontrada' });
    const { rows: items } = await pool.query(
      `SELECT * FROM stock_audit_items WHERE audit_id=$1 AND approved=true AND discrepancy IS NOT NULL AND discrepancy <> 0 AND adjustment_id IS NULL`,
      [req.params.id]
    );
    await client.query('BEGIN');
    let applied = 0;
    for (const item of items) {
      const disc = Number(item.discrepancy);
      if (disc === 0) continue;
      const { rows: [adj] } = await client.query(
        `INSERT INTO stock_adjustments (product_id, product_name, variant_id, variant_name, quantity, reason, notes, date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [item.product_id, item.product_name, item.variant_id, item.variant_name,
         disc, item.adjustment_reason || 'correction',
         item.adjustment_notes || `Ajuste de auditoria ${audit.audit_date}`,
         audit.audit_date]
      );
      await client.query(
        `UPDATE stock_audit_items SET adjustment_id=$1, updated_at=NOW() WHERE id=$2`,
        [adj.id, item.id]
      );
      await applyStockDelta(item.variant_id, item.product_id, disc);
      applied++;
    }
    await client.query(
      `UPDATE stock_audits SET status='applied', applied_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, applied });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao aplicar auditoria' });
  } finally { client.release(); }
});

// PUT /api/stock/audits/:id/revert — revert 'applied' → 'completed'
router.put('/audits/:id/revert', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    // Find all adjustment_ids linked to this audit
    const { rows: linkedItems } = await pool.query(
      'SELECT adjustment_id FROM stock_audit_items WHERE audit_id=$1 AND adjustment_id IS NOT NULL',
      [req.params.id]
    );
    await client.query('BEGIN');
    for (const { adjustment_id } of linkedItems) {
      // Revert stock
      const { rows: [adj] } = await pool.query('SELECT * FROM stock_adjustments WHERE id=$1', [adjustment_id]);
      if (adj) {
        await applyStockDelta(adj.variant_id, adj.product_id, -Number(adj.quantity));
        await pool.query(`DELETE FROM stock_movements WHERE source_reference->>'type'='adjustment' AND source_reference->>'id'=$1`, [adjustment_id]).catch(() => {});
        await pool.query('DELETE FROM stock_adjustments WHERE id=$1', [adjustment_id]);
      }
    }
    // Clear adjustment_ids from items
    await client.query(
      `UPDATE stock_audit_items SET adjustment_id=NULL, approved=false, updated_at=NOW() WHERE audit_id=$1`,
      [req.params.id]
    );
    // Revert status
    await client.query(
      `UPDATE stock_audits SET status='completed', applied_at=NULL WHERE id=$1`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao reverter auditoria' });
  } finally { client.release(); }
});

// DELETE /api/stock/audits/:id
router.delete('/audits/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM stock_audits WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao apagar auditoria' }); }
});

// PUT /api/stock/audits/:id/items/batch
router.put('/audits/:id/items/batch', authMiddleware, async (req, res) => {
  const { updates } = req.body; // Array<{ itemId, countedQuantity, notes? }>
  if (!Array.isArray(updates) || !updates.length) return res.json({ success: true });
  try {
    for (const u of updates) {
      if (!u.itemId) continue;
      // Get system_quantity to calculate discrepancy
      const { rows: [item] } = await pool.query('SELECT system_quantity FROM stock_audit_items WHERE id = $1', [u.itemId]);
      const disc = item ? (Number(u.countedQuantity) - Number(item.system_quantity)) : null;
      await pool.query(
        `UPDATE stock_audit_items SET counted_quantity=$1, discrepancy=$2, notes=$3, updated_at=NOW() WHERE id=$4`,
        [u.countedQuantity ?? null, disc, u.notes || null, u.itemId]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao guardar contagens', success: false }); }
});

// PUT /api/stock/audit-items/:id
router.put('/audit-items/:id', authMiddleware, async (req, res) => {
  try {
    const f = req.body;
    const disc = f.countedQuantity != null && f.systemQuantity != null
      ? Number(f.countedQuantity) - Number(f.systemQuantity)
      : null;
    await pool.query(
      `UPDATE stock_audit_items SET
         counted_quantity=$1, discrepancy=$2, notes=$3,
         adjustment_reason=$4, adjustment_notes=$5, approved=$6, updated_at=NOW()
       WHERE id=$7`,
      [f.countedQuantity ?? null, disc, f.notes || null,
       f.adjustmentReason || null, f.adjustmentNotes || null,
       f.approved || false, req.params.id]
    );
    const { rows } = await pool.query('SELECT * FROM stock_audit_items WHERE id = $1', [req.params.id]);
    res.json(mapAuditItem(rows[0]));
  } catch (err) { res.status(500).json({ error: 'Erro ao actualizar item de auditoria' }); }
});

// === STOCK LOTS ===

// GET /api/stock/lots
router.get('/lots', authMiddleware, async (req, res) => {
  try {
    const { productId, variantId, sourceType, includeConsumed } = req.query;
    let q = 'SELECT l.*, p.name as p_name, p.unit as p_unit, pv.name as v_name, pv.unit as v_unit FROM stock_lots l LEFT JOIN products p ON p.id = l.product_id LEFT JOIN product_variants pv ON pv.id = l.variant_id WHERE 1=1';
    const params = [];
    let idx = 1;
    if (includeConsumed !== 'true') { q += ` AND l.quantity > 0`; }
    if (productId) { q += ` AND l.product_id = $${idx++}`; params.push(productId); }
    if (variantId) { q += ` AND l.variant_id = $${idx++}`; params.push(variantId); }
    if (sourceType) { q += ` AND l.source_type = $${idx++}`; params.push(sourceType); }
    q += ' ORDER BY l.received_at ASC';
    const { rows } = await pool.query(q, params);
    res.json(rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      productName: r.p_name ?? r.product_name,
      variantId: r.variant_id ?? null,
      variantName: r.v_name ?? r.variant_name ?? '',
      unit: r.v_unit ?? r.p_unit ?? r.unit ?? 'un',
      quantity: Number(r.quantity) || 0,
      unitCost: Number(r.unit_cost) || 0,
      totalValue: (Number(r.quantity) || 0) * (Number(r.unit_cost) || 0),
      sourceType: r.source_type ?? 'manual',
      sourceId: r.source_id ?? null,
      receivedAt: r.received_at ?? ''
    })));
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar lotes' }); }
});

// PUT /api/stock/lots/:id
router.put('/lots/:id', authMiddleware, async (req, res) => {
  try {
    const { quantity, unitCost } = req.body;
    const updates = [];
    const params = [];
    if (quantity !== undefined) { updates.push(`quantity=$${params.length + 1}`); params.push(quantity); }
    if (unitCost !== undefined) { updates.push(`unit_cost=$${params.length + 1}`); params.push(unitCost); }
    if (!updates.length) return res.json({ success: true });
    updates.push('updated_at=NOW()');
    params.push(req.params.id);
    await pool.query(`UPDATE stock_lots SET ${updates.join(',')} WHERE id=$${params.length}`, params);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao actualizar lote' }); }
});

// DELETE /api/stock/lots/:id
router.delete('/lots/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM stock_lots WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao apagar lote' }); }
});

// DELETE /api/stock/lots (bulk)
router.delete('/lots', authMiddleware, async (req, res) => {
  const ids = req.body?.ids || [];
  try {
    if (ids.length) await pool.query(`DELETE FROM stock_lots WHERE id = ANY($1::uuid[])`, [ids]);
    res.json({ success: true, deleted: ids.length });
  } catch (err) { res.status(500).json({ error: 'Erro ao apagar lotes' }); }
});

// === STOCK MOVEMENTS ===

const mapMovement = (m) => ({
  id: m.id,
  date: m.date,
  items: m.items || [],
  notes: m.notes,
  sourceReference: m.source_reference,
  createdAt: m.created_at,
  updatedAt: m.updated_at
});

// GET /api/stock/movements
router.get('/movements', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM stock_movements ORDER BY date DESC'
    );
    res.json(rows.map(mapMovement));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar movimentos de stock' });
  }
});

// POST /api/stock/movements
router.post('/movements', authMiddleware, async (req, res) => {
  try {
    const m = req.body;
    const refStr = m.sourceReference ? JSON.stringify(m.sourceReference) : null;

    // Verificar duplicado (se tem sourceReference)
    if (refStr && m.sourceReference?.type !== 'adjustment') {
      const { rows: existing } = await pool.query(
        'SELECT id, date, items, notes, source_reference, created_at FROM stock_movements WHERE source_reference::text = $1 LIMIT 1',
        [refStr]
      );
      if (existing.length) return res.json(mapMovement(existing[0]));
    }

    const { rows } = await pool.query(
      `INSERT INTO stock_movements (date, items, notes, source_reference, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [m.date, JSON.stringify(m.items || []), m.notes || null, refStr]
    );
    const movement = rows[0];

    // Processar stock de cada item
    for (const item of (m.items || [])) {
      if (!item.productId || item.quantity === 0) continue;
      try {
        if (item.variantId) {
          await pool.query(
            `UPDATE product_variants SET stock = GREATEST(0, stock + $1), updated_at = NOW() WHERE id = $2`,
            [item.quantity, item.variantId]
          );
        } else {
          // Buscar variante padrão
          const { rows: vRows } = await pool.query(
            'SELECT id FROM product_variants WHERE product_id = $1 AND is_default = true LIMIT 1',
            [item.productId]
          );
          if (vRows.length) {
            await pool.query(
              'UPDATE product_variants SET stock = GREATEST(0, stock + $1), updated_at = NOW() WHERE id = $2',
              [item.quantity, vRows[0].id]
            );
          }
        }
      } catch (stockErr) {
        console.warn('[stock movement] Erro ao actualizar stock do item:', stockErr.message);
      }
    }

    res.status(201).json(mapMovement(movement));
  } catch (err) {
    console.error('[POST /stock/movements]', err);
    res.status(500).json({ error: 'Erro ao criar movimento de stock' });
  }
});

// PUT /api/stock/movements/:id
router.put('/movements/:id', authMiddleware, async (req, res) => {
  try {
    const m = req.body;
    const { rows: old } = await pool.query('SELECT * FROM stock_movements WHERE id = $1', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'Movimento não encontrado' });

    await pool.query(
      `UPDATE stock_movements SET date = $1, items = $2, notes = $3, source_reference = $4, updated_at = NOW() WHERE id = $5`,
      [m.date, JSON.stringify(m.items || []), m.notes || null,
       m.sourceReference ? JSON.stringify(m.sourceReference) : null, req.params.id]
    );

    // Reverter stock antigo e aplicar novo (se items mudaram)
    if (JSON.stringify(old[0].items) !== JSON.stringify(m.items)) {
      // Reverter
      for (const item of (old[0].items || [])) {
        if (!item.productId || item.quantity === 0) continue;
        const revertQty = -item.quantity;
        if (item.variantId) {
          await pool.query(
            'UPDATE product_variants SET stock = GREATEST(0, stock + $1), updated_at = NOW() WHERE id = $2',
            [revertQty, item.variantId]
          ).catch(() => {});
        }
      }
      // Aplicar novo
      for (const item of (m.items || [])) {
        if (!item.productId || item.quantity === 0) continue;
        if (item.variantId) {
          await pool.query(
            'UPDATE product_variants SET stock = GREATEST(0, stock + $1), updated_at = NOW() WHERE id = $2',
            [item.quantity, item.variantId]
          ).catch(() => {});
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao actualizar movimento' });
  }
});

// DELETE /api/stock/movements/:id
router.delete('/movements/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM stock_movements WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.json({ success: true });

    const movement = rows[0];
    // Reverter stock
    for (const item of (movement.items || [])) {
      if (!item.productId || item.quantity === 0) continue;
      const revertQty = -item.quantity;
      if (item.variantId) {
        await pool.query(
          'UPDATE product_variants SET stock = GREATEST(0, stock + $1), updated_at = NOW() WHERE id = $2',
          [revertQty, item.variantId]
        ).catch(() => {});
      }
    }

    await pool.query('DELETE FROM stock_movements WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao apagar movimento' });
  }
});

// PUT /api/stock/variants/:variantId/adjust
router.put('/variants/:variantId/adjust', authMiddleware, async (req, res) => {
  try {
    const { quantity, operation } = req.body; // operation: 'add' | 'subtract'
    const qty = operation === 'subtract' ? -Math.abs(quantity) : Math.abs(quantity);
    await pool.query(
      'UPDATE product_variants SET stock = GREATEST(0, stock + $1), updated_at = NOW() WHERE id = $2',
      [qty, req.params.variantId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ajustar stock' });
  }
});

// GET /api/stock/config
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM stock_config WHERE is_active = true LIMIT 1'
    );
    if (!rows.length) return res.json(null);
    res.json({ resetDate: rows[0].reset_date, resetReason: rows[0].reset_reason, createdAt: rows[0].created_at });
  } catch (err) {
    res.json(null);
  }
});

// POST /api/stock/reset
router.post('/reset', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { resetDate, resetReason, initialStocks } = req.body;
    await client.query('BEGIN');
    await client.query('UPDATE stock_config SET is_active = false WHERE is_active = true');
    await client.query(
      'INSERT INTO stock_config (reset_date, reset_reason, is_active) VALUES ($1, $2, true)',
      [resetDate, resetReason]
    );
    for (const item of (initialStocks || [])) {
      await client.query(
        'UPDATE product_variants SET stock = $1 WHERE id = $2',
        [Math.max(0, Number(item.stock) || 0), item.variantId]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/stock/snapshot/:date
router.get('/snapshot/:date', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT product_id, variant_id, quantity FROM stock_initial_snapshot WHERE snapshot_date = $1',
      [req.params.date]
    );
    res.json(rows.map(r => ({
      productId: r.product_id,
      variantId: r.variant_id,
      quantity: Number(r.quantity) || 0
    })));
  } catch (err) {
    res.json([]);
  }
});

// POST /api/stock/snapshot
router.post('/snapshot', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { snapshotDate, items } = req.body;
    await client.query('BEGIN');
    await client.query('DELETE FROM stock_initial_snapshot WHERE snapshot_date = $1', [snapshotDate]);
    for (const item of (items || [])) {
      await client.query(
        `INSERT INTO stock_initial_snapshot (snapshot_date, product_id, variant_id, quantity)
         VALUES ($1, $2, $3, $4)`,
        [snapshotDate, item.productId, item.variantId || null, item.quantity]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/stock/period-summary
// Calculates stock period summary from product_variants.stock (current truth) + movements in period.
// initial_qty = current_stock - purchases_in_period + sales_in_period - adjustments_in_period
router.get('/period-summary', authMiddleware, async (req, res) => {
  try {
    const { start_date, end_date, include_zero_stock } = req.query;
    if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date required' });
    const includeZero = include_zero_stock !== 'false';

    // All variants with current stock
    const { rows: variants } = await pool.query(`
      SELECT pv.id AS variant_id, pv.product_id, pv.name AS variant_name,
             pv.stock::float AS current_stock, pv.cost_price::float AS cost_price,
             pv.unit AS variant_unit, pv.is_default, pv.display_order,
             p.name AS product_name, p.unit AS product_unit
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      ORDER BY p.name ASC, pv.is_default DESC, pv.display_order ASC NULLS LAST
    `);

    // Products without any variant (truly simple products)
    const { rows: simpleProducts } = await pool.query(`
      SELECT p.id, p.name, p.stock::float AS stock, p.cost_price::float AS cost_price, p.unit
      FROM products p
      WHERE NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id)
      ORDER BY p.name ASC
    `);

    // Movements in the period (cast to date to avoid timezone issues with TIMESTAMPTZ column)
    const { rows: movements } = await pool.query(
      `SELECT id, date, items FROM stock_movements WHERE date::date >= $1::date AND date::date <= $2::date`,
      [start_date, end_date]
    );

    // Adjustments in the period
    const { rows: adjustments } = await pool.query(
      `SELECT product_id, variant_id, quantity::float FROM stock_adjustments WHERE date >= $1 AND date <= $2`,
      [start_date, end_date]
    );

    // Aggregate movements per variantId and per productId (no-variant movements)
    const variantMov = new Map(); // variantId → {in, out, inV, outV}
    const productMov = new Map(); // productId → {in, out, inV, outV}
    const empty = () => ({ in: 0, out: 0, inV: 0, outV: 0 });

    for (const m of movements) {
      const items = typeof m.items === 'string' ? JSON.parse(m.items) : (m.items || []);
      for (const item of items) {
        const qty = Number(item.quantity) || 0;
        if (qty === 0) continue;
        const price = Number(item.unitPrice) || 0;
        if (item.variantId) {
          const e = variantMov.get(item.variantId) || empty();
          if (qty > 0) { e.in += qty; e.inV += qty * price; }
          else { e.out += Math.abs(qty); e.outV += Math.abs(qty) * price; }
          variantMov.set(item.variantId, e);
        } else if (item.productId) {
          const e = productMov.get(item.productId) || empty();
          if (qty > 0) { e.in += qty; e.inV += qty * price; }
          else { e.out += Math.abs(qty); e.outV += Math.abs(qty) * price; }
          productMov.set(item.productId, e);
        }
      }
    }

    // Adjustments per variantId / productId
    const variantAdj = new Map();
    const productAdj = new Map();
    for (const a of adjustments) {
      if (a.variant_id) variantAdj.set(a.variant_id, (variantAdj.get(a.variant_id) || 0) + Number(a.quantity));
      else productAdj.set(a.product_id, (productAdj.get(a.product_id) || 0) + Number(a.quantity));
    }

    const result = [];

    for (const v of variants) {
      const vm = variantMov.get(v.variant_id) || empty();
      // Default variant also inherits product-level movements (for simple products stored as variants)
      const pm = v.is_default ? (productMov.get(v.product_id) || empty()) : empty();
      const purchases = vm.in + pm.in;
      const sales = vm.out + pm.out;
      const purchasesValue = vm.inV + pm.inV;
      const salesValue = vm.outV + pm.outV;
      const adj = (variantAdj.get(v.variant_id) || 0) + (v.is_default ? (productAdj.get(v.product_id) || 0) : 0);
      const currentStock = Number(v.current_stock) || 0;
      const costPrice = Number(v.cost_price) || 0;
      const initialStock = currentStock - purchases + sales - adj;
      const finalStock = currentStock;

      if (!includeZero && initialStock === 0 && finalStock === 0 && purchases === 0 && sales === 0 && adj === 0) continue;

      result.push({
        product_id: v.product_id,
        product_name: v.product_name,
        variant_id: v.is_default ? null : v.variant_id,
        variant_name: v.is_default ? null : v.variant_name,
        unit: v.variant_unit || v.product_unit || 'un',
        cost_price: costPrice,
        initial_qty: initialStock,
        purchases_qty: purchases,
        sales_qty: sales,
        adjustments_qty: adj,
        final_qty: finalStock,
        initial_value: initialStock * costPrice,
        purchases_value: purchasesValue,
        sales_value: salesValue,
        final_value: finalStock * costPrice
      });
    }

    // Simple products (no variants in product_variants table)
    for (const p of simpleProducts) {
      const pm = productMov.get(p.id) || empty();
      const adj = productAdj.get(p.id) || 0;
      const currentStock = Number(p.stock) || 0;
      const costPrice = Number(p.cost_price) || 0;
      const purchases = pm.in;
      const sales = pm.out;
      const initialStock = currentStock - purchases + sales - adj;
      const finalStock = currentStock;

      if (!includeZero && initialStock === 0 && finalStock === 0 && purchases === 0 && sales === 0 && adj === 0) continue;

      result.push({
        product_id: p.id,
        product_name: p.name,
        variant_id: null,
        variant_name: null,
        unit: p.unit || 'un',
        cost_price: costPrice,
        initial_qty: initialStock,
        purchases_qty: purchases,
        sales_qty: sales,
        adjustments_qty: adj,
        final_qty: finalStock,
        initial_value: initialStock * costPrice,
        purchases_value: pm.inV,
        sales_value: pm.outV,
        final_value: finalStock * costPrice
      });
    }

    result.sort((a, b) => a.product_name.localeCompare(b.product_name));
    res.json(result);
  } catch (err) {
    console.error('[GET /stock/period-summary]', err);
    res.status(500).json({ error: 'Erro ao calcular resumo de stock' });
  }
});

// POST /api/stock/sync-product-stock
// One-time migration: copies products.stock → default variant stock for products where variant.stock = 0
router.post('/sync-product-stock', authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await pool.query(`
      UPDATE product_variants pv
      SET stock = p.stock, updated_at = NOW()
      FROM products p
      WHERE pv.product_id = p.id
        AND pv.is_default = true
        AND pv.stock = 0
        AND p.stock > 0
    `);
    res.json({ success: true, updated: rowCount });
  } catch (err) {
    console.error('[POST /stock/sync-product-stock]', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stock/transactions
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM stock_transactions ORDER BY created_at DESC LIMIT 1000'
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// POST /api/stock/transfer — transfer stock between locations
router.post('/transfer', authMiddleware, async (req, res) => {
  const { productId, variantId = null, quantity, fromLocationId, toLocationId, notes = '' } = req.body;
  if (!productId || !quantity || !fromLocationId || !toLocationId) {
    return res.status(400).json({ error: 'productId, quantity, fromLocationId e toLocationId são obrigatórios' });
  }
  if (fromLocationId === toLocationId) {
    return res.status(400).json({ error: 'Origem e destino não podem ser iguais' });
  }
  const qty = Number(quantity);
  if (qty <= 0) return res.status(400).json({ error: 'Quantidade deve ser positiva' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check source stock
    const whereV = variantId
      ? 'product_id = $1 AND variant_id = $2 AND location_id = $3'
      : 'product_id = $1 AND variant_id IS NULL AND location_id = $2';
    const params = variantId ? [productId, variantId, fromLocationId] : [productId, fromLocationId];
    const { rows: src } = await client.query(
      `SELECT * FROM product_location_stock WHERE ${whereV}`,
      params
    );
    const srcQty = Number(src[0]?.quantity || 0);
    if (srcQty < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Stock insuficiente na origem. Disponível: ${srcQty}` });
    }

    const upsertSql = variantId
      ? `INSERT INTO product_location_stock (product_id, variant_id, location_id, quantity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (product_id, variant_id, location_id)
         DO UPDATE SET quantity = product_location_stock.quantity + EXCLUDED.quantity`
      : `INSERT INTO product_location_stock (product_id, location_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, location_id)
         DO UPDATE SET quantity = product_location_stock.quantity + EXCLUDED.quantity`;

    if (variantId) {
      // Deduct from source
      await client.query(
        `UPDATE product_location_stock SET quantity = quantity - $1
         WHERE product_id = $2 AND variant_id = $3 AND location_id = $4`,
        [qty, productId, variantId, fromLocationId]
      );
      // Add to destination
      await client.query(upsertSql, [productId, variantId, toLocationId, qty]);
    } else {
      await client.query(
        `UPDATE product_location_stock SET quantity = quantity - $1
         WHERE product_id = $2 AND variant_id IS NULL AND location_id = $3`,
        [qty, productId, fromLocationId]
      );
      await client.query(upsertSql, [productId, toLocationId, qty]);
    }

    // Log in stock_movements
    const { rows: product } = await client.query('SELECT name FROM products WHERE id = $1', [productId]);
    const productName = product[0]?.name || '';
    await client.query(
      `INSERT INTO stock_movements
         (date, items, description, metadata)
       VALUES (CURRENT_DATE, $1, $2, $3)`,
      [
        JSON.stringify([{ productId, variantId, quantity: qty }]),
        `Transferência: ${productName} — ${qty} un${notes ? ` (${notes})` : ''}`,
        JSON.stringify({ type: 'transfer', from: fromLocationId, to: toLocationId }),
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      productId,
      variantId,
      quantity: qty,
      fromLocationId,
      toLocationId,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /stock/transfer]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;

