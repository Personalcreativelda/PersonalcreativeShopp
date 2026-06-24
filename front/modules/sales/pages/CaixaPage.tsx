import React, { useState, useEffect, useCallback } from 'react';
import {
 Store, Printer, Clock, Banknote, Smartphone,
 CreditCard, CheckCircle, RefreshCw, Download,
} from 'lucide-react';
import api, { downloadBlob } from '../../core/services/apiClient';
import { PageShell } from '../../core/components/layout/PageShell';
import type { Toast } from '../../core/components/ui/Toast';

interface CaixaPageProps {
 showToast?: (msg: string, type: Toast['type']) => void;
}

type PosSession = {
 id: string; cashier_name: string; cashier_id: string;
 opened_at: string; closed_at?: string; initial_amount: number; is_open: boolean;
};
type ByMethod = { method: string; count: number; total: number };
type CloseReport = {
 session: PosSession;
 summary: { totalSales: number; totalOrders: number; byMethod: ByMethod[]; expectedCash: number };
};
type SessionHistory = {
 id: string; cashierName: string; openedAt: string; closedAt?: string;
 initialAmount: number; isOpen: boolean;
 totalSales: number; totalOrders: number;
 summary?: CloseReport['summary'] | null;
};
type Order = {
 id: string; orderNumber?: string; customerName?: string;
 totalAmount: number; paymentMethod?: string;
 createdAt: string; created_at?: string; source?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const TZ = 'Africa/Maputo';
const PAY_LABELS: Record<string, string> = { cash: 'Dinheiro', mpesa: 'M-Pesa', transfer: 'Transferência' };
const fmt = (n: number | string) => `MT ${Number(n ?? 0).toFixed(2)}`;
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDuration = (from: string) => {
 const m = Math.floor((Date.now() - new Date(from).getTime()) / 60000);
 return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

function printCloseReport(
 s: PosSession,
 summary: CloseReport['summary'],
 companyName = 'NaturErva',
 logoUrl = `${window.location.origin}/logo.png`,
) {
 const f = (n: number) => `MT ${Number(n).toFixed(2)}`;
 const rows = summary.byMethod.map(m =>
 `<tr><td>${PAY_LABELS[m.method] || m.method}</td><td style="text-align:center">${m.count}</td><td style="text-align:right">${f(m.total)}</td></tr>`
 ).join('') || '<tr><td colspan="3" style="text-align:center">Sem vendas</td></tr>';
 const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fecho de Caixa</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:12px}.c{text-align:center}.b{font-weight:bold}.lg{font-size:15px}hr{border:none;border-top:1px dashed #000;margin:7px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}img.logo{display:block;margin:0 auto 6px;max-width:110px;max-height:55px;object-fit:contain}</style>
</head><body>
<div class="c"><img class="logo" src="${logoUrl}" alt="" onerror="this.style.display='none'"><p class="b lg">${companyName}</p><p>FECHO DE CAIXA</p></div><hr>
<p>Caixa: ${s.cashier_name}</p>
<p>Abertura: ${new Date(s.opened_at).toLocaleString('pt-PT', { timeZone: TZ })}</p>
<p>Fecho: ${s.closed_at ? new Date(s.closed_at).toLocaleString('pt-PT', { timeZone: TZ }) : '—'}</p>
<p>Fundo inicial: ${f(Number(s.initial_amount))}</p><hr>
<table><tr><td class="b">Método</td><td class="b" style="text-align:center">Qtd</td><td class="b" style="text-align:right">Total</td></tr>${rows}</table><hr>
<table>
 <tr><td class="b">Total Vendas:</td><td class="b" style="text-align:right">${f(summary.totalSales)}</td></tr>
 <tr><td>Transações:</td><td style="text-align:right">${summary.totalOrders}</td></tr>
 <tr><td>Fundo esperado:</td><td style="text-align:right">${f(summary.expectedCash)}</td></tr>
</table><hr>
<div class="c"><p>Relatório de Fecho de Caixa</p></div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script>
</body></html>`;
 const w = window.open('', '_blank', 'width=360,height=680');
 if (w) { w.document.write(html); w.document.close(); }
}

// ── Component ─────────────────────────────────────────────────────────────────
export const CaixaPage: React.FC<CaixaPageProps> = ({ showToast }) => {
 const [tab, setTab] = useState<'atual' | 'anteriores'>('atual');
 const [session, setSession] = useState<PosSession | null | 'loading'>('loading');
 const [sessions, setSessions] = useState<SessionHistory[]>([]);
 const [loadingSessions, setLoadingSessions] = useState(false);
 const [recentOrders, setRecentOrders] = useState<Order[]>([]);
 const [taxConfig, setTaxConfig] = useState<any>({});
 const [initialAmt, setInitialAmt] = useState('');
 const [opening, setOpening] = useState(false);
 const [closing, setClosing] = useState(false);
 const [closeReport, setCloseReport] = useState<CloseReport | null>(null);

 const loadOrders = useCallback(async (sess: PosSession) => {
 try {
 const data = await api.get<any>('/orders?limit=100');
 const list: Order[] = Array.isArray(data) ? data : (data?.orders || data?.data || []);
 const sessionStart = new Date(sess.opened_at);
 setRecentOrders(
 list.filter(o => {
 const dt = new Date(o.createdAt || o.created_at || 0);
 const src = o.source || '';
 return dt >= sessionStart && src === 'pos';
 })
 );
 } catch { setRecentOrders([]); }
 }, []);

 const loadAll = useCallback(async () => {
 try {
 const [s, t] = await Promise.all([
 api.get<PosSession | null>('/pos/session/current'),
 api.get<any>('/tax/config'),
 ]);
 setSession(s);
 setTaxConfig(t || {});
 if (s?.is_open) loadOrders(s);
 } catch { setSession(null); }
 }, [loadOrders]);

 const loadSessions = useCallback(async () => {
 if (loadingSessions) return;
 setLoadingSessions(true);
 try { setSessions((await api.get<SessionHistory[]>('/pos/sessions')) || []); } catch {}
 setLoadingSessions(false);
 }, [loadingSessions]);

 useEffect(() => { loadAll(); }, [loadAll]);
 useEffect(() => { if (tab === 'anteriores') loadSessions(); }, [tab]);

 const handleOpen = async () => {
 setOpening(true);
 try {
 const s = await api.post<PosSession>('/pos/session/open', { initialAmount: parseFloat(initialAmt) || 0 });
 setSession(s);
 setInitialAmt('');
 setRecentOrders([]);
 } catch (e: any) { showToast?.(e.message || 'Erro ao abrir caixa', 'error'); }
 setOpening(false);
 };

 const handleClose = async () => {
 if (!confirm('Confirmas o fecho da caixa?')) return;
 setClosing(true);
 try {
 const r = await api.post<CloseReport>('/pos/session/close', {});
 setCloseReport(r);
 setSession(null);
 setRecentOrders([]);
 } catch (e: any) { showToast?.(e.message || 'Erro ao fechar caixa', 'error'); }
 setClosing(false);
 };

 const liveByMethod = ['cash', 'mpesa', 'transfer'].map(method => {
 const orders = recentOrders.filter(o => (o.paymentMethod || 'cash') === method);
 return { method, count: orders.length, total: orders.reduce((s, o) => s + Number(o.totalAmount), 0) };
 });
 const liveTotalSales = recentOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
 const sess = session as PosSession | null;
 const logoUrl = taxConfig.logoUrl || `${window.location.origin}/logo.png`;

 // ── Loading ──────────────────────────────────────────────────────────────────
 if (session === 'loading') return (
 <div className="flex items-center justify-center h-48">
 <div className="text-center text-content-muted">
 <Store className="w-10 h-10 mx-auto mb-3 animate-pulse" />
 <p className="text-sm">A carregar caixa...</p>
 </div>
 </div>
 );

 // ── Status badge ─────────────────────────────────────────────────────────────
 const statusBadge = sess ? (
 <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full border border-green-200 dark:border-green-800">
 <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
 Aberta há {fmtDuration(sess.opened_at)}
 </span>
 ) : (
 <span className="text-xs font-medium px-2.5 py-1 bg-surface-base text-content-muted rounded-full border border-border-default">Fechada</span>
 );

 // ── Close Report ─────────────────────────────────────────────────────────────
 if (closeReport) {
 const { summary, session: s } = closeReport;
 return (
 <PageShell title="Caixa" description="Sessão encerrada" compactHeaderMobile>
 <div className="max-w-md mx-auto">
 <div className="bg-surface-raised rounded-2xl border border-border-default overflow-hidden shadow-sm">
 <div className="px-6 py-6 text-white text-center" style={{ background: 'var(--brand-600)' }}>
 <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-90" />
 <h2 className="text-xl font-bold">Caixa Fechada</h2>
 <p className="text-sm mt-1 opacity-80">
 {fmtTime(s.opened_at)} → {s.closed_at ? fmtTime(s.closed_at) : '—'} · {fmtDuration(s.opened_at)}
 </p>
 <p className="text-sm opacity-80">{s.cashier_name}</p>
 </div>
 <div className="p-6 space-y-4">
 <div className="grid grid-cols-2 gap-3">
 <div className="bg-surface-base rounded-xl p-4 text-center">
 <p className="text-2xl font-bold text-content-primary">{summary.totalOrders}</p>
 <p className="text-xs text-content-muted mt-1">Vendas realizadas</p>
 </div>
 <div className="bg-surface-base rounded-xl p-4 text-center">
 <p className="text-xl font-bold" style={{ color: 'var(--brand-600)' }}>{fmt(summary.totalSales)}</p>
 <p className="text-xs text-content-muted mt-1">Total vendido</p>
 </div>
 </div>
 <div className="space-y-2">
 <p className="text-xs font-semibold text-content-muted uppercase tracking-wide">Por método de pagamento</p>
 {summary.byMethod.length === 0
 ? <p className="text-sm text-content-muted text-center py-3">Nenhuma venda</p>
 : summary.byMethod.map(m => (
 <div key={m.method} className="flex items-center justify-between bg-surface-base rounded-lg px-4 py-2.5">
 <div>
 <p className="text-sm font-medium text-content-primary">{PAY_LABELS[m.method] || m.method}</p>
 <p className="text-xs text-content-muted">{m.count} {m.count === 1 ? 'venda' : 'vendas'}</p>
 </div>
 <p className="font-semibold text-content-primary font-mono">{fmt(m.total)}</p>
 </div>
 ))}
 </div>
 <div className="flex items-center justify-between bg-surface-base rounded-xl px-4 py-3 border border-border-default">
 <div>
 <p className="text-sm font-medium text-content-secondary">Fundo esperado em caixa</p>
 <p className="text-xs text-content-muted">Fundo inicial + vendas a dinheiro</p>
 </div>
 <p className="text-xl font-bold text-green-600">{fmt(summary.expectedCash)}</p>
 </div>
 <div className="flex gap-2 pt-1">
 <button
 onClick={() => printCloseReport(s, summary, taxConfig.companyName, logoUrl)}
 className="flex items-center justify-center gap-1.5 py-2.5 px-4 border border-border-default text-content-secondary rounded-xl hover:bg-surface-base transition-colors text-sm font-medium">
 <Printer className="w-4 h-4" />Imprimir
 </button>
 <button
 onClick={() => downloadBlob(`/pdf/pos-session/${s.id}?format=A4`, `caixa-${s.id.slice(0,8)}.pdf`).catch(() => {})}
 className="flex items-center justify-center gap-1.5 py-2.5 px-4 border border-border-default text-content-secondary rounded-xl hover:bg-surface-base transition-colors text-sm font-medium">
 <Download className="w-4 h-4" />PDF
 </button>
 <button
 onClick={() => { setCloseReport(null); setTab('atual'); }}
 className="flex-1 py-2.5 text-white font-semibold rounded-xl transition-colors text-sm"
 style={{ background: 'var(--brand-600)' }}>
 Abrir Nova Caixa
 </button>
 </div>
 </div>
 </div>
 </div>
 </PageShell>
 );
 }

 // ── Main layout ───────────────────────────────────────────────────────────────
 return (
 <PageShell
 title="Caixa"
 description="Gerencie a sua sessão de caixa"
 actions={statusBadge}
 compactHeaderMobile
 >
 {/* Tabs — margens negativas para ir de borda a borda dentro do <main> */}
 <div className="border-b border-border-default -mx-3 sm:-mx-4 md:-mx-8 px-3 sm:px-4 md:px-8">
 <div className="flex">
 {([
 { id: 'atual', label: 'Caixa Atual' },
 { id: 'anteriores', label: 'Caixas Anteriores' },
 ] as const).map(t => (
 <button key={t.id} onClick={() => setTab(t.id)}
 className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
 tab === t.id
 ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
 : 'border-transparent text-content-muted hover:text-content-primary'
 }`}>
 {t.label}
 </button>
 ))}
 </div>
 </div>

 {/* ── Tab: Caixa Atual — sem sessão ──────────────────────────────────── */}
 {tab === 'atual' && !sess && (
 <div className="flex items-center justify-center py-8 sm:py-16">
 <div className="bg-surface-raised rounded-2xl border border-border-default p-6 sm:p-8 w-full max-w-sm text-center shadow-sm">
 <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
 style={{ background: 'color-mix(in srgb, var(--brand-600) 10%, transparent)' }}>
 <Store className="w-8 h-8" style={{ color: 'var(--brand-600)' }} />
 </div>
 <h2 className="text-xl font-bold text-content-primary mb-1">Abrir Caixa</h2>
 <p className="text-sm text-content-muted mb-6">Introduz o fundo de maneio para iniciar a sessão</p>
 <label className="text-xs font-medium text-content-muted mb-1.5 block text-left">Fundo inicial (MT)</label>
 <input
 type="number" value={initialAmt}
 onChange={e => setInitialAmt(e.target.value)}
 placeholder="0.00" min={0}
 onKeyDown={e => e.key === 'Enter' && handleOpen()}
 className="w-full px-4 py-3 rounded-xl border border-border-default bg-surface-base text-lg font-semibold text-center focus:ring-2 focus:ring-brand-500 focus:outline-none mb-4 text-content-primary"
 />
 <button onClick={handleOpen} disabled={opening}
 className="w-full py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
 style={{ background: 'var(--brand-600)' }}>
 {opening ? 'A abrir...' : 'Abrir Caixa'}
 </button>
 </div>
 </div>
 )}

 {/* ── Tab: Caixa Atual — sessão aberta — 3 colunas ──────────────────── */}
 {tab === 'atual' && sess && (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

 {/* Col 1: Resumo */}
 <div className="bg-surface-raised border border-border-default rounded-xl shadow-sm overflow-hidden">
 <div className="px-5 py-4 border-b border-border-default flex items-center justify-between">
 <h3 className="text-sm font-semibold text-content-primary">Resumo do Caixa</h3>
 <button onClick={loadAll} title="Atualizar"
 className="text-content-muted hover:text-content-primary transition-colors p-1 rounded">
 <RefreshCw className="w-3.5 h-3.5" />
 </button>
 </div>
 <div className="p-5 space-y-4">
 <div className="flex items-center gap-2 text-xs text-content-muted">
 <Clock className="w-3.5 h-3.5 shrink-0" />
 <span>Aberto {fmtTime(sess.opened_at)} ({fmtDuration(sess.opened_at)})</span>
 </div>
 <div className="space-y-2.5">
 <div className="flex justify-between items-center">
 <span className="text-sm text-content-muted">Saldo inicial</span>
 <span className="text-sm font-semibold text-content-primary font-mono">{fmt(sess.initial_amount)}</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-sm text-content-muted">Total de vendas</span>
 <span className="text-sm font-semibold font-mono" style={{ color: 'var(--brand-600)' }}>{fmt(liveTotalSales)}</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-sm text-content-muted">Nº de vendas</span>
 <span className="text-sm font-semibold text-content-primary">{recentOrders.length}</span>
 </div>
 <div className="flex justify-between items-center border-t border-border-default pt-3 mt-1">
 <span className="text-sm font-medium text-content-secondary">Saldo Final (est.)</span>
 <span className="text-base font-bold text-content-primary font-mono">
 {fmt(Number(sess.initial_amount) + liveTotalSales)}
 </span>
 </div>
 </div>
 <div className="text-xs text-content-muted bg-surface-base rounded-lg px-3 py-2">
 Caixeiro: <span className="font-medium text-content-secondary">{sess.cashier_name}</span>
 </div>
 </div>
 </div>

 {/* Col 2: Meios de Pagamento */}
 <div className="bg-surface-raised border border-border-default rounded-xl shadow-sm overflow-hidden">
 <div className="px-5 py-4 border-b border-border-default">
 <h3 className="text-sm font-semibold text-content-primary">Meio de Pagamento</h3>
 </div>
 <div className="p-5 space-y-3">
 {liveByMethod.map(m => {
 const icon = m.method === 'cash'
 ? <Banknote className="w-5 h-5" />
 : m.method === 'mpesa'
 ? <Smartphone className="w-5 h-5" />
 : <CreditCard className="w-5 h-5" />;
 const color = m.method === 'cash'
 ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
 : m.method === 'mpesa'
 ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400'
 : 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
 return (
 <div key={m.method} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
 m.total > 0 ? 'bg-surface-base border-border-default' : 'bg-surface-raised border-border-default/50'
 }`}>
 <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
 {icon}
 </div>
 <div className="flex-1">
 <p className="text-sm font-medium text-content-primary">{PAY_LABELS[m.method]}</p>
 {m.count > 0 && (
 <p className="text-xs text-content-muted">{m.count} {m.count === 1 ? 'venda' : 'vendas'}</p>
 )}
 </div>
 <span className={`text-sm font-semibold font-mono ${m.total > 0 ? 'text-content-primary' : 'text-content-muted/50'}`}>
 {fmt(m.total)}
 </span>
 </div>
 );
 })}
 </div>
 </div>

 {/* Col 3: Movimentações + Fechar */}
 <div className="bg-surface-raised border border-border-default rounded-xl shadow-sm overflow-hidden flex flex-col">
 <div className="px-5 py-4 border-b border-border-default flex items-center justify-between shrink-0">
 <h3 className="text-sm font-semibold text-content-primary">Movimentação</h3>
 <span className="text-xs text-content-muted bg-surface-base px-2 py-0.5 rounded-full border border-border-default">
 {recentOrders.length} {recentOrders.length === 1 ? 'venda' : 'vendas'}
 </span>
 </div>
 <div className="flex-1 overflow-y-auto" style={{ maxHeight: '360px' }}>
 <div className="flex items-start gap-3 px-5 py-3.5 border-b border-border-default/30">
 <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--brand-600)' }} />
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2">
 <span className="text-xs font-semibold text-content-primary">{fmt(sess.initial_amount)}</span>
 <span className="text-[10px] text-content-muted">{fmtTime(sess.opened_at)}</span>
 </div>
 <p className="text-[10px] text-content-muted mt-0.5">Abertura de Caixa · Dinheiro</p>
 </div>
 </div>
 {recentOrders.length === 0 ? (
 <div className="px-5 py-10 text-center">
 <p className="text-xs text-content-muted">Nenhuma venda nesta sessão</p>
 <p className="text-[10px] text-content-muted/60 mt-1">As vendas aparecem aqui em tempo real</p>
 </div>
 ) : (
 [...recentOrders].reverse().map(o => (
 <div key={o.id} className="flex items-start gap-3 px-5 py-3 border-b border-border-default/30 hover:bg-surface-base transition-colors">
 <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2">
 <span className="text-xs font-semibold text-content-primary">{fmt(o.totalAmount)}</span>
 <span className="text-[10px] text-content-muted">{fmtTime(o.createdAt)}</span>
 </div>
 <p className="text-[10px] text-content-muted truncate mt-0.5">
 {o.customerName || 'Cliente POS'} · {PAY_LABELS[o.paymentMethod || 'cash'] || o.paymentMethod}
 </p>
 </div>
 </div>
 ))
 )}
 </div>
 <div className="border-t border-border-default p-5 space-y-3 shrink-0">
 <div className="flex items-center justify-between">
 <span className="text-sm text-content-muted font-medium">Saldo Final</span>
 <span className="text-xl font-bold text-content-primary font-mono">
 {fmt(Number(sess.initial_amount) + liveTotalSales)}
 </span>
 </div>
 <button onClick={handleClose} disabled={closing}
 className="w-full py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm"
 style={{ background: 'var(--brand-600)' }}>
 {closing ? 'A fechar...' : 'Fechar Caixa'}
 </button>
 </div>
 </div>

 </div>
 )}

 {/* ── Tab: Caixas Anteriores ──────────────────────────────────────────── */}
 {tab === 'anteriores' && (
 <div className="bg-surface-raised border border-border-default rounded-xl shadow-sm overflow-hidden">
 {loadingSessions ? (
 <div className="py-16 text-center text-sm text-content-muted">A carregar...</div>
 ) : sessions.length === 0 ? (
 <div className="py-16 text-center">
 <p className="text-sm text-content-muted">Nenhuma sessão anterior encontrada</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full min-w-[600px]">
 <thead>
 <tr className="border-b border-border-default">
 {['Caixeiro', 'Abertura', 'Fecho', 'Fundo Inicial', 'Vendas', 'Total', 'Estado', ''].map(h => (
 <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wider">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-border-default/30">
 {sessions.map(s => (
 <tr key={s.id} className="hover:bg-surface-base transition-colors">
 <td className="px-4 py-3 text-sm font-medium text-content-primary">{s.cashierName}</td>
 <td className="px-4 py-3 text-xs text-content-muted">
 <div>{fmtDate(s.openedAt)}</div>
 <div className="text-content-muted/70">{fmtTime(s.openedAt)}</div>
 </td>
 <td className="px-4 py-3 text-xs text-content-muted">
 {s.closedAt ? (
 <><div>{fmtDate(s.closedAt)}</div><div className="text-content-muted/70">{fmtTime(s.closedAt)}</div></>
 ) : '—'}
 </td>
 <td className="px-4 py-3 text-sm font-mono text-content-secondary">{fmt(s.initialAmount)}</td>
 <td className="px-4 py-3 text-sm text-content-muted">{s.totalOrders}</td>
 <td className="px-4 py-3 text-sm font-semibold font-mono text-content-primary">{fmt(s.totalSales)}</td>
 <td className="px-4 py-3">
 {s.isOpen
 ? <span className="inline-flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium border border-green-200 dark:border-green-800"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Aberta</span>
 : <span className="text-xs bg-surface-base text-content-muted px-2 py-0.5 rounded-full border border-border-default">Fechada</span>}
 </td>
 <td className="px-4 py-3 text-right">
 {!s.isOpen && s.summary && (
 <button
 onClick={() => {
 const ps: PosSession = { id: s.id, cashier_name: s.cashierName, cashier_id: '', opened_at: s.openedAt, closed_at: s.closedAt, initial_amount: s.initialAmount, is_open: false };
 printCloseReport(ps, s.summary!, taxConfig.companyName, logoUrl);
 }}
 className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border-default text-content-secondary rounded-lg hover:bg-surface-base transition-colors">
 <Printer className="w-3 h-3" />Imprimir
 </button>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 )}

 </PageShell>
 );
};
