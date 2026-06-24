import { Resend } from 'resend';

// Lazy — evita crash no arranque ESM antes do dotenv carregar
let _resend = null;
function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key || key.startsWith('re_your')) return null;
  _resend = new Resend(key);
  return _resend;
}

const FROM = process.env.RESEND_FROM_EMAIL || 'NaturErva <noreply@natur-erva.co.mz>';
const APP_URL = (process.env.APP_URL || 'https://www.natur-erva.co.mz').replace(/\/$/, '');
const APP_NAME = 'NaturErva';

// ─── base HTML wrapper ────────────────────────────────────────────────────────
function baseTemplate(content) {
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${APP_NAME}</title>
<style>
  body{margin:0;padding:0;background:#f4f7f4;font-family:'Segoe UI',Arial,sans-serif;color:#222}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 24px;text-align:center}
  .header h1{margin:0;color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.5px}
  .header p{margin:4px 0 0;color:#bbf7d0;font-size:14px}
  .body{padding:32px 28px}
  .body h2{font-size:20px;font-weight:700;color:#15803d;margin:0 0 12px}
  .body p{margin:0 0 12px;font-size:15px;line-height:1.6;color:#444}
  .btn{display:inline-block;margin:16px 0;padding:14px 32px;background:#16a34a;color:#fff!important;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600}
  .box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin:16px 0}
  .box-item{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid #dcfce7}
  .box-item:last-child{border:none}
  .label{color:#6b7280}
  .value{font-weight:600;color:#111}
  .status-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600}
  .footer{background:#f9fafb;padding:20px 28px;text-align:center;border-top:1px solid #e5e7eb}
  .footer p{margin:0;font-size:12px;color:#9ca3af;line-height:1.6}
  .footer a{color:#16a34a;text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🌿 ${APP_NAME}</h1>
    <p>Saúde natural, entregue em sua porta</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} ${APP_NAME} · Moçambique<br>
    <a href="${APP_URL}">${APP_URL}</a><br>
    Recebeu este email porque tem uma conta em ${APP_NAME}.</p>
  </div>
</div>
</body></html>`;
}

function statusColor(status) {
  const map = {
    pending: '#f59e0b', processing: '#3b82f6', confirmed: '#8b5cf6',
    out_for_delivery: '#f97316', delivered: '#16a34a', completed: '#15803d',
    cancelled: '#ef4444'
  };
  return map[status] || '#6b7280';
}

function statusLabel(status) {
  const map = {
    pending: 'Pendente', processing: 'Em Processamento', confirmed: 'Confirmado',
    out_for_delivery: 'A Caminho', delivered: 'Entregue',
    completed: 'Concluído', cancelled: 'Cancelado'
  };
  return map[status] || status;
}

async function send(to, subject, html) {
  const client = getResend();
  if (!client) {
    console.warn('[Email] RESEND_API_KEY não configurado — email não enviado:', subject);
    return;
  }
  try {
    await client.emails.send({ from: FROM, to, subject, html });
    console.log(`[Email] Enviado: "${subject}" → ${to}`);
  } catch (err) {
    console.error('[Email] Erro ao enviar:', err.message);
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail({ name, email }) {
  const html = baseTemplate(`
    <h2>Bem-vindo(a), ${name}! 🎉</h2>
    <p>A sua conta na <strong>${APP_NAME}</strong> foi criada com sucesso. Estamos muito felizes em tê-lo(a) connosco!</p>
    <p>Explore os nossos produtos naturais e comece a sua jornada para uma vida mais saudável.</p>
    <div style="text-align:center">
      <a class="btn" href="${APP_URL}/loja">Ver Produtos</a>
    </div>
    <div class="box">
      <div class="box-item"><span class="label">Email</span><span class="value">${email}</span></div>
      <div class="box-item"><span class="label">Programa de Fidelidade</span><span class="value">1 ponto por cada 10 MT gasto</span></div>
    </div>
    <p style="font-size:13px;color:#6b7280">Se não criou esta conta, pode ignorar este email.</p>
  `);
  await send(email, `Bem-vindo(a) ao ${APP_NAME}!`, html);
}

export async function sendOrderConfirmationEmail({ to, name, orderNumber, items, totalAmount, isDelivery, deliveryLocation }) {
  const itemsHtml = (items || []).map(i =>
    `<div class="box-item"><span class="label">${i.name} × ${i.quantity}</span><span class="value">${Number(i.price * i.quantity).toFixed(2)} MT</span></div>`
  ).join('');

  const html = baseTemplate(`
    <h2>Pedido Confirmado! ✅</h2>
    <p>Olá <strong>${name}</strong>, recebemos o seu pedido e estamos a processá-lo.</p>
    <div class="box">
      <div class="box-item"><span class="label">Nº Pedido</span><span class="value">#${orderNumber}</span></div>
      ${itemsHtml}
      <div class="box-item"><span class="label">Entrega</span><span class="value">${isDelivery ? (deliveryLocation || 'Com entrega') : 'Levantamento'}</span></div>
      <div class="box-item"><span class="label"><strong>Total</strong></span><span class="value" style="color:#16a34a;font-size:16px"><strong>${Number(totalAmount).toFixed(2)} MT</strong></span></div>
    </div>
    <div style="text-align:center">
      <a class="btn" href="${APP_URL}/minha-conta/encomendas">Acompanhar Pedido</a>
    </div>
    <p>Entraremos em contacto em breve para confirmar os detalhes da entrega. Obrigado por escolher a ${APP_NAME}!</p>
  `);
  await send(to, `Pedido #${orderNumber} confirmado — ${APP_NAME}`, html);
}

export async function sendOrderStatusEmail({ to, name, orderNumber, status }) {
  const color = statusColor(status);
  const label = statusLabel(status);

  const messages = {
    processing: 'O seu pedido está a ser processado pela nossa equipa.',
    confirmed: 'O seu pedido foi confirmado e será preparado em breve.',
    out_for_delivery: '🚚 O seu pedido saiu para entrega! Esteja disponível para o receber.',
    delivered: '🎉 O seu pedido foi entregue! Esperamos que goste dos produtos.',
    completed: '✅ Pedido concluído. Obrigado pela sua preferência!',
    cancelled: 'O seu pedido foi cancelado. Se tiver questões, contacte-nos.',
  };

  const html = baseTemplate(`
    <h2>Atualização do Pedido #${orderNumber}</h2>
    <p>Olá <strong>${name}</strong>, temos uma atualização sobre o seu pedido.</p>
    <div style="text-align:center;margin:20px 0">
      <span class="status-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">
        ${label}
      </span>
    </div>
    <p>${messages[status] || `Estado atual: ${label}`}</p>
    <div style="text-align:center">
      <a class="btn" href="${APP_URL}/minha-conta/encomendas">Ver Pedido</a>
    </div>
  `);
  await send(to, `Pedido #${orderNumber} — ${label}`, html);
}

export async function sendPasswordResetEmail({ to, name, resetToken }) {
  const link = `${APP_URL}/reset-password?token=${resetToken}`;
  const html = baseTemplate(`
    <h2>Recuperação de Senha</h2>
    <p>Olá <strong>${name || 'utilizador'}</strong>, recebemos um pedido para redefinir a sua senha.</p>
    <p>Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong>1 hora</strong>.</p>
    <div style="text-align:center">
      <a class="btn" href="${link}">Redefinir Senha</a>
    </div>
    <p style="font-size:13px;color:#6b7280">Se não pediu a recuperação de senha, pode ignorar este email — a sua senha não será alterada.</p>
    <p style="font-size:12px;color:#9ca3af;word-break:break-all">Ou copie este link: ${link}</p>
  `);
  await send(to, `Recuperação de senha — ${APP_NAME}`, html);
}

export async function sendMarketingEmail({ to, subject, body, unsubscribeToken, attachments }) {
  const footer = unsubscribeToken
    ? `<p style="font-size:11px;color:#9ca3af;margin-top:8px">
        <a href="${APP_URL}/unsubscribe?token=${unsubscribeToken}" style="color:#9ca3af">Cancelar subscrição</a>
       </p>`
    : '';
  const html = baseTemplate(`${body}${footer}`);

  const client = getResend();
  if (!client) {
    console.warn('[Email] RESEND_API_KEY não configurado — email não enviado:', subject);
    return;
  }
  try {
    const payload = { from: FROM, to, subject, html };
    if (attachments?.length) {
      payload.attachments = attachments.map(a => ({
        filename: a.filename,
        content: a.content
      }));
    }
    await client.emails.send(payload);
    console.log(`[Email] Enviado: "${subject}" → ${to}`);
  } catch (err) {
    console.error('[Email] Erro ao enviar:', err.message);
  }
}

// ─── WhatsApp Business API ────────────────────────────────────────────────────

export async function sendWhatsAppMessage({ phone, message }) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.warn('[WhatsApp] Credenciais não configuradas');
    return { ok: false, error: 'WhatsApp Business API não configurado' };
  }

  // Normalizar número: garantir prefixo 258 (Moçambique)
  const cleaned = phone.replace(/\D/g, '');
  const fullPhone = cleaned.startsWith('258') ? cleaned : `258${cleaned}`;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: fullPhone,
          type: 'text',
          text: { body: message }
        })
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error('[WhatsApp] API error:', JSON.stringify(data));
      return { ok: false, error: data?.error?.message || 'Erro na API do WhatsApp' };
    }
    console.log(`[WhatsApp] Enviado → ${fullPhone}`);
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    console.error('[WhatsApp] Erro:', err.message);
    return { ok: false, error: err.message };
  }
}
