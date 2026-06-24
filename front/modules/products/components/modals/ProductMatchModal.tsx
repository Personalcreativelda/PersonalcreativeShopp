import React, { useState, useMemo } from 'react';
import { Product, ProductVariant } from '../../../core/types/types';
import { Modal } from '../shared/Modal';
import { Search } from 'lucide-react';
import { normalizeForSearch } from '../../../core/services/serviceUtils';

interface ProductMatchModalProps {
 open: boolean;
 stockIndex: number;
 itemIndex: number;
 searchQuery: string;
 products: Product[];
 onMatch: (product: Product, variant?: ProductVariant) => void;
 onClose: () => void;
}

export const ProductMatchModal: React.FC<ProductMatchModalProps> = ({
 open,
 searchQuery,
 products,
 onMatch,
 onClose,
}) => {
 const [localSearch, setLocalSearch] = useState(searchQuery);

 const filteredProducts = useMemo(() => {
 if (!localSearch.trim()) return products.slice(0, 50);
 const q = normalizeForSearch(localSearch);
 return products.filter(
 (p) =>
 normalizeForSearch(p.name).includes(q) ||
 (p.category && normalizeForSearch(p.category).includes(q))
 ).slice(0, 50);
 }, [products, localSearch]);

 if (!open) return null;

 const handleSelect = (product: Product, variant?: ProductVariant) => {
 onMatch(product, variant);
 onClose();
 };

 return (
 <Modal
 open={open}
 onClose={onClose}
 title="Associar a produto"
 maxWidth="md"
 >
 <div className="space-y-4">
 <p className="text-sm text-content-secondary">
 Texto original: <strong className="text-content-primary">{searchQuery}</strong>
 </p>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
 <input
 type="text"
 value={localSearch}
 onChange={(e) => setLocalSearch(e.target.value)}
 placeholder="Pesquisar produtos..."
 className="w-full pl-10 pr-4 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500"
 />
 </div>
 <div className="max-h-64 overflow-y-auto space-y-1 border border-border-default rounded-lg p-2">
 {filteredProducts.length === 0 ? (
 <p className="text-sm text-content-muted py-4 text-center">Nenhum produto encontrado.</p>
 ) : (
 filteredProducts.map((product) => {
 const hasVariants = product.variants && product.variants.length > 0;
 if (hasVariants && product.variants) {
 return (
 <div key={product.id} className="space-y-0.5">
 <div className="text-xs font-medium text-content-muted px-2 py-1">
 {product.name}
 </div>
 {product.variants.map((v) => (
 <button
 key={v.id}
 type="button"
 onClick={() => handleSelect(product, v)}
 className="w-full text-left px-4 py-2 rounded-lg hover:bg-surface-base text-sm text-content-primary"
 >
 {v.name} – {v.unit}
 </button>
 ))}
 </div>
 );
 }
 return (
 <button
 key={product.id}
 type="button"
 onClick={() => handleSelect(product)}
 className="w-full text-left px-4 py-2 rounded-lg hover:bg-surface-base text-sm text-content-primary"
 >
 {product.name} – {product.unit}
 </button>
 );
 })
 )}
 </div>
 </div>
 </Modal>
 );
};
