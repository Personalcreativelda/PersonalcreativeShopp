import React, { useState, useMemo, useEffect } from 'react';
import { Product, StockMovement, StockItem, ProductVariant } from '../../../core/types/types';
import { Modal } from '../shared/Modal';
import {
 Calendar,
 ArrowUp,
 ArrowDown,
 Save,
 Loader2,
 X,
 Plus,
 Minus,
} from 'lucide-react';
import { normalizeForSearch } from '../../../core/services/serviceUtils';
import { getTodayDateString } from '../../../core/utils/dateUtils';

export interface CreateMovementModalProps {
 open: boolean;
 onClose: () => void;
 products: Product[];
 editingMovement: StockMovement | null;
 onSave: (movement: StockMovement) => Promise<void>;
 saving?: boolean;
}

export const CreateMovementModal: React.FC<CreateMovementModalProps> = ({
 open,
 onClose,
 products,
 editingMovement,
 onSave,
 saving = false,
}) => {
 const [date, setDate] = useState(getTodayDateString());
 const [movementType, setMovementType] = useState<'entry' | 'exit'>('entry');
 const [items, setItems] = useState<StockItem[]>([]);
 const [notes, setNotes] = useState('');
 const [productSearch, setProductSearch] = useState('');
 const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

 const filteredProducts = useMemo(() => {
 if (!productSearch.trim()) return products;
 const q = normalizeForSearch(productSearch);
 return products.filter(
 (p) =>
 normalizeForSearch(p.name).includes(q) ||
 (p.category && normalizeForSearch(p.category).includes(q)) ||
 (p.variants && p.variants.some((v) => normalizeForSearch(v.name).includes(q)))
 );
 }, [products, productSearch]);

 useEffect(() => {
 if (!open) return;
 if (editingMovement) {
 setDate(editingMovement.date.split('T')[0] || getTodayDateString());
 const hasExit = editingMovement.items.some((i) => i.quantity < 0);
 setMovementType(hasExit ? 'exit' : 'entry');
 setItems(
 editingMovement.items.map((i) => ({
 ...i,
 quantity: Math.abs(i.quantity),
 variant: i.variant ?? i.variantName,
 }))
 );
 setNotes(editingMovement.notes || '');
 } else {
 setDate(getTodayDateString());
 setMovementType('entry');
 setItems([]);
 setNotes('');
 }
 setProductSearch('');
 setSelectedProductId(null);
 }, [open, editingMovement]);

 const handleAddItem = (productId: string, variantName?: string) => {
 const product = products.find((p) => p.id === productId);
 if (!product) return;

 const variant: ProductVariant | undefined =
 variantName && product.variants
 ? product.variants.find((v) => v.name === variantName)
 : undefined;

 const existing = items.find(
 (i) =>
 i.productId === productId &&
 ((variantName && (i.variant === variantName || i.variantName === variantName)) ||
 (!variantName && !i.variant && !i.variantName))
 );

 if (existing) {
 setItems(
 items.map((i) =>
 i.productId === productId &&
 ((variantName && (i.variant === variantName || i.variantName === variantName)) ||
 (!variantName && !i.variant))
 ? { ...i, quantity: i.quantity + 1 }
 : i
 )
 );
 } else {
 setItems([
 ...items,
 {
 productId: product.id,
 productName: product.name,
 variantId: variant?.id,
 variantName: variant?.name,
 variant: variant?.name,
 quantity: 1,
 unit: variant?.unit || product.unit,
 },
 ]);
 }
 setSelectedProductId(null);
 setProductSearch('');
 };

 const handleUpdateItem = (index: number, updates: Partial<StockItem>) => {
 const next = [...items];
 next[index] = { ...next[index], ...updates };
 setItems(next);
 };

 const handleRemoveItem = (index: number) => {
 setItems(items.filter((_, i) => i !== index));
 };

 const handleSubmit = async () => {
 if (items.length === 0) return;
 const itemsWithSign = items.map((i) => ({
 ...i,
 quantity: movementType === 'entry' ? Math.abs(i.quantity) : -Math.abs(i.quantity),
 }));
 const movement: StockMovement = {
 id: editingMovement?.id ?? `movement-${Date.now()}`,
 date,
 items: itemsWithSign,
 notes: notes || undefined,
 createdAt: editingMovement?.createdAt ?? new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 };
 await onSave(movement);
 };

 const handleClose = () => {
 setProductSearch('');
 setSelectedProductId(null);
 onClose();
 };

 if (!open) return null;

 const footer = (
 <div className="flex gap-3 pt-4 border-t border-border-default">
 <button
 type="button"
 onClick={handleClose}
 className="flex-1 px-4 py-2 border border-border-default rounded-lg hover:bg-surface-base transition-colors text-content-secondary"
 >
 Cancelar
 </button>
 <button
 type="button"
 onClick={handleSubmit}
 disabled={items.length === 0 || saving}
 className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {saving ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Salvando...
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 {editingMovement ? 'Atualizar' : 'Criar'} Movimento
 </>
 )}
 </button>
 </div>
 );

 return (
 <Modal
 open={open}
 onClose={handleClose}
 title={editingMovement ? 'Editar Movimento' : 'Novo Movimento de Stock'}
 maxWidth="4xl"
 footer={footer}
 >
 <div className="p-6 space-y-4">
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 <Calendar className="w-4 h-4 inline mr-1" />
 Data do Movimento
 </label>
 <input
 type="date"
 value={date}
 onChange={(e) => setDate(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 />
 {editingMovement?.createdAt && (
 <p className="mt-2 text-sm text-content-muted">
 Registado no sistema em: {new Date(editingMovement.createdAt).toLocaleString('pt-PT')}
 </p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Tipo de Movimento
 </label>
 <div className="flex gap-3">
 <button
 type="button"
 onClick={() => setMovementType('entry')}
 className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
 movementType === 'entry'
 ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
 : 'border-border-default bg-surface-raised text-content-secondary hover:border-green-300'
 }`}
 >
 <ArrowUp className="w-5 h-5" />
 <span className="font-medium">Entrada</span>
 </button>
 <button
 type="button"
 onClick={() => setMovementType('exit')}
 className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
 movementType === 'exit'
 ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
 : 'border-border-default bg-surface-raised text-content-secondary hover:border-red-300'
 }`}
 >
 <ArrowDown className="w-5 h-5" />
 <span className="font-medium">Saída</span>
 </button>
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Adicionar Produto / Variação
 </label>
 <input
 type="text"
 placeholder="Pesquisar produtos..."
 value={productSearch}
 onChange={(e) => setProductSearch(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg mb-2"
 />
 <div className="max-h-64 overflow-y-auto border border-border-default rounded-lg">
 {filteredProducts.map((product) => {
 const hasVariants = product.variants && product.variants.length > 0;
 const isSelected = selectedProductId === product.id;
 return (
 <div key={product.id} className="relative">
 <button
 type="button"
 onClick={() => {
 if (hasVariants) {
 setSelectedProductId(isSelected ? null : product.id);
 } else {
 handleAddItem(product.id);
 }
 }}
 className="w-full px-4 py-2 text-left hover:bg-surface-base flex items-center justify-between"
 >
 <span className="text-sm text-content-secondary">
 {product.name}
 {hasVariants && (
 <span className="ml-2 text-xs text-content-muted">
 ({product.variants?.length} variações)
 </span>
 )}
 </span>
 <span className="text-xs text-content-muted">{hasVariants ? (isSelected ? '−' : '+') : '+'}</span>
 </button>
 {hasVariants && isSelected && (
 <div className="bg-surface-base border-t border-border-default">
 {product.variants?.map((variant) => (
 <button
 key={variant.id}
 type="button"
 onClick={() => handleAddItem(product.id, variant.name)}
 className="w-full px-6 py-2 text-left hover:bg-surface-base flex items-center justify-between text-sm"
 >
 <span className="text-content-secondary">
 {variant.name} – Stock: {variant.stock ?? 0} {variant.unit || product.unit}
 </span>
 <span className="text-xs text-content-muted">+</span>
 </button>
 ))}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>

 {items.length > 0 && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Itens do Movimento ({items.length})
 </label>
 <div className="space-y-2 max-h-64 overflow-y-auto border border-border-default rounded-lg p-3">
 {items.map((item, index) => (
 <div
 key={index}
 className="flex items-center gap-3 p-3 bg-surface-base/50 rounded-lg"
 >
 <div className="flex-1">
 <p className="text-sm font-medium text-content-primary">{item.productName}</p>
 {(item.variant ?? item.variantName) && (
 <p className="text-xs text-content-muted">
 {item.variant ?? item.variantName}
 </p>
 )}
 </div>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => handleUpdateItem(index, { quantity: item.quantity - 1 })}
 className="p-1 text-content-secondary hover:bg-surface-base rounded"
 >
 <Minus className="w-4 h-4" />
 </button>
 <input
 type="number"
 step="0.01"
 value={item.quantity}
 onChange={(e) => {
 const value = parseFloat(e.target.value) || 0;
 handleUpdateItem(index, { quantity: value });
 }}
 className="w-20 px-2 py-1 text-sm border border-border-default rounded text-center"
 />
 <button
 type="button"
 onClick={() => handleUpdateItem(index, { quantity: item.quantity + 1 })}
 className="p-1 text-content-secondary hover:bg-surface-base rounded"
 >
 <Plus className="w-4 h-4" />
 </button>
 <span className="text-xs text-content-muted w-12 text-right">
 {item.unit ?? 'un'}
 </span>
 <button
 type="button"
 onClick={() => handleRemoveItem(index)}
 className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Notas (opcional)
 </label>
 <textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={3}
 className="w-full px-4 py-2 border border-border-default rounded-lg"
 placeholder="Adicione notas sobre este movimento..."
 />
 </div>
 </div>
 </Modal>
 );
};
