import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
 Truck, Package, Clock, CheckCircle, XCircle, Search,
 ChevronDown, MapPin, Phone, Loader2, RefreshCw, CreditCard, User,
 Mail, MessageCircle,
} from 'lucide-react';
import api from '../../core/services/apiClient';
import { PageShell } from '../../core/components/layout/PageShell';

interface LogisticsOrder {
 id: string;
 orderNumber?: string;
 trackingCode?: string;
 customerName: string;
 customerPhone?: string;
 status: string;
 isDelivery: boolean;
 deliveryZoneName?: string;
 deliveryAddress?: string;
 deliveryAddressFormatted?: string;
 deliveryLocation?: string;
 notes?: string;
 items: { productName: string; quantity: number; variantName?: string }[];
 createdAt: string;
 updatedAt?: string;
}

// Fluxo completo do processo logístico
const FLOW: { key: string; label: string; short: string; color: string; bg: string; ring: string; icon: React.ReactNode }[] = [
 { key: 'pending', label: 'Aguarda Pagamento', short: 'Pendente', color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-900/30', ring: 'ring-yellow-400', icon: <Clock className="w-4 h-4" /> },
 { key: 'confirmed', label: 'Pagamento Confirmado', short: 'Confirmado', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/30', ring: 'ring-blue-400', icon: <CreditCard className="w-4 h-4" /> },
 { key: 'processing', label: 'Em Processamento', short: 'Processando', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-900/30', ring: 'ring-indigo-400', icon: <Package className="w-4 h-4" /> },
 { key: 'out_for_delivery', label: 'Saiu para Entrega', short: 'A Caminho', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-900/30', ring: 'ring-purple-400', icon: <Truck className="w-4 h-4" /> },
 { key: 'delivered', label: 'Entregue', short: 'Entregue', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/30', ring: 'ring-green-400', icon: <CheckCircle className="w-4 h-4" /> },
 { key: 'completed', label: 'Concluído (cliente confirmou)', short: 'Concluído', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/30', ring: 'ring-emerald-500', icon: <CheckCircle className="w-4 h-4" /> },
 { key: 'cancelled', label: 'Cancelado', short: 'Cancelado', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/30', ring: 'ring-red-400', icon: <XCircle className="w-4 h-4" /> },
];

const getStep = (key: string) => FLOW.find(s => s.key === key) ?? FLOW[0];

// Transições permitidas — sempre avançar, nunca retroceder (excepto cancelar)
const NEXT: Record<string, string[]> = {
 pending: ['confirmed', 'cancelled'],
 confirmed: ['processing', 'cancelled'],
 processing: ['out_for_delivery', 'cancelled'],
 out_for_delivery: ['delivered', 'cancelled'],
 delivered: ['completed'],
 completed: [],
 cancelled: [],
};

// Pipeline visual — só etapas activas (entregue/concluído/cancelado ficam fora)
const PIPELINE = ['pending', 'confirmed', 'processing', 'out_for_delivery'];

const StatusDropdown: React.FC<{
 order: LogisticsOrder;
 onUpdate: (orderId: string, status: string, notify: { email: boolean; whatsapp: boolean }) => Promise<void>;
 updating: boolean;
}> = ({ order, onUpdate, updating }) => {
 const [open, setOpen] = useState(false);
 const [notifyEmail, setNotifyEmail] = useState(true);
 const [notifyWhatsApp, setNotifyWhatsApp] = useState(!!order.customerPhone);
 const ref = useRef<HTMLDivElement>(null);
 const next = NEXT[order.status] ?? [];

 useEffect(() => {
 const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
 document.addEventListener('mousedown', close);
 return () => document.removeEventListener('mousedown', close);
 }, []);

 if (next.length === 0) return null;

 return (
 <div ref={ref} className="relative">
 <button
 onClick={() => setOpen(o => !o)}
 disabled={updating}
 className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
 >
 {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
 Atualizar Estado
 <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
 </button>

 {open && (
 <div className="absolute right-0 top-full mt-1 w-72 bg-surface-raised rounded-xl shadow-xl border border-border-default z-30 overflow-hidden">
 <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-content-muted uppercase tracking-wider">
 Avançar para:
 </div>
 {next.map(key => {
 const s = getStep(key);
 const isCancel = key === 'cancelled';
 return (
 <button
 key={key}
 onClick={() => { onUpdate(order.id, key, { email: notifyEmail, whatsapp: notifyWhatsApp }); setOpen(false); }}
 className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${
 isCancel
 ? 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400'
 : 'hover:bg-surface-base text-content-secondary'
 }`}
 >
 <span className={`w-7 h-7 rounded-full ${s.bg} ${s.color} flex items-center justify-center shrink-0`}>
 {s.icon}
 </span>
 <div>
 <p className="font-medium leading-tight">{s.label}</p>
 {!isCancel && (
 <p className="text-[11px] text-content-muted mt-0.5">
 {key === 'confirmed' && 'Pagamento recebido e validado'}
 {key === 'processing' && 'Preparando e embalando o pedido'}
 {key === 'out_for_delivery' && 'Enviado com a equipa de entregas'}
 {key === 'delivered' && 'Entregue ao cliente'}
 {key === 'completed' && 'Cliente confirmou a receção'}
 </p>
 )}
 </div>
 </button>
 );
 })}

 {/* Notificações */}
 <div className="border-t border-border-default px-3 py-2.5 space-y-2">
 <p className="text-[10px] font-semibold text-content-muted uppercase tracking-wider mb-1.5">Notificar cliente:</p>
 <label className={`flex items-center gap-2 text-xs cursor-pointer rounded-lg px-2 py-1.5 transition-colors ${notifyEmail ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-content-muted hover:bg-surface-base'}`}>
 <input
 type="checkbox"
 checked={notifyEmail}
 onChange={e => setNotifyEmail(e.target.checked)}
 className="accent-blue-600 w-3.5 h-3.5"
 onClick={e => e.stopPropagation()}
 />
 <Mail className="w-3.5 h-3.5" />
 <span className="font-medium">Email</span>
 </label>
 <label className={`flex items-center gap-2 text-xs cursor-pointer rounded-lg px-2 py-1.5 transition-colors ${
 !order.customerPhone ? 'opacity-40 cursor-not-allowed' :
 notifyWhatsApp ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'text-content-muted hover:bg-surface-base'
 }`}>
 <input
 type="checkbox"
 checked={notifyWhatsApp}
 disabled={!order.customerPhone}
 onChange={e => setNotifyWhatsApp(e.target.checked)}
 className="accent-green-600 w-3.5 h-3.5"
 onClick={e => e.stopPropagation()}
 />
 <MessageCircle className="w-3.5 h-3.5" />
 <span className="font-medium">WhatsApp</span>
 {!order.customerPhone && <span className="text-[10px] text-content-muted ml-auto">sem nº</span>}
 </label>
 </div>
 </div>
 )}
 </div>
 );
};

export const Logistics: React.FC<{
 showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}> = ({ showToast }) => {
 const [orders, setOrders] = useState<LogisticsOrder[]>([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [search, setSearch] = useState('');
 const [filterStatus, setFilterStatus] = useState<string>('active');
 const [updatingId, setUpdatingId] = useState<string | null>(null);
 const [expandedId, setExpandedId] = useState<string | null>(null);

 const load = async (quiet = false) => {
 quiet ? setRefreshing(true) : setLoading(true);
 try {
 const data = await api.get<LogisticsOrder[]>('/orders');
 setOrders(data);
 } catch {
 showToast('Erro ao carregar encomendas', 'error');
 } finally {
 setLoading(false);
 setRefreshing(false);
 }
 };

 useEffect(() => { load(); }, []);

 const handleStatusUpdate = async (orderId: string, newStatus: string, notify: { email: boolean; whatsapp: boolean }) => {
 setUpdatingId(orderId);
 try {
 await api.put(`/orders/${orderId}`, {
 status: newStatus,
 notifyEmail: notify.email,
 notifyWhatsApp: notify.whatsapp,
 });
 const step = getStep(newStatus);
 const notifParts = [notify.email && '📧 email', notify.whatsapp && '📱 WhatsApp'].filter(Boolean).join(' + ');
 showToast(`Estado: ${step.label}${notifParts ? ` · notificado por ${notifParts}` : ''}`, 'success');
 setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
 } catch (e: any) {
 showToast(e.message || 'Erro ao atualizar estado', 'error');
 } finally {
 setUpdatingId(null);
 }
 };

 const filtered = useMemo(() => {
 const active = ['pending', 'confirmed', 'processing', 'out_for_delivery'];
 let list = orders;
 if (filterStatus === 'active') list = list.filter(o => active.includes(o.status));
 else if (filterStatus !== 'all') list = list.filter(o => o.status === filterStatus);

 if (search.trim()) {
 const q = search.toLowerCase();
 list = list.filter(o =>
 o.customerName.toLowerCase().includes(q) ||
 o.customerPhone?.includes(q) ||
 o.trackingCode?.toLowerCase().includes(q) ||
 o.orderNumber?.toLowerCase().includes(q)
 );
 }
 return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
 }, [orders, filterStatus, search]);

 const counts = useMemo(() => ({
 pending: orders.filter(o => o.status === 'pending').length,
 confirmed: orders.filter(o => o.status === 'confirmed').length,
 processing: orders.filter(o => o.status === 'processing').length,
 out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
 delivered: orders.filter(o => o.status === 'delivered').length,
 completed: orders.filter(o => o.status === 'completed').length,
 cancelled: orders.filter(o => o.status === 'cancelled').length,
 }), [orders]);

 return (
 <PageShell
 title="Logística"
 subtitle="Fluxo completo de entregas — do pagamento à confirmação do cliente"
 actions={
 <button onClick={() => load(true)} disabled={refreshing}
 className="flex items-center gap-2 px-3 py-2 border border-border-default rounded-lg text-sm text-content-secondary hover:bg-surface-base transition-colors">
 <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
 </button>
 }
 >
 {/* Pipeline visual */}
 <div className="bg-surface-raised rounded-xl border border-border-default p-4 mb-6 overflow-x-auto">
 <div className="flex items-center min-w-max gap-0">
 {PIPELINE.map((key, idx) => {
 const s = getStep(key);
 const count = counts[key as keyof typeof counts] ?? 0;
 const isActive = filterStatus === key;
 return (
 <React.Fragment key={key}>
 <button
 onClick={() => setFilterStatus(f => f === key ? 'active' : key)}
 className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-lg transition-all ${isActive ? `${s.bg} ring-2 ${s.ring}` : 'hover:bg-surface-base'}`}
 >
 <span className={`w-9 h-9 rounded-full flex items-center justify-center ${s.bg} ${s.color} relative`}>
 {s.icon}
 {count > 0 && (
 <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 min-w-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
 {count}
 </span>
 )}
 </span>
 <span className={`text-xs font-medium ${s.color}`}>{s.short}</span>
 </button>
 {idx < PIPELINE.length - 1 && (
 <div className="flex-1 h-0.5 bg-surface-base mx-1 min-w-[16px]" />
 )}
 </React.Fragment>
 );
 })}
 {/* Entregue | Concluído | Cancelado */}
 <div className="w-px h-8 bg-surface-base mx-3" />
 <button
 onClick={() => setFilterStatus(f => f === 'delivered' ? 'active' : 'delivered')}
 className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-lg transition-all ${filterStatus === 'delivered' ? 'bg-green-50 dark:bg-green-900/30 ring-2 ring-green-400' : 'hover:bg-surface-base'}`}
 >
 <span className="w-9 h-9 rounded-full flex items-center justify-center bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 relative">
 <CheckCircle className="w-4 h-4" />
 {counts.delivered > 0 && (
 <span className="absolute -top-1.5 -right-1.5 min-w-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
 {counts.delivered}
 </span>
 )}
 </span>
 <span className="text-xs font-medium text-green-600 dark:text-green-400">Entregue</span>
 </button>
 <button
 onClick={() => setFilterStatus(f => f === 'completed' ? 'active' : 'completed')}
 className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-lg transition-all ${filterStatus === 'completed' ? 'bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-500' : 'hover:bg-surface-base'}`}
 >
 <span className="w-9 h-9 rounded-full flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 relative">
 <CheckCircle className="w-4 h-4" />
 {counts.completed > 0 && (
 <span className="absolute -top-1.5 -right-1.5 min-w-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
 {counts.completed}
 </span>
 )}
 </span>
 <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Concluído</span>
 </button>
 <button
 onClick={() => setFilterStatus(f => f === 'cancelled' ? 'active' : 'cancelled')}
 className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-lg transition-all ${filterStatus === 'cancelled' ? 'bg-red-50 dark:bg-red-900/30 ring-2 ring-red-400' : 'hover:bg-surface-base'}`}
 >
 <span className="w-9 h-9 rounded-full flex items-center justify-center bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 relative">
 <XCircle className="w-4 h-4" />
 {counts.cancelled > 0 && (
 <span className="absolute -top-1.5 -right-1.5 min-w-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
 {counts.cancelled}
 </span>
 )}
 </span>
 <span className="text-xs font-medium text-red-500">Cancelado</span>
 </button>
 </div>
 </div>

 {/* Search */}
 <div className="relative mb-4">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input
 type="text" value={search} onChange={e => setSearch(e.target.value)}
 placeholder="Buscar por cliente, telefone ou código de rastreio..."
 className="w-full pl-9 pr-4 py-2.5 border border-border-default rounded-xl bg-surface-raised text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
 />
 </div>

 {/* Lista */}
 {loading ? (
 <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>
 ) : filtered.length === 0 ? (
 <div className="text-center py-16 text-content-muted">
 <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p>Nenhuma encomenda neste estado.</p>
 </div>
 ) : (
 <div className="space-y-2">
 {filtered.map(order => {
 const step = getStep(order.status);
 const pipelineIdx = PIPELINE.indexOf(order.status);
 const isExpanded = expandedId === order.id;

 return (
 <div key={order.id} className="bg-surface-raised rounded-xl border border-border-default shadow-sm">
 {/* Progress bar mini */}
 {pipelineIdx >= 0 && (
 <div className="flex h-1">
 {PIPELINE.map((_, i) => (
 <div key={i} className={`flex-1 ${i <= pipelineIdx ? 'bg-green-500' : 'bg-surface-base'}`} />
 ))}
 </div>
 )}

 <div className="flex items-center gap-3 px-4 py-3">
 {/* Status badge */}
 <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${step.bg} ${step.color} whitespace-nowrap`}>
 {step.icon} {step.short}
 </span>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
 <span className="font-semibold text-sm text-content-primary">{order.customerName}</span>
 {order.trackingCode && (
 <span className="text-xs font-mono text-content-muted">{order.trackingCode}</span>
 )}
 </div>
 <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-content-muted">
 {order.customerPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{order.customerPhone}</span>}
 {order.isDelivery && order.deliveryZoneName
 ? <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><MapPin className="w-3 h-3" />{order.deliveryZoneName}</span>
 : <span>Levantamento</span>
 }
 <span>{new Date(order.createdAt).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' })}</span>
 <span>{order.items.length} {order.items.length === 1 ? 'item' : 'itens'}</span>
 </div>
 </div>

 {/* Dropdown + expand */}
 <div className="flex items-center gap-2 shrink-0">
 <StatusDropdown order={order} onUpdate={handleStatusUpdate} updating={updatingId === order.id} />
 <button
 onClick={() => setExpandedId(isExpanded ? null : order.id)}
 className="p-1.5 text-content-muted hover:text-content-secondary rounded-lg hover:bg-surface-base transition-colors"
 >
 <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
 </button>
 </div>
 </div>

 {/* Detalhes expandidos */}
 {isExpanded && (
 <div className="border-t border-border-default px-4 py-3 bg-surface-base/30 space-y-3">
 {/* Endereço */}
 {(order.deliveryAddressFormatted || order.deliveryAddress || order.deliveryLocation) && (
 <div className="flex items-start gap-2 text-sm text-content-secondary">
 <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />
 <span>{order.deliveryAddressFormatted || order.deliveryAddress || order.deliveryLocation}</span>
 </div>
 )}
 {/* Notas */}
 {order.notes && (
 <div className="flex items-start gap-2 text-sm text-content-muted italic">
 <User className="w-4 h-4 mt-0.5 shrink-0 text-content-muted" />
 <span>{order.notes}</span>
 </div>
 )}
 {/* Itens */}
 <div className="space-y-1">
 {order.items.map((item, i) => (
 <div key={i} className="flex items-center justify-between text-sm">
 <span className="text-content-secondary">
 {item.productName}{item.variantName ? ` — ${item.variantName}` : ''}
 </span>
 <span className="text-content-muted font-medium bg-surface-base px-2 py-0.5 rounded text-xs">×{item.quantity}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </PageShell>
 );
};
