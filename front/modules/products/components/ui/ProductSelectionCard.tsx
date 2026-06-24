import React, { useState, useMemo } from 'react';
import { Product, ProductVariant } from '../../../core/types/types';
import { Package, CheckCircle2, Plus } from 'lucide-react';
import { getVariantImage } from '../../../core/utils/productUtils';
import { useLanguage } from '../../../core/contexts/LanguageContext';


interface ProductCardProps {
 product: Product;
 isSelected: boolean;
 selectedVariantId?: string;
 onSelect: (product: Product, variant?: ProductVariant) => void;
 quantity?: number;
 viewMode?: 'grid' | 'list';
 /** Mostrar imagem do produto no cartão */
 showThumbnail?: boolean;
 /** Mostrar dropdown de variação no cartão (em vez de abrir modal ao clicar) */
 showVariantSelector?: boolean;
 /** Incluir variações com stock 0 no selector (ex.: compras) */
 includeZeroStockVariants?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
 product,
 isSelected,
 selectedVariantId,
 onSelect,
 quantity = 0,
 viewMode = 'grid',
 showThumbnail = true,
 showVariantSelector = false,
 includeZeroStockVariants = false
}) => {
 const { t } = useLanguage();
 const hasVariants = product.variants && product.variants.length > 0;
 const variantsWithStock = useMemo(() =>
 (product.variants ?? []).filter(v => (v.stock ?? 0) > 0),
 [product.variants]
 );
 const variantsToShow = useMemo(() =>
 includeZeroStockVariants ? (product.variants ?? []) : variantsWithStock,
 [includeZeroStockVariants, product.variants, variantsWithStock]
 );
 const defaultVariant = product.variants?.find(v => v.isDefault) || product.variants?.[0];
 const firstVariantWithStock = variantsWithStock[0] ?? defaultVariant;
 const firstVariantToShow = variantsToShow[0] ?? defaultVariant;

 const [dropdownVariantId, setDropdownVariantId] = useState<string>(firstVariantToShow?.id ?? '');

 const selectedVariant = product.variants?.find(v => v.id === selectedVariantId) || defaultVariant;
 const displayVariant = showVariantSelector && hasVariants
 ? (product.variants?.find(v => v.id === dropdownVariantId) || firstVariantToShow)
 : selectedVariant;

 const displayPrice = displayVariant?.price ?? displayVariant?.costPrice ?? product.price;
 const displayStock = displayVariant?.stock ?? product.stock ?? 0;
 const displayUnit = displayVariant?.unit || product.unit || 'un';

 const imageUrl = getVariantImage(displayVariant, product);

 const handleAddWithVariant = (e: React.MouseEvent) => {
 e.preventDefault();
 e.stopPropagation();
 const v = product.variants?.find(vr => vr.id === dropdownVariantId) || firstVariantToShow;
 if (v && (includeZeroStockVariants || (v.stock ?? 0) > 0)) onSelect(product, v);
 };

 if (viewMode === 'list') {
 const listClassName = `relative w-full bg-surface-raised rounded-xl border-2 transition-all overflow-hidden group ${isSelected
 ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-900/10'
 : 'border-border-default hover:border-brand-300 dark:hover:border-brand-600'
 }`;

 if (showVariantSelector && hasVariants && variantsToShow.length > 0) {
 return (
 <div className={listClassName}>
 <div className="p-3 flex flex-wrap items-center justify-between gap-3">
 <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
 <h3 className="font-semibold text-sm text-content-primary text-left truncate w-full">
 {product.name}
 </h3>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
 <select
 value={dropdownVariantId}
 onChange={e => setDropdownVariantId(e.target.value)}
 className="text-xs rounded-lg border border-border-default bg-surface-raised text-content-primary px-2 py-1.5 min-w-[120px] focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 >
 {variantsToShow.map(v => (
 <option key={v.id} value={v.id}>
 {v.name} — {includeZeroStockVariants ? `${(v.costPrice ?? 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MT` : `${(v.stock ?? 0)} ${v.unit}`}
 </option>
 ))}
 </select>
 <button
 type="button"
 onClick={handleAddWithVariant}
 className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
 >
 <Plus className="w-3.5 h-3.5" /> {t.common.add}
 </button>
 </div>
 <div className="flex items-center gap-3 text-right">
 <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
 {displayPrice.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
 </span>
 <span className="text-[10px] text-content-muted">/ {displayUnit}</span>
 {quantity > 0 && (
 <div className="bg-brand-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-[10px]">
 {quantity}
 </div>
 )}
 </div>
 </div>
 </div>
 );
 }

 return (
 <button
 onClick={() => onSelect(product, hasVariants ? undefined : selectedVariant)}
 className={listClassName}
 >
 <div className="p-3 flex items-center justify-between gap-4">
 <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
 <h3 className="font-semibold text-sm text-content-primary text-left truncate w-full">
 {product.name}
 </h3>

 {hasVariants && selectedVariant && (
 <div className="text-[10px] text-brand-600 dark:text-brand-400 font-medium bg-brand-50 dark:bg-brand-600/20 px-1.5 py-0.5 rounded">
 {selectedVariant.name}
 </div>
 )}
 </div>

 <div className="flex items-center gap-4">
 <div className="text-right">
 <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
 {displayPrice.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
 </span>
 <span className="text-[10px] text-content-muted block">
 / {displayUnit}
 </span>
 </div>

 <div className="min-w-[60px] text-right">
 {displayStock > 0 ? (
 <div className="flex items-center justify-end gap-1 text-[10px] text-content-muted">
 <Package className="w-3 h-3" />
 <span>{displayStock}</span>
 </div>
 ) : (
 <div className="text-[10px] text-red-500 dark:text-red-400 font-medium">
 {t.common.outOfStock}
 </div>
 )}
 </div>

 {quantity > 0 && (
 <div className="bg-brand-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-[10px] shadow-sm">
 {quantity}
 </div>
 )}

 {isSelected && !quantity && (
 <div className="text-brand-600 p-1">
 <CheckCircle2 className="w-5 h-5" />
 </div>
 )}
 </div>
 </div>
 </button>
 );
 }

 const cardClassName = `relative w-full bg-surface-raised rounded-xl border-2 transition-all overflow-hidden group ${isSelected
 ? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-900'
 : 'border-border-default hover:border-brand-300 dark:hover:border-brand-600'
 }`;

 const gridContent = (
 <>
 {showThumbnail && (
 <div className="relative w-full aspect-square bg-surface-base overflow-hidden">
 <img
 src={imageUrl}
 alt={product.name}
 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
 onError={(e) => {
 const target = e.target as HTMLImageElement;
 target.src = `https://via.placeholder.com/300x300?text=${t.common.noImage.replace(' ', '+')}`;
 target.style.opacity = '0.5';
 }}
 />
 {isSelected && (
 <div className="absolute top-2 right-2 bg-brand-600 text-white rounded-full p-1.5 shadow-lg">
 <CheckCircle2 className="w-4 h-4" />
 </div>
 )}
 {quantity > 0 && (
 <div className="absolute top-2 left-2 bg-brand-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shadow-lg">
 {quantity}
 </div>
 )}
 </div>
 )}

 <div className="p-3 space-y-1">
 <h3 className="font-semibold text-sm text-content-primary text-left line-clamp-2 min-h-[2.5rem]">
 {product.name}
 </h3>

 {showVariantSelector && hasVariants && variantsToShow.length > 0 ? (
 <div className="space-y-2" onClick={e => e.stopPropagation()}>
 <select
 value={dropdownVariantId}
 onChange={e => setDropdownVariantId(e.target.value)}
 className="w-full text-xs rounded-lg border border-border-default bg-surface-raised text-content-primary px-2 py-1.5 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 >
 {variantsToShow.map(v => (
 <option key={v.id} value={v.id}>
 {v.name} — {(v.stock ?? 0)} {v.unit}
 </option>
 ))}
 </select>
 <button
 type="button"
 onClick={handleAddWithVariant}
 className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors"
 >
 <Plus className="w-3.5 h-3.5" /> {t.common.add}
 </button>
 </div>
 ) : (
 hasVariants && displayVariant && (
 <div className="text-xs text-brand-600 dark:text-brand-400 font-medium">
 {displayVariant.name}
 </div>
 )
 )}

 {!showVariantSelector && (
 <div className="flex items-center justify-between pt-1">
 <div className="flex flex-col">
 <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
 {displayPrice.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
 </span>
 <span className="text-xs text-content-muted">
 / {displayUnit}
 </span>
 </div>
 {displayStock > 0 ? (
 <div className="flex items-center gap-1 text-xs text-content-muted">
 <Package className="w-3 h-3" />
 <span>{displayStock}</span>
 </div>
 ) : (
 <div className="text-xs text-red-500 dark:text-red-400 font-medium">
 {t.common.outOfStock}
 </div>
 )}
 </div>
 )}

 {showVariantSelector && (
 <div className="flex items-center justify-between pt-1">
 <div className="flex flex-col">
 <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
 {displayPrice.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
 </span>
 <span className="text-[10px] text-content-muted">
 / {displayUnit}
 </span>
 </div>
 {quantity > 0 && (
 <div className="bg-brand-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs">
 {quantity}
 </div>
 )}
 </div>
 )}
 </div>
 </>
 );

 if (showVariantSelector && hasVariants) {
 return <div className={cardClassName}>{gridContent}</div>;
 }

 return (
 <button
 onClick={() => onSelect(product, displayVariant)}
 className={`${cardClassName} hover:shadow-lg`}
 >
 {gridContent}
 </button>
 );
};


