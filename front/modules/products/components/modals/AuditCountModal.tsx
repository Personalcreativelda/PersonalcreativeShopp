/**
 * Modal para registar contagens físicas de auditoria
 */
import React, { useState, useEffect } from 'react';
import { ModalPortal } from '../../../core/components/ui/ModalPortal';
import { X, ClipboardCheck, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { StockAudit, StockAuditItem, StockAuditStatus } from '../../../core/types/types';
import { stockAuditService } from '../../services/stockAuditService';

interface AuditCountModalProps {
 open: boolean;
 onClose: () => void;
 audit: StockAudit | null;
 onSuccess: () => void;
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
 isSuperAdmin?: boolean;
}

export const AuditCountModal: React.FC<AuditCountModalProps> = ({
 open,
 onClose,
 audit,
 onSuccess,
 showToast,
 isSuperAdmin = false
}) => {
 const [items, setItems] = useState<StockAuditItem[]>([]);
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState(false);
 const [savingBatch, setSavingBatch] = useState(false);
 const [searchTerm, setSearchTerm] = useState('');
 const [editingCounts, setEditingCounts] = useState<Record<string, number>>({});
 const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

 // Carregar itens quando abrir o modal
 useEffect(() => {
 if (open && audit) {
 loadItems();
 }
 }, [open, audit]);

 const loadItems = async () => {
 if (!audit) return;

 setLoading(true);
 try {
 const data = await stockAuditService.getAuditItems(audit.id);
 setItems(data);

 // Inicializar contagens com valores já registados
 const counts: Record<string, number> = {};
 const notes: Record<string, string> = {};
 data.forEach(item => {
 if (item.countedQuantity !== undefined) {
 counts[item.id] = item.countedQuantity;
 }
 if (item.notes) {
 notes[item.id] = item.notes;
 }
 });
 setEditingCounts(counts);
 setEditingNotes(notes);
 } catch (error) {
 showToast('Erro ao carregar itens', 'error');
 } finally {
 setLoading(false);
 }
 };

 // Filtrar itens pela pesquisa
 const filteredItems = items.filter(item =>
 item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 item.variantName?.toLowerCase().includes(searchTerm.toLowerCase())
 );

 // Guardar todas as contagens de uma vez
 const handleSaveCounts = async () => {
 if (!audit) return;

 const updates = items.map(item => ({
 itemId: item.id,
 countedQuantity: editingCounts[item.id] ?? 0,
 notes: editingNotes[item.id] || undefined
 }));

 setSavingBatch(true);
 try {
 const result = await stockAuditService.updateAuditItemsBatch(audit.id, updates);
 if (result.success) {
 showToast('Contagens guardadas', 'success');
 await loadItems();
 } else {
 showToast(result.error || 'Erro ao guardar contagens', 'error');
 }
 } catch (error: any) {
 showToast(error.message || 'Erro ao guardar contagens', 'error');
 } finally {
 setSavingBatch(false);
 }
 };

 // Finalizar auditoria
 const handleComplete = async () => {
 if (!audit) return;

 // Verificar se todas as contagens foram registadas
 const missingCounts = items.filter(item =>
 editingCounts[item.id] === undefined
 );

 if (missingCounts.length > 0) {
 const confirm = window.confirm(
 `Existem ${missingCounts.length} itens sem contagem registada. Deseja finalizar mesmo assim?`
 );
 if (!confirm) return;
 }

 setSaving(true);
 try {
 const result = await stockAuditService.completeAudit(audit.id);

 if (result.success) {
 showToast('Auditoria finalizada com sucesso', 'success');
 onSuccess();
 onClose();
 } else {
 showToast(result.error || 'Erro ao finalizar auditoria', 'error');
 }
 } catch (error: any) {
 showToast(error.message || 'Erro ao finalizar auditoria', 'error');
 } finally {
 setSaving(false);
 }
 };

 if (!open || !audit) return null;

 const canEdit = audit.status === StockAuditStatus.DRAFT || isSuperAdmin;

 return (
 <ModalPortal open={open} onClose={onClose}>
 <div className="bg-surface-raised rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-border-default">
 <div>
 <div className="flex items-center gap-2">
 <ClipboardCheck className="w-5 h-5 text-blue-600" />
 <h2 className="text-lg font-semibold text-content-primary">
 Registar Contagens
 </h2>
 </div>
 <p className="text-sm text-content-secondary mt-1">
 {audit.description || `Auditoria de ${audit.auditDate}`}
 </p>
 </div>
 <button
 onClick={onClose}
 className="p-1 hover:bg-surface-base rounded-lg transition-colors"
 >
 <X className="w-5 h-5 text-content-muted" />
 </button>
 </div>

 {/* Search */}
 <div className="p-4 border-b border-border-default">
 <input
 type="text"
 placeholder="Pesquisar produto..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
 />
 </div>

 {/* Info Banner */}
 <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
 <div className="flex items-start gap-2">
 <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
 <div className="text-sm text-blue-800 dark:text-blue-200">
 <p className="font-medium">Atenção: Produtos não contados</p>
 <p className="mt-0.5">Produtos sem contagem registada serão considerados como tendo <strong>stock zero (0)</strong> ao finalizar a auditoria.</p>
 </div>
 </div>
 </div>

 {/* Items List */}
 <div className="flex-1 overflow-y-auto p-4">
 {loading ? (
 <div className="flex items-center justify-center py-8">
 <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
 </div>
 ) : (
 <div className="space-y-2">
 {filteredItems.map(item => {
 const hasCount = editingCounts[item.id] !== undefined;
 const discrepancy = hasCount ? editingCounts[item.id] - item.systemQuantity : item.discrepancy;

 return (
 <div
 key={item.id}
 className="p-3 border border-border-default rounded-lg hover:bg-surface-base/50 transition-colors"
 >
 <div className="grid grid-cols-12 gap-3 items-center">
 {/* Product Info */}
 <div className="col-span-4">
 <p className="font-medium text-content-primary text-sm">
 {item.productName}
 </p>
 {item.variantName && (
 <p className="text-xs text-content-secondary">
 {item.variantName}
 </p>
 )}
 </div>

 {/* System Quantity */}
 <div className="col-span-2 text-center">
 <p className="text-xs text-content-secondary">Sistema</p>
 <p className="font-semibold text-content-primary">
 {item.systemQuantity}
 </p>
 </div>

 {/* Counted Quantity Input */}
 <div className="col-span-2">
 <input
 type="number"
 step="0.01"
 placeholder="Contado"
 value={editingCounts[item.id] ?? ''}
 onChange={(e) => setEditingCounts(prev => ({
 ...prev,
 [item.id]: parseFloat(e.target.value) || 0
 }))}
 disabled={!canEdit}
 className="w-full px-2 py-1 text-sm border border-border-default rounded bg-surface-raised text-content-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-surface-base dark:disabled:bg-gray-800"
 />
 </div>

 {/* Discrepancy */}
 <div className="col-span-2 text-center">
 {discrepancy !== undefined && discrepancy !== null && (
 <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${discrepancy === 0
 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
 : discrepancy > 0
 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
 : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
 }`}>
 {discrepancy > 0 ? '+' : ''}{discrepancy.toFixed(2)}
 </div>
 )}
 </div>

 {/* Saved indicator (após guardar em lote) */}
 <div className="col-span-2 flex justify-end">
 {item.countedQuantity !== undefined && (
 <CheckCircle className="w-4 h-4 text-green-600" title="Contagem registada" />
 )}
 </div>
 </div>

 {/* Notes */}
 {canEdit && (
 <div className="mt-2">
 <input
 type="text"
 placeholder="Notas (opcional)..."
 value={editingNotes[item.id] || ''}
 onChange={(e) => setEditingNotes(prev => ({
 ...prev,
 [item.id]: e.target.value
 }))}
 className="w-full px-2 py-1 text-xs border border-border-default rounded bg-surface-raised text-content-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
 />
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex items-center justify-between p-4 border-t border-border-default">
 <div className="text-sm text-content-secondary">
 {items.filter(i => editingCounts[i.id] !== undefined).length} de {items.length} itens contados
 </div>
 <div className="flex gap-3">
 <button
 onClick={onClose}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg transition-colors"
 >
 Fechar
 </button>
 {canEdit && (
 <>
 <button
 onClick={handleSaveCounts}
 disabled={savingBatch}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
 >
 {savingBatch ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
 A guardar...
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 Guardar contagens
 </>
 )}
 </button>
 <button
 onClick={handleComplete}
 disabled={saving}
 className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
 >
 {saving ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
 A finalizar...
 </>
 ) : (
 <>
 <CheckCircle className="w-4 h-4" />
 Finalizar Auditoria
 </>
 )}
 </button>
 </>
 )}
 </div>
 </div>
 </div>
 </ModalPortal>
 );
};
