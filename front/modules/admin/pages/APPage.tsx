import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Search, CheckCircle, XCircle, Clock,
  AlertTriangle, RefreshCw, X, Loader2, DollarSign,
  TrendingDown, Eye, Send, Ban, ChevronDown, ChevronUp, Building2
} from 'lucide-react';
import api from '../../core/services/apiClient';
import { PageShell } from '../../core/components/layout/PageShell';
import type { Toast } from '../../core/components/ui/Toast';

interface APPageProps {
  showToast?: (msg: string, type: Toast['type']) => void;
}

type BillStatus = 'draft' | 'received' | 'approved' | 'paid' | 'partial' | 'overdue' | 'cancelled';

interface Bill {
  id: string;
  billNumber: string;
  purchaseId?: string;
  purchaseNumber?: string;
  supplierName?: string;
  supplierNuit?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  status: BillStatus;
  billDate?: string;
  dueDate?: string;
  paidAt?: string;
  items: any[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  amountPaid: number;
  paymentMethod?: string;
  notes?: string;
  createdByName?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
}

interface APResponse {
  bills: Bill[];
  total: number;
  totalBilled: number;
  totalOutstanding: number;
  totalPaid: number;
  totalOverdue: number;
}

interface AgingSupplier {
  supplierName: string;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  totalOutstanding: number;
}

interface AgingResponse {
  suppliers: AgingSupplier[];
  buckets: { current: number; days1_30: number; days31_60: number; days61_90: number; days90Plus: number; total: number };
}

const STATUS_CFG: Record<BillStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft:     { label: 'Rascunho',  color: 'bg-surface-base text-content-muted border-border-default',                                                              icon: <FileText className="w-3 h-3" /> },
  received:  { label: 'Recebida',  color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',                  icon: <Send className="w-3 h-3" /> },
  approved:  { label: 'Aprovada',  color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',      icon: <CheckCircle className="w-3 h-3" /> },
  paid:      { label: 'Paga',      color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',            icon: <CheckCircle className="w-3 h-3" /> },
  partial:   { label: 'Parcial',   color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',      icon: <Clock className="w-3 h-3" /> },
  overdue:   { label: 'Vencida',   color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',                        icon: <AlertTriangle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelada', color: 'bg-surface-overlay text-content-muted border-border-default',                                                            icon: <XCircle className="w-3 h-3" /> },
};

const fmt     = (n: number) => `${Number(n || 0).toFixed(2)} MT`;
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-MZ') : '—';
const TAB = { BILLS: 'bills', AGING: 'aging' } as const;
type Tab = typeof TAB[keyof typeof TAB];

function StatusBadge({ status }: { status: BillStatus }) {
  const c = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.color}`}>
      {c.icon}{c.label}
    </span>
  );
}

// ── Create Bill Modal ─────────────────────────────────────────────────────────
function CreateBillModal({ onClose, onCreated, showToast }: {
  onClose: () => void;
  onCreated: () => void;
  showToast?: (msg: string, type: Toast['type']) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplierName: '', supplierNuit: '', supplierEmail: '', supplierPhone: '',
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    vatRate: 16, notes: '', status: 'received' as BillStatus,
  });
  const [items, setItems] = useState([{ name: '', quantity: 1, unitPrice: 0 }]);

  // Load configured VAT rate
  useEffect(() => {
    api.get<{ vatRate: number }>('/tax/config')
      .then(c => { if (c.vatRate) setForm(p => ({ ...p, vatRate: c.vatRate })); })
      .catch(() => {});
  }, []);

  const addItem = () => setItems(p => [...p, { name: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, j) => j !== i));
  const setItem = (i: number, k: string, v: any) => setItems(p => p.map((it, j) => j === i ? { ...it, [k]: v } : it));

  const subtotal  = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vatAmount = subtotal * form.vatRate / 100;
  const total     = subtotal + vatAmount;

  const submit = async () => {
    if (!form.supplierName.trim()) { showToast?.('Nome do fornecedor obrigatório', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/ap', { ...form, items: items.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })) });
      showToast?.('Factura criada com sucesso!', 'success');
      onCreated();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border-default">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default sticky top-0 bg-surface-raised z-10">
          <h2 className="font-bold text-content-primary flex items-center gap-2">
            <Building2 className="w-5 h-5 text-content-muted" />Nova Factura de Fornecedor
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-content-muted hover:bg-surface-base"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Supplier */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-content-muted mb-1 block">Fornecedor *</label>
              <input value={form.supplierName} onChange={e => setForm(p => ({ ...p, supplierName: e.target.value }))}
                placeholder="Nome do fornecedor" className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-content-muted mb-1 block">NUIT</label>
              <input value={form.supplierNuit} onChange={e => setForm(p => ({ ...p, supplierNuit: e.target.value }))}
                placeholder="000000000" className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-content-muted mb-1 block">Telefone</label>
              <input value={form.supplierPhone} onChange={e => setForm(p => ({ ...p, supplierPhone: e.target.value }))}
                placeholder="+258 8X XXX XXXX" className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-content-muted mb-1 block">Data da Factura</label>
              <input type="date" value={form.billDate} onChange={e => setForm(p => ({ ...p, billDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-content-muted mb-1 block">Data de Vencimento</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-content-muted uppercase tracking-wide">Artigos</p>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                <Plus className="w-3.5 h-3.5" />Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input value={item.name} onChange={e => setItem(i, 'name', e.target.value)}
                    placeholder="Descrição" className="col-span-5 px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                  <input type="number" value={item.quantity} min={1} onChange={e => setItem(i, 'quantity', Number(e.target.value))}
                    className="col-span-2 px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary text-center focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                  <input type="number" value={item.unitPrice} min={0} step={0.01} onChange={e => setItem(i, 'unitPrice', Number(e.target.value))}
                    placeholder="Preço" className="col-span-3 px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                  <p className="col-span-1 text-xs font-mono text-content-muted text-right">{fmt(item.quantity * item.unitPrice)}</p>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="col-span-1 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-surface-base rounded-xl p-4 border border-border-default space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-content-muted">Subtotal</span><span className="font-mono">{fmt(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-content-muted">IVA ({form.vatRate}%)</span><span className="font-mono">{fmt(vatAmount)}</span></div>
            <div className="flex justify-between border-t border-border-default pt-2 mt-2">
              <span className="font-semibold text-content-primary">Total</span>
              <span className="font-bold font-mono text-base text-content-primary">{fmt(total)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Observações</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-content-secondary border border-border-default rounded-lg hover:bg-surface-base">Cancelar</button>
            <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Criar Factura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bill Detail ───────────────────────────────────────────────────────────────
function BillDetail({ bill, onClose, onAction, showToast }: {
  bill: Bill; onClose: () => void; onAction: () => void;
  showToast?: (msg: string, type: Toast['type']) => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const act = async (fn: () => Promise<any>, msg: string) => {
    setLoading(msg);
    try { await fn(); showToast?.(msg, 'success'); onAction(); }
    catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    finally { setLoading(null); }
  };

  const canReceive = bill.status === 'draft';
  const canApprove = ['draft', 'received'].includes(bill.status);
  const canPay     = ['received', 'approved', 'partial', 'overdue'].includes(bill.status);
  const canCancel  = !['paid', 'cancelled'].includes(bill.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border-default">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default sticky top-0 bg-surface-raised z-10">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-content-muted" />
            <div>
              <h2 className="font-bold text-content-primary text-base">{bill.billNumber}</h2>
              <p className="text-xs text-content-muted">{bill.supplierName || '—'}</p>
            </div>
            <StatusBadge status={bill.status} />
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-content-muted hover:bg-surface-base"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {canReceive && (
              <button onClick={() => act(() => api.post(`/ap/${bill.id}/receive`, {}), 'Factura recebida!')}
                disabled={!!loading} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
                {loading === 'Factura recebida!' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Marcar Recebida
              </button>
            )}
            {canApprove && (
              <button onClick={() => act(() => api.post(`/ap/${bill.id}/approve`, {}), 'Factura aprovada!')}
                disabled={!!loading} className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
                {loading === 'Factura aprovada!' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}Aprovar
              </button>
            )}
            {canPay && (
              <button onClick={() => act(() => api.post(`/ap/${bill.id}/pay`, { amountPaid: bill.totalAmount }), 'Pagamento registado!')}
                disabled={!!loading} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
                {loading === 'Pagamento registado!' ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}Pagar Total
              </button>
            )}
            {canPay && bill.totalAmount > bill.amountPaid && (
              <button onClick={() => {
                const amt = prompt('Valor pago (MT):', String(bill.totalAmount - bill.amountPaid));
                if (!amt) return;
                act(() => api.post(`/ap/${bill.id}/pay`, { amountPaid: Number(amt) }), 'Pagamento parcial registado!');
              }} disabled={!!loading} className="flex items-center gap-1.5 px-3 py-2 border border-border-default text-content-secondary hover:bg-surface-base text-sm rounded-lg disabled:opacity-60">
                <DollarSign className="w-4 h-4" />Pagamento Parcial
              </button>
            )}
            {canCancel && (
              <button onClick={() => {
                const reason = prompt('Motivo do cancelamento:');
                if (reason === null) return;
                act(() => api.post(`/ap/${bill.id}/cancel`, { reason }), 'Factura cancelada');
              }} disabled={!!loading} className="flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm rounded-lg disabled:opacity-60">
                <Ban className="w-4 h-4" />Cancelar
              </button>
            )}
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-base rounded-xl p-4 border border-border-default space-y-2.5">
              <p className="text-xs font-semibold text-content-muted uppercase tracking-wide">Detalhes</p>
              {[['Número', bill.billNumber], ['Data', fmtDate(bill.billDate)], ['Vencimento', fmtDate(bill.dueDate)], bill.paidAt && ['Paga em', fmtDate(bill.paidAt)], bill.approvedByName && ['Aprovada por', bill.approvedByName]].filter(Boolean).map(([l, v]: any) => (
                <div key={l} className="flex justify-between"><span className="text-xs text-content-muted">{l}</span><span className="text-xs font-medium text-content-primary">{v}</span></div>
              ))}
            </div>
            <div className="bg-surface-base rounded-xl p-4 border border-border-default space-y-2.5">
              <p className="text-xs font-semibold text-content-muted uppercase tracking-wide">Fornecedor</p>
              {[['Nome', bill.supplierName || '—'], bill.supplierNuit && ['NUIT', bill.supplierNuit], bill.supplierPhone && ['Telefone', bill.supplierPhone], bill.supplierEmail && ['Email', bill.supplierEmail]].filter(Boolean).map(([l, v]: any) => (
                <div key={l} className="flex justify-between"><span className="text-xs text-content-muted">{l}</span><span className="text-xs font-medium text-content-primary">{v}</span></div>
              ))}
            </div>
          </div>

          {/* Items */}
          {bill.items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-2">Artigos</p>
              <div className="border border-border-default rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-surface-base border-b border-border-default">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-content-muted">Descrição</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-content-muted">Qtd</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-content-muted">Unit.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-content-muted">Total</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border-default/40">
                    {bill.items.map((item: any, i: number) => (
                      <tr key={i}><td className="px-4 py-2.5 text-content-primary">{item.name}</td>
                        <td className="px-4 py-2.5 text-right text-content-secondary">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-content-secondary">{fmt(item.unitPrice || item.price || 0)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-content-primary">{fmt((item.quantity || 1) * (item.unitPrice || item.price || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-content-muted">Subtotal</span><span className="font-mono text-content-secondary">{fmt(bill.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-content-muted">IVA ({bill.vatRate}%)</span><span className="font-mono text-content-muted">{fmt(bill.vatAmount)}</span></div>
            <div className="flex justify-between border-t border-border-default pt-2 mt-2">
              <span className="font-semibold text-content-primary">TOTAL</span>
              <span className="font-bold font-mono text-base text-content-primary">{fmt(bill.totalAmount)}</span>
            </div>
            {bill.amountPaid > 0 && (
              <div className="flex justify-between"><span className="text-green-600 dark:text-green-400">Pago</span><span className="font-mono text-green-600 dark:text-green-400">{fmt(bill.amountPaid)}</span></div>
            )}
            {bill.status === 'partial' && (
              <div className="flex justify-between"><span className="text-yellow-600 font-semibold">Em dívida</span><span className="font-bold font-mono text-yellow-600">{fmt(bill.totalAmount - bill.amountPaid)}</span></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export const APPage: React.FC<APPageProps> = ({ showToast }) => {
  const [tab, setTab]         = useState<Tab>(TAB.BILLS);
  const [data, setData]       = useState<APResponse | null>(null);
  const [aging, setAging]     = useState<AgingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Bill | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const [d, a] = await Promise.all([
        api.get<APResponse>(`/ap?${params}`),
        tab === TAB.AGING ? api.get<AgingResponse>('/ap/aging') : Promise.resolve(aging),
      ]);
      setData(d);
      if (a) setAging(a);
    } catch { showToast?.('Erro ao carregar', 'error'); }
    setLoading(false);
  }, [statusFilter, search, tab]);

  useEffect(() => { load(); }, [load]);

  const toggleSupplier = (name: string) =>
    setExpandedSuppliers(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const kpis = [
    { label: 'Total Facturado',   value: fmt(data?.totalBilled || 0),      icon: <FileText className="w-5 h-5 text-blue-600" />,   color: 'text-content-primary' },
    { label: 'A Pagar',           value: fmt(data?.totalOutstanding || 0),  icon: <Clock className="w-5 h-5 text-yellow-600" />,    color: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Vencido',           value: fmt(data?.totalOverdue || 0),      icon: <AlertTriangle className="w-5 h-5 text-red-600" />, color: 'text-red-600 dark:text-red-400' },
    { label: 'Pago',              value: fmt(data?.totalPaid || 0),         icon: <CheckCircle className="w-5 h-5 text-green-600" />, color: 'text-green-600 dark:text-green-400' },
  ];

  const STATUS_FILTERS = [
    { value: '', label: 'Todas' }, { value: 'draft', label: 'Rascunho' }, { value: 'received', label: 'Recebidas' },
    { value: 'approved', label: 'Aprovadas' }, { value: 'paid', label: 'Pagas' },
    { value: 'partial', label: 'Parciais' }, { value: 'overdue', label: 'Vencidas' },
  ];

  const BUCKET_LABELS = [
    { key: 'current',   label: 'Corrente',  color: 'text-green-600 dark:text-green-400' },
    { key: 'days1_30',  label: '1-30 dias', color: 'text-yellow-600 dark:text-yellow-400' },
    { key: 'days31_60', label: '31-60 dias',color: 'text-orange-600 dark:text-orange-400' },
    { key: 'days61_90', label: '61-90 dias',color: 'text-red-500 dark:text-red-400' },
    { key: 'days90Plus',label: '+90 dias',  color: 'text-red-700 dark:text-red-300' },
  ];

  return (
    <PageShell title="Contas a Pagar" description="Gestão de facturas de fornecedores"
      actions={
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg text-content-muted hover:bg-surface-base" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg">
            <Plus className="w-4 h-4" />Nova Factura
          </button>
        </div>
      } compactHeaderMobile>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className="bg-surface-raised border border-border-default rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">{k.icon}<span className="text-xs text-content-muted font-medium">{k.label}</span></div>
            <p className={`text-xl font-bold font-mono ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-border-default -mx-3 sm:-mx-4 md:-mx-8 px-3 sm:px-4 md:px-8 mb-5">
        <div className="flex gap-1">
          {[{ id: TAB.BILLS, label: 'Facturas' }, { id: TAB.AGING, label: 'Aging AP' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400' : 'border-transparent text-content-muted hover:text-content-primary'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* BILLS TAB */}
      {tab === TAB.BILLS && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar fornecedor ou nº…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <button key={f.value} onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${statusFilter === f.value ? 'bg-brand-600 text-white border-brand-600' : 'border-border-default text-content-muted hover:bg-surface-base'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-raised border border-border-default rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-content-muted" /></div>
            ) : !data?.bills.length ? (
              <div className="py-16 text-center">
                <Building2 className="w-10 h-10 text-content-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-content-muted">Nenhuma factura encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-base">
                      {['Nº Factura', 'Fornecedor', 'Data', 'Vencimento', 'Total', 'Pago', 'Estado', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/30">
                    {data.bills.map(bill => (
                      <tr key={bill.id} className="hover:bg-surface-base transition-colors">
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-content-primary">{bill.billNumber}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-content-primary">{bill.supplierName || '—'}</p>
                          {bill.supplierNuit && <p className="text-xs text-content-muted">NUIT: {bill.supplierNuit}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-content-muted">{fmtDate(bill.billDate)}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className={bill.status === 'overdue' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-content-muted'}>{fmtDate(bill.dueDate)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold font-mono text-content-primary">{fmt(bill.totalAmount)}</td>
                        <td className="px-4 py-3 text-sm font-mono">
                          <span className={bill.amountPaid >= bill.totalAmount ? 'text-green-600 dark:text-green-400' : 'text-content-muted'}>{fmt(bill.amountPaid)}</span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={bill.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setSelected(bill)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-content-secondary border border-border-default hover:bg-surface-base">
                            <Eye className="w-3 h-3" />Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* AGING TAB */}
      {tab === TAB.AGING && (
        <div className="space-y-4">
          {/* Bucket totals */}
          {aging && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {BUCKET_LABELS.map(b => (
                <div key={b.key} className="bg-surface-raised border border-border-default rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-content-muted mb-1">{b.label}</p>
                  <p className={`text-lg font-bold font-mono ${b.color}`}>{fmt((aging.buckets as any)[b.key] || 0)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-surface-raised border border-border-default rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border-default bg-surface-base">
              <p className="text-sm font-semibold text-content-primary">Aging por Fornecedor</p>
            </div>
            {!aging || !aging.suppliers.length ? (
              <div className="py-12 text-center">
                <TrendingDown className="w-8 h-8 text-content-muted mx-auto mb-2 opacity-40" />
                <p className="text-sm text-content-muted">Sem contas a pagar em aberto</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-base">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-content-muted">Fornecedor</th>
                      {BUCKET_LABELS.map(b => <th key={b.key} className="px-4 py-3 text-right text-xs font-semibold text-content-muted">{b.label}</th>)}
                      <th className="px-4 py-3 text-right text-xs font-semibold text-content-muted">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/30">
                    {aging.suppliers.map(s => (
                      <tr key={s.supplierName} className="hover:bg-surface-base transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-content-primary">{s.supplierName}</td>
                        {BUCKET_LABELS.map(b => (
                          <td key={b.key} className={`px-4 py-3 text-sm font-mono text-right ${(s as any)[b.key] > 0 ? b.color : 'text-content-muted/40'}`}>
                            {(s as any)[b.key] > 0 ? fmt((s as any)[b.key]) : '—'}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-sm font-bold font-mono text-right text-content-primary">{fmt(s.totalOutstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && <CreateBillModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} showToast={showToast} />}
      {selected && <BillDetail bill={selected} onClose={() => setSelected(null)} onAction={() => { load(); setSelected(null); }} showToast={showToast} />}
    </PageShell>
  );
};
