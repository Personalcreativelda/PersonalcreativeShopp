import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { generateDocumentPDF, generateReceiptPDF } from '../services/pdfService.js';

const router = Router();

const getTax = async () => {
  const { rows } = await pool.query('SELECT * FROM tax_config WHERE id = 1');
  const r = rows[0] || {};
  return {
    companyName:        r.company_name || 'NaturErva',
    companyNuit:        r.company_nuit || '',
    companyAddress:     r.company_address || '',
    companyPhone:       r.company_phone || '',
    companyEmail:       r.company_email || '',
    vatRate:            Number(r.vat_rate || 16),
    invoicePrefix:      r.invoice_prefix || 'FACT',
    bankName:           r.bank_name || '',
    bankAccount:        r.bank_account || '',
    bankIban:           r.bank_iban || '',
    bankAccountHolder:  r.bank_account_holder || '',
    bankAccounts:       Array.isArray(r.bank_accounts) ? r.bank_accounts : [],
    logoUrl:            r.logo_url || '',
  };
};

const send = (res, buf, filename) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
};

// GET /api/pdf/order/:id — fatura de encomenda
router.get('/order/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM orders WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Encomenda não encontrada' });
    const o   = rows[0];
    const tax = await getTax();

    const items = (o.items || []).map(i => ({
      name:       i.productName || i.name || '',
      variantName: i.variantName,
      quantity:   i.quantity || 1,
      unitPrice:  Number(i.price || 0),
      vatRate:    tax.vatRate,
    }));

    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const buf = await generateDocumentPDF({
      type:   'invoice',
      number: o.order_number || `${tax.invoicePrefix}-${o.id.slice(0, 8).toUpperCase()}`,
      doc:    { customerName: o.customer_name, customerPhone: o.customer_phone, notes: o.notes },
      taxConfig: tax,
      items,
      totals: {
        subtotal,
        discount:    Number(o.discount_amount || 0),
        deliveryFee: Number(o.delivery_fee    || 0),
        total:       Number(o.total_amount    || 0),
        vatRate:     tax.vatRate,
      },
    });
    send(res, buf, `fatura-${o.order_number || o.id.slice(0, 8)}.pdf`);
  } catch (err) { console.error('[PDF/order]', err); res.status(500).json({ error: err.message }); }
});

// GET /api/pdf/invoice/:id — fatura formal (tabela invoices)
router.get('/invoice/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, o.order_number FROM invoices i LEFT JOIN orders o ON o.id = i.order_id WHERE i.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Fatura não encontrada' });
    const inv = rows[0];
    const tax = await getTax();

    const items = (inv.items || []).map(i => ({
      name:       i.name || i.productName || '',
      variantName: i.variantName,
      quantity:   i.quantity || 1,
      unitPrice:  Number(i.unitPrice || i.price || 0),
      vatRate:    tax.vatRate,
    }));

    const subtotal = Number(inv.subtotal || 0);
    const buf = await generateDocumentPDF({
      type:   'invoice',
      number: inv.invoice_number,
      doc: {
        customerName:    inv.customer_name,
        customerPhone:   inv.customer_phone,
        customerEmail:   inv.customer_email,
        customerNuit:    inv.customer_nuit,
        customerAddress: inv.customer_address,
        notes:           inv.notes,
      },
      taxConfig: tax,
      items,
      totals: {
        subtotal,
        discount:    Number(inv.discount_amount || 0),
        deliveryFee: Number(inv.delivery_fee    || 0),
        total:       Number(inv.total_amount    || 0),
        vatRate:     tax.vatRate,
      },
    });
    send(res, buf, `fatura-${inv.invoice_number}.pdf`);
  } catch (err) { console.error('[PDF/invoice]', err); res.status(500).json({ error: err.message }); }
});

// GET /api/pdf/quote/:id — orçamento
router.get('/quote/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Orçamento não encontrado' });
    const q   = rows[0];
    const tax = await getTax();

    const items = (q.items || []).map(i => ({
      name:       i.name || i.productName || '',
      variantName: i.variantName,
      quantity:   i.quantity || 1,
      unitPrice:  Number(i.unitPrice || i.price || 0),
      vatRate:    tax.vatRate,
    }));

    const buf = await generateDocumentPDF({
      type:   'quote',
      number: q.quote_number,
      doc: {
        customerName:  q.customer_name,
        customerPhone: q.customer_phone,
        customerNuit:  q.customer_nuit,
        customerEmail: q.customer_email,
        notes:         q.notes,
      },
      taxConfig: tax,
      items,
      totals: {
        subtotal:    Number(q.subtotal),
        discount:    Number(q.discount),
        deliveryFee: 0,
        total:       Number(q.total),
        vatRate:     tax.vatRate,
      },
      extra: {
        validUntil: q.valid_until
          ? new Date(q.valid_until).toLocaleDateString('pt-MZ') : null,
      },
    });
    send(res, buf, `orcamento-${q.quote_number}.pdf`);
  } catch (err) { console.error('[PDF/quote]', err); res.status(500).json({ error: err.message }); }
});

// GET /api/pdf/pos-session/:id?format=A4|80mm — recibo de sessão POS
router.get('/pos-session/:id', authMiddleware, async (req, res) => {
  try {
    const format = req.query.format === '80mm' ? '80mm' : 'A4';
    const { rows: sessions } = await pool.query('SELECT * FROM pos_sessions WHERE id = $1', [req.params.id]);
    if (!sessions.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    const session = sessions[0];

    const { rows: orders } = await pool.query(
      `SELECT * FROM orders
       WHERE source = 'pos'
         AND created_at >= $1
         AND (($2::timestamptz IS NULL) OR created_at <= $2)
         AND status NOT IN ('cancelled')
       ORDER BY created_at ASC`,
      [session.opened_at, session.closed_at || null]
    );

    const tax = await getTax();
    const buf = await generateReceiptPDF({ session, orders, taxConfig: tax, format });
    const date = new Date(session.opened_at).toISOString().slice(0, 10);
    send(res, buf, `sessao-pos-${date}.pdf`);
  } catch (err) { console.error('[PDF/pos-session]', err); res.status(500).json({ error: err.message }); }
});

// GET /api/pdf/vat-report?month=YYYY-MM — relatório de IVA mensal em PDF
router.get('/vat-report', authMiddleware, async (req, res) => {
  try {
    const month = (req.query.month || new Date().toISOString().slice(0, 7));
    const from  = `${month}-01`;
    const toDate = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0);
    const to    = toDate.toISOString().slice(0, 10);
    const tax   = await getTax();
    const vatRate = tax.vatRate;

    const { rows } = await pool.query(
      `SELECT o.order_number, o.created_at, o.customer_name,
              o.payment_method, o.total_amount, o.discount_amount
       FROM orders o
       WHERE o.created_at::date >= $1 AND o.created_at::date <= $2
         AND o.status NOT IN ('cancelled')
       ORDER BY o.created_at ASC`,
      [from, to]
    );

    const totalRevenue = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const totalVat     = totalRevenue * vatRate / (100 + vatRate);
    const totalNet     = totalRevenue - totalVat;

    // Build the PDF inline using the same pdfkit dependency
    const { default: PDFDocument } = await import('pdfkit');
    const pdf = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    pdf.on('data', c => chunks.push(c));

    await new Promise((ok, err) => {
      pdf.on('end', ok);
      pdf.on('error', err);

      const PW = pdf.page.width - 100;
      const LM = 50;

      // Title
      pdf.fontSize(16).fillColor('#059669').text(tax.companyName || 'NaturErva', LM, 50);
      pdf.fontSize(8).fillColor('#6e6e73');
      if (tax.companyNuit) pdf.text(`NUIT: ${tax.companyNuit}`);
      pdf.fontSize(16).fillColor('#1d1d1f').text('RELATÓRIO DE IVA', LM, 50, { align: 'right', width: PW });
      pdf.fontSize(9).fillColor('#6e6e73').text(`Período: ${month}`, LM, 72, { align: 'right', width: PW });
      pdf.moveTo(LM, 115).lineTo(LM + PW, 115).strokeColor('#d2d2d7').lineWidth(1).stroke();

      // KPI cards
      let y = 130;
      const cw = (PW - 20) / 3;
      const card = (x, bg, label, value, color) => {
        pdf.rect(x, y, cw, 52).fillColor(bg).fill();
        pdf.fontSize(8).fillColor('#6e6e73').text(label, x + 8, y + 7);
        pdf.fontSize(13).fillColor(color).font('Helvetica-Bold').text(value, x + 8, y + 22, { width: cw - 16 });
        pdf.font('Helvetica');
      };
      card(LM,          '#f0fdf4', 'TOTAL BRUTO',       `${totalRevenue.toFixed(2)} MT`, '#059669');
      card(LM + cw + 10, '#fef3c7', `IVA (${vatRate}%)`, `${totalVat.toFixed(2)} MT`,     '#d97706');
      card(LM + (cw+10)*2,'#eff6ff', 'BASE TRIBUTÁVEL',   `${totalNet.toFixed(2)} MT`,     '#2563eb');
      y += 62;
      pdf.fontSize(8).fillColor('#1d1d1f').text(`Nº de documentos: ${rows.length}`, LM, y);
      y += 20;

      // Table header
      pdf.rect(LM, y, PW, 18).fillColor('#059669').fill();
      pdf.fontSize(7.5).fillColor('#ffffff');
      pdf.text('Nº DOC',   LM + 4, y + 5, { width: 70 });
      pdf.text('DATA',     LM + 80, y + 5, { width: 65 });
      pdf.text('CLIENTE',  LM + 152, y + 5, { width: 130 });
      pdf.text('BASE',     LM + PW - 130, y + 5, { width: 58, align: 'right' });
      pdf.text('IVA',      LM + PW - 68,  y + 5, { width: 38, align: 'right' });
      pdf.text('TOTAL',    LM + PW - 28,  y + 5, { width: 40, align: 'right' });
      y += 20;

      let alt = false;
      for (const r of rows) {
        if (y > pdf.page.height - 80) { pdf.addPage(); y = 50; }
        if (alt) pdf.rect(LM, y, PW, 14).fillColor('#f9fafb').fill();
        alt = !alt;

        const tot = Number(r.total_amount || 0);
        const vat = tot * vatRate / (100 + vatRate);
        const net = tot - vat;

        pdf.fontSize(7.5).fillColor('#1d1d1f');
        pdf.text(r.order_number || r.id?.slice(0, 8) || '—', LM + 4, y + 3, { width: 70 });
        pdf.text(new Date(r.created_at).toLocaleDateString('pt-MZ'), LM + 80, y + 3, { width: 65 });
        pdf.text(r.customer_name || '—', LM + 152, y + 3, { width: 130, ellipsis: true });
        pdf.fillColor('#6e6e73');
        pdf.text(net.toFixed(2), LM + PW - 130, y + 3, { width: 58, align: 'right' });
        pdf.text(vat.toFixed(2), LM + PW - 68,  y + 3, { width: 38, align: 'right' });
        pdf.fillColor('#1d1d1f').text(tot.toFixed(2), LM + PW - 28, y + 3, { width: 40, align: 'right' });
        y += 14;
      }

      // Totals row
      y += 6;
      pdf.moveTo(LM + PW - 165, y).lineTo(LM + PW, y).strokeColor('#059669').lineWidth(1).stroke(); y += 6;
      pdf.fontSize(8).font('Helvetica-Bold').fillColor('#6e6e73').text('TOTAIS:', LM + PW - 165, y);
      pdf.text(totalNet.toFixed(2),     LM + PW - 130, y, { width: 58, align: 'right' });
      pdf.text(totalVat.toFixed(2),     LM + PW - 68,  y, { width: 38, align: 'right' });
      pdf.fillColor('#059669').text(totalRevenue.toFixed(2), LM + PW - 28, y, { width: 40, align: 'right' });
      pdf.font('Helvetica');

      // Footer
      const FY = pdf.page.height - 48;
      pdf.moveTo(LM, FY).lineTo(LM + PW, FY).strokeColor('#d2d2d7').lineWidth(0.5).stroke();
      pdf.fontSize(6.5).fillColor('#6e6e73')
        .text(`Gerado em ${new Date().toLocaleString('pt-MZ')} · ${tax.companyName} NUIT: ${tax.companyNuit}`, LM, FY + 8, { align: 'center', width: PW });

      pdf.end();
    });

    const buf = Buffer.concat(chunks);
    send(res, buf, `relatorio-iva-${month}.pdf`);
  } catch (err) { console.error('[PDF/vat-report]', err); res.status(500).json({ error: err.message }); }
});

export default router;
