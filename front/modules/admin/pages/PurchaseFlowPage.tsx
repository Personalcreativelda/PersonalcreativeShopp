import React, { useState, useEffect, useCallback } from 'react';
import { PageShell } from '../../core/components/layout/PageShell';
import api from '../../core/services/apiClient';
import {
  CheckCircle, XCircle, Clock, PackageCheck, Truck, FileText,
  Plus, Loader2, ChevronDown, ChevronUp, AlertTriangle, RefreshCw,
} from 'lucide-react';
import type { Toast } from '../../core/components/ui/Toast';

interface Props { showToast?: (msg: string, type: Toast['type']) => void; }

const fmt = (n: number) => `MT ${Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('pt-PT') : '—';

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:              { label: 'Rascunho',         color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',     icon: <FileText className="w-3 h-3" /> },
  pending_approval:   { label: 'Aguarda Aprovação',color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: <Clock className="w-3 h-3" /> },
  approved:           { label: 'Aprovada',         color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',  icon: <CheckCircle className="w-3 h-3" /> },
  ordered:            { label: 'Encomendada',      color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', icon: <Truck className="w-3 h-3" /> },
  partially_received: { label: 'Recebida Parcial', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: <PackageCheck className="w-3 h-3" /> },
  received:           { label: 'Recebida',         color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: <CheckCircle className="w-3 h-3" /> },
  rejected:           { label: 'Rejeitada',        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',     icon: <XCircle className="w-3 h-3" /> },
  cancelled:          { label: 'Cancelada',        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',     icon: <XCircle className="w-3 h-3" /> },
  pending:            { label: 'Pendente',         color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: <Clock className="w-3 h-3" /> },
  converted:          { label: 'Convertida',       color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300', icon: <CheckCircle className="w-3 h-3" /> },
};

const REQ_STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pendente',  color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  approved:  { label: 'Aprovada',  color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  rejected:  { label: 'Rejeitada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  converted: { label: 'Convertida',color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
};

function StatusBadge({ status, cfg }: { status: string; cfg: Record<string, { label: string; color: string; icon?: React.ReactNode }> }) {
  const c = cfg[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.color}`}>
      {(c as any).icon}{c.label}
    </span>
  );
}

// ── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'requests', label: 'Requisições' },
  { id: 'orders',   label: 'Ordens de Compra' },
  { id: 'receive',  label: 'Recepção de Mercadoria' },
];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function PurchaseFlowPage({ showToast }: Props) {
  const [tab, setTab] = useState<'requests' | 'orders' | 'receive'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, pos, sups] = await Promise.all([
        api.get<any[]>('/purchases/requests'),
        api.get<any[]>('/purchases/purchases'),
        api.get<any[]>('/purchases/suppliers'),
      ]);
      setRequests(reqs || []);
      setPurchases(pos || []);
      setSuppliers(sups || []);
    } catch { showToast?.('Erro ao carregar dados', 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <PageShell title="Fluxo de Compras" description="Requisições, aprovação, encomendas e recepção de mercadoria">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border-default -mx-6 px-6 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-content-muted hover:text-content-primary'
            }`}>
            {t.label}
          </button>
        ))}
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm text-content-muted hover:text-content-primary transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {tab === 'requests' && (
        <RequestsTab requests={requests} onRefresh={load} showToast={showToast} />
      )}
      {tab === 'orders' && (
        <OrdersTab purchases={purchases} suppliers={suppliers} onRefresh={load} showToast={showToast} />
      )}
      {tab === 'receive' && (
        <ReceiveTab purchases={purchases} onRefresh={load} showToast={showToast} />
      )}
    </PageShell>
  );
}

// ── REQUESTS TAB ──────────────────────────────────────────────────────────────
function RequestsTab({ requests, onRefresh, showToast }: { requests: any[]; onRefresh: () => void; showToast?: Props['showToast'] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);

  const approve = async (id: string) => {
    setActing(id);
    try {
      await api.post(`/purchases/requests/${id}/approve`, {});
      showToast?.('Requisição aprovada', 'success');
      onRefresh();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    setActing(null);
  };

  const reject = async (id: string) => {
    if (!rejectReason.trim()) { showToast?.('Indique o motivo', 'error'); return; }
    setActing(id);
    try {
      await api.post(`/purchases/requests/${id}/reject`, { reason: rejectReason });
      showToast?.('Requisição rejeitada', 'success');
      setRejectId(null);
      setRejectReason('');
      onRefresh();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    setActing(null);
  };

  const convertToPO = async (id: string) => {
    setActing(id);
    try {
      await api.post(`/purchases/requests/${id}/convert-to-po`, {});
      showToast?.('Ordem de compra criada', 'success');
      onRefresh();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    setActing(null);
  };

  if (!requests.length) return <EmptyState message="Nenhuma requisição de compra" />;

  return (
    <div className="space-y-3">
      {requests.map(r => {
        const items = r.items || [];
        const isOpen = expanded === r.id;
        const cfg = REQ_STATUS_CFG[r.status] || REQ_STATUS_CFG.pending;
        return (
          <div key={r.id} className="bg-surface-raised border border-border-default rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : r.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-content-primary">{r.requestedByName || 'Utilizador'}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  {r.priority === 'high' && <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 px-2 py-0.5 rounded-full">Urgente</span>}
                </div>
                <p className="text-xs text-content-muted mt-0.5">{fmtDate(r.createdAt)} · {items.length} item{items.length !== 1 ? 's' : ''}</p>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-content-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-content-muted shrink-0" />}
            </div>

            {isOpen && (
              <div className="border-t border-border-default px-5 py-4 space-y-4">
                {items.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-content-muted uppercase">
                        <th className="text-left pb-2">Produto</th>
                        <th className="text-right pb-2">Qtd</th>
                        <th className="text-right pb-2">Custo Unit.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default/50">
                      {items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-1.5 text-content-primary">{item.productName || item.description || 'Produto'}</td>
                          <td className="py-1.5 text-right text-content-secondary">{item.quantity}</td>
                          <td className="py-1.5 text-right text-content-secondary">{item.unitCost ? fmt(item.unitCost) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {r.notes && <p className="text-sm text-content-muted italic">"{r.notes}"</p>}
                {r.rejectionReason && (
                  <p className="text-sm text-red-600 dark:text-red-400">Motivo: {r.rejectionReason}</p>
                )}

                {/* Actions */}
                {r.status === 'pending' && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button onClick={() => approve(r.id)} disabled={acting === r.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
                      {acting === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Aprovar
                    </button>
                    {rejectId === r.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                          placeholder="Motivo da rejeição..." autoFocus
                          className="flex-1 px-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                        <button onClick={() => reject(r.id)} disabled={acting === r.id}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                          Confirmar
                        </button>
                        <button onClick={() => setRejectId(null)} className="px-3 py-2 border border-border-default text-content-muted hover:bg-surface-base rounded-lg text-sm">Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setRejectId(r.id)}
                        className="flex items-center gap-1.5 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium rounded-lg transition-colors">
                        <XCircle className="w-4 h-4" />Rejeitar
                      </button>
                    )}
                  </div>
                )}
                {r.status === 'approved' && (
                  <button onClick={() => convertToPO(r.id)} disabled={acting === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
                    {acting === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Criar Ordem de Compra (PO)
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ORDERS TAB ────────────────────────────────────────────────────────────────
function OrdersTab({ purchases, suppliers, onRefresh, showToast }: { purchases: any[]; suppliers: any[]; onRefresh: () => void; showToast?: Props['showToast'] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [matchForm, setMatchForm] = useState<{ id: string; num: string; amount: string; date: string } | null>(null);
  const [rejectForm, setRejectForm] = useState<{ id: string; reason: string } | null>(null);
  const [newPO, setNewPO] = useState<{ open: boolean; supplierId: string; items: any[]; notes: string }>({ open: false, supplierId: '', items: [{ description: '', quantity: 1, unitCost: 0 }], notes: '' });

  const action = async (endpoint: string, body: object, successMsg: string) => {
    setActing(endpoint);
    try {
      await api.post(endpoint, body);
      showToast?.(successMsg, 'success');
      onRefresh();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    setActing(null);
  };

  const createPO = async () => {
    const items = newPO.items.filter(i => i.description && i.quantity > 0);
    if (!items.length) { showToast?.('Adicione pelo menos um item', 'error'); return; }
    const total = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    const sup = suppliers.find(s => s.id === newPO.supplierId);
    try {
      await api.post('/purchases/purchases', {
        supplierId: newPO.supplierId || null,
        supplierName: sup?.name || null,
        items,
        totalAmount: total,
        status: 'draft',
        notes: newPO.notes || null,
      });
      showToast?.('Ordem de compra criada', 'success');
      setNewPO({ open: false, supplierId: '', items: [{ description: '', quantity: 1, unitCost: 0 }], notes: '' });
      onRefresh();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
  };

  const submitMatch = async () => {
    if (!matchForm) return;
    await action(`/purchases/purchases/${matchForm.id}/match-invoice`, {
      supplierInvoiceNumber: matchForm.num,
      supplierInvoiceAmount: parseFloat(matchForm.amount) || 0,
      supplierInvoiceDate: matchForm.date || null,
    }, 'Correspondência registada');
    setMatchForm(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-content-muted">{purchases.length} ordem{purchases.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setNewPO(p => ({ ...p, open: !p.open }))}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />Nova PO
        </button>
      </div>

      {/* New PO form */}
      {newPO.open && (
        <div className="bg-surface-raised border border-border-default rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-content-primary">Nova Ordem de Compra</h3>
          <div>
            <label className="block text-xs font-medium text-content-muted mb-1">Fornecedor</label>
            <select value={newPO.supplierId} onChange={e => setNewPO(p => ({ ...p, supplierId: e.target.value }))}
              className="w-full px-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none">
              <option value="">Seleccionar fornecedor...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-content-muted">Itens</label>
            {newPO.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_110px_32px] gap-2 items-start">
                <input value={item.description} onChange={e => setNewPO(p => { const items = [...p.items]; items[idx] = { ...items[idx], description: e.target.value }; return { ...p, items }; })}
                  placeholder="Descrição do produto"
                  className="px-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                <input type="number" min="1" value={item.quantity} onChange={e => setNewPO(p => { const items = [...p.items]; items[idx] = { ...items[idx], quantity: Number(e.target.value) }; return { ...p, items }; })}
                  placeholder="Qtd"
                  className="px-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                <input type="number" min="0" step="0.01" value={item.unitCost} onChange={e => setNewPO(p => { const items = [...p.items]; items[idx] = { ...items[idx], unitCost: Number(e.target.value) }; return { ...p, items }; })}
                  placeholder="Custo unit."
                  className="px-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                <button onClick={() => setNewPO(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}
                  className="p-2 text-content-muted hover:text-red-600 transition-colors"><XCircle className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => setNewPO(p => ({ ...p, items: [...p.items, { description: '', quantity: 1, unitCost: 0 }] }))}
              className="text-sm text-brand-600 dark:text-brand-400 hover:underline">+ Adicionar item</button>
          </div>
          <textarea value={newPO.notes} onChange={e => setNewPO(p => ({ ...p, notes: e.target.value }))}
            placeholder="Notas (opcional)" rows={2}
            className="w-full px-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none" />
          <div className="flex gap-2">
            <button onClick={createPO} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">Criar PO</button>
            <button onClick={() => setNewPO(p => ({ ...p, open: false }))} className="px-4 py-2 border border-border-default text-content-muted hover:bg-surface-base text-sm rounded-lg transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* PO list */}
      {purchases.length === 0 ? <EmptyState message="Nenhuma ordem de compra" /> : (
        <div className="space-y-3">
          {purchases.map(po => {
            const items = po.items || [];
            const isOpen = expanded === po.id;
            return (
              <div key={po.id} className="bg-surface-raised border border-border-default rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : po.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {po.poNumber && <span className="font-mono text-sm font-semibold text-brand-600 dark:text-brand-400">{po.poNumber}</span>}
                      <StatusBadge status={po.status} cfg={STATUS_CFG} />
                      {po.matchStatus === 'matched' && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 px-2 py-0.5 rounded-full">3-way ✓</span>}
                      {po.matchStatus === 'discrepancy' && <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Discrepância</span>}
                    </div>
                    <p className="text-xs text-content-muted mt-0.5">
                      {po.supplierName || 'Sem fornecedor'} · {items.length} item{items.length !== 1 ? 's' : ''} · {fmt(po.totalAmount)}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-content-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-content-muted shrink-0" />}
                </div>

                {isOpen && (
                  <div className="border-t border-border-default px-5 py-4 space-y-4">
                    {items.length > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-content-muted uppercase">
                            <th className="text-left pb-2">Produto</th>
                            <th className="text-right pb-2">Qtd</th>
                            <th className="text-right pb-2">Custo Unit.</th>
                            <th className="text-right pb-2">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-default/50">
                          {items.map((item: any, idx: number) => (
                            <tr key={idx}>
                              <td className="py-1.5 text-content-primary">{item.description || item.productName || 'Produto'}</td>
                              <td className="py-1.5 text-right text-content-secondary">{item.quantity}</td>
                              <td className="py-1.5 text-right text-content-secondary">{fmt(item.unitCost || 0)}</td>
                              <td className="py-1.5 text-right font-medium text-content-primary">{fmt((item.quantity || 0) * (item.unitCost || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} className="pt-2 text-sm font-semibold text-content-primary text-right pr-4">Total PO:</td>
                            <td className="pt-2 font-bold text-content-primary text-right">{fmt(po.totalAmount)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                    {po.notes && <p className="text-sm text-content-muted italic">"{po.notes}"</p>}
                    {po.approvedByName && <p className="text-xs text-content-muted">Aprovado por {po.approvedByName} em {fmtDate(po.approvedAt)}</p>}
                    {po.rejectionReason && <p className="text-sm text-red-600 dark:text-red-400">Rejeitado: {po.rejectionReason}</p>}

                    {/* Supplier invoice match */}
                    {po.supplierInvoiceNumber && (
                      <div className="bg-surface-base rounded-lg border border-border-default p-3 text-sm">
                        <p className="font-medium text-content-primary mb-1">Fatura do Fornecedor</p>
                        <p className="text-content-muted">Nº {po.supplierInvoiceNumber} · {fmt(po.supplierInvoiceAmount || 0)} · {fmtDate(po.supplierInvoiceDate)}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {po.status === 'draft' && (
                        <button onClick={() => action(`/purchases/purchases/${po.id}/submit`, {}, 'Submetido para aprovação')} disabled={acting === po.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
                          <Clock className="w-4 h-4" />Submeter para Aprovação
                        </button>
                      )}
                      {po.status === 'pending_approval' && (<>
                        <button onClick={() => action(`/purchases/purchases/${po.id}/approve`, {}, 'PO aprovada')} disabled={acting === po.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
                          <CheckCircle className="w-4 h-4" />Aprovar
                        </button>
                        {rejectForm?.id === po.id ? (
                          <div className="flex items-center gap-2">
                            <input value={rejectForm.reason} onChange={e => setRejectForm(f => f ? { ...f, reason: e.target.value } : null)}
                              placeholder="Motivo..." autoFocus
                              className="px-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                            <button onClick={() => action(`/purchases/purchases/${po.id}/reject`, { reason: rejectForm.reason }, 'PO rejeitada').then(() => setRejectForm(null))}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg">Confirmar</button>
                            <button onClick={() => setRejectForm(null)} className="px-3 py-2 border border-border-default text-content-muted hover:bg-surface-base text-sm rounded-lg">Cancelar</button>
                          </div>
                        ) : (
                          <button onClick={() => setRejectForm({ id: po.id, reason: '' })}
                            className="flex items-center gap-1.5 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium rounded-lg transition-colors">
                            <XCircle className="w-4 h-4" />Rejeitar
                          </button>
                        )}
                      </>)}
                      {po.status === 'approved' && (
                        <button onClick={() => action(`/purchases/purchases/${po.id}/order`, {}, 'Marcada como encomendada')} disabled={acting === po.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
                          <Truck className="w-4 h-4" />Marcar como Encomendada
                        </button>
                      )}
                      {['ordered', 'partially_received', 'received'].includes(po.status) && !po.supplierInvoiceNumber && (
                        matchForm?.id === po.id ? (
                          <div className="flex flex-wrap items-center gap-2 w-full">
                            <input value={matchForm.num} onChange={e => setMatchForm(f => f ? { ...f, num: e.target.value } : null)}
                              placeholder="Nº Fatura Fornecedor"
                              className="flex-1 min-w-[150px] px-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                            <input type="number" value={matchForm.amount} onChange={e => setMatchForm(f => f ? { ...f, amount: e.target.value } : null)}
                              placeholder="Valor (MT)"
                              className="w-32 px-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                            <input type="date" value={matchForm.date} onChange={e => setMatchForm(f => f ? { ...f, date: e.target.value } : null)}
                              className="px-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                            <button onClick={submitMatch} className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg">Confirmar</button>
                            <button onClick={() => setMatchForm(null)} className="px-3 py-2 border border-border-default text-content-muted hover:bg-surface-base text-sm rounded-lg">Cancelar</button>
                          </div>
                        ) : (
                          <button onClick={() => setMatchForm({ id: po.id, num: '', amount: String(po.totalAmount || ''), date: '' })}
                            className="flex items-center gap-1.5 px-4 py-2 border border-border-default text-content-secondary hover:bg-surface-base text-sm font-medium rounded-lg transition-colors">
                            <FileText className="w-4 h-4" />Registar Fatura do Fornecedor
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── RECEIVE TAB ───────────────────────────────────────────────────────────────
function ReceiveTab({ purchases, onRefresh, showToast }: { purchases: any[]; onRefresh: () => void; showToast?: Props['showToast'] }) {
  const receivable = purchases.filter(p => ['ordered', 'partially_received'].includes(p.status));
  const [selected, setSelected] = useState<any | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectPO = (po: any) => {
    setSelected(po);
    const init: Record<number, number> = {};
    (po.items || []).forEach((_: any, i: number) => { init[i] = 0; });
    setQuantities(init);
    setNotes('');
  };

  const submit = async () => {
    if (!selected) return;
    const items = (selected.items || []).map((item: any, idx: number) => ({
      productId: item.productId || null,
      productName: item.description || item.productName,
      quantityReceived: quantities[idx] || 0,
      unitCost: item.unitCost || 0,
    })).filter((i: any) => i.quantityReceived > 0);

    if (!items.length) { showToast?.('Indique quantidades recebidas', 'error'); return; }

    setSubmitting(true);
    try {
      const res = await api.post<any>(`/purchases/purchases/${selected.id}/receive`, { items, notes });
      showToast?.(res.poStatus === 'received' ? 'Recepção completa!' : 'Recepção parcial registada', 'success');
      setSelected(null);
      onRefresh();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    setSubmitting(false);
  };

  if (!receivable.length) return <EmptyState message="Nenhuma encomenda aguarda recepção" />;

  return (
    <div className="space-y-4">
      {!selected ? (
        <div className="space-y-3">
          <p className="text-sm text-content-muted">{receivable.length} encomenda{receivable.length !== 1 ? 's' : ''} aguarda{receivable.length === 1 ? '' : 'm'} recepção</p>
          {receivable.map(po => (
            <div key={po.id} className="flex items-center gap-3 px-5 py-4 bg-surface-raised border border-border-default rounded-xl cursor-pointer hover:border-brand-400 transition-colors" onClick={() => selectPO(po)}>
              <PackageCheck className="w-5 h-5 text-content-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {po.poNumber && <span className="font-mono text-sm font-semibold text-brand-600 dark:text-brand-400">{po.poNumber}</span>}
                  <StatusBadge status={po.status} cfg={STATUS_CFG} />
                </div>
                <p className="text-xs text-content-muted mt-0.5">{po.supplierName || 'Sem fornecedor'} · {fmt(po.totalAmount)}</p>
              </div>
              <span className="text-sm text-brand-600 dark:text-brand-400 font-medium">Registar →</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface-raised border border-border-default rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelected(null)} className="text-sm text-content-muted hover:text-content-primary transition-colors">← Voltar</button>
            <h3 className="font-semibold text-content-primary">
              Receber: {selected.poNumber || 'PO'} — {selected.supplierName || 'Fornecedor'}
            </h3>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-content-muted uppercase border-b border-border-default">
                <th className="text-left pb-2">Produto</th>
                <th className="text-right pb-2">Encomendado</th>
                <th className="text-right pb-2 min-w-[110px]">Recebido Agora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default/50">
              {(selected.items || []).map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="py-2 text-content-primary">{item.description || item.productName || 'Produto'}</td>
                  <td className="py-2 text-right text-content-secondary">{item.quantity}</td>
                  <td className="py-2 text-right">
                    <input type="number" min="0" max={item.quantity} value={quantities[idx] || 0}
                      onChange={e => setQuantities(q => ({ ...q, [idx]: Math.max(0, Number(e.target.value)) }))}
                      className="w-24 px-2 py-1 border border-border-default rounded-lg text-sm text-right bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Observações (opcional)" rows={2}
            className="w-full px-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none" />

          <div className="flex gap-2">
            <button onClick={submit} disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              Confirmar Recepção
            </button>
            <button onClick={() => setSelected(null)} className="px-4 py-2.5 border border-border-default text-content-muted hover:bg-surface-base text-sm rounded-lg transition-colors">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-content-muted">
      <PackageCheck className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
