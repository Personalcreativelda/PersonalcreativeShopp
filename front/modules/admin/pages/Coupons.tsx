import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Tag, Check, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../../core/services/apiClient';
import { PageShell } from '../../core/components/layout/PageShell';

interface Coupon {
 id: string;
 code: string;
 description?: string;
 type: 'percentage' | 'free_shipping';
 value: number;
 minOrderAmount: number;
 maxDiscountAmount?: number | null;
 maxUses?: number | null;
 currentUses: number;
 validFrom?: string | null;
 validUntil?: string | null;
 isActive: boolean;
 createdAt: string;
}

const empty = (): Partial<Coupon> => ({
 code: '',
 description: '',
 type: 'percentage',
 value: 10,
 minOrderAmount: 0,
 maxDiscountAmount: null,
 maxUses: null,
 validFrom: null,
 validUntil: null,
 isActive: true
});

export const Coupons: React.FC<{
 showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}> = ({ showToast }) => {
 const [coupons, setCoupons] = useState<Coupon[]>([]);
 const [loading, setLoading] = useState(true);
 const [showModal, setShowModal] = useState(false);
 const [editing, setEditing] = useState<Coupon | null>(null);
 const [form, setForm] = useState<Partial<Coupon>>(empty());
 const [saving, setSaving] = useState(false);
 const [deletingId, setDeletingId] = useState<string | null>(null);

 useEffect(() => { load(); }, []);

 const load = async () => {
 setLoading(true);
 try {
 const data = await api.get<Coupon[]>('/coupons');
 setCoupons(data);
 } catch {
 showToast('Erro ao carregar cupões', 'error');
 } finally {
 setLoading(false);
 }
 };

 const openCreate = () => { setEditing(null); setForm(empty()); setShowModal(true); };
 const openEdit = (c: Coupon) => { setEditing(c); setForm({ ...c }); setShowModal(true); };

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!form.code?.trim()) return showToast('Código é obrigatório', 'error');
 setSaving(true);
 try {
 const payload = {
 ...form,
 code: form.code!.toUpperCase().trim(),
 value: Number(form.value) || 0,
 minOrderAmount: Number(form.minOrderAmount) || 0,
 maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
 maxUses: form.maxUses ? Number(form.maxUses) : null,
 validFrom: form.validFrom || null,
 validUntil: form.validUntil || null
 };
 if (editing) {
 await api.put(`/coupons/${editing.id}`, payload);
 showToast('Cupão atualizado', 'success');
 } else {
 await api.post('/coupons', payload);
 showToast('Cupão criado', 'success');
 }
 setShowModal(false);
 load();
 } catch (err: any) {
 showToast(err?.message || 'Erro ao guardar cupão', 'error');
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 if (!confirm('Apagar este cupão?')) return;
 setDeletingId(id);
 try {
 await api.delete(`/coupons/${id}`);
 showToast('Cupão apagado', 'success');
 setCoupons(prev => prev.filter(c => c.id !== id));
 } catch {
 showToast('Erro ao apagar cupão', 'error');
 } finally {
 setDeletingId(null);
 }
 };

 const handleToggle = async (c: Coupon) => {
 try {
 await api.put(`/coupons/${c.id}`, { ...c, isActive: !c.isActive });
 setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, isActive: !x.isActive } : x));
 } catch {
 showToast('Erro ao atualizar estado', 'error');
 }
 };

 const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-MZ') : '—';

 return (
 <PageShell
 title="Cupões de Desconto"
 actions={
 <button
 onClick={openCreate}
 className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
 >
 <Plus className="w-4 h-4" /> Novo Cupão
 </button>
 }
 >
 {loading ? (
 <div className="flex items-center justify-center py-20">
 <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
 </div>
 ) : coupons.length === 0 ? (
 <div className="text-center py-20 text-content-muted">
 <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p>Nenhum cupão criado ainda.</p>
 <button onClick={openCreate} className="mt-4 text-brand-600 hover:underline text-sm">Criar primeiro cupão</button>
 </div>
 ) : (
 <div className="overflow-x-auto rounded-xl border border-border-default">
 <table className="w-full text-sm">
 <thead className="bg-surface-raised text-content-secondary text-xs uppercase">
 <tr>
 <th className="px-4 py-3 text-left">Código</th>
 <th className="px-4 py-3 text-left">Tipo</th>
 <th className="px-4 py-3 text-right">Valor</th>
 <th className="px-4 py-3 text-right">Mín. Pedido</th>
 <th className="px-4 py-3 text-center">Usos</th>
 <th className="px-4 py-3 text-center">Validade</th>
 <th className="px-4 py-3 text-center">Estado</th>
 <th className="px-4 py-3 text-right">Ações</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border-default">
 {coupons.map(c => (
 <tr key={c.id} className="hover:bg-surface-raised/50 transition-colors">
 <td className="px-4 py-3 font-mono font-semibold text-brand-600">{c.code}</td>
 <td className="px-4 py-3">
 {c.type === 'percentage' ? (
 <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">%</span>
 ) : (
 <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">Envio grátis</span>
 )}
 </td>
 <td className="px-4 py-3 text-right">
 {c.type === 'percentage' ? `${c.value}%` : '—'}
 {c.maxDiscountAmount ? <span className="text-xs text-content-muted ml-1">(máx {c.maxDiscountAmount} MT)</span> : null}
 </td>
 <td className="px-4 py-3 text-right text-content-secondary">{c.minOrderAmount > 0 ? `${c.minOrderAmount} MT` : '—'}</td>
 <td className="px-4 py-3 text-center">
 {c.currentUses}{c.maxUses ? `/${c.maxUses}` : ''}
 </td>
 <td className="px-4 py-3 text-center text-xs text-content-secondary">
 {c.validFrom || c.validUntil ? `${fmtDate(c.validFrom)} → ${fmtDate(c.validUntil)}` : '∞'}
 </td>
 <td className="px-4 py-3 text-center">
 <button onClick={() => handleToggle(c)} title={c.isActive ? 'Desativar' : 'Ativar'}>
 {c.isActive
 ? <ToggleRight className="w-6 h-6 text-green-500 hover:text-green-600" />
 : <ToggleLeft className="w-6 h-6 text-content-muted hover:text-content-primary" />
 }
 </button>
 </td>
 <td className="px-4 py-3 text-right">
 <div className="flex items-center justify-end gap-2">
 <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-surface-raised text-content-secondary hover:text-content-primary transition-colors">
 <Edit className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleDelete(c.id)}
 disabled={deletingId === c.id}
 className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-content-secondary hover:text-red-600 transition-colors disabled:opacity-50"
 >
 {deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Modal */}
 {showModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
 <div className="bg-surface-overlay rounded-2xl w-full max-w-lg shadow-2xl border border-border-default max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between p-6 border-b border-border-default">
 <h2 className="text-lg font-semibold">{editing ? 'Editar Cupão' : 'Novo Cupão'}</h2>
 <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-surface-raised text-content-muted"><X className="w-5 h-5" /></button>
 </div>
 <form onSubmit={handleSave} className="p-6 space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="col-span-2">
 <label className="block text-sm font-medium text-content-secondary mb-1">Código <span className="text-red-500">*</span></label>
 <input
 value={form.code || ''}
 onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary font-mono uppercase placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
 placeholder="VERÃO20"
 required
 />
 </div>
 <div className="col-span-2">
 <label className="block text-sm font-medium text-content-secondary mb-1">Descrição</label>
 <input
 value={form.description || ''}
 onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
 placeholder="Promoção de verão..."
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Tipo</label>
 <select
 value={form.type}
 onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
 >
 <option value="percentage">Percentagem (%)</option>
 <option value="free_shipping">Envio Grátis</option>
 </select>
 </div>
 {form.type === 'percentage' && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Desconto (%)</label>
 <input
 type="number" min="0" max="100" step="0.01"
 value={form.value ?? 10}
 onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
 required
 />
 </div>
 )}
 {form.type === 'percentage' && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Desconto máximo (MT)</label>
 <input
 type="number" min="0" step="0.01"
 value={form.maxDiscountAmount ?? ''}
 onChange={e => setForm(f => ({ ...f, maxDiscountAmount: e.target.value ? Number(e.target.value) : null }))}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
 placeholder="Sem limite"
 />
 </div>
 )}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Pedido mínimo (MT)</label>
 <input
 type="number" min="0" step="0.01"
 value={form.minOrderAmount ?? 0}
 onChange={e => setForm(f => ({ ...f, minOrderAmount: Number(e.target.value) }))}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Máx. utilizações</label>
 <input
 type="number" min="1" step="1"
 value={form.maxUses ?? ''}
 onChange={e => setForm(f => ({ ...f, maxUses: e.target.value ? Number(e.target.value) : null }))}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
 placeholder="Ilimitado"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Válido de</label>
 <input
 type="datetime-local"
 value={form.validFrom ? form.validFrom.slice(0, 16) : ''}
 onChange={e => setForm(f => ({ ...f, validFrom: e.target.value ? new Date(e.target.value).toISOString() : null }))}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Válido até</label>
 <input
 type="datetime-local"
 value={form.validUntil ? form.validUntil.slice(0, 16) : ''}
 onChange={e => setForm(f => ({ ...f, validUntil: e.target.value ? new Date(e.target.value).toISOString() : null }))}
 className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-base text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
 />
 </div>
 <div className="col-span-2 flex items-center gap-3">
 <label className="relative inline-flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={form.isActive !== false}
 onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
 className="sr-only peer"
 />
 <div className="w-10 h-6 bg-surface-base peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-raised after:border-border-default after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
 </label>
 <span className="text-sm text-content-primary">Cupão ativo</span>
 </div>
 </div>
 <div className="flex gap-3 pt-2">
 <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-lg bg-surface-raised text-content-secondary hover:bg-surface-base transition-colors text-sm font-medium">
 Cancelar
 </button>
 <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
 {editing ? 'Atualizar' : 'Criar Cupão'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </PageShell>
 );
};

export default Coupons;
