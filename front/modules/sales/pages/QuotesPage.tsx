import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api, { downloadBlob } from '../../core/services/apiClient';
import { Product } from '../../core/types/types';
import { getEffectivePrice } from '../../core/utils/pricing';
import { Settings, Plus, Trash2, Edit2, X as XIcon, Eye, Download, Printer } from 'lucide-react';
import { useAppAuth } from '../../auth/hooks/useAppAuth';
import { PageShell } from '../../core/components/layout/PageShell';

// ── Types ──────────────────────────────────────────────────────────────────────
interface QuoteItem {
 productId: string;
 productName: string;
 variantName?: string;
 quantity: number;
 unit: string;
 price: number;
 isPromo?: boolean;
 originalPrice?: number;
}

interface Quote {
 id: string;
 quoteNumber: string;
 customerName: string;
 customerPhone: string;
 customerNuit: string;
 customerEmail: string;
 items: QuoteItem[];
 subtotal: number;
 discount: number;
 total: number;
 notes: string;
 status: QuoteStatus;
 validUntil: string | null;
 validityDays: number;
 createdAt: string;
 updatedAt: string;
}

type QuoteStatus = 'rascunho' | 'enviada' | 'aceite' | 'rejeitada' | 'convertida' | 'expirada';

interface Stats {
 total: number; rascunho: number; enviada: number;
 aceite: number; convertida: number; expirada: number;
 total_mes: string;
}

interface BankAccount {
 id: string;
 name: string;
 holder: string;
 account: string;
 nib: string;
 iban: string;
 swift: string;
}

const emptyAccount = (): BankAccount => ({ id: crypto.randomUUID(), name: '', holder: '', account: '', nib: '', iban: '', swift: '' });

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number | string) => `MT ${Number(n ?? 0).toFixed(2)}`;
const fmtDate = (iso: string | null) => iso
 ? new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
 : '—';

const STATUS_LABELS: Record<QuoteStatus, string> = {
 rascunho: 'Rascunho', enviada: 'Enviada', aceite: 'Aceite',
 rejeitada: 'Rejeitada', convertida: 'Convertida', expirada: 'Expirada',
};
const STATUS_STYLE: Record<QuoteStatus, string> = {
 rascunho: 'bg-surface-base text-content-secondary dark:text-content-muted',
 enviada: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
 aceite: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
 rejeitada: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300',
 convertida: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
 expirada: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

// ── Quote document builder ─────────────────────────────────────────────────────
function printQuoteDoc(q: Quote, tax: { companyName: string; companyNuit: string; companyAddress: string; companyPhone: string; companyEmail: string; vatRate: number; bankName?: string; bankAccount?: string; bankIban?: string; bankAccountHolder?: string; bankSwift?: string; bankAccounts?: BankAccount[] }, logoUrl = `${window.location.origin}/logo.png`, mode: 'print' | 'preview' | 'download' = 'print', issuer?: { name: string; role?: string }) {
 const vatMult = 1 + tax.vatRate / 100;
 const baseIva = q.total / vatMult;
 const ivaAmt = q.total - baseIva;
 const today = new Date().toLocaleString('pt-PT', { timeZone: 'Africa/Maputo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
 const validStr = q.validUntil ? fmtDate(q.validUntil) : '—';

 // Prefer new bankAccounts array, fall back to legacy single fields
 const accounts: BankAccount[] = (tax.bankAccounts && tax.bankAccounts.length > 0)
 ? tax.bankAccounts
 : (tax.bankName || tax.bankAccount)
 ? [{ id: '1', name: tax.bankName || '', holder: tax.bankAccountHolder || '', account: tax.bankAccount || '', nib: '', iban: tax.bankIban || '', swift: tax.bankSwift || '' }]
 : [];

 const hasBankDetails = accounts.length > 0;
 const rows = q.items.map(c =>
 `<tr>
 <td>${c.productName}${c.variantName ? ` (${c.variantName})` : ''}${c.isPromo ? ' <span style="font-size:9px;background:#fff3cd;color:#b45309;padding:1px 4px;border-radius:3px">PROMO</span>' : ''}</td>
 <td class="r">${c.quantity} ${c.unit}</td>
 <td class="r">${c.isPromo && c.originalPrice ? `<span style="text-decoration:line-through;color:#bbb;font-size:10px">MT ${c.originalPrice.toFixed(2)}</span><br>` : ''}MT ${c.price.toFixed(2)}</td>
 <td class="r">MT ${(c.price * c.quantity).toFixed(2)}</td>
 </tr>`).join('');

 const bankSection = hasBankDetails ? `
<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin-top:16px">
 <div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Dados Bancários para Transferência</div>
 ${accounts.map(acc => `
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#166534;border:1px solid #86efac;border-radius:6px;padding:8px 10px;background:#fff;margin-top:6px">
 ${acc.name ? `<div><span style="color:#888">Banco:</span> <strong>${acc.name}</strong></div>` : ''}
 <div><span style="color:#888">Titular:</span> <strong>${acc.holder || tax.companyName}</strong></div>
 ${acc.account ? `<div><span style="color:#888">Nº Conta:</span> <strong>${acc.account}</strong></div>` : ''}
 ${acc.nib ? `<div><span style="color:#888">NIB:</span> <strong>${acc.nib}</strong></div>` : ''}
 ${acc.iban ? `<div><span style="color:#888">IBAN:</span> <strong>${acc.iban}</strong></div>` : ''}
 ${acc.swift ? `<div><span style="color:#888">SWIFT/BIC:</span> <strong>${acc.swift}</strong></div>` : ''}
 </div>`).join('')}
 </div>
</div>` : '';

 const modeScript = mode === 'print'
 ? `<script>window.onload=()=>{window.print();}<\/script>`
 : mode === 'download'
 ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
<script>window.onload=function(){html2pdf().set({margin:10,filename:'cotacao-${q.quoteNumber}.pdf',html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(document.getElementById('doc')).save().then(function(){setTimeout(function(){window.close();},600);});}<\/script>`
 : `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
<script>function dlPdf(){html2pdf().set({margin:10,filename:'cotacao-${q.quoteNumber}.pdf',html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(document.getElementById('doc')).save();}<\/script>`;

 const toolbar = mode === 'preview' ? `
<div id="toolbar" style="position:sticky;top:0;z-index:100;background:#fff;border-bottom:2px solid #059669;padding:10px 20px;display:flex;gap:8px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.08);">
 <span style="flex:1;font-weight:600;color:#059669;font-size:13px;">Cotação ${q.quoteNumber} — Pré-visualização</span>
 <button onclick="window.print()" style="display:flex;align-items:center;gap:5px;padding:6px 14px;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">&#128438; Imprimir</button>
 <button onclick="dlPdf()" style="display:flex;align-items:center;gap:5px;padding:6px 14px;background:#065f46;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">&#8681; Baixar PDF</button>
 <button onclick="window.close()" style="padding:6px 12px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:12px;">Fechar</button>
</div>` : '';

 const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cotação ${q.quoteNumber}</title>
<style>
 *{margin:0;padding:0;box-sizing:border-box}
 body{font-family:Arial,sans-serif;font-size:12px;color:#111}
 #doc{padding:28px}
 .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
 .company{font-size:18px;font-weight:700;color:#059669}
 .badge{background:#059669;color:#fff;font-size:20px;font-weight:700;padding:8px 18px;border-radius:8px;letter-spacing:1px}
 .num{font-size:12px;color:#555;margin-top:4px;text-align:right}
 .validity{background:#f0fdf4;border:2px solid #059669;border-radius:8px;padding:10px 16px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center}
 .vl{font-size:12px;color:#059669;font-weight:600}
 .vd{font-size:16px;font-weight:700;color:#059669}
 .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
 .info-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px}
 .info-box h4{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:4px}
 table{width:100%;border-collapse:collapse;margin-bottom:14px}
 th{background:#059669;color:#fff;padding:7px 8px;font-size:11px;text-align:left}
 td{padding:6px 8px;font-size:11px;border-bottom:1px solid #e5e7eb}
 tr:nth-child(even) td{background:#f9fafb}
 .r{text-align:right}
 .totals{margin-left:auto;width:260px}
 .totals td{padding:4px 8px;font-size:12px}
 .bold td{font-weight:700;font-size:14px;color:#059669;border-top:2px solid #059669}
 .footer{margin-top:24px;font-size:10px;color:#888;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}
 .warning{background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;font-size:11px;color:#92400e;margin-top:16px;text-align:center;font-weight:600}
 .sig{margin-top:32px;display:flex;justify-content:flex-end}
 .sig-box{width:260px;text-align:center}
 .sig-name{font-family:Georgia,"Times New Roman",serif;font-size:20px;font-style:italic;font-weight:600;color:#059669;letter-spacing:0.5px;margin-bottom:6px;text-shadow:0 1px 1px rgba(5,150,105,0.15)}
 .sig-line{border-top:2px solid #059669;padding-top:5px;font-size:10px;color:#555}
 ${q.notes ? '.notes{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:14px;font-size:11px;color:#555}' : ''}
 @media print{#toolbar{display:none!important}}
</style></head><body>
${toolbar}
<div id="doc">
<div class="header">
 <div style="display:flex;align-items:center;gap:14px">
 <img src="${logoUrl}" onerror="this.style.display='none'" style="max-width:90px;max-height:55px;object-fit:contain">
 <div>
 <div class="company">${tax.companyName}</div>
 <div style="font-size:11px;color:#666;margin-top:3px">NUIT: ${tax.companyNuit || '—'}</div>
 <div style="font-size:11px;color:#666">${tax.companyAddress || ''}</div>
 <div style="font-size:11px;color:#666">${tax.companyPhone || ''} | ${tax.companyEmail || ''}</div>
 </div>
 </div>
 <div style="text-align:right">
 <div class="badge">COTAÇÃO</div>
 <div class="num">${q.quoteNumber}</div>
 <div style="font-size:11px;color:#666;margin-top:4px">Data: ${today}</div>
 </div>
</div>
<div class="validity">
 <div><div class="vl">Validade</div><div style="font-size:11px;color:#555;margin-top:2px">Esta cotação é válida por ${q.validityDays} dias</div></div>
 <div class="vd">Válida até ${validStr}</div>
</div>
<div class="info-grid">
 <div class="info-box"><h4>Emitida por</h4><p><strong>${tax.companyName}</strong></p><p>NUIT: ${tax.companyNuit || '—'}</p><p>${tax.companyPhone || ''}</p></div>
 <div class="info-box"><h4>Cliente</h4><p><strong>${q.customerName || '—'}</strong></p>${q.customerPhone ? `<p>${q.customerPhone}</p>` : ''}${q.customerNuit ? `<p>NUIT: ${q.customerNuit}</p>` : '<p style="font-size:10px;color:#999">NUIT: ______________</p>'}${q.customerEmail ? `<p>${q.customerEmail}</p>` : ''}</div>
</div>
${q.notes ? `<div class="notes"><strong>Notas:</strong> ${q.notes}</div>` : ''}
<table><thead><tr><th>Descrição</th><th class="r">Qtd</th><th class="r">Preço Unit.</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
<table class="totals">
 ${q.discount > 0 ? `<tr><td>Subtotal:</td><td class="r">MT ${q.subtotal.toFixed(2)}</td></tr><tr><td>Desconto:</td><td class="r">- MT ${q.discount.toFixed(2)}</td></tr>` : ''}
 <tr><td>Base s/IVA (${tax.vatRate}%):</td><td class="r">MT ${baseIva.toFixed(2)}</td></tr>
 <tr><td>IVA ${tax.vatRate}%:</td><td class="r">MT ${ivaAmt.toFixed(2)}</td></tr>
 <tr class="bold"><td>TOTAL c/IVA:</td><td class="r">MT ${q.total.toFixed(2)}</td></tr>
</table>
${bankSection}
<div class="warning">Este documento é uma cotação e NÃO constitui um documento fiscal. Não serve como comprovativo de pagamento.</div>
<div class="sig">
 <div class="sig-box">
 <div class="sig-name">${issuer?.name || tax.companyName}</div>
 <div class="sig-line">
 <strong>${issuer?.name || tax.companyName}</strong>${issuer?.role ? ` &middot; ${issuer.role}` : ''}<br>
 ${tax.companyName}<br>
 Emitido em ${today}
 </div>
 </div>
</div>
<div class="footer">Cotação ${q.quoteNumber} | ${today} | ${tax.companyName} | NUIT ${tax.companyNuit || '—'}</div>
</div>
${modeScript}
</body></html>`;
 const win = window.open('', '_blank', mode === 'print' ? 'width=900,height=700' : '');
 if (win) { win.document.write(html); win.document.close(); }
}

// ── Empty form state ───────────────────────────────────────────────────────────
const emptyForm = (): Omit<Quote, 'id' | 'quoteNumber' | 'subtotal' | 'total' | 'createdAt' | 'updatedAt'> => ({
 customerName: '', customerPhone: '', customerNuit: '', customerEmail: '',
 items: [], discount: 0, notes: '',
 status: 'rascunho', validUntil: null, validityDays: 15,
});

// ── Component ──────────────────────────────────────────────────────────────────
export const QuotesPage: React.FC = () => {
 const { currentUser } = useAppAuth();

 const [quotes, setQuotes] = useState<Quote[]>([]);
 const [stats, setStats] = useState<Stats | null>(null);
 const [loading, setLoading] = useState(true);
 const [products, setProducts] = useState<Product[]>([]);
 const [taxConfig, setTaxConfig] = useState<any>({});

 // Filters
 const [search, setSearch] = useState('');
 const [statusFilter, setStatus] = useState('todos');

 // Panel
 const [panelOpen, setPanelOpen] = useState(false);
 const [editing, setEditing] = useState<Quote | null>(null);
 const [form, setForm] = useState(emptyForm());
 const [saving, setSaving] = useState(false);

 // Bank settings panel
 const [settingsOpen, setSettingsOpen] = useState(false);
 const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
 const [accountForm, setAccountForm] = useState<BankAccount | null>(null);
 const [savingBank, setSavingBank] = useState(false);

 // Product search in panel
 const [prodSearch, setProdSearch] = useState('');
 const [deleting, setDeleting] = useState<string | null>(null);

 // ── Load data ────────────────────────────────────────────────────────────────
 const load = useCallback(async () => {
 setLoading(true);
 try {
 const params = new URLSearchParams({ limit: '200' });
 if (statusFilter !== 'todos') params.set('status', statusFilter);
 if (search) params.set('search', search);
 const [{ quotes: qs }, s, p, t] = await Promise.all([
 api.get<{ quotes: Quote[]; total: number }>(`/quotes?${params}`),
 api.get<Stats>('/quotes/stats'),
 api.get<Product[]>('/products'),
 api.get<any>('/tax/config'),
 ]);
 setQuotes(qs);
 setStats(s);
 setProducts(p || []);
 const cfg = t || {};
 setTaxConfig(cfg);
 // Populate bankAccounts — prefer new array, migrate legacy single fields
 const accs: BankAccount[] = Array.isArray(cfg.bankAccounts) && cfg.bankAccounts.length > 0
 ? cfg.bankAccounts
 : (cfg.bankName || cfg.bankAccount)
 ? [{ id: crypto.randomUUID(), name: cfg.bankName || '', holder: cfg.bankAccountHolder || '', account: cfg.bankAccount || '', nib: '', iban: cfg.bankIban || '', swift: cfg.bankSwift || '' }]
 : [];
 setBankAccounts(accs);
 } catch {}
 setLoading(false);
 }, [statusFilter, search]);

 useEffect(() => { load(); }, [load]);

 // ── Open panel ───────────────────────────────────────────────────────────────
 const openNew = () => {
 setEditing(null);
 setForm(emptyForm());
 setProdSearch('');
 setPanelOpen(true);
 };
 const openEdit = (q: Quote) => {
 setEditing(q);
 setForm({
 customerName: q.customerName, customerPhone: q.customerPhone,
 customerNuit: q.customerNuit, customerEmail: q.customerEmail,
 items: [...q.items], discount: q.discount, notes: q.notes,
 status: q.status, validUntil: q.validUntil, validityDays: q.validityDays,
 });
 setProdSearch('');
 setPanelOpen(true);
 };

 // ── Computed totals ──────────────────────────────────────────────────────────
 const subtotal = useMemo(() => form.items.reduce((s, c) => s + c.price * c.quantity, 0), [form.items]);
 const discAmt = Math.min(Math.max(form.discount || 0, 0), subtotal);
 const total = subtotal - discAmt;

 // ── Item helpers ─────────────────────────────────────────────────────────────
 const addProduct = (p: Product) => {
 const ep = getEffectivePrice(p);
 const key = p.id;
 setForm(prev => {
 const existing = prev.items.findIndex(i => i.productId === key && !i.variantName);
 if (existing >= 0) {
 return { ...prev, items: prev.items.map((it, idx) => idx === existing ? { ...it, quantity: it.quantity + 1 } : it) };
 }
 return { ...prev, items: [...prev.items, { productId: p.id, productName: p.name, quantity: 1, unit: p.unit, price: ep.price, isPromo: ep.isPromo, originalPrice: ep.originalPrice }] };
 });
 setProdSearch('');
 };

 const updateItemQty = (idx: number, qty: number) =>
 setForm(prev => ({ ...prev, items: qty <= 0 ? prev.items.filter((_, i) => i !== idx) : prev.items.map((it, i) => i === idx ? { ...it, quantity: qty } : it) }));

 const updateItemPrice = (idx: number, price: number) =>
 setForm(prev => ({ ...prev, items: prev.items.map((it, i) => i === idx ? { ...it, price } : it) }));

 // ── Save ─────────────────────────────────────────────────────────────────────
 const save = async (statusOverride?: QuoteStatus) => {
 setSaving(true);
 try {
 const payload = { ...form, subtotal, discount: discAmt, total, status: statusOverride || form.status };
 if (editing) {
 const updated = await api.put<Quote>(`/quotes/${editing.id}`, payload);
 setQuotes(prev => prev.map(q => q.id === updated.id ? updated : q));
 } else {
 const created = await api.post<Quote>('/quotes', payload);
 setQuotes(prev => [created, ...prev]);
 }
 setPanelOpen(false);
 load();
 } catch {}
 setSaving(false);
 };

 // ── Delete ───────────────────────────────────────────────────────────────────
 const deleteQuote = async (id: string) => {
 if (!confirm('Eliminar esta cotação permanentemente?')) return;
 setDeleting(id);
 await api.delete(`/quotes/${id}`);
 setQuotes(prev => prev.filter(q => q.id !== id));
 setDeleting(null);
 load();
 };

 // ── Status change ─────────────────────────────────────────────────────────────
 const changeStatus = async (q: Quote, status: QuoteStatus) => {
 const updated = await api.put<Quote>(`/quotes/${q.id}`, { status });
 setQuotes(prev => prev.map(x => x.id === updated.id ? updated : x));
 };

 // ── Save bank settings ────────────────────────────────────────────────────────
 const saveBank = async () => {
 setSavingBank(true);
 try {
 const updated = await api.put<any>('/tax/config', { bankAccounts });
 setTaxConfig((prev: any) => ({ ...prev, bankAccounts: updated.bankAccounts || bankAccounts }));
 setSettingsOpen(false);
 } catch {}
 setSavingBank(false);
 };

 const saveAccountForm = () => {
 if (!accountForm) return;
 setBankAccounts(prev => {
 const exists = prev.find(a => a.id === accountForm.id);
 return exists ? prev.map(a => a.id === accountForm.id ? accountForm : a) : [...prev, accountForm];
 });
 setAccountForm(null);
 };

 // ── Quote actions ─────────────────────────────────────────────────────────────
 const issuer = currentUser ? { name: currentUser.name, role: currentUser.role } : undefined;

 const openQuote = (q: Quote, mode: 'print' | 'preview' | 'download') =>
 printQuoteDoc(q, taxConfig, taxConfig.logoUrl || `${window.location.origin}/logo.png`, mode, issuer);
 const handlePrint = (q: Quote) => openQuote(q, 'print');

 // ── Filtered products for search ─────────────────────────────────────────────
 const filteredProds = useMemo(() =>
 prodSearch.trim().length >= 1
 ? products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 8)
 : [],
 [products, prodSearch]);

 // ── Render ────────────────────────────────────────────────────────────────────
 return (
 <PageShell
 title="Cotações"
 description="Gere propostas de preço para os seus clientes"
 compactHeaderMobile
 actions={
 <div className="flex items-center gap-2">
 <button onClick={() => setSettingsOpen(true)}
 title="Configurar dados bancários"
 className="p-2 text-content-muted border border-border-default rounded-lg hover:bg-surface-base transition-colors">
 <Settings className="w-4 h-4" />
 </button>
 <button onClick={openNew}
 className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
 <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nova </span>Cotação
 </button>
 </div>
 }
 >

 {/* ── Stats ── */}
 {stats && (
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
 {[
 { label: 'Total', value: stats.total, sub: 'cotações' },
 { label: 'Rascunho', value: stats.rascunho, sub: 'por enviar' },
 { label: 'Enviadas', value: stats.enviada, sub: 'aguardando' },
 { label: 'Aceites', value: stats.aceite, sub: 'este mês' },
 { label: 'Convertidas', value: stats.convertida, sub: 'em vendas' },
 { label: 'Valor Mês', value: fmt(stats.total_mes), sub: 'total c/IVA', isMoney: true },
 ].map(s => (
 <div key={s.label} className="bg-surface-raised border border-border-default rounded-xl p-4">
 <p className="text-xs text-content-muted font-medium uppercase tracking-wider">{s.label}</p>
 <p className={`mt-1 font-semibold ${s.isMoney ? 'text-content-secondary text-base' : 'text-content-primary text-xl'}`}>{s.value}</p>
 <p className="text-xs text-content-muted mt-0.5">{s.sub}</p>
 </div>
 ))}
 </div>
 )}

 {/* ── Filters ── */}
 <div className="flex flex-col gap-2.5">
 <input
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="Pesquisar cliente ou número..."
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none"
 />
 <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
 {(['todos', 'rascunho', 'enviada', 'aceite', 'rejeitada', 'convertida', 'expirada'] as const).map(s => (
 <button key={s} onClick={() => setStatus(s)}
 className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex-shrink-0 ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-border-default text-content-secondary hover:border-brand-400'}`}>
 {s === 'todos' ? 'Todos' : STATUS_LABELS[s as QuoteStatus]}
 </button>
 ))}
 </div>
 </div>

 {/* ── Table ── */}
 <div className="bg-surface-raised border border-border-default rounded-xl shadow-sm overflow-hidden">
 {loading ? (
 <div className="py-16 text-center text-sm text-content-muted">A carregar...</div>
 ) : quotes.length === 0 ? (
 <div className="py-16 text-center">
 <p className="text-sm text-content-muted font-medium">Nenhuma cotação encontrada</p>
 <p className="text-xs text-content-muted/70 mt-1">Cria a primeira cotação com o botão acima</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full min-w-[700px]">
 <thead>
 <tr className="border-b border-border-default">
 {['Número', 'Cliente', 'Itens', 'Total', 'Estado', 'Válida até', 'Data', ''].map(h => (
 <th key={h} className={`px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wider ${h === '' ? 'text-right' : ''}`}>{h}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-border-default/30">
 {quotes.map(q => (
 <tr key={q.id} className="hover:bg-surface-base transition-colors group">
 <td className="px-4 py-3">
 <span className="font-mono text-xs text-content-secondary font-medium">{q.quoteNumber}</span>
 </td>
 <td className="px-4 py-3">
 <p className="text-sm font-medium text-content-primary">{q.customerName || <span className="text-content-muted italic text-xs">Sem nome</span>}</p>
 {q.customerPhone && <p className="text-xs text-content-muted">{q.customerPhone}</p>}
 </td>
 <td className="px-4 py-3 text-sm text-content-muted">
 {q.items.length} {q.items.length === 1 ? 'item' : 'itens'}
 </td>
 <td className="px-4 py-3">
 <span className="text-sm font-semibold text-content-primary font-mono">{fmt(q.total)}</span>
 </td>
 <td className="px-4 py-3">
 <select
 value={q.status}
 onChange={e => changeStatus(q, e.target.value as QuoteStatus)}
 className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-offset-1 focus:outline-none ${STATUS_STYLE[q.status]}`}
 >
 {Object.entries(STATUS_LABELS).map(([v, l]) => (
 <option key={v} value={v}>{l}</option>
 ))}
 </select>
 </td>
 <td className="px-4 py-3 text-sm text-content-muted">
 {q.validUntil ? (
 <span className={new Date(q.validUntil) < new Date() ? 'text-red-500' : ''}>
 {fmtDate(q.validUntil)}
 </span>
 ) : '—'}
 </td>
 <td className="px-4 py-3 text-xs text-content-muted">{fmtDate(q.createdAt)}</td>
 <td className="px-4 py-3 text-right">
 <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={() => openQuote(q, 'preview')} title="Pré-visualizar"
 className="flex items-center gap-1 px-2 py-1 text-xs text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded font-medium transition-colors">
 <Eye className="w-3 h-3" /> Ver
 </button>
 <button onClick={() => downloadBlob(`/pdf/quote/${q.id}`, `orcamento-${q.quoteNumber || q.id.slice(0,8)}.pdf`).catch(() => {})} title="Descarregar PDF"
 className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded font-medium transition-colors">
 <Download className="w-3 h-3" /> PDF
 </button>
 <button onClick={() => openQuote(q, 'print')} title="Imprimir"
 className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded font-medium transition-colors">
 <Printer className="w-3 h-3" />
 </button>
 <button onClick={() => openEdit(q)} className="px-2 py-1 text-xs text-content-muted hover:text-content-primary hover:bg-surface-base rounded font-medium transition-colors">Editar</button>
 <button onClick={() => deleteQuote(q.id)} disabled={deleting === q.id}
 className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded font-medium transition-colors disabled:opacity-40">
 {deleting === q.id ? '...' : 'Eliminar'}
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* ── Bank Settings Panel ── */}
 {settingsOpen && (
 <>
 <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSettingsOpen(false)} />
 <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface-raised shadow-2xl flex flex-col overflow-hidden">
 <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
 <div>
 <h2 className="text-lg font-semibold text-content-primary">Configurações de Cotações</h2>
 <p className="text-xs text-content-muted mt-0.5">Dados bancários que aparecem na cotação impressa</p>
 </div>
 <button onClick={() => setSettingsOpen(false)}
 className="text-content-muted hover:text-content-primary text-2xl font-light leading-none">&times;</button>
 </div>

 <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
 <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
 <p className="text-xs text-blue-700 dark:text-blue-300">Adicione uma ou mais contas bancárias. Todas aparecem nas cotações impressas.</p>
 </div>

 {bankAccounts.map(acc => (
 <div key={acc.id} className="border border-border-default rounded-xl p-4 space-y-1 relative">
 <div className="flex items-start justify-between gap-2">
 <div className="font-semibold text-sm text-content-primary">{acc.name || '—'}</div>
 <div className="flex gap-1 shrink-0">
 <button onClick={() => setAccountForm({ ...acc })} className="p-1 rounded text-content-muted hover:text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
 <button onClick={() => setBankAccounts(p => p.filter(a => a.id !== acc.id))} className="p-1 rounded text-content-muted hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
 </div>
 </div>
 <p className="text-xs text-content-muted">Titular: <strong>{acc.holder || taxConfig.companyName || '—'}</strong></p>
 {acc.account && <p className="text-xs text-content-muted">Nº Conta: <strong className="font-mono">{acc.account}</strong></p>}
 {acc.nib && <p className="text-xs text-content-muted">NIB: <strong className="font-mono">{acc.nib}</strong></p>}
 {acc.iban && <p className="text-xs text-content-muted">IBAN: <strong className="font-mono">{acc.iban}</strong></p>}
 {acc.swift && <p className="text-xs text-content-muted">SWIFT/BIC: <strong>{acc.swift}</strong></p>}
 </div>
 ))}

 {!accountForm && (
 <button onClick={() => setAccountForm(emptyAccount())}
 className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-border-default rounded-xl text-sm text-content-muted hover:border-brand-400 hover:text-brand-600 transition-colors">
 <Plus className="w-4 h-4" /> Adicionar Conta Bancária
 </button>
 )}

 {accountForm && (
 <div className="border-2 border-brand-300 dark:border-brand-700 rounded-xl p-4 space-y-3 bg-brand-50/40 dark:bg-brand-900/10">
 <div className="flex items-center justify-between">
 <p className="text-sm font-semibold text-content-primary">{bankAccounts.find(a => a.id === accountForm.id) ? 'Editar Conta' : 'Nova Conta'}</p>
 <button onClick={() => setAccountForm(null)}><XIcon className="w-4 h-4 text-content-muted" /></button>
 </div>
 {[
 { key: 'name', label: 'Nome do Banco', placeholder: 'BCI, BIM, Millennium BIM…', mono: false },
 { key: 'holder', label: 'Titular da Conta', placeholder: 'Deixe vazio para usar nome da empresa', mono: false },
 { key: 'account', label: 'Número de Conta', placeholder: '1234 5678 9012 3', mono: true },
 { key: 'nib', label: 'NIB', placeholder: '000300001000000000101', mono: true },
 { key: 'iban', label: 'IBAN (opcional)', placeholder: 'MZ59 0003 0000 1000 0000 1010 1', mono: true },
 { key: 'swift', label: 'SWIFT/BIC (opcional)', placeholder: 'BCIOMZMA', mono: true },
 ].map(f => (
 <div key={f.key}>
 <label className="text-xs font-medium text-content-muted mb-1 block">{f.label}</label>
 <input value={(accountForm as any)[f.key]}
 onChange={e => setAccountForm(p => p ? { ...p, [f.key]: e.target.value } : p)}
 placeholder={f.placeholder}
 className={`w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none ${f.mono ? 'font-mono' : ''}`} />
 </div>
 ))}
 <div className="flex gap-2 pt-1">
 <button onClick={() => setAccountForm(null)} className="flex-1 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-base transition-colors">Cancelar</button>
 <button onClick={saveAccountForm} className="flex-1 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors">Guardar Conta</button>
 </div>
 </div>
 )}
 </div>

 <div className="border-t border-border-default px-6 py-4 flex items-center justify-between gap-3 shrink-0 bg-surface-raised">
 <button onClick={() => setSettingsOpen(false)}
 className="px-4 py-2 text-sm text-content-secondary border border-border-default rounded-lg hover:bg-surface-base transition-colors">
 Cancelar
 </button>
 <button onClick={saveBank} disabled={savingBank}
 className="px-5 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-40 font-medium">
 {savingBank ? 'A guardar...' : 'Guardar Configurações'}
 </button>
 </div>
 </div>
 </>
 )}

 {/* ── Slide-over Panel ── */}
 {panelOpen && (
 <>
 <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setPanelOpen(false)} />
 <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-surface-raised shadow-2xl flex flex-col overflow-hidden">

 <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
 <div>
 <h2 className="text-lg font-semibold text-content-primary">
 {editing ? `Editar ${editing.quoteNumber}` : 'Nova Cotação'}
 </h2>
 <p className="text-xs text-content-muted mt-0.5">
 {editing ? `Criada em ${fmtDate(editing.createdAt)}` : 'O número é gerado automaticamente ao guardar'}
 </p>
 </div>
 <button onClick={() => setPanelOpen(false)}
 className="text-content-muted hover:text-content-primary text-2xl font-light leading-none">&times;</button>
 </div>

 <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

 <section>
 <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3">Cliente</h3>
 <div className="grid grid-cols-2 gap-3">
 <div className="col-span-2">
 <label className="text-xs text-content-muted mb-1 block">Nome</label>
 <input value={form.customerName} onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))}
 placeholder="Nome do cliente"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-content-muted mb-1 block">Telefone</label>
 <input value={form.customerPhone} onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value }))}
 placeholder="84 000 0000"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-content-muted mb-1 block">NUIT (opcional)</label>
 <input value={form.customerNuit} onChange={e => setForm(p => ({ ...p, customerNuit: e.target.value }))}
 placeholder="000000000"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 </div>
 <div className="col-span-2">
 <label className="text-xs text-content-muted mb-1 block">Email (opcional)</label>
 <input value={form.customerEmail} onChange={e => setForm(p => ({ ...p, customerEmail: e.target.value }))}
 placeholder="cliente@email.com" type="email"
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 </div>
 </div>
 </section>

 <section>
 <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3">Produtos</h3>
 <div className="relative mb-3">
 <input value={prodSearch} onChange={e => setProdSearch(e.target.value)}
 placeholder="Pesquisar e adicionar produto..."
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 {filteredProds.length > 0 && (
 <div className="absolute top-full left-0 right-0 mt-1 bg-surface-raised border border-border-default rounded-lg shadow-lg z-10 max-h-52 overflow-y-auto">
 {filteredProds.map(p => {
 const ep = getEffectivePrice(p);
 return (
 <button key={p.id} onClick={() => addProduct(p)}
 className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-base transition-colors">
 <span className="text-sm text-content-primary">{p.name}</span>
 <span className={`text-xs font-mono font-semibold ${ep.isPromo ? 'text-orange-600' : 'text-content-muted'}`}>{fmt(ep.price)}</span>
 </button>
 );
 })}
 </div>
 )}
 </div>

 {form.items.length === 0 ? (
 <div className="border-2 border-dashed border-border-default rounded-lg py-8 text-center">
 <p className="text-sm text-content-muted">Pesquisa acima para adicionar produtos</p>
 </div>
 ) : (
 <div className="border border-border-default rounded-lg overflow-hidden">
 <table className="w-full">
 <thead>
 <tr className="bg-surface-base border-b border-border-default">
 <th className="px-3 py-2 text-left text-xs text-content-muted">Produto</th>
 <th className="px-3 py-2 text-right text-xs text-content-muted w-20">Qtd</th>
 <th className="px-3 py-2 text-right text-xs text-content-muted w-28">Preço Unit.</th>
 <th className="px-3 py-2 text-right text-xs text-content-muted w-24">Total</th>
 <th className="px-3 py-2 w-8"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border-default/30">
 {form.items.map((item, idx) => (
 <tr key={idx}>
 <td className="px-3 py-2 text-sm text-content-primary">
 {item.productName}
 {item.isPromo && <span className="ml-1 text-[9px] bg-orange-100 text-orange-600 px-1 rounded font-bold">PROMO</span>}
 </td>
 <td className="px-3 py-2 text-right">
 <input type="number" min="1" value={item.quantity}
 onChange={e => updateItemQty(idx, parseInt(e.target.value) || 1)}
 className="w-16 px-2 py-1 text-sm text-right border border-border-default rounded bg-surface-raised text-content-primary focus:ring-1 focus:ring-brand-500 focus:outline-none" />
 </td>
 <td className="px-3 py-2 text-right">
 <input type="number" min="0" step="0.01" value={item.price}
 onChange={e => updateItemPrice(idx, parseFloat(e.target.value) || 0)}
 className="w-24 px-2 py-1 text-sm text-right border border-border-default rounded bg-surface-raised text-content-primary focus:ring-1 focus:ring-brand-500 focus:outline-none" />
 </td>
 <td className="px-3 py-2 text-right text-sm font-mono text-content-secondary">
 {fmt(item.price * item.quantity)}
 </td>
 <td className="px-3 py-2 text-right">
 <button onClick={() => updateItemQty(idx, 0)}
 className="text-xs text-red-400 hover:text-red-600 font-medium">&times;</button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </section>

 <section className="grid grid-cols-2 gap-4">
 <div className="space-y-3">
 <div>
 <label className="text-xs text-content-muted mb-1 block">Desconto (MT)</label>
 <input type="number" min="0" value={form.discount}
 onChange={e => setForm(p => ({ ...p, discount: parseFloat(e.target.value) || 0 }))}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-content-muted mb-1 block">Validade (dias)</label>
 <input type="number" min="1" value={form.validityDays}
 onChange={e => setForm(p => ({ ...p, validityDays: parseInt(e.target.value) || 15 }))}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 </div>
 <div>
 <label className="text-xs text-content-muted mb-1 block">Data limite (opcional)</label>
 <input type="date" value={form.validUntil ?? ''}
 onChange={e => setForm(p => ({ ...p, validUntil: e.target.value || null }))}
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
 </div>
 </div>
 <div className="bg-surface-base rounded-xl p-4 space-y-2">
 {discAmt > 0 && (
 <>
 <div className="flex justify-between text-xs text-content-muted"><span>Subtotal</span><span className="font-mono">{fmt(subtotal)}</span></div>
 <div className="flex justify-between text-xs text-red-500"><span>Desconto</span><span className="font-mono">- {fmt(discAmt)}</span></div>
 </>
 )}
 <div className="flex justify-between text-sm font-bold text-content-primary pt-1 border-t border-border-default">
 <span>Total c/IVA</span>
 <span className="font-mono">{fmt(total)}</span>
 </div>
 </div>
 </section>

 <section>
 <label className="text-xs text-content-muted mb-1 block">Notas internas (opcional)</label>
 <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
 rows={2} placeholder="Condições especiais, prazo de entrega, etc."
 className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none" />
 </section>
 </div>

 <div className="border-t border-border-default px-6 py-4 flex items-center justify-between gap-3 shrink-0 bg-surface-raised">
 <button onClick={() => setPanelOpen(false)}
 className="px-4 py-2 text-sm text-content-secondary border border-border-default rounded-lg hover:bg-surface-base transition-colors">
 Cancelar
 </button>
 <div className="flex gap-2">
 <button onClick={() => save('rascunho')} disabled={saving || !form.items.length}
 className="px-4 py-2 text-sm border border-border-default text-content-secondary rounded-lg hover:bg-surface-base transition-colors disabled:opacity-40">
 Guardar Rascunho
 </button>
 <button onClick={() => save('enviada')} disabled={saving || !form.items.length}
 className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-40 font-medium">
 {saving ? 'A guardar...' : 'Guardar e Marcar Enviada'}
 </button>
 </div>
 </div>
 </div>
 </>
 )}
 </PageShell>
 );
};
