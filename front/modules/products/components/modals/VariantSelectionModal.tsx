import React, { useEffect, useState } from 'react';
import { getStockSnapshotDate } from '../../../core/utils/dateUtils';
import { Product, ProductVariant } from '../../../core/types/types';
import { Modal } from '../shared/Modal';
import { stockReportService } from '../../services/stockReportService';

interface VariantSelectionModalProps {
 open: boolean;
 product: Product | null;
 onSelect: (product: Product, variant: ProductVariant) => void;
 onClose: () => void;
 isProductSelected: (product: Product, variantId: string) => boolean;
 getSelectedQuantity: (product: Product, variantId: string) => number;
 /** Usar stock calculado (get_stock_period_summary) em vez de variant.stock — evita discrepância no modal de ajuste */
 useCalculatedStock?: boolean;
}

function formatMoney(value: number) {
 return value.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' }).replace(/MZN/gi, 'MT');
}

export const VariantSelectionModal: React.FC<VariantSelectionModalProps> = ({
 open,
 product,
 onSelect,
 onClose,
 isProductSelected,
 getSelectedQuantity,
 useCalculatedStock = false,
}) => {
 const [stockMap, setStockMap] = useState<Record<string, number>>({});
 const [loadingStock, setLoadingStock] = useState(false);

 useEffect(() => {
 if (!open || !product?.variants?.length || !useCalculatedStock) {
 setStockMap({});
 return;
 }
 let cancelled = false;
 setLoadingStock(true);
 const snapshotDate = getStockSnapshotDate();
 stockReportService.getCurrentStockSummary(snapshotDate).then(rows => {
 if (cancelled) return;
 const map: Record<string, number> = {};
 for (const v of product.variants) {
 const row = rows.find(r => r.variantId === v.id);
 map[v.id] = row != null ? row.finalStock : 0;
 }
 setStockMap(map);
 }).finally(() => {
 if (!cancelled) setLoadingStock(false);
 });
 return () => { cancelled = true; };
 }, [open, product?.id, useCalculatedStock]);

 if (!open || !product || !product.variants?.length) return null;

 return (
 <Modal open={open} onClose={onClose} title={`Selecione a Variação: ${product.name}`} maxWidth="md">
 <div className="space-y-2">
 {product.variants.map((variant) => {
 const isSelected = isProductSelected(product, variant.id);
 const quantity = getSelectedQuantity(product, variant.id);
 const variantImage = variant.image || product.image;
 const displayStock = useCalculatedStock
 ? (loadingStock ? null : (stockMap[variant.id] ?? 0))
 : (variant.stock ?? 0);

 return (
 <button
 key={variant.id}
 type="button"
 onClick={() => {
 onSelect(product, variant);
 onClose();
 }}
 className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
 isSelected
 ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/20'
 : 'border-border-default hover:border-brand-300 dark:hover:border-brand-600'
 }`}
 >
 <div className="flex items-center gap-3">
 {variantImage && (
 <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-surface-base">
 <img
 src={variantImage}
 alt={variant.name}
 className="w-full h-full object-cover"
 onError={(e) => {
 const target = e.target as HTMLImageElement;
 target.style.display = 'none';
 }}
 />
 </div>
 )}
 <div className="flex-1 flex items-center justify-between">
 <div>
 <div className="font-semibold text-content-primary">{variant.name}</div>
 <div className="text-sm text-content-muted">
 {formatMoney(variant.price)} / {variant.unit}
 </div>
 <div className={`text-xs font-medium ${
 displayStock != null && displayStock < 0
 ? 'text-red-600 dark:text-red-400'
 : displayStock != null && displayStock === 0
 ? 'text-amber-600 dark:text-amber-400'
 : 'text-content-muted'
 }`}>
 Stock: {displayStock != null ? displayStock : '...'} {variant.unit}
 </div>
 </div>
 {isSelected && (
 <div className="text-brand-600 dark:text-brand-400 font-bold">{quantity}x</div>
 )}
 </div>
 </div>
 </button>
 );
 })}
 </div>
 <div className="mt-4">
 <button
 type="button"
 onClick={onClose}
 className="w-full px-4 py-2 bg-surface-base text-content-secondary rounded-lg hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 </div>
 </Modal>
 );
};
