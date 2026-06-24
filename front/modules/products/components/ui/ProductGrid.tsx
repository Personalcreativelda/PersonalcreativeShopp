import React, { useMemo, useState } from 'react';
import { Product, ProductVariant, OrderItem } from '../../../core/types/types';
import { ProductCard } from './ProductSelectionCard';
import { VariantSelectionModal } from '../modals/VariantSelectionModal';
import { Search, Filter, X } from 'lucide-react';
import { normalizeForSearch } from '../../../core/services/serviceUtils';

interface ProductGridProps {
 products: Product[];
 selectedItems: OrderItem[];
 onSelectProduct: (product: Product, variant?: ProductVariant) => void;
 searchQuery: string;
 onSearchChange: (query: string) => void;
 viewMode?: 'grid' | 'list';
 /** Ocultar imagens dos cartões (ex.: modal novo pedido) */
 showThumbnails?: boolean;
 /** Mostrar dropdown de variação no cartão em vez de abrir modal ao clicar */
 showVariantSelector?: boolean;
 /** Ocultar filtro de categorias (ex.: modal novo pedido) */
 showCategoryFilter?: boolean;
 /** Incluir variações com stock 0 (ex.: compras) */
 includeZeroStockVariants?: boolean;
 /** Mostrar lista de produtos apenas quando houver texto na pesquisa (ex.: modal ajuste de stock) */
 showProductListOnlyWhenSearching?: boolean;
 /** No modal de variantes, usar stock calculado em vez de variant.stock (ex.: ajuste de stock) */
 useCalculatedStockForVariants?: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
 products,
 selectedItems,
 onSelectProduct,
 searchQuery,
 onSearchChange,
 viewMode = 'grid',
 showThumbnails = true,
 showVariantSelector = false,
 showCategoryFilter = true,
 includeZeroStockVariants = false,
 showProductListOnlyWhenSearching = false,
 useCalculatedStockForVariants = false,
}) => {
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [showVariantModal, setShowVariantModal] = useState<{
 isOpen: boolean;
 product: Product | null;
 }>({ isOpen: false, product: null });

 // Extrair categorias únicas
 const categories = useMemo(() => {
 const cats = new Set<string>();
 products.forEach(p => {
 if (p.category) cats.add(p.category);
 });
 return Array.from(cats).sort();
 }, [products]);

 // Filtrar produtos
 const filteredProducts = useMemo(() => {
 let filtered = products;

 // Filtro por busca
 if (searchQuery.trim()) {
 const query = normalizeForSearch(searchQuery);
 filtered = filtered.filter(p =>
 normalizeForSearch(p.name).includes(query) ||
 (p.category && normalizeForSearch(p.category).includes(query))
 );
 }

 // Filtro por categoria (apenas se o filtro estiver visível)
 if (showCategoryFilter && selectedCategory !== 'all') {
 filtered = filtered.filter(p => p.category === selectedCategory);
 }

 return filtered;
 }, [products, searchQuery, selectedCategory, showCategoryFilter]);

 // Verificar se produto esté¡ selecionado
 const isProductSelected = (product: Product, variantId?: string) => {
 return selectedItems.some(
 item => item.productId === product.id &&
 (variantId ? item.variantId === variantId : !item.variantId)
 );
 };

 // Obter quantidade selecionada
 const getSelectedQuantity = (product: Product, variantId?: string) => {
 const item = selectedItems.find(
 item => item.productId === product.id &&
 (variantId ? item.variantId === variantId : !item.variantId)
 );
 return item?.quantity || 0;
 };

 // Handler para seleçéo de produto
 const handleProductSelect = (product: Product, variant?: ProductVariant) => {
 // Com showVariantSelector, a variação já vem selecionada do dropdown; sem ele, abrir modal se tiver variações
 if (!showVariantSelector && product.variants && product.variants.length > 0 && !variant) {
 setShowVariantModal({ isOpen: true, product });
 } else {
 onSelectProduct(product, variant);
 }
 };

 return (
 <div className="space-y-4">
 {/* Barra de Busca e Filtros */}
 <div className="space-y-3">
 {/* Busca */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-content-muted" />
 <input
 type="text"
 placeholder="Buscar produtos..."
 value={searchQuery}
 onChange={(e) => onSearchChange(e.target.value)}
 className="w-full pl-10 pr-10 py-3 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-brand-500 focus:border-transparent"
 />
 {searchQuery && (
 <button
 onClick={() => onSearchChange('')}
 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-content-muted hover:text-content-secondary "
 >
 <X className="w-5 h-5" />
 </button>
 )}
 </div>

 {/* Filtro de Categoria (opcional) */}
 {showCategoryFilter && categories.length > 0 && (
 <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
 <Filter className="w-4 h-4 text-content-muted flex-shrink-0" />
 <button
 onClick={() => setSelectedCategory('all')}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === 'all'
 ? 'bg-brand-600 text-white'
 : 'bg-surface-base text-content-secondary hover:bg-surface-base'
 }`}
 >
 Todas
 </button>
 {categories.map(category => (
 <button
 key={category}
 onClick={() => setSelectedCategory(category)}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === category
 ? 'bg-brand-600 text-white'
 : 'bg-surface-base text-content-secondary hover:bg-surface-base'
 }`}
 >
 {category}
 </button>
 ))}
 </div>
 )}
 </div>

 {/* Grid/List de Produtos */}
 {showProductListOnlyWhenSearching && !searchQuery.trim() ? (
 <div className="text-center py-12 text-content-muted border border-dashed border-border-default rounded-lg">
 <p className="text-lg font-medium mb-2">Pesquise para ver produtos</p>
 <p className="text-sm">Digite na caixa de pesquisa acima para listar os produtos disponíveis</p>
 </div>
 ) : filteredProducts.length > 0 ? (
 <div className={viewMode === 'list'
 ? "flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar"
 : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar"
 }>
 {filteredProducts.map(product => {
 const hasVariants = product.variants && product.variants.length > 0;
 const defaultVariant = product.variants?.find(v => v.isDefault) || product.variants?.[0];

 // Verificar se alguma variaçéo esté¡ selecionada
 const selectedVariantId = selectedItems.find(
 item => item.productId === product.id
 )?.variantId;

 const isSelected = isProductSelected(product, selectedVariantId);
 const quantity = getSelectedQuantity(product, selectedVariantId);

 return (
 <div key={product.id} className="w-full">
 <ProductCard
 product={product}
 isSelected={isSelected}
 selectedVariantId={selectedVariantId}
 onSelect={handleProductSelect}
 quantity={quantity}
 viewMode={viewMode}
 showThumbnail={showThumbnails}
 showVariantSelector={showVariantSelector}
 includeZeroStockVariants={includeZeroStockVariants}
 />
 </div>
 );
 })}
 </div>
 ) : (
 <div className="text-center py-12 text-content-muted">
 <p className="text-lg font-medium mb-2">Nenhum produto encontrado</p>
 <p className="text-sm">Tente ajustar os filtros de busca</p>
 </div>
 )}

 <VariantSelectionModal
 open={showVariantModal.isOpen}
 product={showVariantModal.product}
 onSelect={onSelectProduct}
 onClose={() => setShowVariantModal({ isOpen: false, product: null })}
 isProductSelected={isProductSelected}
 getSelectedQuantity={getSelectedQuantity}
 useCalculatedStock={useCalculatedStockForVariants}
 />
 </div>
 );
};


