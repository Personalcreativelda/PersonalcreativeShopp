import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Product, ProductVariant, StockAdjustmentReason } from '../../../core/types/types';
import { Modal } from '../shared/Modal';
import { Plus, Trash2, Upload, Search, Star, Pencil } from 'lucide-react';
import { productService } from '../../services/productService';
import { stockAdjustmentService } from '../../services/stockAdjustmentService';
import { stockReportService } from '../../services/stockReportService';
import { ConfirmDialog } from '../../../core/components/ui/ConfirmDialog';
import { normalizeForSearch } from '../../../core/services/serviceUtils';
import { AddVariantModal } from './AddVariantModal';
import uploadService from '../../../../services/uploadService';
import { getTodayDateString, getStockSnapshotDate } from '../../../core/utils/dateUtils';
import type { ProductUnitOption } from './ProductFormModal';

interface ProductVariantModalProps {
 open: boolean;
 onClose: () => void;
 product: Product | null;
 units: ProductUnitOption[];
 onProductUpdated: (product: Product) => void;
 showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
 uploadVariantImage: (file: File, productId: string, variantId: string) => Promise<string | null>;
 validateImageFile: (file: File) => { valid: boolean; error?: string };
}

export const ProductVariantModal: React.FC<ProductVariantModalProps> = ({
 open,
 onClose,
 product,
 units,
 onProductUpdated,
 showToast,
 uploadVariantImage,
 validateImageFile,
}) => {
 const [editingVariants, setEditingVariants] = useState<Map<string, Partial<ProductVariant>>>(new Map());
 const [variantSearchQuery, setVariantSearchQuery] = useState('');
 const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; variantId: string | null }>({
 isOpen: false,
 variantId: null,
 });
 const [addVariantModalOpen, setAddVariantModalOpen] = useState(false);
 const [variantToEdit, setVariantToEdit] = useState<ProductVariant | null>(null);
 const [calculatedStockMap, setCalculatedStockMap] = useState<Record<string, number>>({});

 useEffect(() => {
 if (!open || !product?.variants?.length) {
 setCalculatedStockMap({});
 return;
 }
 let cancelled = false;
 const snapshotDate = getStockSnapshotDate();
 stockReportService.getCurrentStockSummary(snapshotDate).then(rows => {
 if (cancelled) return;
 const map: Record<string, number> = {};
 for (const v of product.variants) {
 const row = rows.find(r => r.variantId === v.id);
 map[v.id] = row != null ? row.finalStock : 0;
 }
 setCalculatedStockMap(map);
 });
 return () => { cancelled = true; };
 }, [open, product?.id]);

 const loadProduct = useCallback(async () => {
 if (!product?.id || product.id === 'temp') return product;
 const list = await productService.getProducts();
 const updated = list.find((p) => p.id === product.id);
 return updated || product;
 }, [product]);

 const refreshAndNotify = useCallback(async () => {
 const updated = await loadProduct();
 if (updated) onProductUpdated(updated);
 }, [loadProduct, onProductUpdated]);

 const normalizeNumber = (val: unknown): number => {
 if (val === null || val === undefined) return 0;
 const num = typeof val === 'string' ? parseFloat(val) : Number(val);
 return isNaN(num) ? 0 : num;
 };

 const updateLocalVariant = useCallback(
 (variantId: string, updates: Partial<ProductVariant>) => {
 const originalVariant = product?.variants?.find((v) => v.id === variantId);
 if (!originalVariant) return;
 setEditingVariants((prev) => {
 const newMap = new Map(prev);
 const existing = newMap.get(variantId);
 const base = existing || originalVariant;
 newMap.set(variantId, { ...base, ...updates });
 return newMap;
 });
 },
 [product]
 );

 const handleUpdateVariant = useCallback(
 async (variantId: string, updates: Partial<ProductVariant>): Promise<boolean> => {
 const success = await productService.updateVariant(variantId, updates);
 if (success) {
 showToast('Variação atualizada com sucesso', 'success');
 await refreshAndNotify();
 return true;
 }
 showToast('Erro ao atualizar variação', 'error');
 return false;
 },
 [showToast, refreshAndNotify]
 );

 // Função helper para verificar nome duplicado
 const checkDuplicateName = useCallback(
 (name: string, excludeVariantId?: string | null): boolean => {
 if (!product?.variants) return false;
 const normalizedName = name.trim().toLowerCase();
 return product.variants.some(
 (v) => v.id !== excludeVariantId && v.name.trim().toLowerCase() === normalizedName
 );
 },
 [product]
 );

 const handleVariantBlur = useCallback(
 async (variantId: string) => {
 const updates = editingVariants.get(variantId);
 if (!updates || !product) return;

 const originalVariant = product.variants?.find((v) => v.id === variantId);
 if (!originalVariant) return;

 const changedFields: Partial<ProductVariant> = {};
 let nameReverted = false;
 
 if (updates.name !== undefined && updates.name.trim() !== originalVariant.name.trim()) {
 const newName = updates.name.trim();
 // Validar nome duplicado
 if (checkDuplicateName(newName, variantId)) {
 showToast('Já existe uma variação com este nome para este produto.', 'error');
 // Reverter o nome no estado local
 setEditingVariants((prev) => {
 const next = new Map(prev);
 const existing = next.get(variantId);
 if (existing) {
 next.set(variantId, { ...existing, name: originalVariant.name });
 }
 return next;
 });
 nameReverted = true;
 } else {
 changedFields.name = newName;
 }
 }
 if (updates.price !== undefined && Math.abs(normalizeNumber(updates.price) - originalVariant.price) > 0.01) {
 changedFields.price = normalizeNumber(updates.price);
 }
 if (
 updates.costPrice !== undefined &&
 Math.abs(normalizeNumber(updates.costPrice) - (originalVariant.costPrice || 0)) > 0.01
 ) {
 changedFields.costPrice = normalizeNumber(updates.costPrice);
 }
 if (updates.stock !== undefined && normalizeNumber(updates.stock) !== originalVariant.stock) {
 changedFields.stock = normalizeNumber(updates.stock);
 }
 if (updates.minStock !== undefined && normalizeNumber(updates.minStock) !== (originalVariant.minStock || 0)) {
 changedFields.minStock = normalizeNumber(updates.minStock);
 }
 if (updates.unit !== undefined && updates.unit !== originalVariant.unit) {
 changedFields.unit = updates.unit;
 }

 // Se há campos para atualizar (mesmo que o nome tenha sido revertido, outros campos podem ter mudado)
 if (Object.keys(changedFields).length > 0) {
 // Alteração de stock: criar ajuste para alinhar lista e relatório (em vez de só UPDATE na variante)
 const stockDelta = changedFields.stock !== undefined ? changedFields.stock - originalVariant.stock : 0;
 if (stockDelta !== 0) {
 const adjResult = await stockAdjustmentService.createAdjustment({
 productId: product.id,
 productName: product.name,
 variantId,
 variantName: originalVariant.name ?? undefined,
 quantity: stockDelta,
 reason: StockAdjustmentReason.CORRECTION,
 notes: 'Correção de contagem (edição na ficha do produto)',
 date: getTodayDateString(),
 });
 if (adjResult.error) {
 showToast(adjResult.error || 'Erro ao registar ajuste de stock', 'error');
 setEditingVariants((prev) => { const n = new Map(prev); n.delete(variantId); return n; });
 return;
 }
 showToast('Stock atualizado (ajuste registado)', 'success');
 delete changedFields.stock; // variante já foi atualizada pelo ajuste
 }

 const success = Object.keys(changedFields).length > 0
 ? await handleUpdateVariant(variantId, changedFields)
 : await refreshAndNotify().then(() => true);
 if (!success && Object.keys(changedFields).length > 0) {
 setEditingVariants((prev) => { const n = new Map(prev); n.delete(variantId); return n; });
 return;
 }
 if (success && originalVariant.isDefault && (changedFields.price !== undefined || changedFields.costPrice !== undefined)) {
 const updatedVariant = { ...originalVariant, ...changedFields };
 await productService.updateProduct(product.id, {
 price: updatedVariant.price,
 costPrice: updatedVariant.costPrice || 0,
 });
 }
 // Limpar estado de edição após salvar (mantendo o nome revertido se necessário)
 setEditingVariants((prev) => {
 const next = new Map(prev);
 const existing = next.get(variantId);
 if (existing && nameReverted) {
 // Se o nome foi revertido, manter apenas o nome original no estado
 next.set(variantId, { name: originalVariant.name });
 } else {
 // Caso contrário, remover completamente
 next.delete(variantId);
 }
 return next;
 });
 } else if (nameReverted) {
 // Se apenas o nome foi revertido e não há outros campos, limpar o estado
 setEditingVariants((prev) => {
 const next = new Map(prev);
 next.delete(variantId);
 return next;
 });
 } else {
 // Sem mudanças, limpar estado
 setEditingVariants((prev) => {
 const next = new Map(prev);
 next.delete(variantId);
 return next;
 });
 }
 },
 [editingVariants, product, handleUpdateVariant, checkDuplicateName, showToast]
 );

 const handleDeleteVariant = useCallback(async (variantId: string) => {
 await productService.deleteVariant(variantId);
 showToast('Variação apagada com sucesso', 'success');
 await refreshAndNotify();
 setConfirmDelete({ isOpen: false, variantId: null });
 }, [showToast, refreshAndNotify]);

 const handleSetDefaultVariant = useCallback(
 async (variantId: string) => {
 if (!product) return;
 const variantToSet = product.variants?.find((v) => v.id === variantId);
 if (!variantToSet) return;

 for (const v of product.variants || []) {
 if (v.isDefault && v.id !== variantId) {
 await productService.updateVariant(v.id, { isDefault: false });
 }
 }
 await handleUpdateVariant(variantId, { isDefault: true });
 await productService.updateProduct(product.id, {
 price: variantToSet.price,
 costPrice: variantToSet.costPrice || 0,
 });
 },
 [product, handleUpdateVariant]
 );

 // Hooks devem ser chamados incondicionalmente (antes de qualquer return)
 const variants = product?.variants ?? [];
 const sortedVariants = useMemo(() => {
 return [...variants].sort((a, b) => a.price - b.price);
 }, [variants]);
 const filteredVariants = useMemo(() => {
 if (!variantSearchQuery.trim()) return sortedVariants;
 const query = normalizeForSearch(variantSearchQuery);
 return sortedVariants.filter(
 (v) =>
 normalizeForSearch(v.name).includes(query) ||
 v.price.toString().includes(query) ||
 (v.costPrice != null && v.costPrice.toString().includes(query))
 );
 }, [sortedVariants, variantSearchQuery]);

 if (!open || !product) return null;

 return (
 <>
 <ConfirmDialog
 isOpen={confirmDelete.isOpen}
 message="Tem certeza que deseja apagar esta variação? Esta ação não pode ser desfeita."
 variant="danger"
 onConfirm={() => confirmDelete.variantId && handleDeleteVariant(confirmDelete.variantId)}
 onCancel={() => setConfirmDelete({ isOpen: false, variantId: null })}
 />

 <AddVariantModal
 open={addVariantModalOpen}
 onClose={() => {
 setAddVariantModalOpen(false);
 setVariantToEdit(null);
 }}
 product={product}
 variant={variantToEdit}
 units={units}
 onSuccess={refreshAndNotify}
 showToast={showToast}
 uploadVariantImage={uploadVariantImage}
 validateImageFile={validateImageFile}
 />

 <Modal
 open={open}
 onClose={onClose}
 title="Variações do Produto"
 maxWidth="4xl"
 footer={
 <div className="flex items-center justify-end gap-3">
 <button
 type="button"
 onClick={() => {
 setVariantToEdit(null);
 setAddVariantModalOpen(true);
 }}
 className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
 >
 <Plus className="w-4 h-4" />
 Adicionar Nova Variação
 </button>
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 text-content-secondary hover:bg-surface-base rounded-lg font-medium text-sm transition-colors"
 >
 Fechar
 </button>
 </div>
 }
 >
 <div className="space-y-6">
 <p className="text-sm text-content-secondary">
 Produto: <span className="font-medium text-content-primary">{product.name}</span>
 </p>

 <div className="border-t border-border-default pt-6">
 <h4 className="text-lg font-semibold text-content-primary mb-4">
 Variações Existentes ({filteredVariants.length} de {variants.length})
 </h4>
 <div className="relative mt-4">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input
 type="text"
 placeholder="Pesquisar variações..."
 value={variantSearchQuery}
 onChange={(e) => setVariantSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary text-sm focus:ring-2 focus:ring-brand-500"
 />
 </div>
 <div className="overflow-x-auto max-h-96 overflow-y-auto border border-border-default rounded-lg">
 <table className="w-full min-w-[800px]">
 <thead className="bg-surface-base border-b border-border-default sticky top-0">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 Imagem
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 Nome
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 Preço Compra
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 Preço Venda
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 Stock
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
 Unidade
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium text-content-muted uppercase tracking-wider">
 Ações
 </th>
 </tr>
 </thead>
 <tbody className="bg-surface-raised divide-y divide-gray-200 dark:divide-gray-600">
 {filteredVariants.length === 0 ? (
 <tr>
 <td colSpan={7} className="px-4 py-8 text-center text-sm text-content-muted">
 {variantSearchQuery ? 'Nenhuma variação encontrada' : 'Nenhuma variação cadastrada'}
 </td>
 </tr>
 ) : (
 filteredVariants.map((variant) => {
 const edits = editingVariants.get(variant.id);
 const displayVariant = edits ? { ...variant, ...edits } : variant;

 return (
 <tr
 key={variant.id}
 className="hover:bg-surface-base /50 transition-colors"
 >
 <td className="px-4 py-3">
 {variant.image ? (
 <img
 src={uploadService.getPublicUrl(variant.image)}
 alt={variant.name}
 className="w-12 h-12 object-cover rounded-lg"
 />
 ) : (
 <div className="w-12 h-12 bg-surface-base rounded-lg flex items-center justify-center">
 <Upload className="w-5 h-5 text-content-muted" />
 </div>
 )}
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <input
 type="text"
 value={displayVariant.name}
 onChange={(e) => updateLocalVariant(variant.id, { name: e.target.value })}
 onBlur={() => handleVariantBlur(variant.id)}
 className="flex-1 px-2 py-1 text-sm font-medium text-content-primary bg-transparent border border-transparent hover:border-border-default dark:hover:border-gray-500 focus:border-brand-500 focus:outline-none rounded"
 />
 {variant.isDefault && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 flex-shrink-0">
 Padrão
 </span>
 )}
 </div>
 </td>
 <td className="px-4 py-3">
 <input
 type="number"
 step="0.01"
 value={displayVariant.costPrice || ''}
 onChange={(e) =>
 updateLocalVariant(variant.id, { costPrice: parseFloat(e.target.value) || 0 })
 }
 onBlur={() => handleVariantBlur(variant.id)}
 className="input-number-simple w-full px-2 py-1 text-sm text-content-secondary bg-transparent border border-transparent hover:border-border-default dark:hover:border-gray-500 focus:border-brand-500 focus:outline-none rounded text-right"
 />
 </td>
 <td className="px-4 py-3">
 <input
 type="number"
 step="0.01"
 value={displayVariant.price}
 onChange={(e) =>
 updateLocalVariant(variant.id, { price: parseFloat(e.target.value) || 0 })
 }
 onBlur={() => handleVariantBlur(variant.id)}
 className="input-number-simple w-full px-2 py-1 text-sm font-medium text-content-primary bg-transparent border border-transparent hover:border-border-default dark:hover:border-gray-500 focus:border-brand-500 focus:outline-none rounded text-right"
 />
 </td>
 <td className="px-4 py-3 text-right text-sm text-content-secondary">
 {calculatedStockMap[variant.id] !== undefined
 ? calculatedStockMap[variant.id]
 : (variant.stock ?? 0)}
 {calculatedStockMap[variant.id] !== undefined &&
 (variant.stock ?? 0) !== calculatedStockMap[variant.id] && (
 <span className="ml-1 text-xs text-amber-600 dark:text-amber-400" title={`BD: ${variant.stock ?? 0} — use Alinhar stock na Gestão de Stock`}>
 (BD:{variant.stock ?? 0})
 </span>
 )}
 </td>
 <td className="px-4 py-3">
 <select
 value={displayVariant.unit}
 onChange={(e) => updateLocalVariant(variant.id, { unit: e.target.value })}
 onBlur={() => handleVariantBlur(variant.id)}
 className="px-2 py-1 text-sm text-content-secondary bg-transparent border border-transparent hover:border-border-default dark:hover:border-gray-500 focus:border-brand-500 focus:outline-none rounded"
 >
 {units.map((u) => (
 <option key={u.abbreviation} value={u.abbreviation}>
 {u.abbreviation}
 </option>
 ))}
 </select>
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center justify-end gap-2">
 <button
 type="button"
 onClick={() => {
 setVariantToEdit(variant);
 setAddVariantModalOpen(true);
 }}
 className="p-1.5 text-content-secondary hover:bg-surface-base rounded transition-colors"
 title="Editar variação"
 >
 <Pencil className="w-4 h-4" />
 </button>
 {!variant.isDefault && (
 <button
 type="button"
 onClick={() => handleSetDefaultVariant(variant.id)}
 className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
 title="Definir como padrão"
 >
 <Star className="w-4 h-4" />
 </button>
 )}
 {variant.isDefault && (
 <div className="p-1.5 text-yellow-500" title="Variação padrão">
 <Star className="w-4 h-4 fill-current" />
 </div>
 )}
 <button
 type="button"
 onClick={() => setConfirmDelete({ isOpen: true, variantId: variant.id })}
 className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
 title="Eliminar variação"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </Modal>
 </>
 );
};
