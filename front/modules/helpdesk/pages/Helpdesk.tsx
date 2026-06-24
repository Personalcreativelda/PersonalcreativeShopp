import React, { useState, useEffect, useCallback } from 'react';
import { PageShell } from '../../core/components/layout/PageShell';
import api from '../../core/services/apiClient';
import {
  Headphones, Plus, Loader2, X, Pencil, Trash2, Send,
  AlertCircle, Clock, CheckCircle, Search, MessageCircle,
} from 'lucide-react';
import type { Toast } from '../../core/components/ui/Toast';

interface Props { showToast?: (msg: string, type: Toast['type']) => void; }

type Ticket = {
  id: number; title: string; description: string; status: string; priority: string;
  category_name: string; category_color: string; customer_name: string;
  assigned_name: string; message_count: number; created_at: string; updated_at: string;
};
type Message = { id: number; content: string; user_name: string; is_internal: boolean; created_at: string; };
type Category = { id: number; name: string; color: string; };
type Stats = { total: number; open: number; in_progress: number; resolved: number; urgent: number; avg_hours: number; };

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto', in_progress: 'Em Progresso', waiting: 'Aguarda', resolved: 'Resolvido', closed: 'Fechado',
};
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  waiting: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-400', medium: 'text-blue-500', high: 'text-orange-500', urgent: 'text-red-500',
};

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-base text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-content-secondary mb-1';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
      <div className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-2xl animate-modal-enter">
        <div className="flex items-center justify-between p-5 border-b border-border-default">
          <h3 className="font-semibold text-content-primary">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Helpdesk({ showToast }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<(Ticket & { messages: Message[] }) | null>(null);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [newMsg, setNewMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', category_id: '', assigned_to: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (filterStatus) params.set('status', filterStatus);
      const [t, c, s] = await Promise.all([
        api.get<Ticket[]>(`/helpdesk?${params}`),
        api.get<Category[]>('/helpdesk/categories'),
        api.get<Stats>('/helpdesk/stats'),
      ]);
      setTickets(t); setCategories(c); setStats(s);
    } catch { showToast?.('Erro ao carregar', 'error'); }
    finally { setLoading(false); }
  }, [q, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const openTicket = async (t: Ticket) => {
    try {
      const data = await api.get<Ticket & { messages: Message[] }>(`/helpdesk/${t.id}`);
      setSelected(data);
    } catch { showToast?.('Erro ao abrir ticket', 'error'); }
  };

  const saveTicket = async () => {
    setSaving(true);
    try {
      await api.post('/helpdesk', form);
      showToast?.('Ticket criado', 'success'); setModal(false); load();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.put(`/helpdesk/${id}`, { ...selected, status });
      setSelected(prev => prev ? { ...prev, status } : null);
      showToast?.('Estado actualizado', 'success'); load();
    } catch { showToast?.('Erro', 'error'); }
  };

  const sendMessage = async () => {
    if (!selected || !newMsg.trim()) return;
    setSendingMsg(true);
    try {
      const msg = await api.post<Message>(`/helpdesk/${selected.id}/messages`, { content: newMsg, is_internal: false });
      setSelected(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : null);
      setNewMsg('');
    } catch { showToast?.('Erro ao enviar', 'error'); }
    finally { setSendingMsg(false); }
  };

  const deleteTicket = async (id: number) => {
    if (!confirm('Eliminar ticket?')) return;
    try { await api.delete(`/helpdesk/${id}`); showToast?.('Eliminado', 'success'); load(); setSelected(null); }
    catch { showToast?.('Erro', 'error'); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

  return (
    <PageShell title="Central de Ajuda" description="Gestão de tickets de suporte e atendimento"
      actions={
        <button onClick={() => { setForm({ title:'', description:'', priority:'medium', category_id:'', assigned_to:'' }); setModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Novo Ticket
        </button>
      }>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-content-primary' },
            { label: 'Abertos', value: stats.open, color: 'text-blue-600' },
            { label: 'Em Progresso', value: stats.in_progress, color: 'text-yellow-600' },
            { label: 'Resolvidos', value: stats.resolved, color: 'text-green-600' },
            { label: 'Urgentes', value: stats.urgent, color: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-surface-raised border border-border-default rounded-xl p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-content-muted">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface-raised rounded-2xl border border-border-default overflow-hidden">
        {/* Filtros */}
        <div className="p-4 border-b border-border-default flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar tickets…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-content-secondary focus:outline-none">
            <option value="">Todos os estados</option>
            {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-content-muted" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border-default">
                {['#', 'Título', 'Categoria', 'Cliente', 'Prioridade', 'Estado', 'Msgs', 'Data', ''].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-medium text-content-muted">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="border-b border-border-default/50 hover:bg-surface-overlay/50 cursor-pointer" onClick={() => openTicket(t)}>
                    <td className="py-3 px-3 text-content-muted text-xs">#{t.id}</td>
                    <td className="py-3 px-3 font-medium text-content-primary max-w-xs truncate">{t.title}</td>
                    <td className="py-3 px-3">
                      {t.category_name && (
                        <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: t.category_color + '20', color: t.category_color }}>{t.category_name}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-content-secondary">{t.customer_name || '—'}</td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-medium capitalize ${PRIORITY_COLORS[t.priority]}`}>
                        {t.priority === 'urgent' ? '🔴 Urgente' : t.priority === 'high' ? '🟠 Alta' : t.priority === 'medium' ? '🔵 Média' : '⚪ Baixa'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="flex items-center gap-1 text-content-muted"><MessageCircle className="w-3.5 h-3.5" />{t.message_count}</span>
                    </td>
                    <td className="py-3 px-3 text-xs text-content-muted">{fmtDate(t.created_at)}</td>
                    <td className="py-3 px-3">
                      <button onClick={e => { e.stopPropagation(); deleteTicket(t.id); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-content-muted hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr><td colSpan={9} className="py-12 text-center text-content-muted">Nenhum ticket encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {selected && (
        <Modal title={`#${selected.id} — ${selected.title}`} onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
              {selected.customer_name && <span className="px-2 py-0.5 rounded-full text-xs bg-surface-overlay text-content-secondary">{selected.customer_name}</span>}
            </div>
            {selected.description && <p className="text-sm text-content-secondary bg-surface-overlay rounded-lg p-3">{selected.description}</p>}

            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <button key={v} onClick={() => updateStatus(selected.id, v)}
                  className={`px-3 py-1 text-xs rounded-lg border transition-colors ${selected.status === v ? 'bg-brand-600 text-white border-brand-600' : 'border-border-default text-content-secondary hover:bg-surface-overlay'}`}>
                  {l}
                </button>
              ))}
            </div>

            <div className="border-t border-border-default pt-4">
              <p className="text-xs font-medium text-content-secondary mb-3">Mensagens ({selected.messages.length})</p>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {selected.messages.map(m => (
                  <div key={m.id} className={`rounded-lg p-3 text-sm ${m.is_internal ? 'bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800' : 'bg-surface-overlay'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-content-secondary">{m.user_name || 'Sistema'}</span>
                      <span className="text-xs text-content-muted">{fmtDate(m.created_at)}</span>
                    </div>
                    <p className="text-content-primary">{m.content}</p>
                  </div>
                ))}
                {selected.messages.length === 0 && <p className="text-xs text-content-muted text-center py-4">Sem mensagens</p>}
              </div>
            </div>

            <div className="flex gap-2">
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Escrever resposta…"
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                className="flex-1 px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <button onClick={sendMessage} disabled={sendingMsg || !newMsg.trim()}
                className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50">
                {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Criar Ticket Modal */}
      {modal && (
        <Modal title="Novo Ticket" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Título *</label>
              <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <textarea value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} rows={3} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Prioridade</label>
                <select value={form.priority} onChange={e => setForm(p=>({...p,priority:e.target.value}))} className={inputCls}>
                  <option value="low">Baixa</option><option value="medium">Média</option>
                  <option value="high">Alta</option><option value="urgent">Urgente</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Categoria</label>
                <select value={form.category_id} onChange={e => setForm(p=>({...p,category_id:e.target.value}))} className={inputCls}>
                  <option value="">Nenhuma</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-overlay">Cancelar</button>
              <button onClick={saveTicket} disabled={saving || !form.title}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Criar Ticket
              </button>
            </div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

export default Helpdesk;
