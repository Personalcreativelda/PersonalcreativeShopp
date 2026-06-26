import React, { useState, useEffect, useRef } from 'react';
import { Save, Loader2, FileText, TrendingUp, Receipt, Printer, Store, CheckCircle, XCircle, Clock, Upload, Image, Download, FileSpreadsheet } from 'lucide-react';
import { PageShell } from '../../core/components/layout/PageShell';
import api, { downloadBlob } from '../../core/services/apiClient';
import { uploadService } from '../../../services/uploadService';
import { invalidateLogoCache } from '../../core/services/systemSettingsService';
import type { Toast } from '../../core/components/ui/Toast';

interface FinancasProps {
 showToast?: (msg: string, type: Toast['type']) => void;
}

type TaxConfig = {
 companyName: string; companyNuit: string; companyAddress: string;
 companyPhone: string; companyEmail: string;
 vatRate: number; invoicePrefix: string;
 logoUrl?: string; logoIconUrl?: string;
 siteTitle?: string;
};

type TaxReport = {
 vatRate: number; ordersCount: number;
 totalIncVat: number; totalExVat: number; totalVat: number;
 byMonth: { month: string; count: number; incVat: number; exVat: number; vat: number }[];
};

const fmt = (n: number) => `MT ${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const TAB = { CONFIG: 'config', REPORT: 'report', SESSIONS: 'sessions', EXPORT: 'export', AR: 'ar' } as const;

const thisMonth = () => {
 const d = new Date();
 const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
 return { start: `${y}-${m}-01`, end: `${y}-${m}-${new Date(y, d.getMonth() + 1, 0).getDate()}` };
};

export const Financas: React.FC<FinancasProps> = ({ showToast }) => {
 const [tab, setTab] = useState<'config' | 'report' | 'sessions' | 'export' | 'ar'>(TAB.CONFIG);

 type Session = { id: string; cashierName: string; openedAt: string; closedAt?: string; initialAmount: number; isOpen: boolean; totalSales: number; totalOrders: number; summary?: any };
 const [sessions, setSessions] = useState<Session[]>([]);
 const [loadingSessions, setLoadingSessions] = useState(false);
 const [config, setConfig] = useState<TaxConfig>({
 companyName: '', companyNuit: '', companyAddress: '',
 companyPhone: '', companyEmail: '', vatRate: 16, invoicePrefix: 'FACT',
 logoUrl: '', logoIconUrl: '', siteTitle: '',
 });
 const [saving, setSaving] = useState(false);
 const [uploadingLogo, setUploadingLogo] = useState(false);
 const [uploadingIcon, setUploadingIcon] = useState(false);
 const logoInputRef = useRef<HTMLInputElement>(null);
 const iconInputRef = useRef<HTMLInputElement>(null);
 const [reportStart, setReportStart] = useState(thisMonth().start);
 const [reportEnd, setReportEnd] = useState(thisMonth().end);
 const [report, setReport] = useState<TaxReport | null>(null);
 const [loadingReport, setLoadingReport] = useState(false);

 useEffect(() => {
 api.get<any>('/tax/config').then(c => {
 if (c && c.companyName !== undefined) setConfig(c);
 }).catch(() => {});
 }, []);

 const handleSaveConfig = async () => {
 setSaving(true);
 try {
 const updated = await api.put<TaxConfig>('/tax/config', config);
 setConfig(updated);
 invalidateLogoCache();
 window.dispatchEvent(new Event('logo:updated'));
 showToast?.('Configuração guardada', 'success');
 } catch (e: any) {
 showToast?.(e.message || 'Erro ao guardar', 'error');
 } finally { setSaving(false); }
 };

 const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'logoIconUrl') => {
 const file = e.target.files?.[0];
 if (!file) return;
 const setUploading = field === 'logoUrl' ? setUploadingLogo : setUploadingIcon;
 setUploading(true);
 try {
 const result = await uploadService.uploadImage(file, 'logo', 1600);
 if (result?.url) {
 setConfig(p => ({ ...p, [field]: result.url }));
 showToast?.('Imagem carregada — clique em Guardar para aplicar', 'success');
 } else {
 showToast?.('Erro ao carregar imagem', 'error');
 }
 } catch (e: any) {
 showToast?.(e.message || 'Erro ao carregar imagem', 'error');
 } finally {
 setUploading(false);
 e.target.value = '';
 }
 };

 const handleLoadReport = async () => {
 setLoadingReport(true);
 try {
 const r = await api.get<TaxReport>(`/tax/report?start=${reportStart}&end=${reportEnd}`);
 setReport(r);
 } catch (e: any) {
 showToast?.(e.message || 'Erro ao carregar relatório', 'error');
 } finally { setLoadingReport(false); }
 };

 const handlePrintReport = () => {
 if (!report) return;
 const rows = report.byMonth.map(m =>
 `<tr><td>${m.month}</td><td>${m.count}</td><td>${fmt(m.incVat)}</td><td>${fmt(m.exVat)}</td><td>${fmt(m.vat)}</td></tr>`
 ).join('');
 const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório IVA</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin-bottom:4px}p{font-size:12px;color:#555;margin:2px 0}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:8px;font-size:12px;text-align:right}th{background:#f0f0f0;text-align:center}.left{text-align:left}.total{font-weight:bold;background:#e8f5e9}</style>
</head><body>
<h1>RELATÓRIO DE IVA — ${config.companyName}</h1>
<p>NUIT: ${config.companyNuit || '—'} | Período: ${reportStart} a ${reportEnd}</p>
<table>
 <thead><tr><th class="left">Mês</th><th>Nº Vendas</th><th>Total c/IVA</th><th>Base s/IVA</th><th>IVA (${report.vatRate}%)</th></tr></thead>
 <tbody>${rows}</tbody>
 <tfoot>
 <tr class="total"><td class="left"><strong>TOTAL</strong></td><td>${report.ordersCount}</td><td>${fmt(report.totalIncVat)}</td><td>${fmt(report.totalExVat)}</td><td>${fmt(report.totalVat)}</td></tr>
 </tfoot>
</table>
<p style="margin-top:16px;font-size:11px;color:#888">Gerado em ${new Date().toLocaleString('pt-PT', { timeZone: 'Africa/Maputo' })} · IVA a entregar às Finanças: ${fmt(report.totalVat)}</p>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;
 const w = window.open('', '_blank', 'width=800,height=600');
 if (w) { w.document.write(html); w.document.close(); }
 };

 const loadSessions = async () => {
 setLoadingSessions(true);
 try { setSessions(await api.get<Session[]>('/pos/sessions')); }
 catch { showToast?.('Erro ao carregar sessões', 'error'); }
 finally { setLoadingSessions(false); }
 };

 const closeSession = async () => {
 if (!confirm('Fechar a sessão de caixa actual?')) return;
 try {
 await api.post('/pos/session/close', {});
 showToast?.('Sessão fechada', 'success');
 loadSessions();
 } catch (e: any) { showToast?.(e.message, 'error'); }
 };

 const openSession = async () => {
 const amt = window.prompt('Fundo inicial (MT):', '0');
 if (amt === null) return;
 try {
 await api.post('/pos/session/open', { initialAmount: parseFloat(amt) || 0 });
 showToast?.('Caixa aberta', 'success');
 loadSessions();
 } catch (e: any) { showToast?.(e.message, 'error'); }
 };

 const printSession = (s: Session) => {
 const PAY_LABELS: Record<string, string> = { cash: 'Dinheiro', mpesa: 'M-Pesa', transfer: 'Transferência' };
 const fmtT = (iso: string) => new Date(iso).toLocaleString('pt-PT', { timeZone: 'Africa/Maputo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
 const dur = () => {
 const ms = (s.closedAt ? new Date(s.closedAt) : new Date()).getTime() - new Date(s.openedAt).getTime();
 const mins = Math.floor(ms / 60000);
 return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
 };
 const byMethod = s.summary?.byMethod || [];
 const rowsHtml = byMethod.map((m: any) =>
 `<tr><td>${PAY_LABELS[m.method] || m.method}</td><td style="text-align:right">${m.count}</td><td style="text-align:right">${fmt(m.total)}</td></tr>`
 ).join('');
 const w = window.open('', '_blank', 'width=500,height=700');
 if (!w) return;
 w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sessão de Caixa</title>
<style>body{font-family:'Courier New',monospace;padding:20px;font-size:12px}h1{font-size:16px;text-align:center}hr{border:none;border-top:1px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse}td{padding:4px 0}.bold{font-weight:bold}.center{text-align:center}.right{text-align:right}</style></head><body>
<h1>RELATÓRIO DE CAIXA</h1>
<div class="center">${config.companyName || 'NaturErva'}</div><hr>
<p>Caixa: <strong>${s.cashierName}</strong></p>
<p>Abertura: ${fmtT(s.openedAt)}</p>
${s.closedAt ? `<p>Fecho: ${fmtT(s.closedAt)}</p>` : '<p>Estado: <strong>ABERTA</strong></p>'}
<p>Duração: ${dur()}</p>
<p>Fundo inicial: <strong>${fmt(s.initialAmount)}</strong></p><hr>
<table><thead><tr><td><strong>Método</strong></td><td class="right"><strong>Nº</strong></td><td class="right"><strong>Total</strong></td></tr></thead>
<tbody>${rowsHtml || '<tr><td colspan="3">Sem vendas</td></tr>'}</tbody></table><hr>
<p class="bold">Total Vendas: ${fmt(s.totalSales)}</p>
<p class="bold">Nº Pedidos: ${s.totalOrders}</p>
${s.summary?.expectedCash !== undefined ? `<p class="bold">Fundo esperado em caixa: ${fmt(s.summary.expectedCash)}</p>` : ''}
<hr><div class="center" style="font-size:10px">Documento gerado em ${fmtT(new Date().toISOString())}</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script>
</body></html>`);
 w.document.close();
 };

 const inputCls = 'w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm';
 const labelCls = 'block text-sm font-medium text-content-secondary mb-1';

 return (
 <PageShell title="Finanças / IVA" description="Configuração fiscal e relatório de IVA" compactHeaderMobile>
 {/* Tabs */}
 <div className="border-b border-border-default -mx-3 sm:-mx-4 md:-mx-8 px-3 sm:px-4 md:px-8">
 <div className="flex overflow-x-auto">
 {[
 { id: TAB.CONFIG, label: 'Config. Fiscal', icon: FileText },
 { id: TAB.REPORT, label: 'Relatório IVA', icon: TrendingUp },
 { id: TAB.SESSIONS, label: 'Sessões Caixa', icon: Store },
         { id: TAB.EXPORT, label: 'Exportação', icon: Download },
         { id: TAB.AR, label: 'Contas a Receber', icon: TrendingUp },
 ].map(t => (
 <button key={t.id} onClick={() => { setTab(t.id as any); if (t.id === TAB.SESSIONS) loadSessions(); }}
 className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
 tab === t.id
 ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
 : 'border-transparent text-content-muted hover:text-content-primary'
 }`}>
 <t.icon className="w-4 h-4" />{t.label}
 </button>
 ))}
 </div>
 </div>

 {/* ── Configuração Fiscal ── */}
 {tab === TAB.CONFIG && (
 <div className="bg-surface-raised rounded-xl border border-border-default p-6 space-y-5">

 <h2 className="font-semibold text-content-primary">Identidade Visual</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
 {/* Logo principal */}
 <div className="space-y-2">
 <p className={labelCls}>Logotipo principal</p>
 <div className="flex items-center gap-4">
 <div className="w-24 h-14 rounded-lg border border-border-default bg-surface-base flex items-center justify-center overflow-hidden">
 {config.logoUrl
 ? <img src={config.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
 : <Image className="w-6 h-6 text-content-muted" />}
 </div>
 <div className="flex-1">
 <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
 onChange={e => handleUploadLogo(e, 'logoUrl')} />
 <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
 className="flex items-center gap-2 px-3 py-2 text-sm border border-border-default rounded-lg hover:bg-surface-base transition-colors disabled:opacity-50 text-content-secondary">
 {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
 {uploadingLogo ? 'A carregar…' : 'Carregar logo'}
 </button>
 <p className="text-xs text-content-muted mt-1">PNG, SVG ou JPG recomendado</p>
 </div>
 </div>
 </div>

 {/* Ícone (sidebar) */}
 <div className="space-y-2">
 <p className={labelCls}>Ícone (sidebar / favicon)</p>
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-lg border border-border-default bg-surface-base flex items-center justify-center overflow-hidden">
 {config.logoIconUrl
 ? <img src={config.logoIconUrl} alt="Ícone" className="max-w-full max-h-full object-contain p-1" />
 : <Image className="w-6 h-6 text-content-muted" />}
 </div>
 <div className="flex-1">
 <input ref={iconInputRef} type="file" accept="image/*" className="hidden"
 onChange={e => handleUploadLogo(e, 'logoIconUrl')} />
 <button onClick={() => iconInputRef.current?.click()} disabled={uploadingIcon}
 className="flex items-center gap-2 px-3 py-2 text-sm border border-border-default rounded-lg hover:bg-surface-base transition-colors disabled:opacity-50 text-content-secondary">
 {uploadingIcon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
 {uploadingIcon ? 'A carregar…' : 'Carregar ícone'}
 </button>
 <p className="text-xs text-content-muted mt-1">Quadrado, preferencialmente PNG</p>
 </div>
 </div>
 </div>
 </div>

 {/* Título da página (navegador) */}
 <div>
 <label className={labelCls}>Título da página (separador do navegador)</label>
 <input
   value={config.siteTitle ?? ''}
   onChange={e => setConfig(p => ({ ...p, siteTitle: e.target.value }))}
   className={inputCls}
   placeholder="ex: PersonalCreative — Gráfica &amp; Serigrafia"
   maxLength={120}
 />
 <p className="text-xs text-content-muted mt-1">Aparece no separador do browser ao lado do favicon.</p>
 </div>

 <hr className="border-border-default" />
 <h2 className="font-semibold text-content-primary">Dados da Empresa</h2>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className={labelCls}>Nome da Empresa *</label>
 <input value={config.companyName} onChange={e => setConfig(p => ({ ...p, companyName: e.target.value }))}
 className={inputCls} placeholder="NaturErva Lda." />
 </div>
 <div>
 <label className={labelCls}>NUIT</label>
 <input value={config.companyNuit} onChange={e => setConfig(p => ({ ...p, companyNuit: e.target.value }))}
 className={inputCls} placeholder="4XXXXXXXXX" />
 </div>
 <div className="sm:col-span-2">
 <label className={labelCls}>Endereço</label>
 <input value={config.companyAddress} onChange={e => setConfig(p => ({ ...p, companyAddress: e.target.value }))}
 className={inputCls} placeholder="Av. 24 de Julho, Maputo" />
 </div>
 <div>
 <label className={labelCls}>Telefone</label>
 <input value={config.companyPhone} onChange={e => setConfig(p => ({ ...p, companyPhone: e.target.value }))}
 className={inputCls} placeholder="+258 XX XXX XXXX" />
 </div>
 <div>
 <label className={labelCls}>Email</label>
 <input type="email" value={config.companyEmail} onChange={e => setConfig(p => ({ ...p, companyEmail: e.target.value }))}
 className={inputCls} placeholder="geral@natur-erva.co.mz" />
 </div>
 </div>

 <hr className="border-border-default" />
 <h2 className="font-semibold text-content-primary">Configuração Fiscal</h2>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className={labelCls}>Taxa IVA (%)</label>
 <input type="number" min={0} max={100} step={0.5}
 value={config.vatRate} onChange={e => setConfig(p => ({ ...p, vatRate: parseFloat(e.target.value) || 0 }))}
 className={inputCls} />
 <p className="text-xs text-content-muted mt-1">Taxa actual em Moçambique: 16%</p>
 </div>
 <div>
 <label className={labelCls}>Prefixo de Factura</label>
 <input value={config.invoicePrefix} onChange={e => setConfig(p => ({ ...p, invoicePrefix: e.target.value.toUpperCase() }))}
 className={inputCls} placeholder="FACT" maxLength={10} />
 <p className="text-xs text-content-muted mt-1">Ex: FACT → FACT/2026/0001</p>
 </div>
 </div>

 <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 text-sm space-y-1">
 <p className="font-medium text-brand-700 dark:text-brand-300">Exemplo de cálculo (preço c/ IVA: MT 116.00)</p>
 <p className="text-content-secondary">Base tributável (s/ IVA): <strong>MT {(116 / (1 + config.vatRate / 100)).toFixed(2)}</strong></p>
 <p className="text-content-secondary">IVA {config.vatRate}%: <strong>MT {(116 - 116 / (1 + config.vatRate / 100)).toFixed(2)}</strong></p>
 </div>

 <div className="flex justify-end">
 <button onClick={handleSaveConfig} disabled={saving}
 className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50">
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
 Guardar Configuração
 </button>
 </div>
 </div>
 )}

 {/* ── Relatório IVA ── */}
 {tab === TAB.REPORT && (
 <div className="space-y-4">
 <div className="bg-surface-raised rounded-xl border border-border-default p-5">
 <h2 className="font-semibold text-content-primary mb-4">Período de Análise</h2>
 <div className="flex flex-wrap items-end gap-3">
 <div>
 <label className={labelCls}>Data Início</label>
 <input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} className={inputCls} style={{ width: 160 }} />
 </div>
 <div>
 <label className={labelCls}>Data Fim</label>
 <input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} className={inputCls} style={{ width: 160 }} />
 </div>
 <button onClick={handleLoadReport} disabled={loadingReport}
 className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm">
 {loadingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
 Calcular
 </button>
 {[
 { label: 'Este mês', ...thisMonth() },
 { label: 'Último mês', start: (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; })(), end: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0') || '12'}-${new Date(d.getFullYear(), d.getMonth(), 0).getDate()}`; })() },
 { label: 'Este ano', start: `${new Date().getFullYear()}-01-01`, end: `${new Date().getFullYear()}-12-31` },
 ].map(q => (
 <button key={q.label} onClick={() => { setReportStart(q.start); setReportEnd(q.end); }}
 className="px-3 py-2 border border-border-default rounded-lg text-xs font-medium text-content-secondary hover:bg-surface-base transition-colors">
 {q.label}
 </button>
 ))}
 </div>
 </div>

 {report && (
 <>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {[
 { label: 'Nº Vendas', value: report.ordersCount.toString(), cls: 'text-brand-600 dark:text-brand-400' },
 { label: 'Total c/ IVA', value: fmt(report.totalIncVat), cls: 'text-semantic-success' },
 { label: 'Base s/ IVA', value: fmt(report.totalExVat), cls: 'text-content-primary' },
 { label: `IVA ${report.vatRate}%`, value: fmt(report.totalVat), cls: 'text-orange-600 dark:text-orange-400' },
 ].map(c => (
 <div key={c.label} className="bg-surface-raised rounded-xl border border-border-default p-4">
 <p className="text-xs text-content-muted">{c.label}</p>
 <p className={`text-lg font-bold mt-1 ${c.cls}`}>{c.value}</p>
 </div>
 ))}
 </div>

 <div className="bg-surface-raised rounded-xl border border-border-default overflow-hidden">
 <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
 <h3 className="font-semibold text-content-primary flex items-center gap-2">
 <Receipt className="w-4 h-4" />Detalhe por Mês
 </h3>
 <button onClick={handlePrintReport}
 className="flex items-center gap-2 px-4 py-2 border border-border-default rounded-lg text-sm font-medium text-content-secondary hover:bg-surface-base transition-colors">
 <Printer className="w-4 h-4" />Imprimir / Exportar
 </button>
 </div>
 {report.byMonth.length === 0 ? (
 <p className="text-center text-content-muted py-12 text-sm">Sem vendas no período seleccionado</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-surface-base">
 <tr>
 {['Mês', 'Nº Vendas', 'Total c/ IVA', 'Base s/ IVA', `IVA ${report.vatRate}%`].map(h => (
 <th key={h} className="px-4 py-3 text-right first:text-left text-xs font-semibold text-content-muted uppercase tracking-wide">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-border-default">
 {report.byMonth.map(m => (
 <tr key={m.month} className="hover:bg-surface-base transition-colors">
 <td className="px-4 py-3 font-medium text-content-primary">{m.month}</td>
 <td className="px-4 py-3 text-right text-content-secondary">{m.count}</td>
 <td className="px-4 py-3 text-right font-medium text-content-primary">{fmt(m.incVat)}</td>
 <td className="px-4 py-3 text-right text-content-secondary">{fmt(m.exVat)}</td>
 <td className="px-4 py-3 text-right font-semibold text-orange-600 dark:text-orange-400">{fmt(m.vat)}</td>
 </tr>
 ))}
 </tbody>
 <tfoot className="bg-surface-base border-t-2 border-border-strong">
 <tr>
 <td className="px-4 py-3 font-bold text-content-primary">TOTAL</td>
 <td className="px-4 py-3 text-right font-bold text-content-primary">{report.ordersCount}</td>
 <td className="px-4 py-3 text-right font-bold text-semantic-success">{fmt(report.totalIncVat)}</td>
 <td className="px-4 py-3 text-right font-bold text-content-primary">{fmt(report.totalExVat)}</td>
 <td className="px-4 py-3 text-right font-bold text-orange-600 dark:text-orange-400">{fmt(report.totalVat)}</td>
 </tr>
 </tfoot>
 </table>
 </div>
 )}
 </div>

 <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 text-sm">
 <p className="font-semibold text-orange-800 dark:text-orange-300">IVA a entregar às Finanças (AT)</p>
 <p className="text-orange-700 dark:text-orange-400 mt-1">
 No período <strong>{reportStart}</strong> a <strong>{reportEnd}</strong>, o valor de IVA a declarar e entregar é: <strong className="text-lg">{fmt(report.totalVat)}</strong>
 </p>
 <p className="text-orange-600 dark:text-orange-500 text-xs mt-2">
 Base tributável: {fmt(report.totalExVat)} | Taxa aplicada: {report.vatRate}% | NUIT: {config.companyNuit || 'não configurado'}
 </p>
 </div>
 </>
 )}
 </div>
 )}

 {/* ── Sessões de Caixa ── */}
 {tab === TAB.SESSIONS && (
 <div className="space-y-4">
 <div className="flex items-center gap-3 flex-wrap">
 <button onClick={openSession}
 className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors">
 <Store className="w-4 h-4" />Abrir Nova Caixa
 </button>
 {sessions.some(s => s.isOpen) && (
 <button onClick={closeSession}
 className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors">
 <XCircle className="w-4 h-4" />Fechar Caixa Actual
 </button>
 )}
 <button onClick={loadSessions} disabled={loadingSessions}
 className="flex items-center gap-2 px-4 py-2 border border-border-default text-content-secondary hover:bg-surface-base rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
 {loadingSessions ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
 Actualizar
 </button>
 </div>

 <div className="bg-surface-raised rounded-xl border border-border-default overflow-hidden">
 {sessions.length === 0 ? (
 <div className="text-center py-12">
 {loadingSessions
 ? <Loader2 className="w-8 h-8 animate-spin text-content-muted mx-auto" />
 : <p className="text-content-muted text-sm">Nenhuma sessão registada</p>}
 </div>
 ) : (
 <div className="divide-y divide-border-default">
 {sessions.map(s => {
 const dur = () => {
 const ms = (s.closedAt ? new Date(s.closedAt) : new Date()).getTime() - new Date(s.openedAt).getTime();
 const mins = Math.floor(ms / 60000);
 return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
 };
 const fmtDt = (iso: string) => new Date(iso).toLocaleString('pt-PT', { timeZone: 'Africa/Maputo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
 return (
 <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-base transition-colors">
 <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.isOpen ? 'bg-green-500 animate-pulse' : 'bg-border-strong'}`} />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-medium text-sm text-content-primary">{s.cashierName}</span>
 {s.isOpen && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Aberta</span>}
 </div>
 <p className="text-xs text-content-muted mt-0.5">
 {fmtDt(s.openedAt)}
 {s.closedAt ? ` → ${fmtDt(s.closedAt)} · ${dur()}` : ` · Em curso (${dur()})`}
 </p>
 <p className="text-xs text-content-muted mt-0.5">
 Fundo: {fmt(s.initialAmount)} · {s.totalOrders} venda{s.totalOrders !== 1 ? 's' : ''} · {fmt(s.totalSales)}
 </p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <button onClick={() => printSession(s)} title="Imprimir relatório"
 className="p-2 rounded-lg hover:bg-surface-base text-content-muted transition-colors">
 <Printer className="w-4 h-4" />
 </button>
 {!s.isOpen && <CheckCircle className="w-4 h-4 text-content-muted" />}
 {s.isOpen && <Clock className="w-4 h-4 text-green-500" />}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 )}

 {/* ── Exportação Contabilística ── */}
 {tab === TAB.EXPORT && <ExportTab showToast={showToast} />}

 {/* ── Contas a Receber ── */}
 {tab === TAB.AR && <ARTab showToast={showToast} />}

 </PageShell>
 );
};

// ── Export Tab component ───────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
 const d = new Date();
 d.setMonth(d.getMonth() - 1);
 return d.toISOString().slice(0, 10);
};
const thisMonthStr = () => new Date().toISOString().slice(0, 7);

function ExportTab({ showToast }: { showToast?: (m: string, t: any) => void }) {
 const [from, setFrom] = React.useState(monthAgo);
 const [to, setTo] = React.useState(today);
 const [vatMonth, setVatMonth] = React.useState(thisMonthStr);
 const [loadingVat, setLoadingVat] = React.useState(false);
 const [vatSummary, setVatSummary] = React.useState<any>(null);
 const [configuredVatRate, setConfiguredVatRate] = React.useState(16);
 const [downloadingCsv, setDownloadingCsv] = React.useState(false);

 React.useEffect(() => {
  api.get<{ vatRate: number }>('/tax/config')
   .then(c => { if (c?.vatRate) setConfiguredVatRate(c.vatRate); })
   .catch(() => {});
 }, []);

 const loadVatSummary = async () => {
  setLoadingVat(true);
  try {
   const d = await api.get<any>(`/reports/vat-summary?month=${vatMonth}`);
   setVatSummary(d);
  } catch { showToast?.('Erro ao carregar resumo IVA', 'error'); }
  setLoadingVat(false);
 };

 const handleDownloadCsv = async () => {
  setDownloadingCsv(true);
  try {
   await downloadBlob(`/reports/accounting?from=${from}&to=${to}&format=csv`, `contabilidade-${from}-${to}.csv`);
  } catch { showToast?.('Erro ao descarregar CSV', 'error'); }
  setDownloadingCsv(false);
 };

 const PAY: Record<string, string> = { cash: 'Dinheiro', mpesa: 'M-Pesa', transfer: 'Transferência' };

 return (
  <div className="space-y-6 mt-6">

   {/* Contabilidade CSV */}
   <div className="bg-surface-raised border border-border-default rounded-xl p-6 shadow-sm">
    <div className="flex items-center gap-2 mb-4">
     <FileSpreadsheet className="w-5 h-5 text-green-600" />
     <h3 className="font-semibold text-content-primary">Exportação para Contabilidade (CSV)</h3>
    </div>
    <p className="text-sm text-content-muted mb-4">
     Exporta todas as transações num ficheiro CSV compatível com Excel e software de contabilidade.
     Inclui base tributável, IVA {configuredVatRate}% e total bruto por transação.
    </p>
    <div className="flex flex-wrap items-end gap-3 mb-4">
     <div>
      <label className="block text-xs font-medium text-content-muted mb-1">De</label>
      <input type="date" value={from} onChange={e => setFrom(e.target.value)}
       className="px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
     </div>
     <div>
      <label className="block text-xs font-medium text-content-muted mb-1">Até</label>
      <input type="date" value={to} onChange={e => setTo(e.target.value)}
       className="px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
     </div>
    </div>
    <div className="flex gap-2">
     <button
      onClick={handleDownloadCsv}
      disabled={downloadingCsv}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
     >
      {downloadingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      Descarregar CSV
     </button>
     <button
      onClick={() => downloadBlob(`/pdf/vat-report?month=${vatMonth}`, `relatorio-iva-${vatMonth}.pdf`).catch(() => {})}
      className="flex items-center gap-2 px-4 py-2 border border-border-default text-content-secondary hover:bg-surface-base text-sm font-medium rounded-lg transition-colors"
     >
      <FileText className="w-4 h-4" />
      Relatório IVA PDF
     </button>
    </div>
   </div>

   {/* Resumo IVA por mês */}
   <div className="bg-surface-raised border border-border-default rounded-xl p-6 shadow-sm">
    <div className="flex items-center gap-2 mb-4">
     <TrendingUp className="w-5 h-5 text-blue-600" />
     <h3 className="font-semibold text-content-primary">Resumo IVA por Mês</h3>
    </div>
    <div className="flex items-end gap-3 mb-4">
     <div>
      <label className="block text-xs font-medium text-content-muted mb-1">Mês</label>
      <input type="month" value={vatMonth} onChange={e => setVatMonth(e.target.value)}
       className="px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
     </div>
     <button onClick={loadVatSummary} disabled={loadingVat}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
      {loadingVat ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
      Calcular
     </button>
    </div>
    {vatSummary && (
     <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
       {[
        { label: 'Total Bruto', value: `${Number(vatSummary.totals?.gross || 0).toFixed(2)} MT`, color: 'text-green-600' },
        { label: `IVA ${vatSummary.vatRate ?? configuredVatRate}%`, value: `${Number(vatSummary.totals?.vat || 0).toFixed(2)} MT`, color: 'text-yellow-600' },
        { label: 'Base Tributável', value: `${Number(vatSummary.totals?.net || 0).toFixed(2)} MT`, color: 'text-blue-600' },
        { label: 'Nº Transações', value: String(vatSummary.totals?.count || 0), color: 'text-content-primary' },
       ].map(k => (
        <div key={k.label} className="bg-surface-base rounded-lg p-4 border border-border-default">
         <p className="text-xs text-content-muted mb-1">{k.label}</p>
         <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
        </div>
       ))}
      </div>
      {vatSummary.byPaymentMethod?.length > 0 && (
       <div>
        <p className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-2">Por Método de Pagamento</p>
        <div className="space-y-1">
         {vatSummary.byPaymentMethod.map((m: any) => (
          <div key={m.payment_method} className="flex items-center justify-between bg-surface-base rounded-lg px-4 py-2.5 border border-border-default/60">
           <span className="text-sm font-medium text-content-primary">{PAY[m.payment_method] || m.payment_method}</span>
           <div className="flex items-center gap-4 text-sm text-content-muted">
            <span>{m.count} vendas</span>
            <span className="font-semibold text-content-primary">{Number(m.gross).toFixed(2)} MT</span>
           </div>
          </div>
         ))}
        </div>
       </div>
      )}
     </div>
    )}
   </div>

  </div>
 );
}

// ── AR (Contas a Receber) Tab ──────────────────────────────────────────────────
const BUCKET_LABELS: Record<string, { label: string; color: string; bg: string }> = {
 current:  { label: 'Corrente',  color: 'text-green-700 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
 '1-30':   { label: '1–30 dias', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' },
 '31-60':  { label: '31–60 dias',color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
 '61-90':  { label: '61–90 dias',color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
 '90+':    { label: '+90 dias',  color: 'text-red-800 dark:text-red-300',       bg: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700' },
};

function ARTab({ showToast }: { showToast?: (m: string, t: any) => void }) {
 const [data, setData] = React.useState<any>(null);
 const [loading, setLoading] = React.useState(false);
 const [filter, setFilter] = React.useState<string>('all');

 const load = async () => {
  setLoading(true);
  try {
   const d = await (await import('../../core/services/apiClient')).default.get<any>('/reports/ar-aging');
   setData(d);
  } catch { showToast?.('Erro ao carregar contas a receber', 'error'); }
  setLoading(false);
 };

 React.useEffect(() => { load(); }, []);

 const bucketOrder = ['current', '1-30', '31-60', '61-90', '90+'];
 const invoices: any[] = data?.invoices || [];
 const totals: Record<string, number> = data?.bucketTotals || {};
 const grandTotal = Object.values(totals).reduce((s: number, v: any) => s + Number(v), 0);
 const overdueTotal = (['1-30', '31-60', '61-90', '90+'] as string[]).reduce((s, k) => s + Number(totals[k] || 0), 0);

 const filtered = filter === 'all' ? invoices : invoices.filter(i => i.aging_bucket === filter);

 const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('pt-PT') : '—';

 return (
  <div className="space-y-6 mt-6">

   {/* KPI cards */}
   <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
    {bucketOrder.map(key => {
     const cfg = BUCKET_LABELS[key];
     const amount = Number(totals[key] || 0);
     return (
      <button key={key} onClick={() => setFilter(f => f === key ? 'all' : key)}
       className={`rounded-xl border p-4 text-left transition-all ${cfg.bg} ${filter === key ? 'ring-2 ring-brand-500' : ''}`}>
       <p className="text-xs font-semibold text-content-muted uppercase tracking-wide">{cfg.label}</p>
       <p className={`text-xl font-bold mt-1 ${cfg.color}`}>{fmt(amount)}</p>
      </button>
     );
    })}
   </div>

   {/* Summary row */}
   <div className="flex flex-wrap gap-4 items-center">
    <div className="flex items-center gap-2 text-sm">
     <span className="text-content-muted">Total em aberto:</span>
     <span className="font-bold text-content-primary text-base">{fmt(grandTotal)}</span>
    </div>
    {overdueTotal > 0 && (
     <div className="flex items-center gap-2 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5">
      <span className="text-red-600 dark:text-red-400 font-medium">Vencido: {fmt(overdueTotal)}</span>
     </div>
    )}
    <button onClick={load} disabled={loading}
     className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-border-default text-content-secondary hover:bg-surface-base rounded-lg text-sm transition-colors disabled:opacity-50">
     {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
     Actualizar
    </button>
    {filter !== 'all' && (
     <button onClick={() => setFilter('all')} className="text-xs text-brand-600 underline">Limpar filtro</button>
    )}
   </div>

   {/* Invoice table */}
   {loading && !data ? (
    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-content-muted" /></div>
   ) : filtered.length === 0 ? (
    <div className="text-center py-16 text-content-muted text-sm">Nenhuma fatura em aberto</div>
   ) : (
    <div className="bg-surface-raised rounded-xl border border-border-default overflow-hidden">
     <div className="overflow-x-auto">
      <table className="w-full min-w-[700px]">
       <thead className="bg-surface-base border-b border-border-default">
        <tr>
         {['Nº Fatura', 'Cliente', 'Emitida', 'Vencimento', 'Total', 'Pago', 'Em Aberto', 'Estado'].map(h => (
          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wide">{h}</th>
         ))}
        </tr>
       </thead>
       <tbody className="divide-y divide-border-default">
        {filtered.map((inv: any) => {
         const bucket = BUCKET_LABELS[inv.aging_bucket] || BUCKET_LABELS['current'];
         const outstanding = Number(inv.total_amount || 0) - Number(inv.amount_paid || 0);
         return (
          <tr key={inv.id} className="hover:bg-surface-base transition-colors">
           <td className="px-4 py-3 font-mono text-sm text-brand-600 dark:text-brand-400">{inv.invoice_number || '—'}</td>
           <td className="px-4 py-3 text-sm text-content-primary">{inv.customer_name || '—'}</td>
           <td className="px-4 py-3 text-sm text-content-muted">{fmtDate(inv.issued_at)}</td>
           <td className="px-4 py-3 text-sm text-content-muted">{fmtDate(inv.due_date)}</td>
           <td className="px-4 py-3 text-sm font-medium text-content-primary">{fmt(Number(inv.total_amount || 0))}</td>
           <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400">{fmt(Number(inv.amount_paid || 0))}</td>
           <td className="px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400">{fmt(outstanding)}</td>
           <td className="px-4 py-3">
            <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full border ${bucket.bg} ${bucket.color}`}>
             {bucket.label}
            </span>
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
    </div>
   )}

  </div>
 );
}
