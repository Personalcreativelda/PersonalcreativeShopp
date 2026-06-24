import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Package, Truck, CheckCircle, Clock, XCircle, MapPin, Tag, Copy, Check, Scan, CreditCard, ThumbsUp, CalendarClock, ShieldCheck, ShieldOff, AlertTriangle } from 'lucide-react';
import api from '../../core/services/apiClient';
import { Order, OrderStatus } from '../../core/types/order';

interface TimelineStep {
  label: string;
  icon: React.ReactNode;
  done: boolean;
  date?: string;
  isCancelled?: boolean;
}

const TZ = 'Africa/Maputo';
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : null;

const fmtShortDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', timeZone: TZ }) : null;

const daysRemaining = (deadline?: string | null): number => {
  if (!deadline) return -1;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const isDelivered = (status: string) =>
  status === OrderStatus.DELIVERED || status === 'delivered' ||
  status === OrderStatus.COMPLETED || status === 'completed';

const buildTimeline = (order: Order): TimelineStep[] => {
  const cancelled = order.status === OrderStatus.CANCELLED || order.status === 'cancelled';
  if (cancelled) {
    return [
      { label: 'Encomenda Recebida', icon: <Package className="w-5 h-5" />, done: true, date: fmtDate(order.createdAt) || undefined },
      { label: 'Cancelada', icon: <XCircle className="w-5 h-5" />, done: true, date: fmtDate(order.updatedAt) || undefined, isCancelled: true },
    ];
  }
  const statusOrder = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
  ];
  const currentIdx = statusOrder.indexOf(order.status as OrderStatus);
  return [
    { label: 'Encomenda Recebida',     icon: <Package className="w-5 h-5" />,     done: currentIdx >= 0, date: currentIdx >= 0 ? fmtDate(order.createdAt) || undefined : undefined },
    { label: 'Pagamento Confirmado',   icon: <CreditCard className="w-5 h-5" />,   done: currentIdx >= 1, date: currentIdx >= 1 ? fmtDate(order.updatedAt) || undefined : undefined },
    { label: 'Em Processamento',       icon: <Clock className="w-5 h-5" />,        done: currentIdx >= 2, date: currentIdx >= 2 ? fmtDate(order.updatedAt) || undefined : undefined },
    { label: 'Saiu para Entrega',      icon: <Truck className="w-5 h-5" />,        done: currentIdx >= 3, date: currentIdx >= 3 ? fmtDate(order.updatedAt) || undefined : undefined },
    { label: 'Entregue',               icon: <CheckCircle className="w-5 h-5" />,  done: currentIdx >= 4, date: currentIdx >= 4 ? fmtDate(order.deliveredAt || order.updatedAt) || undefined : undefined },
    { label: 'Receção Confirmada',     icon: <ThumbsUp className="w-5 h-5" />,     done: currentIdx >= 5, date: currentIdx >= 5 ? fmtDate(order.updatedAt) || undefined : undefined },
  ];
};

export const CustomerOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirmDelivery = async () => {
    if (!order) return;
    setConfirming(true);
    try {
      await api.put(`/orders/my-orders/${order.id}/confirm`, {});
      setOrder(o => o ? { ...o, status: OrderStatus.COMPLETED } : o);
      setConfirmed(true);
    } catch {
      // silently fail — user can retry
    } finally {
      setConfirming(false);
    }
  };

  const copyTracking = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  useEffect(() => {
    if (!id) return;
    api.get<Order>(`/orders/my-orders/${id}`)
      .then(setOrder)
      .catch(() => setError('Encomenda não encontrada'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-content-muted" />
    </div>
  );

  if (error || !order) return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center gap-4">
      <p className="text-red-500">{error || 'Encomenda não encontrada'}</p>
      <button onClick={() => navigate('/minha-conta/encomendas')} className="text-green-600 hover:underline text-sm">Voltar</button>
    </div>
  );

  const timeline = buildTimeline(order);
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className="min-h-screen bg-surface-base py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/minha-conta/encomendas')} className="p-2 rounded-lg hover:bg-surface-overlay transition-colors text-content-muted">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-content-primary">Pedido #{order.orderNumber || order.id.slice(0,8)}</h1>
            <p className="text-sm text-content-muted">{fmtDate(order.createdAt)}</p>
          </div>
        </div>

        {/* Código de Rastreio */}
        {order.trackingCode && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-5 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-3">
              <Scan className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="font-semibold text-green-800 dark:text-green-300 text-sm">Código de Rastreio</h2>
            </div>
            <div className="flex items-center justify-between bg-surface-raised rounded-xl px-4 py-3 border border-green-200 dark:border-green-700">
              <span className="font-mono text-lg font-bold tracking-widest text-content-primary">
                {order.trackingCode}
              </span>
              <button
                onClick={() => copyTracking(order.trackingCode!)}
                className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400 hover:text-green-800 transition-colors"
              >
                {copied ? (
                  <><Check className="w-4 h-4" /> Copiado!</>
                ) : (
                  <><Copy className="w-4 h-4" /> Copiar</>
                )}
              </button>
            </div>
            <p className="text-xs text-green-700 dark:text-green-400 mt-2">
              Use este código para rastrear a sua encomenda.
            </p>
          </div>
        )}

        {/* ── Entrega estimada (antes de chegar) ── */}
        {!isDelivered(order.status) && order.estimatedDeliveryDate && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800/50 rounded-xl flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">Chegada Estimada</p>
                <p className="text-base font-bold text-blue-900 dark:text-blue-100 mt-0.5">
                  {fmtShortDate(order.estimatedDeliveryDate)}
                  {' – '}
                  {fmtShortDate(
                    new Date(new Date(order.estimatedDeliveryDate).getTime() + 2 * 86400000).toISOString()
                  )}
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                  {(() => {
                    const d = daysRemaining(order.estimatedDeliveryDate);
                    if (d <= 0) return 'Prevista para hoje ou amanhã';
                    return `Em ${d} dia${d !== 1 ? 's' : ''}`;
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Protecção do comprador (após entrega) ── */}
        {isDelivered(order.status) && order.disputeDeadline && (() => {
          const days = daysRemaining(order.disputeDeadline);
          const expired = days < 0;
          return (
            <div className={`rounded-2xl p-5 border ${
              expired
                ? 'bg-surface-base dark:bg-white/[0.04] border-border-default'
                : days <= 3
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  expired ? 'bg-surface-overlay dark:bg-white/[0.1]' : days <= 3 ? 'bg-amber-100 dark:bg-amber-800/50' : 'bg-emerald-100 dark:bg-emerald-800/50'
                }`}>
                  {expired
                    ? <ShieldOff className="w-5 h-5 text-gray-500" />
                    : days <= 3
                      ? <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      : <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  }
                </div>
                <div className="flex-1">
                  {expired ? (
                    <>
                      <p className="text-sm font-semibold text-content-muted">Período de Disputa Encerrado</p>
                      <p className="text-xs text-content-muted mt-0.5">O prazo para abrir uma disputa expirou em {fmtShortDate(order.disputeDeadline)}.</p>
                    </>
                  ) : (
                    <>
                      <p className={`text-sm font-semibold ${days <= 3 ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
                        Protecção do Comprador Activa
                      </p>
                      <p className={`text-xs mt-0.5 ${days <= 3 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        Podes abrir uma disputa até <strong>{fmtShortDate(order.disputeDeadline)}</strong>
                        {' · '}
                        <strong>{days} dia{days !== 1 ? 's' : ''} restante{days !== 1 ? 's' : ''}</strong>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Timeline */}
        <div className="bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default">
          <h2 className="font-semibold text-content-primary mb-5">Rastreio do Pedido</h2>
          <div className="space-y-0">
            {timeline.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.isCancelled ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : step.done ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'bg-surface-overlay text-content-muted'
                  }`}>
                    {step.icon}
                  </div>
                  {i < timeline.length - 1 && (
                    <div className={`w-0.5 flex-1 my-1 ${step.done && !step.isCancelled ? 'bg-green-400' : 'bg-surface-overlay dark:bg-white/[0.1]'}`} style={{ minHeight: '24px' }} />
                  )}
                </div>
                <div className="pb-4 flex-1">
                  <p className={`font-medium text-sm ${step.isCancelled ? 'text-red-600 dark:text-red-400' : step.done ? 'text-content-primary' : 'text-content-muted dark:text-content-muted'}`}>
                    {step.label}
                  </p>
                  {step.date && <p className="text-xs text-content-muted mt-0.5">{step.date}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Itens */}
        <div className="bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default">
          <h2 className="font-semibold text-content-primary mb-4">Itens do Pedido</h2>
          <div className="space-y-3">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-border-default last:border-0">
                <div>
                  <p className="text-sm font-medium text-content-primary">{item.productName}</p>
                  <p className="text-xs text-content-muted">Qtd: {item.quantity} {item.unit || ''}</p>
                </div>
                <span className="text-sm font-semibold text-content-primary">
                  {((item.priceAtTime || item.price || 0) * item.quantity).toFixed(2)} MT
                </span>
              </div>
            ))}
          </div>

          {/* Totais */}
          <div className="mt-4 space-y-2">
            {order.isDelivery && order.deliveryFee != null && order.deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-content-muted">
                <span>Taxa de entrega {order.deliveryZoneName ? `(${order.deliveryZoneName})` : ''}</span>
                <span>{order.deliveryFee.toFixed(2)} MT</span>
              </div>
            )}
            {order.couponCode && (order.discountAmount || 0) > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> {order.couponCode}</span>
                <span>-{(order.discountAmount || 0).toFixed(2)} MT</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-border-default pt-2 text-content-primary">
              <span>Total</span>
              <span>{order.totalAmount?.toFixed(2)} MT</span>
            </div>
          </div>
        </div>

        {/* Endereço */}
        {order.isDelivery && order.deliveryLocation && (
          <div className="bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="font-semibold text-content-primary">Endereço de Entrega</h2>
            </div>
            <p className="text-sm text-content-muted">{order.deliveryLocation}</p>
          </div>
        )}

        {/* Confirmar Receção */}
        {(order.status === OrderStatus.DELIVERED || order.status === 'delivered') && !confirmed && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-800/50 flex items-center justify-center shrink-0">
                <ThumbsUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-content-primary text-sm">Recebeste a tua encomenda?</h3>
                <p className="text-xs text-content-muted mt-0.5">
                  Confirma a receção para que possamos fechar o processo de entrega.
                </p>
              </div>
            </div>
            <button
              onClick={handleConfirmDelivery}
              disabled={confirming}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmar que recebi a encomenda
            </button>
          </div>
        )}

        {/* Confirmado com sucesso */}
        {(order.status === OrderStatus.COMPLETED || order.status === 'completed' || confirmed) && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">Receção confirmada. Obrigado pela tua compra!</p>
          </div>
        )}

        {/* Ação: Solicitar Reembolso */}
        {isDelivered(order.status) && (() => {
          const deadlineExpired = order.disputeDeadline ? daysRemaining(order.disputeDeadline) < 0 : false;
          return deadlineExpired ? (
            <div className="w-full py-3 rounded-xl border-2 border-border-default text-center text-sm text-content-muted dark:text-content-muted cursor-not-allowed">
              Prazo de disputa encerrado — reembolso não disponível
            </div>
          ) : (
            <button
              onClick={() => navigate('/minha-conta/reembolsos', { state: { orderId: order.id, orderNumber: order.orderNumber } })}
              className="w-full py-3 rounded-xl border-2 border-gray-300 dark:border-border-default text-content-secondary hover:border-red-400 hover:text-red-600 dark:hover:border-red-500 dark:hover:text-red-400 transition-colors font-medium text-sm"
            >
              Solicitar Reembolso / Disputa
            </button>
          );
        })()}
      </div>
    </div>
  );
};

export default CustomerOrderDetail;
