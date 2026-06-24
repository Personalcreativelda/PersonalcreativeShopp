import React, { useState, useEffect } from 'react';
import { RefreshCw, Check, X, Loader2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import api from '../../core/services/apiClient';
import { PageShell } from '../../core/components/layout/PageShell';

interface RefundRequest {
 id: string;
 orderId: string;
 orderNumber?: string;
 customerName?: string;
 reason: string;
 details?: string;
 photos?: string[];
 status: 'pending' | 'approved' | 'rejected';
 adminNotes?: string;
 createdAt: string;
 reviewedAt?: string;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
 pending: { label: 'Pendente', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
 approved: { label: 'Aprovado', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
 rejected: { label: 'Rejeitado', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
};

export const Refunds: React.FC<{
 showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}> = ({ showToast }) => {
 const [refunds, setRefunds] = useState<RefundRequest[]>([]);
 const [loading, setLoading] = useState(true);
 const [actionId, setActionId] = useState<string | null>(null);
 const [expanded, setExpanded] = useState<string | null>(null);
 const [notesMap, setNotesMap] = useState<Record<string, string>>({});
 const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

 useEffect(() => { load(); }, []);

 const load = async () => {
 setLoading(true);
 try {
 const data = await api.get<RefundRequest[]>('/refunds');
 setRefunds(data);
 } catch {
 showToast('Erro ao carregar reembolsos', 'error');
 } finally {
 setLoading(false);
 }
 };

 const handleAction = async (id: string, status: 'approved' | 'rejected') => {
 setActionId(id);
 try {
 const admin_notes = notesMap[id] || null;
 const updated = await api.put<RefundRequest>(`/refunds/${id}/status`, { status, admin_notes });
 setRefunds(prev => prev.map(r => r.id === id ? updated : r));
 showToast(status === 'approved' ? 'Reembolso aprovado' : 'Reembolso rejeitado', 'success');
 } catch {
 showToast('Erro ao atualizar reembolso', 'error');
 } finally {
 setActionId(null);
 }
 };

 const visible = filter === 'all' ? refunds : refunds.filter(r => r.status === filter);
 const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

 return (
 <PageShell
 title="Pedidos de Reembolso"
 actions={
 <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-default text-content-secondary hover:bg-surface-raised text-sm transition-colors">
 <RefreshCw className="w-4 h-4" /> Atualizar
 </button>
 }
 >
 {/* Filtros */}
 <div className="flex gap-2 mb-4 flex-wrap">
 {(['all','pending','approved','rejected'] as const).map(f => (
 <button
 key={f}
 onClick={() => setFilter(f)}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-brand-600 text-white' : 'bg-surface-raised text-content-secondary hover:bg-surface-base'}`}
 >
 {f === 'all' ? 'Todos' : STATUS_LABEL[f].label}
 <span className="ml-1.5 opacity-70 text-xs">({f === 'all' ? refunds.length : refunds.filter(r => r.status === f).length})</span>
 </button>
 ))}
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-20">
 <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
 </div>
 ) : visible.length === 0 ? (
 <div className="text-center py-20 text-content-muted">
 <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p>Nenhum pedido de reembolso{filter !== 'all' ? ` com estado "${STATUS_LABEL[filter]?.label}"` : ''}.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {visible.map(r => {
 const s = STATUS_LABEL[r.status];
 const isExpanded = expanded === r.id;
 return (
 <div key={r.id} className="rounded-xl border border-border-default bg-surface-overlay overflow-hidden">
 <div
 className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-surface-raised/50 transition-colors"
 onClick={() => setExpanded(isExpanded ? null : r.id)}
 >
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 flex-wrap">
 <span className="font-semibold text-content-primary">#{r.orderNumber || r.orderId.slice(0,8)}</span>
 <span className="text-content-secondary text-sm">{r.customerName}</span>
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.className}`}>{s.label}</span>
 </div>
 <p className="text-sm text-content-muted mt-0.5 truncate">{r.reason}</p>
 </div>
 <div className="text-xs text-content-muted whitespace-nowrap">{fmtDate(r.createdAt)}</div>
 {isExpanded ? <ChevronUp className="w-4 h-4 text-content-muted" /> : <ChevronDown className="w-4 h-4 text-content-muted" />}
 </div>

 {isExpanded && (
 <div className="border-t border-border-default px-4 py-4 space-y-3 bg-surface-base/50">
 {r.details && (
 <div>
 <p className="text-xs font-medium text-content-secondary mb-1">Detalhes do cliente</p>
 <p className="text-sm text-content-primary bg-surface-raised rounded-lg p-3">{r.details}</p>
 </div>
 )}
 {r.photos && r.photos.length > 0 && (
 <div>
 <p className="text-xs font-medium text-content-secondary mb-2">Fotos enviadas pelo cliente</p>
 <div className="flex gap-2 flex-wrap">
 {r.photos.map((url, i) => (
 <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-border-default hover:opacity-80 transition-opacity flex-shrink-0">
 <img src={url} alt="" className="w-full h-full object-cover" />
 </a>
 ))}
 </div>
 </div>
 )}
 {r.adminNotes && (
 <div>
 <p className="text-xs font-medium text-content-secondary mb-1">Notas do admin</p>
 <p className="text-sm text-content-primary bg-surface-raised rounded-lg p-3">{r.adminNotes}</p>
 </div>
 )}
 {r.status === 'pending' && (
 <div className="space-y-3">
 <div>
 <label className="block text-xs font-medium text-content-secondary mb-1">Notas (opcional)</label>
 <textarea
 value={notesMap[r.id] || ''}
 onChange={e => setNotesMap(prev => ({ ...prev, [r.id]: e.target.value }))}
 rows={2}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary text-sm placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
 placeholder="Motivo da aprovação/rejeição..."
 />
 </div>
 <div className="flex gap-3">
 <button
 onClick={() => handleAction(r.id, 'approved')}
 disabled={actionId === r.id}
 className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
 >
 {actionId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
 Aprovar
 </button>
 <button
 onClick={() => handleAction(r.id, 'rejected')}
 disabled={actionId === r.id}
 className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
 >
 {actionId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
 Rejeitar
 </button>
 </div>
 </div>
 )}
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

export default Refunds;
