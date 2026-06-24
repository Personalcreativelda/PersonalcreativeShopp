import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MapPin, Check, X, Loader2, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react';
import api from '../../core/services/apiClient';
import { PageShell } from '../../core/components/layout/PageShell';

interface DeliveryZone {
 id: string;
 name: string;
 price: number;
 isActive: boolean;
 displayOrder: number;
 createdAt: string;
 updatedAt: string;
}

const empty = (): Partial<DeliveryZone> => ({
 name: '',
 price: 0,
 isActive: true,
 displayOrder: 0,
});

export const DeliveryZones: React.FC<{
 showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}> = ({ showToast }) => {
 const [zones, setZones] = useState<DeliveryZone[]>([]);
 const [loading, setLoading] = useState(true);
 const [showModal, setShowModal] = useState(false);
 const [editing, setEditing] = useState<DeliveryZone | null>(null);
 const [form, setForm] = useState<Partial<DeliveryZone>>(empty());
 const [saving, setSaving] = useState(false);
 const [deletingId, setDeletingId] = useState<string | null>(null);

 useEffect(() => { load(); }, []);

 const load = async () => {
 setLoading(true);
 try {
 const data = await api.get<DeliveryZone[]>('/delivery-zones/all');
 setZones(data);
 } catch {
 showToast('Erro ao carregar zonas de entrega', 'error');
 } finally {
 setLoading(false);
 }
 };

 const openCreate = () => {
 setEditing(null);
 setForm({ ...empty(), displayOrder: zones.length });
 setShowModal(true);
 };

 const openEdit = (z: DeliveryZone) => {
 setEditing(z);
 setForm({ ...z });
 setShowModal(true);
 };

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!form.name?.trim()) return showToast('Nome é obrigatório', 'error');
 if (form.price == null || form.price < 0) return showToast('Preço inválido', 'error');
 setSaving(true);
 try {
 const payload = {
 name: form.name.trim(),
 price: Number(form.price),
 isActive: form.isActive !== false,
 displayOrder: Number(form.displayOrder) || 0,
 };
 if (editing) {
 await api.put(`/delivery-zones/${editing.id}`, payload);
 showToast('Zona atualizada', 'success');
 } else {
 await api.post('/delivery-zones', payload);
 showToast('Zona criada', 'success');
 }
 setShowModal(false);
 load();
 } catch {
 showToast('Erro ao guardar zona', 'error');
 } finally {
 setSaving(false);
 }
 };

 const handleDelete = async (id: string) => {
 if (!window.confirm('Apagar esta zona de entrega?')) return;
 setDeletingId(id);
 try {
 await api.delete(`/delivery-zones/${id}`);
 showToast('Zona apagada', 'success');
 load();
 } catch {
 showToast('Erro ao apagar zona', 'error');
 } finally {
 setDeletingId(null);
 }
 };

 const handleToggle = async (z: DeliveryZone) => {
 try {
 await api.put(`/delivery-zones/${z.id}`, { isActive: !z.isActive });
 showToast(z.isActive ? 'Zona desativada' : 'Zona ativada', 'success');
 load();
 } catch {
 showToast('Erro ao alterar estado', 'error');
 }
 };

 const set = (field: keyof DeliveryZone, value: any) =>
 setForm(f => ({ ...f, [field]: value }));

 return (
 <PageShell
 title="Zonas de Entrega"
 subtitle="Defina as zonas e os preços de frete para a loja"
 actions={
 <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
 <Plus className="w-4 h-4" /> Nova Zona
 </button>
 }
 >
 {loading ? (
 <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>
 ) : zones.length === 0 ? (
 <div className="text-center py-16 text-content-muted">
 <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
 <p>Nenhuma zona definida. Cria a primeira zona de entrega.</p>
 </div>
 ) : (
 <div className="bg-surface-raised rounded-xl border border-border-default overflow-hidden">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-surface-base/50 border-b border-border-default">
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wide w-8"></th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-content-muted uppercase tracking-wide">Zona</th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-content-muted uppercase tracking-wide">Frete (MT)</th>
 <th className="px-4 py-3 text-center text-xs font-semibold text-content-muted uppercase tracking-wide">Estado</th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-content-muted uppercase tracking-wide">Ações</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
 {zones.map(z => (
 <tr key={z.id} className="hover:bg-surface-base/30 transition-colors">
 <td className="px-4 py-3 text-content-muted">
 <GripVertical className="w-4 h-4" />
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
 <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
 </div>
 <span className="font-medium text-content-primary">{z.name}</span>
 </div>
 </td>
 <td className="px-4 py-3 text-right">
 <span className={`font-semibold ${z.price === 0 ? 'text-green-600 dark:text-green-400' : 'text-content-primary'}`}>
 {z.price === 0 ? 'Grátis' : `${z.price.toFixed(2)} MT`}
 </span>
 </td>
 <td className="px-4 py-3 text-center">
 <button onClick={() => handleToggle(z)} className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors">
 {z.isActive
 ? <><ToggleRight className="w-5 h-5 text-green-500" /><span className="text-green-600 dark:text-green-400">Ativa</span></>
 : <><ToggleLeft className="w-5 h-5 text-content-muted" /><span className="text-content-muted">Inativa</span></>
 }
 </button>
 </td>
 <td className="px-4 py-3 text-right">
 <div className="flex items-center justify-end gap-2">
 <button onClick={() => openEdit(z)} className="p-1.5 text-content-muted hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
 <Edit className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleDelete(z.id)}
 disabled={deletingId === z.id}
 className="p-1.5 text-content-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
 >
 {deletingId === z.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
 <div className="relative bg-surface-raised rounded-2xl shadow-xl w-full max-w-md p-6">
 <div className="flex items-center justify-between mb-5">
 <h2 className="text-lg font-bold text-content-primary">
 {editing ? 'Editar Zona' : 'Nova Zona de Entrega'}
 </h2>
 <button onClick={() => setShowModal(false)} className="text-content-muted hover:text-content-secondary ">
 <X className="w-5 h-5" />
 </button>
 </div>

 <form onSubmit={handleSave} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Nome da Zona <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 value={form.name || ''}
 onChange={e => set('name', e.target.value)}
 placeholder="Ex: Maputo Cidade, Matola, Interior..."
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
 required
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Preço do Frete (MT) <span className="text-red-500">*</span>
 </label>
 <input
 type="number"
 min="0"
 step="0.01"
 value={form.price ?? ''}
 onChange={e => set('price', parseFloat(e.target.value) || 0)}
 placeholder="Ex: 150.00 — usa 0 para entrega grátis"
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
 required
 />
 {form.price === 0 && (
 <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
 <Check className="w-3 h-3" /> Entrega gratuita
 </p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Ordem de exibição
 </label>
 <input
 type="number"
 min="0"
 value={form.displayOrder ?? 0}
 onChange={e => set('displayOrder', parseInt(e.target.value) || 0)}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
 />
 <p className="text-xs text-content-muted mt-1">Números menores aparecem primeiro no checkout</p>
 </div>

 <div className="flex items-center gap-3 pt-1">
 <button
 type="button"
 onClick={() => set('isActive', !form.isActive)}
 className={`flex items-center gap-2 text-sm font-medium transition-colors ${form.isActive ? 'text-green-600' : 'text-content-muted'}`}
 >
 {form.isActive
 ? <ToggleRight className="w-6 h-6" />
 : <ToggleLeft className="w-6 h-6" />
 }
 {form.isActive ? 'Zona ativa' : 'Zona inativa'}
 </button>
 </div>

 <div className="flex gap-3 pt-2">
 <button
 type="button"
 onClick={() => setShowModal(false)}
 className="flex-1 px-4 py-2 border border-border-default text-content-secondary rounded-lg text-sm font-medium hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 <button
 type="submit"
 disabled={saving}
 className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
 >
 {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
 {editing ? 'Guardar' : 'Criar'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </PageShell>
 );
};
