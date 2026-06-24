import React from 'react';
import { OrderItem, Product, ProductVariant } from '../../../core/types/types';
import { Trash2, Plus, Minus } from 'lucide-react';

interface OrderItemEditorProps {
 item: OrderItem;
 itemIndex: number;
 product: Product | undefined;
 selectedVariant: ProductVariant | null;
 onUpdateQuantity: (index: number, quantity: number) => void;
 onUpdatePrice: (index: number, price: number) => void;
 onRemove: (index: number) => void;
 onVariantChange?: (index: number, variantId: string) => void;
 stockCheck?: {
 available: boolean;
 availableStock: number;
 message: string;
 };
 isPriceModified?: boolean;
 formatMoney: (value: number) => string;
}

export const OrderItemEditor: React.FC<OrderItemEditorProps> = ({
 item,
 itemIndex,
 product,
 selectedVariant,
 onUpdateQuantity,
 onUpdatePrice,
 onRemove,
 onVariantChange,
 stockCheck,
 isPriceModified = false,
 formatMoney
}) => {
 const hasVariants = product && product.variants && product.variants.length > 0;

 return (
 <div className={`bg-surface-raised p-3 rounded-lg border transition-all ${
 stockCheck && !stockCheck.available
 ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
 : 'border-border-default'
 }`}>
 {stockCheck && !stockCheck.available && (
 <div className="mb-2 py-1.5 px-2 bg-red-100 dark:bg-red-900/20 rounded text-xs text-red-700 dark:text-red-400">
 {stockCheck.message}
 </div>
 )}

 <div className="flex flex-wrap items-center gap-2 sm:gap-3">
 <div className="flex-1 min-w-0 flex items-center gap-2">
 <span className="font-semibold text-sm text-content-primary truncate">
 {item.productName}
 </span>
 {item.variantName && (
 <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded">
 {item.variantName}
 </span>
 )}
 {isPriceModified && (
 <span className="shrink-0 text-[10px] text-orange-600 dark:text-orange-400" title="Preço modificado">*</span>
 )}
 </div>

 {hasVariants && onVariantChange && product.variants && (
 <select
 value={item.variantId || ''}
 onChange={(e) => onVariantChange(itemIndex, e.target.value)}
 className="shrink-0 w-full sm:w-auto min-w-[100px] max-w-[160px] px-2 py-1.5 text-xs border border-border-default rounded-md bg-surface-raised text-content-primary focus:ring-1 focus:ring-brand-500"
 >
 {product.variants
 .filter(v => (v.stock ?? 0) > 0 || v.id === item.variantId)
 .map(variant => (
 <option key={variant.id} value={variant.id}>
 {variant.name} — {formatMoney(variant.price)}/{variant.unit}
 {(variant.stock ?? 0) <= 0 && variant.id === item.variantId ? ' (sem stock)' : ''}
 </option>
 ))}
 </select>
 )}

 <div className="flex items-center gap-1">
 <button
 type="button"
 onClick={() => onUpdateQuantity(itemIndex, Math.max(0, item.quantity - 1))}
 className="p-1.5 bg-surface-base text-content-secondary rounded-md hover:bg-surface-base transition-colors"
 aria-label="Diminuir quantidade"
 >
 <Minus className="w-3.5 h-3.5" />
 </button>
 <input
 type="number"
 min="0"
 step="0.01"
 value={item.quantity}
 onChange={(e) => {
 const value = parseFloat(e.target.value) || 0;
 onUpdateQuantity(itemIndex, value);
 }}
 className="w-14 px-1.5 py-1.5 text-sm text-center border border-border-default rounded-md bg-surface-raised text-content-primary focus:ring-1 focus:ring-brand-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
 />
 <button
 type="button"
 onClick={() => onUpdateQuantity(itemIndex, item.quantity + 1)}
 className="p-1.5 bg-surface-base text-content-secondary rounded-md hover:bg-surface-base transition-colors"
 aria-label="Aumentar quantidade"
 >
 <Plus className="w-3.5 h-3.5" />
 </button>
 </div>

 <div className="flex items-center gap-1 shrink-0">
 <input
 type="number"
 min="0"
 step="0.01"
 value={item.priceAtTime}
 onChange={(e) => {
 const value = parseFloat(e.target.value) || 0;
 onUpdatePrice(itemIndex, value);
 }}
 title="Preço unitário"
 className="w-20 px-2 py-1.5 text-sm border border-border-default rounded-md bg-surface-raised text-content-primary focus:ring-1 focus:ring-brand-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
 />
 {selectedVariant && item.priceAtTime !== selectedVariant.price && (
 <button
 type="button"
 onClick={() => onUpdatePrice(itemIndex, selectedVariant.price)}
 className="text-[10px] text-green-600 dark:text-green-400 hover:underline whitespace-nowrap"
 title={`Padrão: ${formatMoney(selectedVariant.price)}`}
 >
 Padrão
 </button>
 )}
 </div>

 <span className="shrink-0 text-sm font-bold text-brand-600 dark:text-brand-400 tabular-nums min-w-[70px] text-right">
 {formatMoney(item.priceAtTime * item.quantity)}
 </span>

 <button
 type="button"
 onClick={() => onRemove(itemIndex)}
 className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors shrink-0"
 title="Remover item"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 );
};
