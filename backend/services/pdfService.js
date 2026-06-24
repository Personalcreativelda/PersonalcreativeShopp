import PDFDocument from 'pdfkit';

const C = {
  primary: '#059669',
  dark:    '#1d1d1f',
  muted:   '#6e6e73',
  light:   '#f5f5f7',
  border:  '#d2d2d7',
  white:   '#ffffff',
};

const MT = (n) => `${Number(n).toFixed(2)} MT`;

/** Builds a professional A4 invoice / quote PDF. Returns a Buffer. */
export async function generateDocumentPDF({ type, number, doc, taxConfig, items, totals, extra = {} }) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    pdf.on('data', c => chunks.push(c));
    pdf.on('end',  () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const PW = pdf.page.width - 100;
    const LM = 50;

    // ── Header ──────────────────────────────────────────────────────────────
    pdf.fontSize(18).fillColor(C.primary).text(taxConfig.companyName || 'NaturErva', LM, 50);
    pdf.fontSize(8).fillColor(C.muted);
    if (taxConfig.companyNuit)    pdf.text(`NUIT: ${taxConfig.companyNuit}`);
    if (taxConfig.companyAddress) pdf.text(taxConfig.companyAddress);
    if (taxConfig.companyPhone)   pdf.text(`Tel: ${taxConfig.companyPhone}`);
    if (taxConfig.companyEmail)   pdf.text(taxConfig.companyEmail);

    const typeLabel = { invoice: 'FATURA', quote: 'ORÇAMENTO', vd: 'VENDA A DINHEIRO', receipt: 'RECIBO' }[type] || 'DOCUMENTO';
    pdf.fontSize(22).fillColor(C.dark).text(typeLabel, LM, 50, { align: 'right', width: PW });
    pdf.fontSize(9).fillColor(C.muted).text(number, LM, 82, { align: 'right', width: PW });
    const dateStr = new Date().toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    pdf.text(`Data: ${dateStr}`, LM, 95, { align: 'right', width: PW });
    if (extra.validUntil) pdf.text(`Válido até: ${extra.validUntil}`, LM, 108, { align: 'right', width: PW });

    pdf.moveTo(LM, 145).lineTo(LM + PW, 145).strokeColor(C.border).lineWidth(1).stroke();

    // ── Client ──────────────────────────────────────────────────────────────
    let y = 160;
    pdf.fontSize(7).fillColor(C.muted).text('CLIENTE', LM, y);  y += 13;
    pdf.fontSize(10).fillColor(C.dark).text(doc.customerName || 'Cliente', LM, y);  y += 13;
    pdf.fontSize(8).fillColor(C.muted);
    if (doc.customerNuit)  { pdf.text(`NUIT: ${doc.customerNuit}`,   LM, y); y += 11; }
    if (doc.customerPhone) { pdf.text(`Tel: ${doc.customerPhone}`,   LM, y); y += 11; }
    if (doc.customerEmail) { pdf.text(`Email: ${doc.customerEmail}`, LM, y); y += 11; }

    // ── Items table ─────────────────────────────────────────────────────────
    y += 18;
    const C1 = LM, C2 = LM + PW * 0.50, C3 = LM + PW * 0.63, C4 = LM + PW * 0.76, C5 = LM + PW * 0.88;

    pdf.rect(LM, y, PW, 20).fillColor(C.primary).fill();
    pdf.fontSize(7.5).fillColor(C.white);
    pdf.text('DESCRIÇÃO',  C1 + 4, y + 6);
    pdf.text('QTD',        C2 + 4, y + 6, { width: 45 });
    pdf.text('PREÇO UNIT', C3 + 4, y + 6, { width: 60 });
    pdf.text('IVA%',       C4 + 4, y + 6, { width: 45 });
    pdf.text('TOTAL',      C5 + 4, y + 6, { width: 55 });
    y += 22;

    let rowAlt = false;
    for (const item of items) {
      if (y > pdf.page.height - 120) { pdf.addPage(); y = 50; }
      const H = 20;
      if (rowAlt) pdf.rect(LM, y, PW, H).fillColor('#f9fafb').fill();
      rowAlt = !rowAlt;

      const name   = item.name || item.productName || '';
      const vrnt   = item.variantName ? ` (${item.variantName})` : '';
      const qty    = item.quantity || 1;
      const price  = Number(item.unitPrice || item.price || 0);
      const vatPct = item.vatRate ?? taxConfig.vatRate ?? 16;
      const line   = qty * price;

      pdf.fontSize(7.5).fillColor(C.dark);
      pdf.text(`${name}${vrnt}`, C1 + 4, y + 6, { width: C2 - C1 - 8, ellipsis: true });
      pdf.text(String(qty),            C2 + 4, y + 6, { width: 45 });
      pdf.text(MT(price),              C3 + 4, y + 6, { width: 60 });
      pdf.text(`${vatPct}%`,           C4 + 4, y + 6, { width: 45 });
      pdf.text(MT(line),               C5 + 4, y + 6, { width: 55 });
      y += H;
      pdf.moveTo(LM, y).lineTo(LM + PW, y).strokeColor(C.border).lineWidth(0.3).stroke();
    }

    // ── Totals ──────────────────────────────────────────────────────────────
    y += 12;
    const TW = 190, TX = LM + PW - TW;
    const line = (label, val, color = C.dark, bold = false) => {
      if (bold) pdf.font('Helvetica-Bold'); else pdf.font('Helvetica');
      pdf.fontSize(bold ? 10 : 8).fillColor(C.muted).text(label, TX, y);
      pdf.fillColor(color).text(val, TX, y, { width: TW, align: 'right' });
      y += bold ? 16 : 13;
    };

    line('Subtotal:',                    MT(totals.subtotal));
    if (totals.discount > 0)
      line('Desconto:', `-${MT(totals.discount)}`, '#e53e3e');
    if ((totals.deliveryFee || 0) > 0)
      line('Taxa de entrega:', MT(totals.deliveryFee));

    const vatRate = totals.vatRate ?? taxConfig.vatRate ?? 16;
    const vatAmt  = totals.total * vatRate / (100 + vatRate);
    line(`IVA (${vatRate}%):`, MT(vatAmt));

    pdf.moveTo(TX, y).lineTo(TX + TW, y).strokeColor(C.primary).lineWidth(1.5).stroke(); y += 6;
    line('TOTAL:', MT(totals.total), C.primary, true);

    // ── Bank info ───────────────────────────────────────────────────────────
    const banks = (taxConfig.bankAccounts?.length > 0)
      ? taxConfig.bankAccounts
      : (taxConfig.bankAccount ? [{ bankName: taxConfig.bankName, account: taxConfig.bankAccount, iban: taxConfig.bankIban, holder: taxConfig.bankAccountHolder }] : []);

    if (banks.length > 0) {
      y += 8;
      pdf.moveTo(LM, y).lineTo(LM + PW, y).strokeColor(C.border).lineWidth(0.5).stroke(); y += 10;
      pdf.fontSize(7).fillColor(C.muted).text('DADOS BANCÁRIOS', LM, y); y += 12;
      for (const b of banks) {
        pdf.fontSize(8).fillColor(C.dark);
        if (b.bankName)  { pdf.text(b.bankName,         LM, y); y += 11; }
        if (b.account)   { pdf.fillColor(C.muted).text(`Conta: ${b.account}`,   LM, y); y += 10; }
        if (b.iban)      { pdf.text(`IBAN: ${b.iban}`,   LM, y); y += 10; }
        if (b.holder)    { pdf.text(`Titular: ${b.holder}`, LM, y); y += 10; }
        y += 4;
      }
    }

    // ── Notes ───────────────────────────────────────────────────────────────
    if (doc.notes) {
      y += 6;
      pdf.fontSize(7).fillColor(C.muted).text('OBSERVAÇÕES:', LM, y); y += 11;
      pdf.fontSize(8).fillColor(C.dark).text(doc.notes, LM, y, { width: PW });
    }

    // ── Footer ──────────────────────────────────────────────────────────────
    const FY = pdf.page.height - 55;
    pdf.moveTo(LM, FY).lineTo(LM + PW, FY).strokeColor(C.border).lineWidth(0.5).stroke();
    pdf.fontSize(6.5).fillColor(C.muted)
      .text(`${taxConfig.companyName} · NUIT: ${taxConfig.companyNuit} · ${taxConfig.companyAddress}`, LM, FY + 8, { align: 'center', width: PW })
      .text('Documento gerado automaticamente pelo sistema NaturErva ERP', LM, FY + 20, { align: 'center', width: PW });

    pdf.end();
  });
}

/** Generates a POS session receipt. format: 'A4' | '80mm' */
export async function generateReceiptPDF({ session, orders, taxConfig, format = 'A4' }) {
  return new Promise((resolve, reject) => {
    const is80 = format === '80mm';
    const pageW = is80 ? 226.77 : 595.28;
    const M     = is80 ? 12 : 50;
    const UW    = pageW - M * 2;
    const pdf   = new PDFDocument({ margin: M, size: is80 ? [226.77, 841.89] : 'A4' });
    const chunks = [];
    pdf.on('data', c => chunks.push(c));
    pdf.on('end',  () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    let y = M;
    const fs = (n) => pdf.fontSize(is80 ? n * 0.8 : n);

    // Header
    fs(14).fillColor(C.primary).text(taxConfig.companyName || 'NaturErva', M, y, { align: 'center', width: UW }); y += is80 ? 16 : 22;
    fs(8).fillColor(C.muted);
    if (taxConfig.companyNuit)  { pdf.text(`NUIT: ${taxConfig.companyNuit}`, M, y, { align: 'center', width: UW }); y += 11; }
    if (taxConfig.companyPhone) { pdf.text(`Tel: ${taxConfig.companyPhone}`, M, y, { align: 'center', width: UW }); y += 11; }
    y += 5;
    pdf.moveTo(M, y).lineTo(M + UW, y).strokeColor(C.border).lineWidth(0.5).stroke(); y += 8;

    // Session info
    fs(8).fillColor(C.dark);
    pdf.text(`Sessão: ${new Date(session.openedAt || session.opened_at).toLocaleString('pt-MZ')}`, M, y, { width: UW }); y += 11;
    pdf.text(`Operador: ${session.cashierName || session.cashier_name}`, M, y, { width: UW }); y += 11;
    pdf.text(`Total de vendas: ${orders.length}`, M, y, { width: UW }); y += 18;

    // Orders
    for (const order of orders) {
      if (y > pdf.page.height - 80) { pdf.addPage(); y = M; }
      fs(8).fillColor(C.dark);
      pdf.text(
        `#${order.orderNumber || order.order_number} — ${new Date(order.createdAt || order.created_at).toLocaleTimeString('pt-MZ')}`,
        M, y, { width: UW }
      ); y += 11;

      for (const item of (order.items || [])) {
        const name = `${item.productName || item.name}${item.variantName ? ` (${item.variantName})` : ''}`;
        fs(7).fillColor(C.muted).text(`  ${item.quantity}x ${name}`, M, y, { width: UW * 0.72 });
        pdf.text(MT(item.quantity * item.price), M, y, { width: UW, align: 'right' }); y += 10;
      }

      fs(8).fillColor(C.primary);
      pdf.text(MT(order.totalAmount || order.total_amount || 0), M, y, { width: UW, align: 'right' });
      pdf.fillColor(C.muted).text(`Pgto: ${order.paymentMethod || 'dinheiro'}`, M, y); y += 14;
      pdf.moveTo(M, y).lineTo(M + UW, y).strokeColor(C.border).lineWidth(0.3).stroke(); y += 8;
    }

    // Summary
    y += 6;
    pdf.moveTo(M, y).lineTo(M + UW, y).strokeColor(C.primary).lineWidth(1.2).stroke(); y += 10;
    fs(10).fillColor(C.dark).font('Helvetica-Bold').text('RESUMO DA SESSÃO', M, y, { align: 'center', width: UW }); y += 16;
    pdf.font('Helvetica');

    const summary = session.summary || {};
    for (const m of (summary.byMethod || [])) {
      const lbl = { cash: 'Dinheiro', mpesa: 'M-Pesa', transfer: 'Transferência' }[m.method] || m.method;
      fs(8).fillColor(C.muted).text(`${lbl} (${m.count}x):`, M, y, { width: UW * 0.65 });
      pdf.fillColor(C.dark).text(MT(m.total), M, y, { width: UW, align: 'right' }); y += 12;
    }

    y += 4;
    pdf.moveTo(M, y).lineTo(M + UW, y).strokeColor(C.border).lineWidth(0.5).stroke(); y += 8;
    fs(11).fillColor(C.primary).font('Helvetica-Bold');
    pdf.text('TOTAL GERAL:', M, y, { width: UW * 0.6 });
    pdf.text(MT(summary.totalSales || 0), M, y, { width: UW, align: 'right' }); y += 16;
    pdf.font('Helvetica');
    fs(8).fillColor(C.muted);
    pdf.text(`Fundo inicial: ${MT(session.initialAmount || session.initial_amount || 0)}`, M, y, { width: UW }); y += 11;
    pdf.text(`Caixa esperada: ${MT(summary.expectedCash || 0)}`, M, y, { width: UW }); y += 20;

    fs(7).fillColor(C.muted).text('NaturErva ERP — Obrigado!', M, y, { align: 'center', width: UW });
    pdf.end();
  });
}
