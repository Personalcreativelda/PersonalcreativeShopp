import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Minus, ShoppingCart, CheckCircle, X, Printer, Store, LogOut, Clock, ScanLine, Smartphone, Wifi, ChevronLeft } from 'lucide-react';
import api from '../../core/services/apiClient';
import { orderService } from '../services/orderService';
import { Product, OrderItem, OrderStatus } from '../../core/types/types';
import type { Toast } from '../../core/components/ui/Toast';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { getEffectivePrice } from '../../core/utils/pricing';

interface POSProps {
 showToast?: (msg: string, type: Toast['type']) => void;
}

// ── Types ──────────────────────────────────────────────────────────────────────
type CartItem = {
 productId: string; productName: string;
 variantId?: string; variantName?: string;
 price: number; quantity: number; unit: string; maxStock: number;
 image?: string;
 isPromo?: boolean;
 originalPrice?: number;
};
type PayMethod = 'cash' | 'mpesa' | 'transfer';
type SaleReceipt = {
 orderNumber: string; items: CartItem[];
 subtotal: number; discount: number; total: number;
 paid: number; change: number; payMethod: PayMethod;
 customerName: string; customerPhone?: string; date: string;
};
type TaxConfig = {
 companyName: string; companyNuit: string; companyAddress: string;
 companyPhone: string; companyEmail: string;
 vatRate: number; invoicePrefix: string;
 vdPrefix?: string; quotePrefix?: string;
 logoUrl?: string;
};
type PosSession = {
 id: string; cashier_name: string; cashier_id: string;
 opened_at: string; closed_at?: string; initial_amount: number; is_open: boolean;
};
type ByMethod = { method: string; count: number; total: number };
type CloseReport = {
 session: PosSession;
 summary: { totalSales: number; totalOrders: number; byMethod: ByMethod[]; expectedCash: number };
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const TZ = 'Africa/Maputo';

// Beep de scanner POS via Web Audio API
function playScanBeep(type: 'ok' | 'error' = 'ok') {
 try {
 const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
 if (!AudioCtx) return;
 const ctx = new AudioCtx();
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.connect(gain);
 gain.connect(ctx.destination);
 if (type === 'ok') {
 osc.type = 'sine';
 osc.frequency.setValueAtTime(1850, ctx.currentTime);
 gain.gain.setValueAtTime(0.35, ctx.currentTime);
 gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
 osc.start(ctx.currentTime);
 osc.stop(ctx.currentTime + 0.12);
 } else {
 // Dois beeps curtos descendentes para erro
 osc.type = 'square';
 osc.frequency.setValueAtTime(600, ctx.currentTime);
 osc.frequency.setValueAtTime(400, ctx.currentTime + 0.1);
 gain.gain.setValueAtTime(0.2, ctx.currentTime);
 gain.gain.setValueAtTime(0.2, ctx.currentTime + 0.1);
 gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
 osc.start(ctx.currentTime);
 osc.stop(ctx.currentTime + 0.22);
 }
 osc.onended = () => ctx.close();
 } catch {}
}
const PAY_LABELS: Record<string, string> = { cash: 'Dinheiro', mpesa: 'M-Pesa', transfer: 'Transferência' };
const fmt = (n: number | string | undefined | null) => `MT ${Number(n ?? 0).toFixed(2)}`;
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const nowMaputo = () => new Date().toLocaleString('pt-PT', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDuration = (from: string) => {
 const mins = Math.floor((Date.now() - new Date(from).getTime()) / 60000);
 return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

function printReceipt(r: SaleReceipt, vatRate = 16, logoUrl = `${window.location.origin}/logo.png`) {
 const vatMult = 1 + vatRate / 100;
 const baseIva = r.total / vatMult;
 const ivaAmt = r.total - baseIva;

 const rows = r.items.map(c =>
 `<tr><td style="padding:3px 0">${c.productName}${c.variantName ? ' · ' + c.variantName : ''}${c.isPromo ? ' <span style="font-size:9px;background:#fff3cd;color:#b45309;padding:1px 3px;border-radius:3px">PROMO</span>' : ''}</td>
 <td style="padding:3px 4px;white-space:nowrap">${c.quantity} ${c.unit}</td>
 <td style="padding:3px 0;text-align:right;white-space:nowrap">${c.isPromo && c.originalPrice ? `<span style="text-decoration:line-through;color:#999;font-size:10px">MT ${(c.originalPrice * c.quantity).toFixed(2)}</span><br>` : ''}MT ${(c.price * c.quantity).toFixed(2)}</td></tr>`
 ).join('');
 const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo #${r.orderNumber}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:12px}.c{text-align:center}.b{font-weight:bold}.lg{font-size:15px}hr{border:none;border-top:1px dashed #000;margin:7px 0}table{width:100%;border-collapse:collapse}.totrow{font-weight:bold;font-size:13px}.iva{font-size:10px;color:#666}img.logo{display:block;margin:0 auto 6px;max-width:120px;max-height:60px;object-fit:contain}</style>
</head><body>
<div class="c"><img class="logo" src="${logoUrl}" alt="Logo" onerror="this.style.display='none'"><p class="b lg">NATUR ERVA</p><p>natural é saudável</p><p>${r.date}</p><p>Recibo #${r.orderNumber}</p>
${r.customerName !== 'Cliente POS' ? `<p>Cliente: ${r.customerName}</p>` : ''}</div>
<hr><table>${rows}</table><hr>
<table>
 ${r.discount > 0 ? `<tr><td>Subtotal:</td><td style="text-align:right">MT ${r.subtotal.toFixed(2)}</td></tr><tr><td>Desconto:</td><td style="text-align:right">- MT ${r.discount.toFixed(2)}</td></tr>` : ''}
 <tr class="totrow"><td>TOTAL c/IVA:</td><td style="text-align:right">MT ${r.total.toFixed(2)}</td></tr>
 <tr class="iva"><td> Base s/IVA (${vatRate}%):</td><td style="text-align:right">MT ${baseIva.toFixed(2)}</td></tr>
 <tr class="iva"><td> IVA ${vatRate}%:</td><td style="text-align:right">MT ${ivaAmt.toFixed(2)}</td></tr>
</table><hr>
<table>
 <tr><td>${PAY_LABELS[r.payMethod] || r.payMethod}:</td><td style="text-align:right">MT ${r.paid.toFixed(2)}</td></tr>
 ${r.change > 0 ? `<tr><td>Troco:</td><td style="text-align:right">MT ${r.change.toFixed(2)}</td></tr>` : ''}
</table><hr>
<div class="c"><p>Obrigado pela sua compra!</p><p>IVA incluído à taxa de ${vatRate}%</p></div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script>
</body></html>`;
 const win = window.open('', '_blank', 'width=360,height=680');
 if (win) { win.document.write(html); win.document.close(); }
}

function printInvoice(r: SaleReceipt, tax: TaxConfig, invoiceNumber: string, logoUrl = `${window.location.origin}/logo.png`) {
 const vatMult = 1 + tax.vatRate / 100;
 const baseIva = r.total / vatMult;
 const ivaAmt = r.total - baseIva;

 const rows = r.items.map(c => {
 const lineTotal = c.price * c.quantity;
 const lineBase = lineTotal / vatMult;
 const lineIva = lineTotal - lineBase;
 return `<tr>
 <td>${c.productName}${c.variantName ? ` (${c.variantName})` : ''}${c.isPromo ? ' <span style="font-size:9px;background:#fff3cd;color:#b45309;padding:1px 4px;border-radius:3px;font-weight:600">PROMO</span>' : ''}</td>
 <td class="r">${c.quantity} ${c.unit}</td>
 <td class="r">${c.isPromo && c.originalPrice ? `<span style="text-decoration:line-through;color:#bbb;font-size:10px">MT ${(c.originalPrice / vatMult).toFixed(2)}</span><br>` : ''}MT ${(c.price / vatMult).toFixed(2)}</td>
 <td class="r">${tax.vatRate}%</td>
 <td class="r">MT ${lineIva.toFixed(2)}</td>
 <td class="r">MT ${lineTotal.toFixed(2)}</td>
 </tr>`;
 }).join('');

 const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Factura ${invoiceNumber}</title>
<style>
 *{margin:0;padding:0;box-sizing:border-box}
 body{font-family:Arial,sans-serif;font-size:12px;padding:32px;color:#111}
 .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
 .company{font-size:20px;font-weight:700;color:#16a34a}
 .invoice-num{font-size:14px;font-weight:600;color:#555}
 .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
 .info-box{background:#f9f9f9;border:1px solid #e5e7eb;border-radius:8px;padding:12px}
 .info-box h4{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:6px;letter-spacing:.5px}
 table{width:100%;border-collapse:collapse;margin-bottom:16px}
 th{background:#16a34a;color:#fff;padding:8px;font-size:11px;text-align:left}
 td{padding:7px 8px;font-size:11px;border-bottom:1px solid #e5e7eb}
 .r{text-align:right}
 .totals{margin-left:auto;width:280px}
 .totals td{padding:5px 8px;font-size:12px}
 .totals .bold{font-weight:700;font-size:14px}
 .totals .green{color:#16a34a}
 .footer{margin-top:32px;font-size:10px;color:#999;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px}
</style></head><body>
<div class="header">
 <div style="display:flex;align-items:center;gap:14px">
 <img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'" style="max-width:100px;max-height:60px;object-fit:contain;display:block">
 <div>
 <div class="company">${tax.companyName}</div>
 <div style="font-size:11px;color:#666;margin-top:4px">NUIT: ${tax.companyNuit || '—'}</div>
 <div style="font-size:11px;color:#666">${tax.companyAddress || ''}</div>
 <div style="font-size:11px;color:#666">${tax.companyPhone || ''} | ${tax.companyEmail || ''}</div>
 </div>
 </div>
 <div style="text-align:right">
 <div style="font-size:18px;font-weight:700;color:#111">FACTURA</div>
 <div class="invoice-num">${invoiceNumber}</div>
 <div style="font-size:11px;color:#666;margin-top:4px">Data: ${r.date}</div>
 </div>
</div>

<div class="info-grid">
 <div class="info-box">
 <h4>Emitida por</h4>
 <p><strong>${tax.companyName}</strong></p>
 <p>NUIT: ${tax.companyNuit || '—'}</p>
 <p>${tax.companyAddress || ''}</p>
 </div>
 <div class="info-box">
 <h4>Cliente</h4>
 <p><strong>${r.customerName}</strong></p>
 ${r.customerPhone ? `<p>Tel: ${r.customerPhone}</p>` : ''}
 <p>NUIT: —</p>
 </div>
</div>

<table>
 <thead><tr>
 <th>Descrição</th><th class="r">Qty</th><th class="r">Preço s/IVA</th>
 <th class="r">IVA</th><th class="r">Valor IVA</th><th class="r">Total c/IVA</th>
 </tr></thead>
 <tbody>${rows}</tbody>
</table>

<table class="totals">
 ${r.discount > 0 ? `<tr><td>Subtotal:</td><td class="r">MT ${r.subtotal.toFixed(2)}</td></tr><tr><td>Desconto:</td><td class="r">- MT ${r.discount.toFixed(2)}</td></tr>` : ''}
 <tr><td>Base tributável s/IVA:</td><td class="r">MT ${baseIva.toFixed(2)}</td></tr>
 <tr><td>IVA ${tax.vatRate}%:</td><td class="r">MT ${ivaAmt.toFixed(2)}</td></tr>
 <tr class="bold"><td>TOTAL c/IVA:</td><td class="r green">MT ${r.total.toFixed(2)}</td></tr>
 <tr><td style="color:#666">${PAY_LABELS[r.payMethod] || r.payMethod} recebido:</td><td class="r" style="color:#666">MT ${r.paid.toFixed(2)}</td></tr>
 ${r.change > 0 ? `<tr><td style="color:#666">Troco:</td><td class="r" style="color:#666">MT ${r.change.toFixed(2)}</td></tr>` : ''}
</table>

<div class="footer">
 Documento emitido por ${tax.companyName} | NUIT ${tax.companyNuit || '—'} | IVA incluído à taxa de ${tax.vatRate}%<br>
 ${invoiceNumber} | ${r.date}
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;
 const win = window.open('', '_blank', 'width=900,height=700');
 if (win) { win.document.write(html); win.document.close(); }
}

// ── Venda a Dinheiro (VD) ─────────────────────────────────────────────────────
function printVD(r: SaleReceipt, tax: TaxConfig, vdNumber: string, logoUrl = `${window.location.origin}/logo.png`) {
 const vatMult = 1 + tax.vatRate / 100;
 const baseIva = r.total / vatMult;
 const ivaAmt = r.total - baseIva;

 const rows = r.items.map(c => {
 const lineTotal = c.price * c.quantity;
 const isPromo = (c as any).isPromo;
 const original = (c as any).originalPrice;
 return `<tr>
 <td>${c.productName}${c.variantName ? ` (${c.variantName})` : ''}${isPromo ? ' <span style="font-size:9px;background:#fff3cd;color:#b45309;padding:1px 4px;border-radius:3px">PROMO</span>' : ''}</td>
 <td class="r">${c.quantity} ${c.unit}</td>
 <td class="r">${isPromo && original ? `<span style="text-decoration:line-through;color:#bbb;font-size:10px">MT ${(original * c.quantity).toFixed(2)}</span><br>` : ''}MT ${lineTotal.toFixed(2)}</td>
 </tr>`;
 }).join('');

 const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>VD ${vdNumber}</title>
<style>
 *{margin:0;padding:0;box-sizing:border-box}
 body{font-family:Arial,sans-serif;font-size:12px;padding:28px;color:#111}
 .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
 .company{font-size:18px;font-weight:700;color:#16a34a}
 .vd-badge{background:#1e40af;color:#fff;font-size:20px;font-weight:700;padding:8px 18px;border-radius:8px;letter-spacing:1px}
 .vd-num{font-size:12px;color:#555;margin-top:4px;text-align:right}
 .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
 .info-box{background:#f9f9f9;border:1px solid #e5e7eb;border-radius:6px;padding:10px}
 .info-box h4{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:4px;letter-spacing:.5px}
 table{width:100%;border-collapse:collapse;margin-bottom:14px}
 th{background:#1e40af;color:#fff;padding:7px 8px;font-size:11px;text-align:left}
 td{padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb}
 .r{text-align:right}
 .totals{margin-left:auto;width:260px}
 .totals td{padding:4px 8px;font-size:12px}
 .totals .bold{font-weight:700;font-size:14px;color:#1e40af}
 .footer{margin-top:24px;font-size:10px;color:#999;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}
 .iva-badge{display:inline-block;background:#dbeafe;color:#1e40af;font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600;margin-bottom:8px}
</style></head><body>
<div class="header">
 <div style="display:flex;align-items:center;gap:14px">
 <img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'" style="max-width:90px;max-height:55px;object-fit:contain">
 <div>
 <div class="company">${tax.companyName}</div>
 <div style="font-size:11px;color:#666;margin-top:3px">NUIT: ${tax.companyNuit || '—'}</div>
 <div style="font-size:11px;color:#666">${tax.companyAddress || ''}</div>
 <div style="font-size:11px;color:#666">${tax.companyPhone || ''} | ${tax.companyEmail || ''}</div>
 </div>
 </div>
 <div style="text-align:right">
 <div class="vd-badge">VENDA A DINHEIRO</div>
 <div class="vd-num">${vdNumber}</div>
 <div style="font-size:11px;color:#666;margin-top:4px">Data: ${r.date}</div>
 <div class="iva-badge" style="margin-top:6px">IVA incluído ${tax.vatRate}%</div>
 </div>
</div>

<div class="info-grid">
 <div class="info-box">
 <h4>Vendedor</h4>
 <p><strong>${tax.companyName}</strong></p>
 <p>NUIT: ${tax.companyNuit || '—'}</p>
 </div>
 <div class="info-box">
 <h4>Cliente</h4>
 <p><strong>${r.customerName !== 'Cliente POS' ? r.customerName : 'Consumidor Final'}</strong></p>
 ${r.customerPhone ? `<p>Tel: ${r.customerPhone}</p>` : ''}
 <p style="font-size:10px;color:#999">NUIT: Não aplicável (consumidor final)</p>
 </div>
</div>

<table>
 <thead><tr>
 <th>Descrição</th><th class="r">Qtd</th><th class="r">Total c/IVA</th>
 </tr></thead>
 <tbody>${rows}</tbody>
</table>

<table class="totals">
 ${r.discount > 0 ? `<tr><td>Subtotal:</td><td class="r">MT ${r.subtotal.toFixed(2)}</td></tr><tr><td>Desconto:</td><td class="r">- MT ${r.discount.toFixed(2)}</td></tr>` : ''}
 <tr><td>Base s/IVA:</td><td class="r">MT ${baseIva.toFixed(2)}</td></tr>
 <tr><td>IVA ${tax.vatRate}%:</td><td class="r">MT ${ivaAmt.toFixed(2)}</td></tr>
 <tr class="bold"><td>TOTAL c/IVA:</td><td class="r">MT ${r.total.toFixed(2)}</td></tr>
 <tr><td style="color:#555">${PAY_LABELS[r.payMethod] || r.payMethod}:</td><td class="r" style="color:#555">MT ${r.paid.toFixed(2)}</td></tr>
 ${r.change > 0 ? `<tr><td style="color:#555">Troco:</td><td class="r" style="color:#555">MT ${r.change.toFixed(2)}</td></tr>` : ''}
</table>

<div class="footer">
 Documento emitido por ${tax.companyName} | NUIT ${tax.companyNuit || '—'}<br>
 Venda a Dinheiro ${vdNumber} | ${r.date} | IVA incluído à taxa de ${tax.vatRate}%
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;
 const win = window.open('', '_blank', 'width=900,height=700');
 if (win) { win.document.write(html); win.document.close(); }
}

// ── Cotação ───────────────────────────────────────────────────────────────────
function printCotacao(items: CartItem[], tax: TaxConfig, quoteNumber: string, logoUrl = `${window.location.origin}/logo.png`, customerName = '', validityDays = 15) {
 const subtotal = items.reduce((s, c) => s + c.price * c.quantity, 0);
 const vatMult = 1 + tax.vatRate / 100;
 const baseIva = subtotal / vatMult;
 const ivaAmt = subtotal - baseIva;

 const validUntil = new Date();
 validUntil.setDate(validUntil.getDate() + validityDays);
 const validUntilStr = validUntil.toLocaleDateString('pt-PT', { timeZone: 'Africa/Maputo', day: '2-digit', month: '2-digit', year: 'numeric' });
 const today = new Date().toLocaleString('pt-PT', { timeZone: 'Africa/Maputo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

 const rows = items.map(c => {
 const isPromo = c.isPromo;
 const original = c.originalPrice;
 return `<tr>
 <td>${c.productName}${c.variantName ? ` (${c.variantName})` : ''}${isPromo ? ' <span style="font-size:9px;background:#fff3cd;color:#b45309;padding:1px 4px;border-radius:3px">PROMO</span>' : ''}</td>
 <td class="r">${c.quantity} ${c.unit}</td>
 <td class="r">${isPromo && original ? `<span style="text-decoration:line-through;color:#bbb;font-size:10px">MT ${original.toFixed(2)}</span><br>` : ''}MT ${c.price.toFixed(2)}</td>
 <td class="r">MT ${(c.price * c.quantity).toFixed(2)}</td>
 </tr>`;
 }).join('');

 const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cotação ${quoteNumber}</title>
<style>
 *{margin:0;padding:0;box-sizing:border-box}
 body{font-family:Arial,sans-serif;font-size:12px;padding:28px;color:#111}
 .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
 .company{font-size:18px;font-weight:700;color:#16a34a}
 .quote-badge{background:#7c3aed;color:#fff;font-size:20px;font-weight:700;padding:8px 18px;border-radius:8px;letter-spacing:1px}
 .quote-num{font-size:12px;color:#555;margin-top:4px;text-align:right}
 .validity{background:#faf5ff;border:2px solid #7c3aed;border-radius:8px;padding:10px 16px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center}
 .validity-label{font-size:12px;color:#7c3aed;font-weight:600}
 .validity-date{font-size:16px;font-weight:700;color:#7c3aed}
 .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
 .info-box{background:#f9f9f9;border:1px solid #e5e7eb;border-radius:6px;padding:10px}
 .info-box h4{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:4px;letter-spacing:.5px}
 table{width:100%;border-collapse:collapse;margin-bottom:14px}
 th{background:#7c3aed;color:#fff;padding:7px 8px;font-size:11px;text-align:left}
 td{padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb}
 .r{text-align:right}
 .totals{margin-left:auto;width:260px}
 .totals td{padding:4px 8px;font-size:12px}
 .totals .bold{font-weight:700;font-size:15px;color:#7c3aed}
 .footer{margin-top:24px;font-size:10px;color:#888;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}
 .not-fiscal{background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;font-size:11px;color:#92400e;margin-top:16px;text-align:center;font-weight:600}
 .signature{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:32px}
 .sig-box{border-top:1px solid #999;padding-top:6px;font-size:11px;color:#555;text-align:center}
</style></head><body>
<div class="header">
 <div style="display:flex;align-items:center;gap:14px">
 <img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'" style="max-width:90px;max-height:55px;object-fit:contain">
 <div>
 <div class="company">${tax.companyName}</div>
 <div style="font-size:11px;color:#666;margin-top:3px">NUIT: ${tax.companyNuit || '—'}</div>
 <div style="font-size:11px;color:#666">${tax.companyAddress || ''}</div>
 <div style="font-size:11px;color:#666">${tax.companyPhone || ''} | ${tax.companyEmail || ''}</div>
 </div>
 </div>
 <div style="text-align:right">
 <div class="quote-badge">COTAÇÃO</div>
 <div class="quote-num">${quoteNumber}</div>
 <div style="font-size:11px;color:#666;margin-top:4px">Data: ${today}</div>
 </div>
</div>

<div class="validity">
 <div>
 <div class="validity-label">⏳ Validade da Cotação</div>
 <div style="font-size:11px;color:#555;margin-top:2px">Esta cotação é válida por ${validityDays} dias</div>
 </div>
 <div class="validity-date">Válida até ${validUntilStr}</div>
</div>

<div class="info-grid">
 <div class="info-box">
 <h4>Emitida por</h4>
 <p><strong>${tax.companyName}</strong></p>
 <p>NUIT: ${tax.companyNuit || '—'}</p>
 <p>${tax.companyPhone || ''}</p>
 </div>
 <div class="info-box">
 <h4>Cliente / Destinatário</h4>
 <p><strong>${customerName || '—'}</strong></p>
 <p style="font-size:10px;color:#999;margin-top:4px">NUIT: ______________</p>
 <p style="font-size:10px;color:#999">Contacto: ______________</p>
 </div>
</div>

<table>
 <thead><tr>
 <th>Descrição</th><th class="r">Qtd</th><th class="r">Preço Unit.</th><th class="r">Total</th>
 </tr></thead>
 <tbody>${rows}</tbody>
</table>

<table class="totals">
 <tr><td>Base s/IVA (${tax.vatRate}%):</td><td class="r">MT ${baseIva.toFixed(2)}</td></tr>
 <tr><td>IVA ${tax.vatRate}%:</td><td class="r">MT ${ivaAmt.toFixed(2)}</td></tr>
 <tr class="bold"><td>TOTAL c/IVA:</td><td class="r">MT ${subtotal.toFixed(2)}</td></tr>
</table>

<div class="not-fiscal">⚠️ Este documento é uma cotação e NÃO constitui um documento fiscal. Não serve como comprovativo de pagamento.</div>

<div class="signature">
 <div class="sig-box">Emitido por: ${tax.companyName}</div>
 <div class="sig-box">Aceite pelo Cliente</div>
</div>

<div class="footer">
 Cotação ${quoteNumber} | ${today} | ${tax.companyName} | NUIT ${tax.companyNuit || '—'}
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;
 const win = window.open('', '_blank', 'width=900,height=700');
 if (win) { win.document.write(html); win.document.close(); }
}

// ── Component ──────────────────────────────────────────────────────────────────
export const POS: React.FC<POSProps> = ({ showToast }) => {
 const navigate = useNavigate();
 // Session
 const [session, setSession] = useState<PosSession | null | 'loading'>('loading');
 const [initialAmtInput, setInitialAmtInput] = useState('');
 const [openingSession, setOpeningSession] = useState(false);
 const [closingSession, setClosingSession] = useState(false);
 const [closeReport, setCloseReport] = useState<CloseReport | null>(null);

 // POS
 const [products, setProducts] = useState<Product[]>([]);
 const [search, setSearch] = useState('');
 const [cart, setCart] = useState<CartItem[]>([]);
 const [variantPicker, setVariantPicker] = useState<Product | null>(null);
 const [customerName, setCustomerName] = useState('');
 const [customerPhone, setCustomerPhone] = useState('');
 const [payMethod, setPayMethod] = useState<PayMethod>('cash');
 const [amountPaid, setAmountPaid] = useState('');
 const [discount, setDiscount] = useState('');
 const [submitting, setSubmitting] = useState(false);
 const [done, setDone] = useState<SaleReceipt | null>(null);
 const [showScanner, setShowScanner] = useState(false);
 const [mobileCartOpen, setMobileCartOpen] = useState(false);
 const [taxConfig, setTaxConfig] = useState<TaxConfig>({ companyName: 'NaturErva', companyNuit: '', companyAddress: '', companyPhone: '', companyEmail: '', vatRate: 16, invoicePrefix: 'FACT' });
 // Scanner remoto (telemóvel → computador)
 const [remoteSession, setRemoteSession] = useState<{ sessionId: string; url: string } | null>(null);
 const [showRemoteModal, setShowRemoteModal] = useState(false);
 const remotePollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

 const startRemoteScanner = async () => {
 try {
 const result = await api.post<{ sessionId: string }>('/pos/scan-relay', {});
 const sessionId = result.sessionId;
 const origin = window.location.origin;
 const url = `${origin}/scanner-remoto?session=${sessionId}`;
 setRemoteSession({ sessionId, url });
 setShowRemoteModal(true);
 // Polling a cada 600ms
 if (remotePollerRef.current) clearInterval(remotePollerRef.current);
 remotePollerRef.current = setInterval(async () => {
 try {
 const data = await api.get<{ codes: string[]; active: boolean }>(`/pos/scan-relay/${sessionId}`);
 if (!data.active) { stopRemoteScanner(); return; }
 for (const code of (data.codes || [])) {
 await handleScan(code);
 }
 } catch {}
 }, 600);
 } catch {
 showToast?.('Erro ao criar sessão de scan remoto', 'error');
 }
 };

 const stopRemoteScanner = () => {
 if (remotePollerRef.current) { clearInterval(remotePollerRef.current); remotePollerRef.current = null; }
 setRemoteSession(null);
 setShowRemoteModal(false);
 };

 // Parar poller ao desmontar
 useEffect(() => () => { if (remotePollerRef.current) clearInterval(remotePollerRef.current); }, []);

 useEffect(() => {
 Promise.all([
 api.get<Product[]>('/products').then(d => setProducts(d || [])),
 api.get<PosSession | null>('/pos/session/current').then(s => setSession(s)),
 api.get<TaxConfig>('/tax/config').then(async c => {
 if (c?.vatRate) {
 try {
 const { getSystemSettings } = await import('../../core/services/systemSettingsService');
 const sys = await getSystemSettings();
 setTaxConfig({ ...c, logoUrl: sys.logo_light || sys.logo_dark || `${window.location.origin}/logo.png` });
 } catch {
 setTaxConfig(c);
 }
 }
 }).catch(() => {}),
 ]).catch(() => {
 setSession(null);
 showToast?.('Erro ao carregar dados', 'error');
 });
 }, []);

 const filtered = useMemo(() =>
 products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())),
 [products, search]
 );

 // ── Session handlers ──────────────────────────────────────────────────────────
 const handleOpenSession = async () => {
 setOpeningSession(true);
 try {
 const s = await api.post<PosSession>('/pos/session/open', {
 initialAmount: parseFloat(initialAmtInput) || 0,
 });
 setSession(s);
 setInitialAmtInput('');
 } catch (e: any) {
 showToast?.(e.message || 'Erro ao abrir caixa', 'error');
 } finally { setOpeningSession(false); }
 };

 const handleCloseSession = async () => {
 if (!confirm('Confirmas o fecho da caixa?')) return;
 setClosingSession(true);
 try {
 const report = await api.post<CloseReport>('/pos/session/close', {});
 setCloseReport(report);
 setSession(null);
 setCart([]);
 } catch (e: any) {
 showToast?.(e.message || 'Erro ao fechar caixa', 'error');
 } finally { setClosingSession(false); }
 };

 // ── Cart handlers ─────────────────────────────────────────────────────────────
 const addItem = (productId: string, productName: string, price: number, unit: string, maxStock: number, variantId?: string, variantName?: string, image?: string, isPromo?: boolean, originalPrice?: number) => {
 const key = variantId ?? productId;
 setCart(prev => {
 const idx = prev.findIndex(c => (c.variantId ?? c.productId) === key);
 if (idx >= 0) return prev.map((c, i) => i === idx ? { ...c, quantity: c.maxStock > 0 ? Math.min(c.quantity + 1, c.maxStock) : c.quantity + 1 } : c);
 return [...prev, { productId, productName, variantId, variantName, price, quantity: 1, unit, maxStock, image, isPromo, originalPrice }];
 });
 setVariantPicker(null);
 };

 const setQty = (idx: number, qty: number) =>
 qty <= 0
 ? setCart(prev => prev.filter((_, i) => i !== idx))
 : setCart(prev => prev.map((c, i) => i === idx ? { ...c, quantity: c.maxStock > 0 ? Math.min(qty, c.maxStock) : qty } : c));

 const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
 const discountAmt = Math.min(Math.max(parseFloat(discount) || 0, 0), subtotal);
 const total = subtotal - discountAmt;
 const paid = parseFloat(amountPaid) || 0;
 const change = paid - total;

 const handleCheckout = async () => {
 if (!cart.length) return;
 setSubmitting(true);
 try {
 const items: OrderItem[] = cart.map(c => ({
 id: '', productId: c.productId,
 productName: c.variantName ? `${c.productName} ${c.variantName}` : c.productName,
 variantId: c.variantId, variantName: c.variantName,
 quantity: c.quantity, price: c.price, unit: c.unit,
 }));
 const result = await orderService.createOrder({
 id: '', customerId: '',
 customerName: customerName.trim() || 'Cliente POS',
 customerPhone: customerPhone.trim() || undefined,
 items, totalAmount: total,
 discountAmount: discountAmt || undefined,
 status: OrderStatus.COMPLETED, paymentStatus: 'paid',
 amountPaid: Math.max(paid, total), paymentMethod: payMethod,
 isDelivery: false, source: 'pos',
 createdAt: new Date().toISOString(),
 });
 if (result.order) {
 setDone({
 orderNumber: result.order.orderNumber || result.order.id.substring(0, 8),
 items: [...cart], subtotal, discount: discountAmt, total,
 paid: Math.max(paid, total), change: Math.max(0, change),
 payMethod,
 customerName: customerName.trim() || 'Cliente POS',
 customerPhone: customerPhone.trim() || undefined,
 date: nowMaputo(),
 });
 setMobileCartOpen(false);
 setCart([]);
 setCustomerName(''); setCustomerPhone('');
 setAmountPaid(''); setDiscount('');
 } else {
 showToast?.('Erro ao registar venda', 'error');
 }
 } catch (e: any) {
 showToast?.(e.message || 'Erro ao processar venda', 'error');
 } finally { setSubmitting(false); }
 };

 // ── Barcode scan ──────────────────────────────────────────────────────────────
 const handleScan = async (code: string) => {
 setShowScanner(false);
 try {
 const product = await api.get<Product>(`/products/barcode/${encodeURIComponent(code)}`);
 if (product.hasVariants && product.variants?.length) {
 playScanBeep('ok');
 setVariantPicker(product);
 } else {
 playScanBeep('ok');
 const ep = getEffectivePrice(product);
 addItem(product.id, product.name, ep.price, product.unit, product.stock, undefined, undefined, product.image, ep.isPromo, ep.originalPrice);
 showToast?.(`${product.name} adicionado`, 'success');
 }
 } catch {
 playScanBeep('error');
 showToast?.(`Código "${code}" não encontrado`, 'error');
 }
 };

 // ── Loading ───────────────────────────────────────────────────────────────────
 if (session === 'loading') {
 return (
 <div className="flex items-center justify-center h-[calc(100vh-64px)]">
 <div className="text-center text-content-muted">
 <Store className="w-10 h-10 mx-auto mb-3 animate-pulse" />
 <p className="text-sm">A carregar caixa...</p>
 </div>
 </div>
 );
 }

 // ── Sem sessão — redireciona para Caixa ──────────────────────────────────────
 if (!session && !closeReport) {
 return (
 <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-surface-base p-4">
 <div className="bg-surface-raised rounded-2xl shadow-lg border border-border-default p-8 w-full max-w-sm text-center">
 <div className="w-16 h-16 bg-surface-base rounded-2xl flex items-center justify-center mx-auto mb-5">
 <Store className="w-8 h-8 text-content-muted" />
 </div>
 <h2 className="text-xl font-bold text-content-primary mb-1">Caixa Fechada</h2>
 <p className="text-sm text-content-muted mb-6">Abre uma sessão de caixa antes de iniciar vendas.</p>
 <button onClick={() => navigate('/admin/caixa')}
 className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors">
 Ir para Caixa
 </button>
 </div>
 </div>
 );
 }

 // ── Relatório de Fecho — redireciona para Caixa ──────────────────────────────
 if (closeReport) {
 return (
 <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-surface-base p-4">
 <div className="bg-surface-raised rounded-2xl shadow-lg border border-border-default p-8 w-full max-w-sm text-center">
 <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
 <CheckCircle className="w-8 h-8 text-green-600" />
 </div>
 <h2 className="text-xl font-bold text-content-primary mb-1">Caixa Fechada</h2>
 <p className="text-sm text-content-muted mb-2">
 {fmt(closeReport.summary.totalSales)} em {closeReport.summary.totalOrders} vendas
 </p>
 <p className="text-xs text-content-muted mb-6">Ver o relatório completo na página de Caixa.</p>
 <button onClick={() => navigate('/admin/caixa')}
 className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors">
 Ir para Caixa
 </button>
 </div>
 </div>
 );
 }

 // ── POS Principal ─────────────────────────────────────────────────────────────
 return (
 <div className="flex flex-col overflow-hidden bg-surface-base -mx-3 -mt-3 sm:-mx-4 sm:-mt-4 md:mx-0 md:mt-0 md:h-[calc(100vh-64px)]">

 {/* Barra de sessão */}
 <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-brand-600 text-white text-sm shrink-0">
 <Store className="w-4 h-4 shrink-0" />
 <span className="font-medium truncate max-w-[110px] sm:max-w-none">{(session as PosSession).cashier_name}</span>
 <span className="hidden md:inline text-brand-200">·</span>
 <Clock className="hidden md:inline w-3.5 h-3.5 text-brand-200" />
 <span className="hidden md:inline text-brand-100">Abertura: {fmtTime((session as PosSession).opened_at)}</span>
 <span className="hidden md:inline text-brand-200">·</span>
 <span className="hidden md:inline text-brand-100">Fundo: {fmt((session as PosSession).initial_amount)}</span>
 <button onClick={handleCloseSession} disabled={closingSession}
 className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-surface-raised/15 hover:bg-surface-raised/25 rounded-lg transition-colors disabled:opacity-50 text-xs font-medium whitespace-nowrap">
 <LogOut className="w-3.5 h-3.5" />
 <span className="hidden sm:inline">{closingSession ? 'A fechar...' : 'Fechar Caixa'}</span>
 <span className="sm:hidden">{closingSession ? '...' : 'Fechar'}</span>
 </button>
 </div>

 {/* ── DESKTOP (md+): lado a lado ─────────────────────────────────────────── */}
 <div className="hidden md:flex flex-1 overflow-hidden gap-4 p-4">

 {/* Produtos */}
 <div className="flex-1 flex flex-col overflow-hidden">
 <div className="flex gap-2 mb-3">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar produto..."
 className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border-default bg-surface-raised text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 </div>
 <button onClick={() => setShowScanner(true)} title="Câmera"
 className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shrink-0 flex items-center gap-1.5">
 <ScanLine className="w-4 h-4" />
 <span className="text-xs font-medium">Câmera</span>
 </button>
 <button onClick={() => remoteSession ? setShowRemoteModal(true) : startRemoteScanner()}
 title="Telemóvel"
 className={`px-3 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 text-xs font-medium ${remoteSession ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 hover:bg-border-strong text-white'}`}>
 {remoteSession ? <Wifi className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
 {remoteSession ? 'Activo' : 'Telemóvel'}
 </button>
 </div>
 <div className="flex-1 overflow-y-auto">
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
 {filtered.map(p => (
 <button key={p.id}
 onClick={() => p.hasVariants && p.variants?.length ? setVariantPicker(p) : (() => { const ep = getEffectivePrice(p); addItem(p.id, p.name, ep.price, p.unit, p.stock, undefined, undefined, p.image, ep.isPromo, ep.originalPrice); })()}
 className="bg-surface-raised rounded-xl border border-border-default p-3 text-left hover:border-brand-500 hover:shadow-md transition-all">
 {p.image
 ? <img src={p.image} alt={p.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
 : <div className="w-full aspect-square bg-surface-base rounded-lg mb-2 flex items-center justify-center text-2xl">🌿</div>}
 <p className="text-sm font-medium text-content-primary truncate">{p.name}</p>
 {(() => { const ep = getEffectivePrice(p); return ep.isPromo ? (
 <div className="mt-0.5">
 <span className="text-xs text-orange-600 font-bold">{fmt(ep.price)}</span>
 <span className="text-[10px] text-content-muted line-through ml-1">{fmt(ep.originalPrice)}</span>
 <span className="ml-1 text-[9px] bg-orange-100 text-orange-600 px-1 rounded font-medium">PROMO</span>
 </div>
 ) : <p className="text-xs text-brand-600 font-semibold mt-0.5">{fmt(p.price)}</p>; })()}
 <p className="text-xs text-content-muted mt-0.5">Stock: {p.stock} {p.unit}</p>
 </button>
 ))}
 {filtered.length === 0 && <p className="col-span-full text-center text-content-muted py-12">Nenhum produto encontrado</p>}
 </div>
 </div>
 </div>

 {/* Carrinho (desktop) */}
 <div className="w-80 lg:w-96 flex flex-col bg-surface-raised rounded-xl border border-border-default overflow-hidden">
 <div className="px-4 py-3 border-b border-border-default flex items-center gap-2">
 <ShoppingCart className="w-5 h-5 text-brand-600" />
 <span className="font-semibold text-content-primary">Carrinho</span>
 {cart.length > 0 && <span className="ml-auto text-xs bg-brand-600 text-white rounded-full px-2 py-0.5">{cart.reduce((s, c) => s + c.quantity, 0)}</span>}
 </div>
 <div className="flex-1 overflow-y-auto p-3 space-y-2">
 {cart.length === 0
 ? <p className="text-center text-content-muted text-sm py-8">Carrinho vazio</p>
 : cart.map((c, idx) => (
 <div key={idx} className="flex items-center gap-2 bg-surface-base rounded-lg px-2 py-1.5">
 {/* Imagem do produto */}
 {c.image
 ? <img src={c.image} alt={c.productName} className="w-9 h-9 object-cover rounded-lg shrink-0" />
 : <div className="w-9 h-9 bg-surface-base rounded-lg shrink-0 flex items-center justify-center text-sm">🌿</div>}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1 flex-wrap">
 <p className="text-xs font-medium text-content-primary truncate">{c.productName}{c.variantName ? ` · ${c.variantName}` : ''}</p>
 {c.isPromo && <span className="text-[9px] bg-orange-100 text-orange-600 px-1 rounded font-bold shrink-0">PROMO</span>}
 </div>
 <p className="text-xs text-content-muted">
 {c.isPromo && c.originalPrice && <span className="line-through mr-1 text-content-muted">{fmt(c.originalPrice)}</span>}
 <span className={c.isPromo ? 'text-orange-600 font-semibold' : ''}>{fmt(c.price)}</span>
 {' × '}{c.quantity} = {fmt(c.price * c.quantity)}
 </p>
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <button onClick={() => setQty(idx, c.quantity - 1)} className="w-6 h-6 flex items-center justify-center rounded bg-surface-base hover:bg-red-100 dark:hover:bg-red-900/40"><Minus className="w-3 h-3" /></button>
 <span className="w-5 text-center text-xs font-medium">{c.quantity}</span>
 <button onClick={() => setQty(idx, c.quantity + 1)} disabled={c.maxStock > 0 && c.quantity >= c.maxStock} className="w-6 h-6 flex items-center justify-center rounded bg-surface-base hover:bg-green-100 disabled:opacity-40"><Plus className="w-3 h-3" /></button>
 <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} className="w-6 h-6 flex items-center justify-center rounded bg-red-100 dark:bg-red-900/30 hover:bg-red-200 text-red-500 ml-0.5"><X className="w-3 h-3" /></button>
 </div>
 </div>
 ))}
 </div>
 <div className="border-t border-border-default p-4 space-y-3">
 <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nome do cliente (opcional)"
 className="w-full px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-raised focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Telefone (opcional)"
 className="w-full px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-raised focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 <div className="flex gap-1.5">
 {(['cash', 'mpesa', 'transfer'] as PayMethod[]).map(m => (
 <button key={m} onClick={() => setPayMethod(m)}
 className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${payMethod === m ? 'bg-brand-600 text-white border-brand-600' : 'border-border-default text-content-secondary hover:border-brand-400'}`}>
 {PAY_LABELS[m]}
 </button>
 ))}
 </div>
 <div className="flex items-center gap-2">
 <label className="text-xs text-content-muted shrink-0">Desconto MT</label>
 <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} min={0} placeholder="0.00"
 className="flex-1 px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-raised focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 </div>
 <div>
 <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
 placeholder={`Valor recebido (total: ${fmt(total)})`}
 className="w-full px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-raised focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 {paid > 0 && change >= 0 && <p className="text-xs text-green-600 font-medium mt-1 px-1">Troco: {fmt(change)}</p>}
 </div>
 <div className="space-y-1 py-2 border-t border-border-default ">
 {discountAmt > 0 && (
 <>
 <div className="flex justify-between text-xs text-content-muted"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
 <div className="flex justify-between text-xs text-red-500"><span>Desconto</span><span>- {fmt(discountAmt)}</span></div>
 </>
 )}
 <div className="flex items-center justify-between">
 <span className="text-sm text-content-muted">Total</span>
 <span className="text-xl font-bold text-content-primary">{fmt(total)}</span>
 </div>
 </div>
 <div className="flex gap-2">
 <button
 onClick={async () => {
 try {
 const yr = new Date().getFullYear();
 const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
 const saved = await api.post<{ id: string; quoteNumber: string }>('/quotes', {
 customerName: customerName.trim() || '',
 customerPhone: customerPhone.trim() || '',
 items: cart.map(c => ({ productId: c.productId, productName: c.productName, variantName: c.variantName, quantity: c.quantity, unit: c.unit, price: c.price, isPromo: c.isPromo, originalPrice: c.originalPrice })),
 subtotal, discount: discountAmt, total, status: 'rascunho',
 });
 printCotacao(cart, taxConfig, saved.quoteNumber, taxConfig.logoUrl, customerName.trim());
 } catch { printCotacao(cart, taxConfig, `COT/${new Date().getFullYear()}/0000`, taxConfig.logoUrl, customerName.trim()); }
 }}
 disabled={!cart.length}
 className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-purple-400 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-xs font-semibold disabled:opacity-40">
 <Printer className="w-3.5 h-3.5" />Cotação
 </button>
 <button onClick={handleCheckout} disabled={!cart.length || submitting}
 className="flex-[2] py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm">
 {submitting ? 'A processar...' : 'Finalizar Venda'}
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* ── MOBILE (<md): tabs produtos / carrinho ──────────────────────────────── */}
 <div className="flex md:hidden flex-1 flex-col overflow-hidden min-h-0">
 {!mobileCartOpen ? (
 /* Vista de produtos */
 <div className="flex flex-col flex-1 overflow-hidden min-h-0">
 {/* Pesquisa + scan */}
 <div className="flex gap-2 px-3 pt-3 pb-2 shrink-0">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar produto..."
 className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border-default bg-surface-raised text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 </div>
 <button onClick={() => setShowScanner(true)} title="Câmera"
 className="px-3 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-lg transition-colors shrink-0">
 <ScanLine className="w-5 h-5" />
 </button>
 <button onClick={() => remoteSession ? setShowRemoteModal(true) : startRemoteScanner()} title="Scanner remoto"
 className={`px-3 py-2 rounded-lg transition-colors shrink-0 ${remoteSession ? 'bg-green-600 text-white' : 'bg-surface-base text-content-secondary'}`}>
 {remoteSession ? <Wifi className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
 </button>
 </div>

 {/* Grelha de produtos */}
 <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-2">
 <div className="grid grid-cols-2 gap-2.5">
 {filtered.map(p => (
 <button key={p.id}
 onClick={() => p.hasVariants && p.variants?.length ? setVariantPicker(p) : (() => { const ep = getEffectivePrice(p); addItem(p.id, p.name, ep.price, p.unit, p.stock, undefined, undefined, p.image, ep.isPromo, ep.originalPrice); })()}
 className="bg-surface-raised rounded-xl border border-border-default p-2.5 text-left active:scale-95 transition-transform">
 {p.image
 ? <img src={p.image} alt={p.name} className="w-full aspect-square object-cover rounded-lg mb-2" />
 : <div className="w-full aspect-square bg-surface-base rounded-lg mb-2 flex items-center justify-center text-2xl">🌿</div>}
 <p className="text-xs font-medium text-content-primary truncate">{p.name}</p>
 {(() => { const ep = getEffectivePrice(p); return ep.isPromo ? (
 <div className="mt-0.5">
 <span className="text-xs text-orange-600 font-bold">{fmt(ep.price)}</span>
 <span className="text-[10px] text-content-muted line-through ml-1">{fmt(ep.originalPrice)}</span>
 <span className="ml-1 text-[9px] bg-orange-100 text-orange-600 px-1 rounded font-medium">PROMO</span>
 </div>
 ) : <p className="text-xs text-brand-600 font-semibold mt-0.5">{fmt(p.price)}</p>; })()}
 <p className="text-[10px] text-content-muted mt-0.5">Stock: {p.stock} {p.unit}</p>
 </button>
 ))}
 {filtered.length === 0 && <p className="col-span-full text-center text-content-muted py-12 text-sm">Nenhum produto encontrado</p>}
 </div>
 </div>

 {/* Barra inferior → abre carrinho */}
 <div className="shrink-0 bg-surface-raised border-t border-border-default px-3 py-3">
 <button onClick={() => setMobileCartOpen(true)}
 className="w-full flex items-center gap-3 px-4 py-3 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl transition-colors">
 <div className="relative">
 <ShoppingCart className="w-5 h-5" />
 {cart.length > 0 && (
 <span className="absolute -top-2 -right-2 bg-surface-raised text-brand-600 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
 {cart.reduce((s, c) => s + c.quantity, 0)}
 </span>
 )}
 </div>
 <span className="font-semibold flex-1 text-left">Ver Carrinho</span>
 <span className="font-bold text-base">{fmt(total)}</span>
 </button>
 </div>
 </div>
 ) : (
 /* Vista do carrinho */
 <div className="flex flex-col flex-1 overflow-hidden min-h-0 bg-surface-raised">
 {/* Cabeçalho */}
 <div className="flex items-center gap-3 px-4 py-3 border-b border-border-default shrink-0">
 <button onClick={() => setMobileCartOpen(false)}
 className="p-1.5 -ml-1.5 rounded-lg hover:bg-surface-base active:bg-surface-base transition-colors">
 <ChevronLeft className="w-5 h-5 text-content-secondary" />
 </button>
 <ShoppingCart className="w-5 h-5 text-brand-600" />
 <span className="font-semibold text-content-primary">Carrinho</span>
 {cart.length > 0 && <span className="ml-auto text-xs bg-brand-600 text-white rounded-full px-2 py-0.5">{cart.reduce((s, c) => s + c.quantity, 0)}</span>}
 </div>

 {/* Itens + checkout (scroll conjunto) */}
 <div className="flex-1 overflow-y-auto min-h-0">
 <div className="p-3 space-y-2">
 {cart.length === 0
 ? <p className="text-center text-content-muted text-sm py-8">Carrinho vazio</p>
 : cart.map((c, idx) => (
 <div key={idx} className="flex items-center gap-2 bg-surface-base rounded-lg px-3 py-2">
 {/* Imagem do produto */}
 {c.image
 ? <img src={c.image} alt={c.productName} className="w-10 h-10 object-cover rounded-lg shrink-0" />
 : <div className="w-10 h-10 bg-surface-base rounded-lg shrink-0 flex items-center justify-center text-base">🌿</div>}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5 flex-wrap">
 <p className="text-sm font-medium text-content-primary truncate">{c.productName}{c.variantName ? ` · ${c.variantName}` : ''}</p>
 {c.isPromo && <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold shrink-0">PROMO</span>}
 </div>
 <p className="text-xs text-content-muted">
 {c.isPromo && c.originalPrice && <span className="line-through mr-1 text-content-muted">{fmt(c.originalPrice)}</span>}
 <span className={c.isPromo ? 'text-orange-600 font-semibold' : ''}>{fmt(c.price)}</span>
 {' × '}{c.quantity} = <span className="font-semibold text-content-secondary">{fmt(c.price * c.quantity)}</span>
 </p>
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <button onClick={() => setQty(idx, c.quantity - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-base hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95"><Minus className="w-3.5 h-3.5" /></button>
 <span className="w-6 text-center text-sm font-semibold">{c.quantity}</span>
 <button onClick={() => setQty(idx, c.quantity + 1)} disabled={c.maxStock > 0 && c.quantity >= c.maxStock} className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-base hover:bg-green-100 disabled:opacity-40 active:scale-95"><Plus className="w-3.5 h-3.5" /></button>
 <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 active:scale-95 ml-0.5"><X className="w-3.5 h-3.5" /></button>
 </div>
 </div>
 ))}
 </div>

 <div className="border-t border-border-default p-4 space-y-3">
 <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nome do cliente (opcional)"
 className="w-full px-3 py-2.5 text-sm rounded-lg border border-border-default bg-surface-raised focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Telefone (opcional)"
 className="w-full px-3 py-2.5 text-sm rounded-lg border border-border-default bg-surface-raised focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 <div className="flex gap-1.5">
 {(['cash', 'mpesa', 'transfer'] as PayMethod[]).map(m => (
 <button key={m} onClick={() => setPayMethod(m)}
 className={`flex-1 py-2.5 text-xs rounded-lg border font-medium transition-colors ${payMethod === m ? 'bg-brand-600 text-white border-brand-600' : 'border-border-default text-content-secondary hover:border-brand-400'}`}>
 {PAY_LABELS[m]}
 </button>
 ))}
 </div>
 <div className="flex items-center gap-2">
 <label className="text-xs text-content-muted shrink-0">Desconto MT</label>
 <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} min={0} placeholder="0.00"
 className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-border-default bg-surface-raised focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 </div>
 <div>
 <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
 placeholder={`Valor recebido (total: ${fmt(total)})`}
 className="w-full px-3 py-2.5 text-sm rounded-lg border border-border-default bg-surface-raised focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 {paid > 0 && change >= 0 && <p className="text-xs text-green-600 font-medium mt-1.5 px-1">Troco: {fmt(change)}</p>}
 </div>
 <div className="space-y-1.5 py-2 border-t border-border-default ">
 {discountAmt > 0 && (
 <>
 <div className="flex justify-between text-xs text-content-muted"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
 <div className="flex justify-between text-xs text-red-500"><span>Desconto</span><span>- {fmt(discountAmt)}</span></div>
 </>
 )}
 <div className="flex items-center justify-between">
 <span className="text-sm text-content-muted">Total</span>
 <span className="text-2xl font-bold text-content-primary">{fmt(total)}</span>
 </div>
 </div>
 <div className="flex gap-2">
 <button
 onClick={async () => {
 try {
 const { number } = await api.post<{ number: string }>('/tax/quote/number', {});
 printCotacao(cart, taxConfig, number, taxConfig.logoUrl, customerName.trim());
 } catch { printCotacao(cart, taxConfig, `COT/${new Date().getFullYear()}/----`, taxConfig.logoUrl, customerName.trim()); }
 }}
 disabled={!cart.length}
 className="flex-1 flex items-center justify-center gap-1.5 py-3.5 border border-purple-400 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-sm font-semibold disabled:opacity-40 active:scale-[0.98]">
 <Printer className="w-4 h-4" />Cotação
 </button>
 <button onClick={handleCheckout} disabled={!cart.length || submitting}
 className="flex-[2] py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-base rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
 {submitting ? 'A processar...' : 'Finalizar Venda'}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Scanner de código de barras */}
 {showScanner && (
 <BarcodeScanner
 onScan={handleScan}
 onClose={() => setShowScanner(false)}
 />
 )}

 {/* Modal Scanner Remoto */}
 {showRemoteModal && remoteSession && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowRemoteModal(false)}>
 <div className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
 <div className="bg-green-600 px-5 py-4 text-white text-center">
 <Smartphone className="w-10 h-10 mx-auto mb-2" />
 <h2 className="text-lg font-bold">Scanner Remoto Activo</h2>
 <p className="text-green-100 text-xs mt-0.5">Abre este link no teu telemóvel</p>
 </div>
 <div className="p-5 space-y-4">
 <div className="bg-surface-base rounded-xl p-3">
 <p className="text-xs text-content-muted mb-1 font-medium">URL do scanner:</p>
 <p className="text-xs font-mono text-brand-600 dark:text-brand-400 break-all leading-relaxed">
 {remoteSession.url}
 </p>
 </div>
 <div className="flex gap-2">
 <button onClick={() => { navigator.clipboard.writeText(remoteSession.url); showToast?.('Link copiado!', 'success'); }}
 className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">
 Copiar Link
 </button>
 <button onClick={stopRemoteScanner}
 className="flex-1 py-2.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
 Parar
 </button>
 </div>
 <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2">
 <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
 <p className="text-xs text-green-700 dark:text-green-400">A aguardar scans do telemóvel...</p>
 </div>
 <p className="text-xs text-content-muted text-center">
 Partilha o link via WhatsApp, email ou escaneia com o telemóvel
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Modal variantes */}
 {variantPicker && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setVariantPicker(null)}>
 <div className="bg-surface-raised rounded-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-semibold text-content-primary">{variantPicker.name}</h3>
 <button onClick={() => setVariantPicker(null)}><X className="w-5 h-5 text-content-muted" /></button>
 </div>
 <div className="space-y-2">
 {variantPicker.variants?.map(v => (
 <button key={v.id}
 onClick={() => { const ep = getEffectivePrice({ price: v.price, promotionalPrice: null }); addItem(variantPicker.id, variantPicker.name, ep.price, v.unit, v.stock, v.id, v.name, variantPicker.image, ep.isPromo, ep.originalPrice); }}
 className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border-default hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors text-sm">
 <span className="font-medium text-content-primary">{v.name}</span>
 <div className="text-right">
 <p className="text-brand-600 font-semibold">{fmt(v.price)}</p>
 <p className="text-xs text-content-muted">Stock: {v.stock}</p>
 </div>
 </button>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Modal venda concluída */}
 {done && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-surface-raised rounded-xl w-full max-w-sm overflow-hidden">
 <div className="p-6 text-center border-b border-border-default ">
 <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
 <h3 className="text-xl font-bold text-content-primary">Venda Concluída!</h3>
 <p className="text-sm text-content-muted mt-1">Pedido #{done.orderNumber} · {done.date}</p>
 </div>
 <div className="px-5 py-4 max-h-52 overflow-y-auto space-y-1">
 {done.items.map((c, i) => (
 <div key={i} className="flex justify-between text-sm text-content-secondary">
 <span className="truncate mr-2">{c.productName}{c.variantName ? ` · ${c.variantName}` : ''} ×{c.quantity}</span>
 <span className="shrink-0 font-medium">{fmt(c.price * c.quantity)}</span>
 </div>
 ))}
 </div>
 <div className="px-5 pb-4 space-y-1 border-t border-border-default pt-3">
 {done.discount > 0 && (
 <>
 <div className="flex justify-between text-xs text-content-muted"><span>Subtotal</span><span>{fmt(done.subtotal)}</span></div>
 <div className="flex justify-between text-xs text-red-500"><span>Desconto</span><span>- {fmt(done.discount)}</span></div>
 </>
 )}
 <div className="flex justify-between font-bold text-content-primary"><span>Total</span><span>{fmt(done.total)}</span></div>
 <div className="flex justify-between text-sm text-content-muted"><span>{PAY_LABELS[done.payMethod]}</span><span>{fmt(done.paid)}</span></div>
 {done.change > 0 && <div className="flex justify-between text-sm font-semibold text-green-600"><span>Troco</span><span>{fmt(done.change)}</span></div>}
 </div>
 <div className="px-5 pb-5 space-y-2">
 {/* Linha 1: Recibo + VD */}
 <div className="flex gap-2">
 <button onClick={() => printReceipt(done, taxConfig.vatRate, taxConfig.logoUrl)}
 className="flex-1 flex items-center justify-center gap-1 py-2 border border-border-default text-content-secondary rounded-xl hover:bg-surface-base transition-colors text-xs font-medium">
 <Printer className="w-3.5 h-3.5" />Recibo
 </button>
 <button onClick={async () => {
 try {
 const { number } = await api.post<{ number: string }>('/tax/vd/number', {});
 printVD(done, taxConfig, number, taxConfig.logoUrl);
 } catch { printVD(done, taxConfig, `VD/${new Date().getFullYear()}/----`, taxConfig.logoUrl); }
 }}
 className="flex-1 flex items-center justify-center gap-1 py-2 border border-blue-400 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-xs font-medium">
 <Printer className="w-3.5 h-3.5" />VD
 </button>
 <button onClick={async () => {
 try {
 const { number } = await api.post<{ number: string }>('/tax/invoice/number', {});
 printInvoice(done, taxConfig, number, taxConfig.logoUrl);
 } catch { printInvoice(done, taxConfig, `FACT/${new Date().getFullYear()}/----`, taxConfig.logoUrl); }
 }}
 className="flex-1 flex items-center justify-center gap-1 py-2 border border-brand-400 text-brand-600 dark:text-brand-400 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors text-xs font-medium">
 <Printer className="w-3.5 h-3.5" />Fatura
 </button>
 </div>
 <button onClick={() => setDone(null)}
 className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors text-sm">
 Nova Venda
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};
