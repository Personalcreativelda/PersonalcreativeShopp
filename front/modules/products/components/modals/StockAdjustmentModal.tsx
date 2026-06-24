/**
 * Modal para criar ou editar ajustes de stock
 * Permite registar produtos estragados, devoluções, correções, etc.
 * Em modo criação: ajuste em lote com pesquisa rápida e lista de itens (ProductGrid).
 * Em modo edição (existingAdjustment) só quantidade, motivo, notas e data são editáveis.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { ModalPortal } from '../../../core/components/ui/ModalPortal';
import { X, Package, AlertTriangle, RotateCcw, Edit3, Trash2, Factory, HelpCircle, Plus, Minus } from 'lucide-react';
import { AdjustmentLine, Product, ProductVariant, StockAdjustment, StockAdjustmentReason } from '../../../core/types/types';
import type { OrderItem } from '../../../core/types/order';
import { stockAdjustmentService, ADJUSTMENT_REASON_LABELS } from '../../services/stockAdjustmentService';
import { useTrackAction } from '../../../auth/components/TrackedPage';
import { stockReportService } from '../../services/stockReportService';
import { ProductGrid } from '../ui/ProductGrid';
import { getTodayDateString, getStockSnapshotDate } from '../../../core/utils/dateUtils';

interface StockAdjustmentModalProps {
 open: boolean;
 onClose: () => void;
 products: Product[];
 onSuccess: () => void;
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
 existingAdjustment?: StockAdjustment | null;
}

const REASON_ICONS: Record<StockAdjustmentReason, React.ReactNode> = {
 [StockAdjustmentReason.DAMAGED]: <AlertTriangle className="w-4 h-4" />,
 [StockAdjustmentReason.RETURN]: <RotateCcw className="w-4 h-4" />,
 [StockAdjustmentReason.CORRECTION]: <Edit3 className="w-4 h-4" />,
 [StockAdjustmentReason.LOSS]: <Trash2 className="w-4 h-4" />,
 [StockAdjustmentReason.PRODUCTION]: <Factory className="w-4 h-4" />,
 [StockAdjustmentReason.EXPIRED]: <AlertTriangle className="w-4 h-4" />,
 [StockAdjustmentReason.OTHER]: <HelpCircle className="w-4 h-4" />
};

// Ajustes que normalmente são saídas (quantidade negativa)
const EXIT_REASONS = [
 StockAdjustmentReason.DAMAGED,
 StockAdjustmentReason.LOSS,
 StockAdjustmentReason.EXPIRED
];

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
 open,
 onClose,
 products,
 onSuccess,
 showToast,
 existingAdjustment = null
}) => {
 const isEditMode = !!existingAdjustment;
 const trackAction = useTrackAction();
 const [selectedProductId, setSelectedProductId] = useState<string>('');
 const [selectedVariantId, setSelectedVariantId] = useState<string>('');
 const [quantity, setQuantity] = useState<number>(1);
 const [isEntry, setIsEntry] = useState<boolean>(false); // false = saída (negativo)
 const [reason, setReason] = useState<StockAdjustmentReason>(StockAdjustmentReason.DAMAGED);
 const [notes, setNotes] = useState<string>('');
 const [date, setDate] = useState<string>(() => getTodayDateString());
 const [saving, setSaving] = useState(false);
 const [productSearch, setProductSearch] = useState('');
 const [calculatedStock, setCalculatedStock] = useState<number | null>(null);
 const [loadingCalculatedStock, setLoadingCalculatedStock] = useState(false);
 /** Modo criação: lista de linhas para ajuste em lote */
 const [items, setItems] = useState<AdjustmentLine[]>([]);

 useEffect(() => {
 if (!open) return;
 if (existingAdjustment) {
 setSelectedProductId(existingAdjustment.productId);
 setSelectedVariantId(existingAdjustment.variantId || '');
 setQuantity(Math.abs(existingAdjustment.quantity));
 setIsEntry(existingAdjustment.quantity > 0);
 setReason(existingAdjustment.reason);
 setNotes(existingAdjustment.notes || '');
 setDate(existingAdjustment.date || getTodayDateString());
 setProductSearch('');
 setItems([]);
 } else {
 setSelectedProductId('');
 setSelectedVariantId('');
 setQuantity(1);
 setIsEntry(false);
 setReason(StockAdjustmentReason.DAMAGED);
 setNotes('');
 setDate(getTodayDateString());
 setProductSearch('');
 setItems([]);
 }
 }, [open, existingAdjustment?.id]);

 // Stock calculado para a variante em edição ou para os itens em criação
 const [itemsStockMap, setItemsStockMap] = useState<Record<string, number>>({});

 useEffect(() => {
 if (!open || !selectedVariantId) {
 setCalculatedStock(null);
 return;
 }
 let cancelled = false;
 setLoadingCalculatedStock(true);
 const snapshotDate = getStockSnapshotDate();
 stockReportService.getCurrentStockSummary(snapshotDate).then(rows => {
 if (cancelled) return;
 const row = rows.find(r => r.variantId === selectedVariantId);
 setCalculatedStock(row != null ? row.finalStock : null);
 }).catch(() => {
 if (!cancelled) setCalculatedStock(null);
 }).finally(() => {
 if (!cancelled) setLoadingCalculatedStock(false);
 });
 return () => { cancelled = true; };
 }, [open, selectedVariantId]);

 // Carregar stock actual para itens em modo criação (múltiplos itens)
 useEffect(() => {
 if (!open || items.length === 0) {
 setItemsStockMap({});
 return;
 }
 let cancelled = false;
 const snapshotDate = getStockSnapshotDate();
 stockReportService.getCurrentStockSummary(snapshotDate).then(rows => {
 if (cancelled) return;
 const map: Record<string, number> = {};
 for (const it of items) {
 const key = it.variantId ?? `p:${it.productId}`;
 const row = it.variantId
 ? rows.find(r => r.variantId === it.variantId)
 : rows.find(r => r.productId === it.productId && !r.variantId);
 map[key] = row != null ? row.finalStock : 0;
 }
 setItemsStockMap(map);
 });
 return () => { cancelled = true; };
 }, [open, items]);

 // Produto selecionado
 const selectedProduct = useMemo(() => {
 return products.find(p => p.id === selectedProductId);
 }, [products, selectedProductId]);

 // Variante selecionada
 const selectedVariant = useMemo(() => {
 if (!selectedProduct || !selectedVariantId) return null;
 return selectedProduct.variants?.find(v => v.id === selectedVariantId);
 }, [selectedProduct, selectedVariantId]);

 // Produtos filtrados pela pesquisa (modo edição / select antigo)
 const filteredProducts = useMemo(() => {
 if (!productSearch.trim()) return products;
 const search = productSearch.toLowerCase();
 return products.filter(p => 
 p.name.toLowerCase().includes(search) ||
 p.variants?.some(v => v.name.toLowerCase().includes(search))
 );
 }, [products, productSearch]);

 // Mapear itens de ajuste para OrderItem[] (ProductGrid)
 const selectedItemsForGrid = useMemo((): OrderItem[] => {
 return items.map((line, i) => ({
 id: `adj_${i}`,
 productId: line.productId,
 productName: line.productName ?? '',
 variantId: line.variantId,
 variantName: line.variantName,
 quantity: line.quantity,
 price: 0,
 unit: line.unit
 }));
 }, [items]);

 const handleAddAdjustmentItem = (product: Product, variant?: ProductVariant) => {
 const variantId = variant?.id;
 const variantName = variant?.name;
 const unit = variant?.unit ?? product.unit ?? 'un';
 const existing = items.find(
 i => i.productId === product.id && (variantId ? i.variantId === variantId : !i.variantId)
 );
 if (existing) {
 setItems(items.map(i =>
 i.productId === product.id && (variantId ? i.variantId === variantId : !i.variantId)
 ? { ...i, quantity: i.quantity + 1 }
 : i
 ));
 } else {
 setItems([
 ...items,
 {
 productId: product.id,
 productName: product.name,
 variantId: variantId ?? undefined,
 variantName: variantName ?? undefined,
 quantity: 1,
 unit
 }
 ]);
 }
 };

 const handleUpdateItemQuantity = (index: number, newQuantity: number) => {
 const q = Math.max(0, Number(newQuantity) || 0);
 if (q === 0) {
 setItems(items.filter((_, i) => i !== index));
 return;
 }
 setItems(items.map((line, i) => (i === index ? { ...line, quantity: q } : line)));
 };

 const handleRemoveItem = (index: number) => {
 setItems(items.filter((_, i) => i !== index));
 };

 // Reset form
 const resetForm = () => {
 setSelectedProductId('');
 setSelectedVariantId('');
 setQuantity(1);
 setIsEntry(false);
 setReason(StockAdjustmentReason.DAMAGED);
 setNotes('');
 setDate(getTodayDateString());
 setProductSearch('');
 setItems([]);
 };

 // Quando muda o motivo, ajustar automaticamente se é entrada ou saída
 const handleReasonChange = (newReason: StockAdjustmentReason) => {
 setReason(newReason);
 // Motivos de saída: manter como saída
 // Devolução e produção: normalmente são entradas
 if (newReason === StockAdjustmentReason.RETURN || newReason === StockAdjustmentReason.PRODUCTION) {
 setIsEntry(true);
 } else if (EXIT_REASONS.includes(newReason)) {
 setIsEntry(false);
 }
 };

 // Submeter ajuste (criar ou atualizar; criação suporta lote)
 const handleSubmit = async () => {
 if (isEditMode) {
 if (quantity <= 0) {
 showToast('Quantidade deve ser maior que zero', 'warning');
 return;
 }
 const finalQuantity = isEntry ? Math.abs(quantity) : -Math.abs(quantity);
 setSaving(true);
 try {
 const result = await stockAdjustmentService.updateAdjustment(existingAdjustment!.id, {
 quantity: finalQuantity,
 reason,
 notes: notes.trim() || undefined,
 date
 });
 if (result.success) {
 trackAction('update', { entity: 'stock_adjustment', entityId: existingAdjustment!.id, changes: { quantity: finalQuantity, reason } });
 showToast('Ajuste atualizado com sucesso', 'success');
 onSuccess();
 onClose();
 } else {
 showToast(result.error || 'Erro ao atualizar ajuste', 'error');
 }
 } catch (e: any) {
 showToast(e.message || 'Erro ao atualizar ajuste', 'error');
 } finally {
 setSaving(false);
 }
 return;
 }

 // Modo criação
 const validItems = items.filter(i => (Number(i.quantity) || 0) > 0);
 if (validItems.length === 0) {
 showToast('Adicione pelo menos um produto com quantidade maior que zero', 'warning');
 return;
 }

 setSaving(true);
 try {
 if (validItems.length === 1) {
 const line = validItems[0];
 const finalQuantity = isEntry ? Math.abs(line.quantity) : -Math.abs(line.quantity);
 const result = await stockAdjustmentService.createAdjustment({
 productId: line.productId,
 productName: line.productName,
 variantId: line.variantId,
 variantName: line.variantName,
 quantity: finalQuantity,
 reason,
 notes: notes.trim() || undefined,
 date,
 createdBy: undefined
 });
 if (result.adjustment) {
 trackAction('create', { entity: 'stock_adjustment', entityId: result.adjustment.id, changes: { productId: line.productId, quantity: finalQuantity, reason } });
 showToast('Ajuste de stock registado com sucesso', 'success');
 onSuccess();
 resetForm();
 onClose();
 } else {
 showToast(result.error || 'Erro ao criar ajuste', 'error');
 }
 } else {
 const batch = await stockAdjustmentService.createBatchAdjustments(validItems, {
 reason,
 date,
 notes: notes.trim() || undefined,
 createdBy: undefined,
 isEntry
 });
 if (batch.failed === 0) {
 trackAction('create', { entity: 'stock_adjustment', changes: { batch: batch.created, reason } });
 showToast(`${batch.created} ajuste(s) de stock registados com sucesso`, 'success');
 onSuccess();
 resetForm();
 onClose();
 } else if (batch.created > 0) {
 trackAction('create', { entity: 'stock_adjustment', changes: { batch: batch.created, batchFailed: batch.failed, reason } });
 showToast(
 `${batch.created} registados, ${batch.failed} falha(s). ${batch.errors.slice(0, 2).join('; ')}${batch.errors.length > 2 ? '...' : ''}`,
 'warning'
 );
 onSuccess();
 resetForm();
 onClose();
 } else {
 showToast(batch.errors[0] || 'Erro ao criar ajustes', 'error');
 }
 }
 } catch (e: any) {
 showToast(e.message || 'Erro ao criar ajuste(s)', 'error');
 } finally {
 setSaving(false);
 }
 };

 if (!open) return null;

 return (
 <ModalPortal open={open} onClose={onClose}>
 <div className={`bg-surface-raised rounded-xl shadow-xl w-full mx-4 max-h-[90vh] overflow-y-auto ${isEditMode ? 'max-w-lg' : 'max-w-4xl'}`}>
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-border-default">
 <div className="flex items-center gap-2">
 <Package className="w-5 h-5 text-blue-600" />
 <h2 className="text-lg font-semibold text-content-primary">
 {isEditMode ? 'Editar ajuste' : 'Ajuste de Stock'}
 </h2>
 </div>
 <button
 onClick={onClose}
 className="p-1 hover:bg-surface-base rounded-lg transition-colors"
 >
 <X className="w-5 h-5 text-content-muted" />
 </button>
 </div>

 {/* Content */}
 <div className="p-4 space-y-4">
 {/* Data */}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Data
 </label>
 <input
 type="date"
 value={date}
 onChange={(e) => setDate(e.target.value)}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
 />
 </div>

 {/* Produto (em edição é só leitura) */}
 {isEditMode ? (
 <div className="p-3 bg-surface-base/50 rounded-lg">
 <p className="text-sm text-content-secondary">Produto</p>
 <p className="font-medium text-content-primary">
 {existingAdjustment?.productName}
 {existingAdjustment?.variantName ? ` · ${existingAdjustment.variantName}` : ''}
 </p>
 </div>
 ) : (
 <>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Adicionar produtos
 </label>
 <ProductGrid
 products={products}
 selectedItems={selectedItemsForGrid}
 onSelectProduct={handleAddAdjustmentItem}
 searchQuery={productSearch}
 onSearchChange={setProductSearch}
 viewMode="list"
 showThumbnails={false}
 showCategoryFilter={true}
 includeZeroStockVariants={true}
 showProductListOnlyWhenSearching={true}
 useCalculatedStockForVariants={true}
 />
 </div>

 {items.length > 0 && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Itens do ajuste ({items.length})
 </label>
 <div className="space-y-2 max-h-64 overflow-y-auto border border-border-default rounded-lg p-3">
 {items.map((line, index) => (
 <div
 key={`${line.productId}_${line.variantId ?? 'base'}_${index}`}
 className="flex items-center gap-3 p-3 bg-surface-base/50 rounded-lg"
 >
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-content-primary truncate">
 {line.productName}
 </p>
 {line.variantName && (
 <p className="text-xs text-content-muted truncate">
 {line.variantName}
 </p>
 )}
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 <button
 type="button"
 onClick={() => handleUpdateItemQuantity(index, (line.quantity || 1) - 1)}
 className="p-1 text-content-secondary hover:bg-surface-base rounded"
 aria-label="Diminuir quantidade"
 >
 <Minus className="w-4 h-4" />
 </button>
 <input
 type="number"
 min="0.01"
 step="0.01"
 value={line.quantity}
 onChange={(e) => handleUpdateItemQuantity(index, parseFloat(e.target.value) || 0)}
 className="w-20 px-2 py-1 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary text-center"
 />
 <button
 type="button"
 onClick={() => handleUpdateItemQuantity(index, (line.quantity || 0) + 1)}
 className="p-1 text-content-secondary hover:bg-surface-base rounded"
 aria-label="Aumentar quantidade"
 >
 <Plus className="w-4 h-4" />
 </button>
 <span className="text-xs text-content-muted w-8 text-right">
 {line.unit ?? 'un'}
 </span>
 <button
 type="button"
 onClick={() => handleRemoveItem(index)}
 className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
 aria-label="Remover item"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </>
 )}

 {/* Stock actual (só modo edição, variante selecionada) */}
 {isEditMode && selectedProduct && (
 <div className="p-3 bg-surface-base/50 rounded-lg space-y-1">
 <p className="text-sm text-content-secondary">
 Stock actual (relatório):{' '}
 <span className="font-semibold text-content-primary">
 {loadingCalculatedStock ? '...' : (calculatedStock != null ? calculatedStock : (selectedVariant?.stock ?? selectedProduct.variants?.[0]?.stock ?? 0))} {selectedProduct.unit || 'un'}
 </span>
 </p>
 {!loadingCalculatedStock && selectedVariantId && calculatedStock != null && (selectedVariant?.stock ?? 0) !== calculatedStock && (
 <p className="text-xs text-amber-600 dark:text-amber-400">
 Stock na base de dados: {selectedVariant?.stock ?? 0} {selectedProduct.unit || 'un'} — há discrepância. Use &quot;Alinhar stock&quot; na Gestão de Stock para corrigir.
 </p>
 )}
 </div>
 )}

 {/* Motivo */}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Motivo do ajuste
 </label>
 <div className="grid grid-cols-2 gap-2">
 {Object.values(StockAdjustmentReason).map(r => (
 <button
 key={r}
 type="button"
 onClick={() => handleReasonChange(r)}
 className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm ${
 reason === r
 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
 : 'border-border-default hover:bg-surface-base text-content-secondary'
 }`}
 >
 {REASON_ICONS[r]}
 <span className="truncate">{ADJUSTMENT_REASON_LABELS[r]}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Tipo (Entrada/Saída); em edição também Quantidade */}
 <div className={isEditMode ? 'grid grid-cols-2 gap-4' : ''}>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Tipo
 </label>
 <div className="flex rounded-lg border border-border-default overflow-hidden">
 <button
 type="button"
 onClick={() => setIsEntry(false)}
 className={`flex-1 px-3 py-2 flex items-center justify-center gap-1 text-sm font-medium transition-colors ${
 !isEntry
 ? 'bg-red-500 text-white'
 : 'bg-surface-raised text-content-secondary hover:bg-surface-base '
 }`}
 >
 <Minus className="w-4 h-4" />
 Saída
 </button>
 <button
 type="button"
 onClick={() => setIsEntry(true)}
 className={`flex-1 px-3 py-2 flex items-center justify-center gap-1 text-sm font-medium transition-colors ${
 isEntry
 ? 'bg-green-500 text-white'
 : 'bg-surface-raised text-content-secondary hover:bg-surface-base '
 }`}
 >
 <Plus className="w-4 h-4" />
 Entrada
 </button>
 </div>
 </div>
 {isEditMode && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Quantidade
 </label>
 <input
 type="number"
 min="0.01"
 step="0.01"
 value={quantity}
 onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
 />
 </div>
 )}
 </div>

 {/* Notas */}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-1">
 Notas (opcional)
 </label>
 <textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={3}
 placeholder="Detalhes adicionais sobre o ajuste..."
 className="w-full px-3 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
 />
 </div>

 {/* Preview do ajuste — stock actual, ajuste, stock depois */}
 {isEditMode && existingAdjustment?.productName && quantity > 0 && (
 <div className={`p-3 rounded-lg border ${
 isEntry 
 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
 : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
 }`}>
 <p className={`text-sm font-medium ${isEntry ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
 {existingAdjustment.productName}
 {existingAdjustment.variantName ? ` (${existingAdjustment.variantName})` : ''}
 </p>
 <div className="flex flex-wrap gap-4 mt-2 text-sm">
 <span className="text-content-secondary">
 Stock actual: <strong>{loadingCalculatedStock ? '...' : (calculatedStock ?? 0)} un</strong>
 </span>
 <span className={isEntry ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
 Ajuste: <strong>{isEntry ? '+' : '-'}{quantity} un</strong>
 </span>
 <span className="text-content-primary font-medium">
 Stock depois: <strong>
 {loadingCalculatedStock ? '...' : Math.max(0, (calculatedStock ?? 0) + (isEntry ? quantity : -quantity))} un
 </strong>
 </span>
 </div>
 <p className="text-xs text-content-secondary mt-2">
 Motivo: {ADJUSTMENT_REASON_LABELS[reason]}
 </p>
 </div>
 )}
 {!isEditMode && items.length > 0 && items.some(i => (Number(i.quantity) || 0) > 0) && (
 <div className={`p-3 rounded-lg border ${
 isEntry 
 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
 : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
 }`}>
 <p className={`text-sm font-medium ${isEntry ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
 {items.length} item(ns) · total {items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)} un · {isEntry ? 'Entrada' : 'Saída'}
 </p>
 <div className="mt-2 space-y-1.5">
 {items.filter(i => (Number(i.quantity) || 0) > 0).map((line, idx) => {
 const q = Number(line.quantity) || 0;
 const stockKey = line.variantId ?? `p:${line.productId}`;
 const stockBefore = itemsStockMap[stockKey] ?? null;
 const delta = isEntry ? q : -q;
 const stockAfter = stockBefore != null ? Math.max(0, stockBefore + delta) : null;
 return (
 <div key={idx} className="text-xs text-content-secondary flex flex-wrap items-center gap-x-3 gap-y-0.5">
 <span className="truncate max-w-[140px]">{line.productName}{line.variantName ? ` (${line.variantName})` : ''}:</span>
 <span>Stock actual: <strong>{stockBefore != null ? stockBefore : '...'}</strong> un</span>
 <span className={isEntry ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
 Ajuste: <strong>{isEntry ? '+' : '-'}{q}</strong> un
 </span>
 <span>Stock depois: <strong>{stockAfter != null ? stockAfter : '...'}</strong> un</span>
 </div>
 );
 })}
 </div>
 <p className="text-xs text-content-secondary mt-2">
 Motivo: {ADJUSTMENT_REASON_LABELS[reason]}
 </p>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex items-center justify-end gap-3 p-4 border-t border-border-default">
 <button
 onClick={onClose}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg transition-colors"
 >
 Cancelar
 </button>
 <button
 onClick={handleSubmit}
 disabled={
 saving ||
 (isEditMode && quantity <= 0) ||
 (!isEditMode && (items.length === 0 || !items.some(i => (Number(i.quantity) || 0) > 0)))
 }
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
 >
 {saving ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
 A guardar...
 </>
 ) : (
 <>
 <Package className="w-4 h-4" />
 {isEditMode
 ? 'Guardar alterações'
 : items.length > 1
 ? `Registar ${items.length} Ajustes`
 : 'Registar Ajuste'}
 </>
 )}
 </button>
 </div>
 </div>
 </ModalPortal>
 );
};
