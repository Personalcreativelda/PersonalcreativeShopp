/**
 * Modal de edição de lote (quantidade e custo unitário).
 * Aviso: alterar custo afecta valorização FIFO e relatórios.
 */
import React, { useState, useEffect } from 'react';
import { ModalPortal } from '../../../core/components/ui/ModalPortal';
import { X, Save, AlertTriangle } from 'lucide-react';
import { StockLotRow, stockLotsService } from '../../services/stockLotsService';

interface LotEditModalProps {
 open: boolean;
 lot: StockLotRow | null;
 onClose: () => void;
 onSaved: () => void;
 showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const formatMoney = (n: number) => n.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const LotEditModal: React.FC<LotEditModalProps> = ({
 open,
 lot,
 onClose,
 onSaved,
 showToast
}) => {
 const [quantity, setQuantity] = useState<string>('');
 const [unitCost, setUnitCost] = useState<string>('');
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 if (lot) {
 setQuantity(String(lot.quantity));
 setUnitCost(String(lot.unitCost));
 }
 }, [lot]);

 if (!lot) return null;

 const handleSave = async () => {
 const qty = parseFloat(quantity.replace(',', '.'));
 const cost = parseFloat(unitCost.replace(',', '.'));
 if (isNaN(qty) || qty < 0) {
 showToast('Quantidade inválida', 'error');
 return;
 }
 if (isNaN(cost) || cost < 0) {
 showToast('Custo unitário inválido', 'error');
 return;
 }
 setSaving(true);
 try {
 const result = await stockLotsService.updateLot(lot.id, {
 quantity: qty,
 unitCost: cost
 });
 if (result.success) {
 showToast('Lote actualizado com sucesso', 'success');
 onSaved();
 onClose();
 } else {
 showToast(result.error ?? 'Erro ao actualizar lote', 'error');
 }
 } catch (e: any) {
 showToast(e?.message ?? 'Erro ao actualizar lote', 'error');
 } finally {
 setSaving(false);
 }
 };

 const qtyNum = parseFloat(quantity.replace(',', '.'));
 const costNum = parseFloat(unitCost.replace(',', '.'));
 const totalValue = !isNaN(qtyNum) && !isNaN(costNum) && qtyNum >= 0 && costNum >= 0 ? qtyNum * costNum : 0;
 const hasChanges = (quantity !== String(lot.quantity) || unitCost !== String(lot.unitCost));

 return (
 <ModalPortal open={open} onClose={onClose} zIndex={10002}>
 <div className="bg-surface-raised rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
 <div className="p-6 border-b border-border-default flex justify-between items-center">
 <h2 className="text-xl font-bold text-content-primary">Editar Lote</h2>
 <button
 type="button"
 onClick={onClose}
 className="text-content-muted hover:text-content-secondary "
 >
 <X className="w-6 h-6" />
 </button>
 </div>
 <div className="p-6 space-y-4">
 <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 flex gap-2">
 <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
 <p className="text-sm text-amber-800 dark:text-amber-200">
 Alterar quantidade ou custo unitário afecta a valorização FIFO e os relatórios de stock. Use com cuidado.
 </p>
 </div>

 <p className="text-sm text-content-secondary">
 {lot.productName} {lot.variantName && `— ${lot.variantName}`}
 </p>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Quantidade ({lot.unit})</label>
 <input
 type="text"
 inputMode="decimal"
 value={quantity}
 onChange={(e) => setQuantity(e.target.value)}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">Custo unitário (MTn)</label>
 <input
 type="text"
 inputMode="decimal"
 value={unitCost}
 onChange={(e) => setUnitCost(e.target.value)}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary"
 />
 </div>

 {!isNaN(qtyNum) && !isNaN(costNum) && qtyNum >= 0 && costNum >= 0 && (
 <p className="text-sm text-content-secondary">
 Valor total: <span className="font-semibold">{formatMoney(totalValue)} MTn</span>
 </p>
 )}
 </div>
 <div className="p-6 border-t border-border-default flex justify-end gap-2">
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg transition-colors"
 >
 Cancelar
 </button>
 <button
 type="button"
 onClick={handleSave}
 disabled={saving || !hasChanges}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors inline-flex items-center gap-2"
 >
 {saving ? (
 <>
 <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
 A guardar...
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 Guardar
 </>
 )}
 </button>
 </div>
 </div>
 </ModalPortal>
 );
};
