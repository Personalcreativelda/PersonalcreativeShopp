import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, Download, Check, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../core/services/apiClient';
import { PageShell } from '../../core/components/layout/PageShell';

type Tab = 'affiliates' | 'commissions' | 'withdrawals';

interface Affiliate {
 id: string;
 name: string;
 email: string;
 phone?: string;
 referral_code: string;
 status: string;
 commission_rate: number;
 total_earned: number;
 pending_balance: number;
 available_balance: number;
 withdrawn_balance: number;
 total_referrals: number;
 created_at: string;
}

interface Commission {
 id: string;
 affiliate_name: string;
 order_number?: string;
 referred_name?: string;
 order_amount: number;
 commission_rate: number;
 commission_amount: number;
 status: string;
 created_at: string;
}

interface Withdrawal {
 id: string;
 affiliate_name: string;
 affiliate_phone?: string;
 amount: number;
 method: string;
 account_info: string;
 status: string;
 admin_notes?: string;
 created_at: string;
}

const STATUS_CLS: Record<string, string> = {
 pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
 approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
 rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
 paid: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
 active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
 suspended:'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const STATUS_LABEL: Record<string, string> = {
 pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', paid: 'Pago',
 active: 'Activo', suspended: 'Suspenso',
};

const fmt = (d: string) => new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' });

export const Affiliates: React.FC<{
 currentUser: any;
 showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}> = ({ currentUser, showToast }) => {
 const [tab, setTab] = useState<Tab>('affiliates');
 const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
 const [commissions, setCommissions] = useState<Commission[]>([]);
 const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
 const [loading, setLoading] = useState(true);
 const [actionLoading, setActionLoading] = useState<string | null>(null);
 const [expandedId, setExpandedId] = useState<string | null>(null);
 const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

 useEffect(() => { loadAll(); }, []);

 const loadAll = async () => {
 setLoading(true);
 try {
 const [affs, comms, wds] = await Promise.all([
 api.get<Affiliate[]>('/affiliates').catch(() => []),
 api.get<Commission[]>('/affiliates/admin/commissions').catch(() => []),
 api.get<Withdrawal[]>('/affiliates/admin/withdrawals').catch(() => []),
 ]);
 setAffiliates(affs);
 setCommissions(comms);
 setWithdrawals(wds);
 } finally {
 setLoading(false);
 }
 };

 const toggleAffStatus = async (aff: Affiliate) => {
 const newStatus = aff.status === 'active' ? 'suspended' : 'active';
 setActionLoading(aff.id);
 try {
 await api.put(`/affiliates/${aff.id}/status`, { status: newStatus });
 showToast(`Afiliado ${newStatus === 'active' ? 'activado' : 'suspenso'}`, 'success');
 await loadAll();
 } catch (err: any) {
 showToast(err.message || 'Erro', 'error');
 } finally {
 setActionLoading(null);
 }
 };

 const handleCommission = async (id: string, status: 'approved' | 'rejected') => {
 setActionLoading(id);
 try {
 await api.put(`/affiliates/commissions/${id}/status`, { status, notes: noteInputs[id] || '' });
 showToast(status === 'approved' ? 'Comissão aprovada' : 'Comissão rejeitada', 'success');
 setExpandedId(null);
 await loadAll();
 } catch (err: any) {
 showToast(err.message || 'Erro', 'error');
 } finally {
 setActionLoading(null);
 }
 };

 const handleWithdrawal = async (id: string, status: 'approved' | 'rejected' | 'paid') => {
 setActionLoading(id);
 try {
 await api.put(`/affiliates/withdrawals/${id}/process`, { status, adminNotes: noteInputs[id] || '' });
 showToast(
 status === 'paid' ? 'Levantamento marcado como pago' :
 status === 'approved' ? 'Levantamento aprovado' : 'Levantamento rejeitado',
 'success'
 );
 setExpandedId(null);
 await loadAll();
 } catch (err: any) {
 showToast(err.message || 'Erro', 'error');
 } finally {
 setActionLoading(null);
 }
 };

 const pendingCommissions = commissions.filter(c => c.status === 'pending').length;
 const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;

 return (
 <PageShell title="Programa de Afiliados" icon={<TrendingUp className="w-5 h-5" />}>
 {/* Tabs */}
 <div className="flex gap-1 bg-surface-base p-1 rounded-xl mb-6">
 {([
 ['affiliates', 'Afiliados', affiliates.length],
 ['commissions', 'Comissões', pendingCommissions || undefined],
 ['withdrawals', 'Levantamentos', pendingWithdrawals || undefined],
 ] as const).map(([key, label, badge]) => (
 <button
 key={key}
 onClick={() => setTab(key)}
 className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
 tab === key ? 'bg-surface-raised text-content-primary shadow-sm' : 'text-content-secondary hover:text-content-primary '
 }`}
 >
 {label}
 {badge ? (
 <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
 {badge}
 </span>
 ) : null}
 </button>
 ))}
 </div>

 {loading ? (
 <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-content-muted" /></div>
 ) : (
 <>
 {/* ── Afiliados ─────────────────────────────────── */}
 {tab === 'affiliates' && (
 <div className="space-y-3">
 {affiliates.length === 0 && (
 <div className="text-center py-16 text-content-muted">
 <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p>Ainda não há afiliados registados.</p>
 </div>
 )}
 {affiliates.map(aff => (
 <div key={aff.id} className="bg-surface-raised rounded-2xl p-5 border border-border-default shadow-sm">
 <div className="flex items-start justify-between gap-3 mb-3">
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="font-semibold text-content-primary">{aff.name}</p>
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[aff.status]}`}>
 {STATUS_LABEL[aff.status]}
 </span>
 <span className="font-mono text-xs bg-surface-base px-2 py-0.5 rounded text-content-secondary">
 {aff.referral_code}
 </span>
 </div>
 <p className="text-xs text-content-muted mt-0.5">{aff.email}{aff.phone ? ` · ${aff.phone}` : ''}</p>
 </div>
 <button
 onClick={() => toggleAffStatus(aff)}
 disabled={actionLoading === aff.id}
 className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 ${
 aff.status === 'active'
 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200'
 : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200'
 }`}
 >
 {actionLoading === aff.id ? <Loader2 className="w-3 h-3 animate-spin" /> : aff.status === 'active' ? 'Suspender' : 'Activar'}
 </button>
 </div>
 <div className="grid grid-cols-4 gap-2 text-center text-xs">
 {[
 ['Ganho', `${Number(aff.total_earned).toFixed(0)} MT`],
 ['Pendente', `${Number(aff.pending_balance).toFixed(0)} MT`],
 ['Disponível', `${Number(aff.available_balance).toFixed(0)} MT`],
 ['Referidos', String(aff.total_referrals)],
 ].map(([label, value]) => (
 <div key={label} className="bg-surface-base rounded-lg p-2">
 <p className="font-bold text-content-primary">{value}</p>
 <p className="text-content-muted">{label}</p>
 </div>
 ))}
 </div>
 <p className="text-xs text-content-muted mt-2">Taxa: {Number(aff.commission_rate).toFixed(0)}% · Desde {fmt(aff.created_at)}</p>
 </div>
 ))}
 </div>
 )}

 {/* ── Comissões ─────────────────────────────────── */}
 {tab === 'commissions' && (
 <div className="space-y-3">
 {commissions.length === 0 && (
 <div className="text-center py-16 text-content-muted">
 <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p>Nenhuma comissão registada.</p>
 </div>
 )}
 {commissions.map(c => (
 <div key={c.id} className="bg-surface-raised rounded-2xl border border-border-default shadow-sm overflow-hidden">
 <button
 className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-surface-base/50 transition-colors"
 onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
 >
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-medium text-content-primary text-sm">{c.affiliate_name}</span>
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[c.status]}`}>
 {STATUS_LABEL[c.status]}
 </span>
 </div>
 <p className="text-xs text-content-muted mt-0.5">
 {c.referred_name ? `Referido: ${c.referred_name}` : ''}{c.order_number ? ` · Pedido #${c.order_number}` : ''} · {fmt(c.created_at)}
 </p>
 </div>
 <div className="text-right flex-shrink-0 ml-3">
 <p className="text-sm font-bold text-green-600 dark:text-green-400">+{Number(c.commission_amount).toFixed(2)} MT</p>
 <p className="text-xs text-content-muted">{Number(c.commission_rate).toFixed(0)}% de {Number(c.order_amount).toFixed(2)} MT</p>
 {c.status === 'pending' && (expandedId === c.id ? <ChevronUp className="w-4 h-4 text-content-muted ml-auto mt-1" /> : <ChevronDown className="w-4 h-4 text-content-muted ml-auto mt-1" />)}
 </div>
 </button>
 {expandedId === c.id && c.status === 'pending' && (
 <div className="px-5 pb-4 space-y-3 border-t border-border-default pt-3">
 <textarea
 rows={2}
 placeholder="Notas (opcional)"
 value={noteInputs[c.id] || ''}
 onChange={e => setNoteInputs(n => ({ ...n, [c.id]: e.target.value }))}
 className="w-full px-3 py-2 rounded-xl border border-border-default bg-surface-raised text-sm text-content-primary resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
 />
 <div className="flex gap-2">
 <button
 onClick={() => handleCommission(c.id, 'approved')}
 disabled={actionLoading === c.id}
 className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
 >
 {actionLoading === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
 Aprovar
 </button>
 <button
 onClick={() => handleCommission(c.id, 'rejected')}
 disabled={actionLoading === c.id}
 className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
 >
 <X className="w-4 h-4" />
 Rejeitar
 </button>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 )}

 {/* ── Levantamentos ─────────────────────────────── */}
 {tab === 'withdrawals' && (
 <div className="space-y-3">
 {withdrawals.length === 0 && (
 <div className="text-center py-16 text-content-muted">
 <Download className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p>Nenhum pedido de levantamento.</p>
 </div>
 )}
 {withdrawals.map(w => (
 <div key={w.id} className="bg-surface-raised rounded-2xl border border-border-default shadow-sm overflow-hidden">
 <button
 className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-surface-base/50 transition-colors"
 onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
 >
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-medium text-content-primary text-sm">{w.affiliate_name}</span>
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[w.status]}`}>
 {STATUS_LABEL[w.status]}
 </span>
 </div>
 <p className="text-xs text-content-muted mt-0.5">
 {w.method.toUpperCase()} — {w.account_info} · {fmt(w.created_at)}
 </p>
 {w.admin_notes && <p className="text-xs text-content-muted mt-0.5">{w.admin_notes}</p>}
 </div>
 <div className="text-right flex-shrink-0 ml-3">
 <p className="text-base font-bold text-content-primary">{Number(w.amount).toFixed(2)} MT</p>
 {w.status === 'pending' && (expandedId === w.id ? <ChevronUp className="w-4 h-4 text-content-muted ml-auto mt-1" /> : <ChevronDown className="w-4 h-4 text-content-muted ml-auto mt-1" />)}
 </div>
 </button>
 {expandedId === w.id && w.status === 'pending' && (
 <div className="px-5 pb-4 space-y-3 border-t border-border-default pt-3">
 <textarea
 rows={2}
 placeholder="Notas ao afiliado (opcional)"
 value={noteInputs[w.id] || ''}
 onChange={e => setNoteInputs(n => ({ ...n, [w.id]: e.target.value }))}
 className="w-full px-3 py-2 rounded-xl border border-border-default bg-surface-raised text-sm text-content-primary resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
 />
 <div className="flex gap-2">
 <button
 onClick={() => handleWithdrawal(w.id, 'paid')}
 disabled={actionLoading === w.id}
 className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
 >
 {actionLoading === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
 Marcar Pago
 </button>
 <button
 onClick={() => handleWithdrawal(w.id, 'approved')}
 disabled={actionLoading === w.id}
 className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
 >
 <Check className="w-4 h-4" />
 Aprovar
 </button>
 <button
 onClick={() => handleWithdrawal(w.id, 'rejected')}
 disabled={actionLoading === w.id}
 className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
 >
 <X className="w-4 h-4" />
 Rejeitar
 </button>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </>
 )}
 </PageShell>
 );
};

export default Affiliates;
