import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendMarketingEmail, sendWhatsAppMessage } from '../services/emailService.js';
import { randomBytes } from 'crypto';

const router = express.Router();
const APP_URL = (process.env.APP_URL || 'https://www.natur-erva.co.mz').replace(/\/$/, '');

// GET /api/marketing/customers — lista todos os clientes com email (perfis + customers do admin)
router.get('/customers', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, points, order_count FROM (

         -- 1. Perfis registados (qualquer role não-admin)
         SELECT
           p.id::text          AS id,
           p.name,
           p.email,
           p.phone,
           COALESCE(p.points, 0)          AS points,
           COUNT(DISTINCT o.id)::int      AS order_count
         FROM profiles p
         LEFT JOIN orders o ON o.created_by = p.id
         WHERE p.is_active = true
           AND p.email IS NOT NULL AND p.email <> ''
           AND p.is_super_admin IS NOT TRUE
         GROUP BY p.id

         UNION

         -- 2. Clientes criados pelo admin sem conta própria
         SELECT
           c.id::text          AS id,
           c.name,
           c.email,
           c.phone,
           0                              AS points,
           COUNT(DISTINCT o.id)::int      AS order_count
         FROM customers c
         LEFT JOIN orders o ON o.customer_id = c.id
         LEFT JOIN profiles p ON LOWER(p.email) = LOWER(c.email)
         WHERE c.email IS NOT NULL AND c.email <> ''
           AND p.id IS NULL
         GROUP BY c.id

       ) combined
       ORDER BY order_count DESC, name ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /marketing/customers]', err);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});

// POST /api/marketing/send-email — enviar campanha por email
router.post('/send-email', authMiddleware, async (req, res) => {
  try {
    const { subject, body, recipientIds, sendToAll, attachments } = req.body;
    if (!subject?.trim() || !body?.trim())
      return res.status(400).json({ error: 'Assunto e corpo são obrigatórios' });

    let recipients = [];

    if (sendToAll) {
      const { rows } = await pool.query(
        `SELECT id, name, email FROM profiles WHERE role = 'CLIENTE' AND is_active = true AND email IS NOT NULL`
      );
      recipients = rows;
    } else if (Array.isArray(recipientIds) && recipientIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT id, name, email FROM profiles WHERE id = ANY($1) AND email IS NOT NULL`,
        [recipientIds]
      );
      recipients = rows;
    }

    if (!recipients.length)
      return res.status(400).json({ error: 'Nenhum destinatário selecionado' });

    // Guardar campanha
    const { rows: campaignRows } = await pool.query(
      `INSERT INTO marketing_campaigns (title, subject, body, channel, recipient_count, created_by)
       VALUES ($1, $2, $3, 'email', $4, $5) RETURNING id`,
      [subject, subject, body, recipients.length, req.user.id]
    );

    // Enviar emails (best-effort, em paralelo com limite)
    const BATCH = 10;
    let sent = 0;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(r => {
          const token = randomBytes(16).toString('hex');
          return sendMarketingEmail({
            to: r.email,
            subject,
            body,
            attachments: attachments || [],
            unsubscribeToken: token
          });
        })
      );
      sent += batch.length;
    }

    res.json({ success: true, sent, campaignId: campaignRows[0].id });
  } catch (err) {
    console.error('[POST /marketing/send-email]', err);
    res.status(500).json({ error: 'Erro ao enviar campanha' });
  }
});

// POST /api/marketing/whatsapp-send — enviar via WhatsApp Business API (ou gerar links se API não configurada)
router.post('/whatsapp-send', authMiddleware, async (req, res) => {
  try {
    const { message, recipientIds, sendToAll } = req.body;
    if (!message?.trim())
      return res.status(400).json({ error: 'Mensagem obrigatória' });

    const hasApi = !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);

    // Buscar destinatários com telefone
    let recipients = [];
    if (sendToAll) {
      const { rows } = await pool.query(
        `SELECT id::text AS id, name, phone FROM profiles
         WHERE is_active = true AND phone IS NOT NULL AND phone <> '' AND is_super_admin IS NOT TRUE
         UNION
         SELECT c.id::text AS id, c.name, c.phone FROM customers c
         LEFT JOIN profiles p ON LOWER(p.email) = LOWER(c.email)
         WHERE c.phone IS NOT NULL AND c.phone <> '' AND p.id IS NULL`
      );
      recipients = rows;
    } else if (Array.isArray(recipientIds) && recipientIds.length > 0) {
      const { rows: pRows } = await pool.query(
        `SELECT id::text AS id, name, phone FROM profiles WHERE id = ANY($1) AND phone IS NOT NULL`,
        [recipientIds]
      );
      const { rows: cRows } = await pool.query(
        `SELECT id::text AS id, name, phone FROM customers WHERE id = ANY($1) AND phone IS NOT NULL`,
        [recipientIds]
      );
      recipients = [...pRows, ...cRows];
    }

    if (!recipients.length)
      return res.status(400).json({ error: 'Nenhum destinatário com número de telemóvel' });

    if (hasApi) {
      // Envio real via WhatsApp Business API
      let sent = 0;
      let failed = 0;
      const BATCH = 5;
      for (let i = 0; i < recipients.length; i += BATCH) {
        const batch = recipients.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(r => {
            const personalMsg = message.replace(/{nome}/gi, r.name || 'Cliente');
            return sendWhatsAppMessage({ phone: r.phone, message: personalMsg });
          })
        );
        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value?.ok) sent++;
          else failed++;
        });
        // Aguardar 1s entre batches para não exceder rate limit
        if (i + BATCH < recipients.length) await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await pool.query(
        `INSERT INTO marketing_campaigns (title, body, channel, recipient_count, created_by)
         VALUES ($1, $2, 'whatsapp', $3, $4)`,
        [`WhatsApp API — ${new Date().toLocaleDateString('pt-MZ')}`, message, sent, req.user.id]
      );

      res.json({ mode: 'api', sent, failed, total: recipients.length });
    } else {
      // Fallback: gerar links wa.me
      const links = recipients.map(r => {
        const phone = r.phone.replace(/\D/g, '');
        const fullPhone = phone.startsWith('258') ? phone : `258${phone}`;
        const personalMsg = message.replace(/{nome}/gi, r.name || 'Cliente');
        return { name: r.name, phone: fullPhone, link: `https://wa.me/${fullPhone}?text=${encodeURIComponent(personalMsg)}` };
      });

      await pool.query(
        `INSERT INTO marketing_campaigns (title, body, channel, recipient_count, created_by)
         VALUES ($1, $2, 'whatsapp', $3, $4)`,
        [`WhatsApp Links — ${new Date().toLocaleDateString('pt-MZ')}`, message, links.length, req.user.id]
      );

      res.json({ mode: 'links', links, count: links.length });
    }
  } catch (err) {
    console.error('[POST /marketing/whatsapp-send]', err);
    res.status(500).json({ error: 'Erro ao enviar WhatsApp' });
  }
});

// GET /api/marketing/campaigns — histórico de campanhas
router.get('/campaigns', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, p.name as created_by_name
       FROM marketing_campaigns c
       LEFT JOIN profiles p ON p.id = c.created_by
       ORDER BY c.created_at DESC LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /marketing/campaigns]', err);
    res.status(500).json({ error: 'Erro ao buscar campanhas' });
  }
});

export default router;
