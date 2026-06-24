import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Search, Download, CheckCircle, XCircle,
  Clock, AlertTriangle, RefreshCw, ChevronRight, X, Loader2,
  DollarSign, TrendingUp, Eye, Send, Ban
} from 'lucide-react';
import api, { downloadBlob } from '../../core/services/apiClient';
import { PageShell } from '../../core/components/layout/PageShell';
import type { Toast } from '../../core/components/ui/Toast';

interface InvoicesPageProps {
  showToast?: (msg: string, type: Toast['type']) => void;
}

type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partial' | 'overdue' | 'cancelled';

interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId?: string;
  orderNumber?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerNuit?: string;
  status: InvoiceStatus;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  items: any[];
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod?: string;
  amountPaid: number;
  notes?: string;
  createdAt: string;
  createdByName?: string;
}

interface InvoicesResponse {
  invoices: Invoice[];
  total: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft:     { label: 'Rascunho',  color: 'bg-surface-base text-content-muted border-border-default',             icon: <FileText className="w-3 h-3" /> },
  issued:    { label: 'Emitida',   color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',       icon: <Send className="w-3 h-3" /> },
  paid:      { label: 'Paga',      color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',  icon: <CheckCircle className="w-3 h-3" /> },
  partial:   { label: 'Parcial',   color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', icon: <Clock className="w-3 h-3" /> },
  overdue:   { label: 'Vencida',   color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',              icon: <AlertTriangle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelada', color: 'bg-surface-overlay text-content-muted border-border-default',         icon: <XCircle className="w-3 h-3" /> },
};

const fmt = (n: number) => `${Number(n || 0).toFixed(2)} MT`;
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-MZ') : '—';
const apiBase = import.meta.env.VITE_API_URL as string;

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.color}`}>
      {c.icon}{c.label}
    </span>
  );
}

// ── Invoice Detail Panel ───────────────────────────────────────────────────────
function InvoiceDetail({
  invoice, onClose, onAction, showToast,
}: {
  invoice: Invoice;
  onClose: () => void;
  onAction: () => void;
  showToast?: (msg: string, type: Toast['type']) => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const act = async (fn: () => Promise<any>, successMsg: string) => {
    setLoading(successMsg);
    try {
      await fn();
      showToast?.(successMsg, 'success');
      onAction();
    } catch (e: any) {
      showToast?.(e.message || 'Erro', 'error');
    } finally { setLoading(null); }
  };

  const canIssue   = invoice.status === 'draft';
  const canPay     = ['issued', 'partial', 'overdue'].includes(invoice.status);
  const canCancel  = !['paid', 'cancelled'].includes(invoice.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border-default">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default sticky top-0 bg-surface-raised z-10">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-content-muted" />
            <div>
              <h2 className="font-bold text-content-primary text-base">{invoice.invoiceNumber}</h2>
              <p className="text-xs text-content-muted">{invoice.customerName || '—'}</p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-content-muted hover:bg-surface-base transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {canIssue && (
              <button onClick={() => act(() => api.post(`/invoices/${invoice.id}/issue`, {}), 'Fatura emitida!')}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                {loading === 'Fatura emitida!' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Emitir Fatura
              </button>
            )}
            {canPay && (
              <button onClick={() => act(() => api.post(`/invoices/${invoice.id}/pay`, { amountPaid: invoice.totalAmount }), 'Marcada como paga!')}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                {loading === 'Marcada como paga!' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Marcar como Paga
              </button>
            )}
            {canPay && invoice.totalAmount > (invoice.amountPaid || 0) && (
              <button onClick={() => {
                const amt = prompt('Valor recebido (MT):', String(invoice.totalAmount - invoice.amountPaid));
                if (!amt) return;
                act(() => api.post(`/invoices/${invoice.id}/pay`, { amountPaid: Number(amt) }), 'Pagamento registado!');
              }}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-3 py-2 border border-border-default text-content-secondary hover:bg-surface-base text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
                <DollarSign className="w-4 h-4" />Pagamento Parcial
              </button>
            )}
            {canCancel && (
              <button onClick={() => {
                const reason = prompt('Motivo do cancelamento (opcional):');
                if (reason === null) return;
                act(() => api.post(`/invoices/${invoice.id}/cancel`, { reason }), 'Fatura cancelada');
              }}
                disabled={!!loading}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
                <Ban className="w-4 h-4" />Cancelar
              </button>
            )}
            {invoice.status !== 'draft' && (
              <button
                onClick={async () => {
                  setPdfLoading(true);
                  try {
                    const path = invoice.orderId ? `/pdf/order/${invoice.orderId}` : `/pdf/invoice/${invoice.id}`;
                    await downloadBlob(path, `fatura-${invoice.invoiceNumber}.pdf`);
                  } catch (e: any) { showToast?.(e.message || 'Erro ao gerar PDF', 'error'); }
                  finally { setPdfLoading(false); }
                }}
                disabled={pdfLoading}
                className="flex items-center gap-1.5 px-3 py-2 border border-border-default text-content-secondary hover:bg-surface-base text-sm font-medium rounded-lg transition-colors ml-auto">
                {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}PDF
              </button>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-base rounded-xl p-4 border border-border-default space-y-2.5">
              <p className="text-xs font-semibold text-content-muted uppercase tracking-wide">Detalhes</p>
              <Row label="Número" value={invoice.invoiceNumber} />
              <Row label="Emitida em" value={fmtDate(invoice.issuedAt)} />
              <Row label="Vencimento" value={fmtDate(invoice.dueDate)} />
              {invoice.paidAt && <Row label="Paga em" value={fmtDate(invoice.paidAt)} />}
              {invoice.orderNumber && <Row label="Encomenda" value={`#${invoice.orderNumber}`} />}
              {invoice.createdByName && <Row label="Criada por" value={invoice.createdByName} />}
            </div>
            <div className="bg-surface-base rounded-xl p-4 border border-border-default space-y-2.5">
              <p className="text-xs font-semibold text-content-muted uppercase tracking-wide">Cliente</p>
              <Row label="Nome" value={invoice.customerName || '—'} />
              <Row label="Telefone" value={invoice.customerPhone || '—'} />
              <Row label="Email" value={invoice.customerEmail || '—'} />
              {invoice.customerNuit && <Row label="NUIT" value={invoice.customerNuit} />}
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-2">Artigos</p>
            <div className="border border-border-default rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface-base">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-content-muted">Descrição</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-content-muted">Qtd</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-content-muted">Unit.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-content-muted">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default/40">
                  {invoice.items.map((item, i) => (
                    <tr key={i} className="hover:bg-surface-base/50">
                      <td className="px-4 py-2.5 text-content-primary">
                        {item.name || item.productName}
                        {item.variantName && <span className="text-content-muted text-xs"> ({item.variantName})</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-content-secondary">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-content-secondary font-mono">{fmt(item.unitPrice || item.price || 0)}</td>
                      <td className="px-4 py-2.5 text-right text-content-primary font-semibold font-mono">{fmt((item.quantity || 1) * (item.unitPrice || item.price || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <TotalRow label="Subtotal" value={fmt(invoice.subtotal)} />
            {invoice.discountAmount > 0 && <TotalRow label="Desconto" value={`-${fmt(invoice.discountAmount)}`} color="text-red-600 dark:text-red-400" />}
            {invoice.deliveryFee > 0   && <TotalRow label="Entrega"  value={fmt(invoice.deliveryFee)} />}
            <TotalRow label={`IVA (${invoice.vatRate}%)`} value={fmt(invoice.vatAmount)} color="text-content-muted" />
            <div className="border-t border-border-default pt-2 mt-2">
              <TotalRow label="TOTAL" value={fmt(invoice.totalAmount)} bold />
            </div>
            {invoice.amountPaid > 0 && invoice.status !== 'paid' && (
              <TotalRow label="Já pago" value={fmt(invoice.amountPaid)} color="text-green-600 dark:text-green-400" />
            )}
            {invoice.status === 'partial' && (
              <TotalRow label="Em dívida" value={fmt(invoice.totalAmount - invoice.amountPaid)} color="text-yellow-600 dark:text-yellow-400" bold />
            )}
          </div>

          {invoice.notes && (
            <div className="bg-surface-base rounded-xl p-4 border border-border-default">
              <p className="text-xs font-semibold text-content-muted mb-1">Observações</p>
              <p className="text-sm text-content-secondary">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-content-muted shrink-0">{label}</span>
      <span className="text-xs font-medium text-content-primary text-right">{value}</span>
    </div>
  );
}

function TotalRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`${bold ? 'font-semibold text-content-primary' : 'text-content-muted'}`}>{label}</span>
      <span className={`font-mono ${bold ? 'font-bold text-base text-content-primary' : ''} ${color || 'text-content-secondary'}`}>{value}</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export const InvoicesPage: React.FC<InvoicesPageProps> = ({ showToast }) => {
  const [data, setData] = useState<InvoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [fromOrderId, setFromOrderId] = useState('');
  const [creatingFromOrder, setCreatingFromOrder] = useState(false);

  const [setupError, setSetupError] = useState('');
  const [fixing, setFixing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSetupError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('status', statusFilter);
      if (search)       params.set('search', search);
      const d = await api.get<InvoicesResponse>(`/invoices?${params}`);
      setData(d);
    } catch (e: any) {
      const msg = e?.message || 'Erro ao carregar faturas';
      setSetupError(msg);
      showToast?.(msg, 'error');
    }
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const runSetup = async () => {
    setFixing(true);
    try {
      await api.post('/tax/setup-invoices', {});
      showToast?.('Tabela criada com sucesso!', 'success');
      setSetupError('');
      load();
    } catch (e: any) {
      showToast?.(e.message || 'Erro ao configurar', 'error');
    }
    setFixing(false);
  };

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const createFromOrder = async () => {
    const id = fromOrderId.trim();
    if (!id) return;
    if (!UUID_RE.test(id)) {
      showToast?.('O ID da encomenda deve ser um UUID válido (ex: 550e8400-e29b-41d4-a716-446655440000)', 'error');
      return;
    }
    setCreatingFromOrder(true);
    try {
      const inv = await api.post<Invoice>(`/invoices/from-order/${id}`, {});
      showToast?.(`Fatura ${inv.invoiceNumber} criada!`, 'success');
      setFromOrderId('');
      load();
      setSelected(inv);
    } catch (e: any) { showToast?.(e.message || 'Erro ao criar fatura', 'error'); }
    setCreatingFromOrder(false);
  };

  const kpis = [
    { label: 'Total Faturado', value: fmt(data?.totalInvoiced || 0), color: 'text-content-primary', icon: <TrendingUp className="w-5 h-5 text-green-600" /> },
    { label: 'Pago',           value: fmt(data?.totalPaid || 0),      color: 'text-green-600 dark:text-green-400', icon: <CheckCircle className="w-5 h-5 text-green-600" /> },
    { label: 'Por Receber',    value: fmt(data?.totalOutstanding || 0), color: 'text-yellow-600 dark:text-yellow-400', icon: <Clock className="w-5 h-5 text-yellow-600" /> },
    { label: 'Nº Faturas',     value: String(data?.total || 0),       color: 'text-content-primary', icon: <FileText className="w-5 h-5 text-blue-600" /> },
  ];

  const STATUS_FILTERS = [
    { value: '', label: 'Todas' },
    { value: 'draft',     label: 'Rascunho' },
    { value: 'issued',    label: 'Emitidas' },
    { value: 'paid',      label: 'Pagas' },
    { value: 'partial',   label: 'Parciais' },
    { value: 'overdue',   label: 'Vencidas' },
    { value: 'cancelled', label: 'Canceladas' },
  ];

  return (
    <PageShell
      title="Faturas"
      description="Gestão de faturação formal"
      actions={
        <button onClick={load} className="p-2 rounded-lg text-content-muted hover:bg-surface-base transition-colors" title="Atualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
      compactHeaderMobile
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className="bg-surface-raised border border-border-default rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">{k.icon}<span className="text-xs text-content-muted font-medium">{k.label}</span></div>
            <p className={`text-xl font-bold font-mono ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Quick-create from order */}
      <div className="bg-surface-raised border border-border-default rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
        <FileText className="w-4 h-4 text-content-muted shrink-0" />
        <span className="text-sm font-medium text-content-secondary">Criar fatura de encomenda:</span>
        <input
          value={fromOrderId}
          onChange={e => setFromOrderId(e.target.value)}
          placeholder="UUID da encomenda…"
          className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none"
          onKeyDown={e => e.key === 'Enter' && createFromOrder()}
        />
        <button onClick={createFromOrder} disabled={creatingFromOrder || !fromOrderId.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
          {creatingFromOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Criar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar número ou cliente…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-default bg-surface-base text-sm text-content-primary focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === f.value
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'border-border-default text-content-muted hover:bg-surface-base'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-raised border border-border-default rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-content-muted" />
          </div>
        ) : setupError ? (
          <div className="py-12 text-center px-6">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Erro ao carregar faturas</p>
            <p className="text-xs text-content-muted font-mono mb-5 max-w-lg mx-auto break-all">{setupError}</p>
            <div className="flex justify-center gap-3">
              <button onClick={runSetup} disabled={fixing}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                {fixing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Configurar Base de Dados
              </button>
              <button onClick={load}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-default text-content-secondary hover:bg-surface-base text-sm font-medium rounded-lg transition-colors">
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>
            </div>
          </div>
        ) : !data?.invoices.length ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-content-muted mx-auto mb-3 opacity-40" />
            <p className="text-sm text-content-muted">Nenhuma fatura encontrada</p>
            {!statusFilter && !search && (
              <p className="text-xs text-content-muted mt-1">Crie faturas a partir de encomendas acima</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border-default bg-surface-base">
                  {['Nº Fatura', 'Cliente', 'Emitida', 'Vencimento', 'Total', 'Pago', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default/30">
                {data.invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-surface-base transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-content-primary">{inv.invoiceNumber}</span>
                      {inv.orderNumber && <p className="text-xs text-content-muted">#{inv.orderNumber}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-content-primary">{inv.customerName || '—'}</p>
                      {inv.customerPhone && <p className="text-xs text-content-muted">{inv.customerPhone}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-content-muted">{fmtDate(inv.issuedAt)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={inv.status === 'overdue' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-content-muted'}>
                        {fmtDate(inv.dueDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold font-mono text-content-primary">{fmt(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-sm font-mono">
                      <span className={inv.amountPaid >= inv.totalAmount ? 'text-green-600 dark:text-green-400' : 'text-content-muted'}>
                        {fmt(inv.amountPaid)}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelected(inv)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-content-secondary border border-border-default hover:bg-surface-base transition-colors">
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

      {/* Detail modal */}
      {selected && (
        <InvoiceDetail
          invoice={selected}
          onClose={() => setSelected(null)}
          onAction={() => { load(); setSelected(null); }}
          showToast={showToast}
        />
      )}
    </PageShell>
  );
};
