import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// ── Shop visits ───────────────────────────────────────────────────────────────

// POST /api/tracking/shop-visit
router.post('/shop-visit', async (req, res) => {
  const {
    visitor_id, customer_id, user_id, page_path, page_title, referrer,
    ip_address, user_agent, device_type, browser, browser_version,
    os, os_version, screen_resolution, language, timezone,
    session_id, visit_duration, products_viewed, actions, metadata
  } = req.body;

  if (!page_path) return res.status(400).json({ error: 'page_path obrigatório' });

  try {
    await pool.query(
      `INSERT INTO shop_visits
        (visitor_id, customer_id, user_id, page_path, page_title, referrer,
         ip_address, user_agent, device_type, browser, browser_version,
         os, os_version, screen_resolution, language, timezone,
         session_id, visit_duration, products_viewed, actions, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        visitor_id || null, customer_id || null, user_id || null,
        page_path, page_title || null, referrer || null,
        ip_address || null, user_agent || null, device_type || null,
        browser || null, browser_version || null,
        os || null, os_version || null, screen_resolution || null,
        language || null, timezone || null,
        session_id || null, visit_duration || null,
        JSON.stringify(products_viewed || []),
        JSON.stringify(actions || []),
        JSON.stringify(metadata || {})
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Tracking] Erro ao registar visita:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tracking/shop-visits
router.get('/shop-visits', authMiddleware, async (req, res) => {
  const { startDate, endDate, customerId, pagePath, limit = 5000 } = req.query;

  const conditions = [];
  const params = [];

  if (startDate) { params.push(startDate); conditions.push(`created_at >= $${params.length}`); }
  if (endDate)   { params.push(endDate);   conditions.push(`created_at <= $${params.length}`); }
  if (customerId){ params.push(customerId);conditions.push(`customer_id = $${params.length}`); }
  if (pagePath)  { params.push(pagePath);  conditions.push(`page_path = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit));

  try {
    const { rows: visits } = await pool.query(
      `SELECT sv.*,
              c.name AS customer_name,
              p.name AS user_name
       FROM shop_visits sv
       LEFT JOIN customers c ON c.id = sv.customer_id
       LEFT JOIN profiles  p ON p.id = sv.user_id
       ${where}
       ORDER BY sv.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    const mapped = visits.map(v => ({
      id: v.id,
      visitorId: v.visitor_id,
      customerId: v.customer_id,
      userId: v.user_id,
      pagePath: v.page_path,
      pageTitle: v.page_title,
      referrer: v.referrer,
      ipAddress: v.ip_address,
      userAgent: v.user_agent,
      deviceType: v.device_type,
      browser: v.browser,
      browserVersion: v.browser_version,
      os: v.os,
      osVersion: v.os_version,
      screenResolution: v.screen_resolution,
      language: v.language,
      timezone: v.timezone,
      sessionId: v.session_id,
      visitDuration: v.visit_duration,
      productsViewed: v.products_viewed || [],
      actions: v.actions || [],
      metadata: v.metadata || {},
      createdAt: v.created_at,
      customerName: v.customer_name || undefined,
      userName: v.user_name || undefined
    }));

    res.json(mapped);
  } catch (err) {
    console.error('[Tracking] Erro ao buscar visitas:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Admin activity log ────────────────────────────────────────────────────────

// POST /api/tracking/admin-activity
router.post('/admin-activity', authMiddleware, async (req, res) => {
  const {
    user_id, page_path, page_title, action_type,
    action_details, ip_address, user_agent, device_type,
    browser, browser_version, os, os_version, session_id,
    duration, metadata
  } = req.body;

  if (!user_id || !page_path) {
    return res.status(400).json({ error: 'user_id e page_path são obrigatórios' });
  }

  try {
    await pool.query(
      `INSERT INTO admin_activity_log
        (user_id, page_path, page_title, action_type, action_details,
         ip_address, user_agent, device_type, browser, browser_version,
         os, os_version, session_id, duration, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        user_id, page_path, page_title || null,
        action_type || 'view',
        JSON.stringify(action_details || {}),
        ip_address || null, user_agent || null, device_type || null,
        browser || null, browser_version || null,
        os || null, os_version || null,
        session_id || null, duration || null,
        JSON.stringify(metadata || {})
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Tracking] Erro ao registar atividade:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tracking/admin-activities
router.get('/admin-activities', authMiddleware, async (req, res) => {
  const { userId, startDate, endDate, pagePath, actionType, limit = 5000 } = req.query;

  const conditions = [];
  const params = [];

  if (userId)    { params.push(userId);    conditions.push(`al.user_id = $${params.length}`); }
  if (startDate) { params.push(startDate); conditions.push(`al.created_at >= $${params.length}`); }
  if (endDate)   { params.push(endDate);   conditions.push(`al.created_at <= $${params.length}`); }
  if (pagePath)  { params.push(pagePath);  conditions.push(`al.page_path = $${params.length}`); }
  if (actionType){ params.push(actionType);conditions.push(`al.action_type = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit));

  try {
    const { rows: activities } = await pool.query(
      `SELECT al.*, p.name AS user_name
       FROM admin_activity_log al
       LEFT JOIN profiles p ON p.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    const mapped = activities.map(a => ({
      id: a.id,
      userId: a.user_id,
      pagePath: a.page_path,
      pageTitle: a.page_title,
      actionType: a.action_type,
      actionDetails: a.action_details || {},
      ipAddress: a.ip_address,
      userAgent: a.user_agent,
      deviceType: a.device_type,
      browser: a.browser,
      browserVersion: a.browser_version,
      os: a.os,
      osVersion: a.os_version,
      sessionId: a.session_id,
      duration: a.duration,
      metadata: a.metadata || {},
      createdAt: a.created_at,
      userName: a.user_name || undefined
    }));

    res.json(mapped);
  } catch (err) {
    console.error('[Tracking] Erro ao buscar atividades:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
