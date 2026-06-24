import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Package, CreditCard, Clock, Truck, CheckCircle,
  XCircle, ThumbsUp, Loader2, AlertCircle, MapPin,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3060/api';

const TZ = 'Africa/Maputo';
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : null;

interface TrackResult {
  trackingCode: string;
  orderNumber: string;
  status: string;
  customerName: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string | null;
  deliveryZoneName?: string | null;
  isDelivery?: boolean;
  estimatedDeliveryDate?: string | null;
  disputeDeadline?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  processing: 'Em Processamento',
  out_for_delivery: 'Saiu para Entrega',
  delivered: 'Entregue',
  completed: 'Recebido / Concluído',
  cancelled: 'Cancelado',
};

interface Step {
  key: string;
  label: string;
  icon: React.ReactNode;
  isCancelled?: boolean;
}

const buildTimeline = (status: string, order: TrackResult): Array<Step & { done: boolean; date?: string | null }> => {
  if (status === 'cancelled') {
    return [
      { key: 'pending', label: 'Encomenda Recebida', icon: <Package className="w-5 h-5" />, done: true, date: fmtDate(order.createdAt) },
      { key: 'cancelled', label: 'Cancelada', icon: <XCircle className="w-5 h-5" />, done: true, date: fmtDate(order.updatedAt), isCancelled: true },
    ];
  }
  const STEPS: Step[] = [
    { key: 'pending', label: 'Encomenda Recebida', icon: <Package className="w-5 h-5" /> },
    { key: 'confirmed', label: 'Pagamento Confirmado', icon: <CreditCard className="w-5 h-5" /> },
    { key: 'processing', label: 'Em Processamento', icon: <Clock className="w-5 h-5" /> },
    { key: 'out_for_delivery', label: 'Saiu para Entrega', icon: <Truck className="w-5 h-5" /> },
    { key: 'delivered', label: 'Entregue', icon: <CheckCircle className="w-5 h-5" /> },
    { key: 'completed', label: 'Receção Confirmada', icon: <ThumbsUp className="w-5 h-5" /> },
  ];
  const ORDER = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'completed'];
  const currentIdx = ORDER.indexOf(status);
  return STEPS.map((s, i) => ({
    ...s,
    done: i <= currentIdx,
    date: i <= currentIdx ? fmtDate(i === 4 ? (order.deliveredAt || order.updatedAt) : order.updatedAt) : null,
  }));
};

const statusColor = (status: string) => {
  if (status === 'cancelled') return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  if (status === 'completed' || status === 'delivered') return 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
  if (status === 'out_for_delivery') return 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
  return 'text-amber-700 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
};

export const OrderTrackingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('codigo') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const didAutoSearch = useRef(false);

  const search = async (trackingCode: string) => {
    const trimmed = trackingCode.trim().toUpperCase();
    if (!trimmed) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timerId = setTimeout(() => controller.abort(), 15000);

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(
        `${API_BASE}/orders/tracking/${encodeURIComponent(trimmed)}`,
        { signal: controller.signal }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const data: TrackResult = await res.json();
      setResult(data);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('Tempo limite excedido. Tente novamente.');
      } else {
        setError(e?.message || 'Código não encontrado');
      }
    } finally {
      clearTimeout(timerId);
      setLoading(false);
    }
  };

  // Auto-search when page loads with ?codigo= in URL.
  // didAutoSearch ref prevents StrictMode double-fire.
  useEffect(() => {
    const inicial = searchParams.get('codigo');
    if (inicial && !didAutoSearch.current) {
      didAutoSearch.current = true;
      search(inicial);
    }
    return () => { abortRef.current?.abort(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(code);
  };

  const timeline = result ? buildTimeline(result.status, result) : [];

  return (
    <div className="min-h-screen bg-surface-base py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 shadow-md"
            style={{ background: 'var(--brand-600)' }}>
            <Package className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-content-primary">Rastrear Encomenda</h1>
          <p className="text-sm text-content-muted mt-1">
            Insere o código de rastreio para ver o estado da tua encomenda
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: NRV-2024-0001"
            className="flex-1 px-4 py-3 rounded-xl border border-border-default bg-surface-raised text-content-primary placeholder:text-content-muted focus:outline-none focus:ring-2 font-mono text-sm tracking-wider"
            style={{ '--tw-ring-color': 'var(--brand-600)' } as React.CSSProperties}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
            style={{ background: 'var(--brand-600)' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'A rastrear…' : 'Rastrear'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mb-6">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            {/* Status card */}
            <div className={`rounded-2xl p-5 border ${statusColor(result.status)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Estado</p>
                  <p className="text-lg font-bold">{STATUS_LABELS[result.status] || result.status}</p>
                  <p className="text-xs opacity-70 mt-1">Pedido #{result.orderNumber}</p>
                </div>
                <span className="font-mono text-xs font-bold px-3 py-1.5 rounded-full bg-white/60 dark:bg-black/20 border border-current opacity-80">
                  {result.trackingCode}
                </span>
              </div>
              {result.customerName && (
                <p className="text-xs opacity-70 mt-2">Cliente: {result.customerName}</p>
              )}
              {result.isDelivery && result.deliveryZoneName && (
                <div className="flex items-center gap-1.5 mt-2">
                  <MapPin className="w-3.5 h-3.5 opacity-70" />
                  <p className="text-xs opacity-70">Zona: {result.deliveryZoneName}</p>
                </div>
              )}
              {result.estimatedDeliveryDate && result.status !== 'delivered' && result.status !== 'completed' && result.status !== 'cancelled' && (
                <p className="text-xs opacity-80 font-medium mt-2">
                  Entrega estimada: {fmtDate(result.estimatedDeliveryDate)?.split(',')[0]}
                </p>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-surface-raised rounded-2xl p-6 border border-border-default shadow-sm">
              <h2 className="font-semibold text-content-primary mb-5 text-sm uppercase tracking-wide">
                Histórico do Pedido
              </h2>
              <div className="space-y-0">
                {timeline.map((step, i) => (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        step.isCancelled
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
                          : step.done
                            ? 'text-white shadow-sm'
                            : 'bg-surface-overlay text-content-muted'
                      }`}
                        style={step.done && !step.isCancelled ? { background: 'var(--brand-600)' } : undefined}
                      >
                        {step.icon}
                      </div>
                      {i < timeline.length - 1 && (
                        <div className={`w-0.5 flex-1 my-1 ${step.done && !step.isCancelled ? '' : 'bg-surface-overlay dark:bg-white/10'}`}
                          style={step.done && !step.isCancelled ? { background: 'color-mix(in srgb, var(--brand-600) 40%, transparent)' } : undefined}
                        />
                      )}
                    </div>
                    <div className="pb-5 flex-1">
                      <p className={`font-medium text-sm ${
                        step.isCancelled ? 'text-red-600 dark:text-red-400'
                          : step.done ? 'text-content-primary'
                          : 'text-content-muted'
                      }`}>
                        {step.label}
                      </p>
                      {step.date && <p className="text-xs text-content-muted mt-0.5">{step.date}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tip */}
            <p className="text-center text-xs text-content-muted px-4">
              Para mais detalhes, acede à tua{' '}
              <a href="/minha-conta/encomendas" className="font-medium hover:underline" style={{ color: 'var(--brand-600)' }}>
                área de membro
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTrackingPage;
