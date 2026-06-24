import React, { useState, useEffect, useCallback } from 'react';
import { PageShell } from '../../core/components/layout/PageShell';
import api from '../../core/services/apiClient';
import { RefreshCw, Plus, Loader2, X, Pencil, Trash2, CreditCard } from 'lucide-react';
import type { Toast } from '../../core/components/ui/Toast';

interface Props { showToast?: (msg: string, type: Toast['type']) => void; }
type Plan = { id: number; name: string; description: string; price: number; billing_cycle: string; features: string[]; status: string; subscriber_count: number; };
type Subscription = { id: number; customer_name: string; plan_name: string; price: number; billing_cycle: string; status: string; start_date: string; next_billing_date: string; };
type Stats = { total: number; active: number; cancelled: number; mrr: number; };

type Customer = { id: string; name: string; };

const TAB = { SUBS: 'subs', PLANS: 'plans' } as const;
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};
const CYCLE_LABELS: Record<string, string> = { monthly: 'Mensal', quarterly: 'Trimestral', yearly: 'Anual' };
const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border-default bg-surface-base text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-content-secondary mb-1';
const fmt = (n: number) => `MT ${Number(n||0).toFixed(2)}`;

export function Subscriptions({ showToast }: Props) {
  const [tab, setTab] = useState<typeof TAB[keyof typeof TAB]>(TAB.SUBS);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'plan' | 'sub' | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', description: '', price: '', billing_cycle: 'monthly', features: '', status: 'active' });
  const [subForm, setSubForm] = useState({ customer_id: '', plan_id: '', amount: '', start_date: new Date().toISOString().slice(0,10), auto_renew: true, notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, st, cu] = await Promise.all([
        api.get<Subscription[]>('/subscriptions'),
        api.get<Plan[]>('/subscriptions/plans'),
        api.get<Stats>('/subscriptions/stats'),
        api.get<Customer[]>('/customers?limit=500'),
      ]);
      setSubs(s); setPlans(p); setStats(st); setCustomers(cu);
    } catch { showToast?.('Erro ao carregar', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const savePlan = async () => {
    setSaving(true);
    try {
      const payload = { ...planForm, price: Number(planForm.price), features: planForm.features.split('\n').filter(Boolean) };
      if (editing) await api.put(`/subscriptions/plans/${editing.id}`, payload);
      else await api.post('/subscriptions/plans', payload);
      showToast?.('Guardado', 'success'); setModal(null); setEditing(null); load();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    finally { setSaving(false); }
  };

  const saveSub = async () => {
    if (!subForm.customer_id || !subForm.start_date) {
      showToast?.('Cliente e data de início são obrigatórios', 'error'); return;
    }
    setSaving(true);
    try {
      // Calcular próxima cobrança baseado no ciclo do plano
      const plan = plans.find(p => String(p.id) === String(subForm.plan_id));
      const start = new Date(subForm.start_date);
      let nextBilling: Date | null = null;
      if (plan) {
        nextBilling = new Date(start);
        if (plan.billing_cycle === 'monthly')    nextBilling.setMonth(nextBilling.getMonth() + 1);
        else if (plan.billing_cycle === 'quarterly') nextBilling.setMonth(nextBilling.getMonth() + 3);
        else if (plan.billing_cycle === 'yearly')    nextBilling.setFullYear(nextBilling.getFullYear() + 1);
      }
      const payload = {
        customer_id: subForm.customer_id,
        plan_id: subForm.plan_id || null,
        start_date: subForm.start_date,
        amount: subForm.amount ? Number(subForm.amount) : (plan?.price || 0),
        next_billing: nextBilling ? nextBilling.toISOString().slice(0,10) : null,
        auto_renew: subForm.auto_renew,
        notes: subForm.notes || null,
      };
      await api.post('/subscriptions', payload);
      showToast?.('Assinatura criada', 'success'); setModal(null); load();
    } catch (e: any) { showToast?.(e.message || 'Erro', 'error'); }
    finally { setSaving(false); }
  };

  // Auto-preenche o valor quando o plano é selecionado
  const onPlanChange = (planId: string) => {
    const plan = plans.find(p => String(p.id) === planId);
    setSubForm(prev => ({ ...prev, plan_id: planId, amount: plan ? String(plan.price) : prev.amount }));
  };

  const deletePlan = async (id: number) => {
    if (!confirm('Eliminar plano?')) return;
    try { await api.delete(`/subscriptions/plans/${id}`); showToast?.('Eliminado', 'success'); load(); }
    catch { showToast?.('Erro', 'error'); }
  };

  const updateSubStatus = async (id: number, status: string) => {
    try { await api.put(`/subscriptions/${id}`, { status }); showToast?.('Actualizado', 'success'); load(); }
    catch { showToast?.('Erro', 'error'); }
  };

  return (
    <PageShell title="Assinaturas" description="Gestão de planos e assinaturas recorrentes"
      actions={
        <button onClick={() => { setEditing(null); setPlanForm({ name:'', description:'', price:'', billing_cycle:'monthly', features:'', status:'active' }); setSubForm({ customer_id:'', plan_id:'', amount:'', start_date: new Date().toISOString().slice(0,10), auto_renew:true, notes:'' }); setModal(tab === TAB.PLANS ? 'plan' : 'sub'); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> {tab === TAB.PLANS ? 'Novo Plano' : 'Nova Assinatura'}
        </button>
      }>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-content-primary' },
            { label: 'Activas', value: stats.active, color: 'text-green-600' },
            { label: 'Canceladas', value: stats.cancelled, color: 'text-red-600' },
            { label: 'MRR', value: fmt(stats.mrr), color: 'text-brand-600' },
          ].map(s => (
            <div key={s.label} className="bg-surface-raised border border-border-default rounded-xl p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-content-muted">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface-raised rounded-2xl border border-border-default overflow-hidden">
        <div className="flex border-b border-border-default">
          {[{ id: TAB.SUBS, label: 'Assinaturas' }, { id: TAB.PLANS, label: 'Planos' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400' : 'border-transparent text-content-muted hover:text-content-primary'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-content-muted" /></div>
          ) : tab === TAB.PLANS ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map(p => (
                <div key={p.id} className="border border-border-default rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-content-primary">{p.name}</h3>
                      <p className="text-xs text-content-muted">{p.description}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(p); setPlanForm({ name: p.name, description: p.description||'', price: String(p.price), billing_cycle: p.billing_cycle, features: (p.features||[]).join('\n'), status: p.status }); setModal('plan'); }} className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-muted"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deletePlan(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-content-muted hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-content-primary">{fmt(p.price)}<span className="text-sm font-normal text-content-muted">/{CYCLE_LABELS[p.billing_cycle]?.toLowerCase()}</span></p>
                  {p.features?.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {p.features.map((f, i) => <li key={i} className="text-xs text-content-secondary flex items-center gap-1.5">✓ {f}</li>)}
                    </ul>
                  )}
                  <div className="mt-3 pt-3 border-t border-border-default flex items-center justify-between text-xs text-content-muted">
                    <span>{p.subscriber_count} assinantes</span>
                    <span className={`px-2 py-0.5 rounded-full ${p.status==='active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500'}`}>{p.status==='active' ? 'Activo' : 'Inactivo'}</span>
                  </div>
                </div>
              ))}
              {plans.length === 0 && <p className="col-span-3 text-center py-12 text-content-muted">Nenhum plano criado</p>}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border-default">
                {['Cliente', 'Plano', 'Valor', 'Ciclo', 'Estado', 'Próx. Cobrança', ''].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-medium text-content-muted">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {subs.map(s => (
                  <tr key={s.id} className="border-b border-border-default/50 hover:bg-surface-overlay/50">
                    <td className="py-3 px-3 font-medium text-content-primary">{s.customer_name || '—'}</td>
                    <td className="py-3 px-3 text-content-secondary">{s.plan_name}</td>
                    <td className="py-3 px-3 text-content-secondary">{fmt(s.price)}</td>
                    <td className="py-3 px-3 text-content-secondary">{CYCLE_LABELS[s.billing_cycle]}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]}`}>
                        {s.status === 'active' ? 'Activa' : s.status === 'paused' ? 'Pausada' : s.status === 'cancelled' ? 'Cancelada' : 'Expirada'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-content-secondary">{s.next_billing_date?.slice(0,10) || '—'}</td>
                    <td className="py-3 px-3">
                      {s.status === 'active' && (
                        <button onClick={() => updateSubStatus(s.id, 'cancelled')} className="text-xs text-red-500 hover:text-red-700">Cancelar</button>
                      )}
                    </td>
                  </tr>
                ))}
                {subs.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-content-muted">Nenhuma assinatura</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Nova Assinatura */}
      {modal === 'sub' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-md animate-modal-enter">
            <div className="flex items-center justify-between p-5 border-b border-border-default">
              <h3 className="font-semibold text-content-primary">Nova Assinatura</h3>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Cliente *</label>
                <select value={subForm.customer_id} onChange={e => setSubForm(p=>({...p,customer_id:e.target.value}))} className={inputCls}>
                  <option value="">Seleccionar cliente…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Plano</label>
                <select value={subForm.plan_id} onChange={e => onPlanChange(e.target.value)} className={inputCls}>
                  <option value="">Sem plano</option>
                  {plans.filter(p => p.status !== 'inactive').map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}/{CYCLE_LABELS[p.billing_cycle]?.toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Data de Início *</label>
                  <input type="date" value={subForm.start_date} onChange={e => setSubForm(p=>({...p,start_date:e.target.value}))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Valor (MT)</label>
                  <input type="number" step="0.01" placeholder="Auto do plano" value={subForm.amount} onChange={e => setSubForm(p=>({...p,amount:e.target.value}))} className={inputCls} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
                <input type="checkbox" checked={subForm.auto_renew} onChange={e => setSubForm(p=>({...p,auto_renew:e.target.checked}))} className="rounded" />
                Renovação automática
              </label>
              <div>
                <label className={labelCls}>Notas</label>
                <textarea value={subForm.notes} onChange={e => setSubForm(p=>({...p,notes:e.target.value}))} rows={2} className={inputCls} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-overlay">Cancelar</button>
                <button onClick={saveSub} disabled={saving || !subForm.customer_id || !subForm.start_date}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Criar Assinatura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === 'plan' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-md animate-modal-enter">
            <div className="flex items-center justify-between p-5 border-b border-border-default">
              <h3 className="font-semibold text-content-primary">{editing ? 'Editar Plano' : 'Novo Plano'}</h3>
              <button onClick={() => { setModal(null); setEditing(null); }} className="p-1.5 rounded-lg hover:bg-surface-overlay text-content-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Nome *</label>
                <input value={planForm.name} onChange={e => setPlanForm(p=>({...p,name:e.target.value}))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Descrição</label>
                <input value={planForm.description} onChange={e => setPlanForm(p=>({...p,description:e.target.value}))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Preço (MT) *</label>
                  <input type="number" value={planForm.price} onChange={e => setPlanForm(p=>({...p,price:e.target.value}))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Ciclo</label>
                  <select value={planForm.billing_cycle} onChange={e => setPlanForm(p=>({...p,billing_cycle:e.target.value}))} className={inputCls}>
                    {Object.entries(CYCLE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Funcionalidades (uma por linha)</label>
                <textarea value={planForm.features} onChange={e => setPlanForm(p=>({...p,features:e.target.value}))} rows={4} className={inputCls} placeholder="Acesso ilimitado&#10;Suporte prioritário&#10;..." />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setModal(null); setEditing(null); }} className="px-4 py-2 text-sm border border-border-default rounded-lg text-content-secondary hover:bg-surface-overlay">Cancelar</button>
                <button onClick={savePlan} disabled={saving || !planForm.name || !planForm.price}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default Subscriptions;
