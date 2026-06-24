import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Product, ProductVariant } from '../../../core/types/types';
import { ShoppingCart, Package, Bell, X, Star, TrendingUp } from 'lucide-react';
import { getVariantImage } from '../../../core/utils/productUtils';
import { StarRating } from './StarRating';
import { ReviewModal } from './ReviewModal';
import { getProductRating, RatingStats } from '../../services/reviewService';

export const ProductCardSkeleton: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
 return (
 <div className="bg-surface-raised rounded-2xl overflow-hidden border border-border-default shadow-sm">
 <div className={`w-full ${isMobile ? 'h-40' : 'h-52'} bg-surface-base dark:bg-surface-base animate-pulse`} />
 <div className={`${isMobile ? 'p-3' : 'p-4'} space-y-3`}>
 <div className="h-4 bg-surface-base rounded-lg animate-pulse w-3/4" />
 <div className="h-3 bg-surface-base rounded-lg animate-pulse w-1/2" />
 {!isMobile && <div className="h-3 bg-surface-base rounded-lg animate-pulse w-full" />}
 <div className="h-5 bg-surface-base rounded-lg animate-pulse w-1/3 mt-2" />
 <div className="h-9 bg-surface-base rounded-lg animate-pulse w-full mt-1" />
 </div>
 </div>
 );
};

const ProductCardComponent: React.FC<{
 product: Product;
 onAddToCart: (product: Product, variant?: ProductVariant) => void;
 onNotify?: () => void;
 index?: number;
 isMobile?: boolean;
 showFeaturedBadge?: boolean;
 currentUserName?: string;
}> = ({ product, onAddToCart, onNotify, index = 0, isMobile = false, showFeaturedBadge = false, currentUserName }) => {
 const availableVariants = useMemo(() =>
 product.variants?.filter(v => v.stock > 0) || [],
 [product.variants]
 );

 const defaultVariant = useMemo(() =>
 product.variants?.find(v => v.isDefault && v.stock > 0) || availableVariants[0] || product.variants?.[0],
 [product.variants, availableVariants]
 );

 const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(defaultVariant);
 const [showVariantModal, setShowVariantModal] = useState(false);
 const [modalSelectedVariant, setModalSelectedVariant] = useState<ProductVariant | undefined>(defaultVariant);
 const [showReviewModal, setShowReviewModal] = useState(false);
 const [ratingStats, setRatingStats] = useState<RatingStats>({ average: 0, total: 0 });
 const hasVariants = product.variants && product.variants.length > 0;
 const hasTrackedViewRef = useRef(false);

 useEffect(() => {
 getProductRating(product.id).then(setRatingStats);
 }, [product.id]);

 useEffect(() => {
 const variantWithStock = availableVariants.length > 0
 ? availableVariants[0]
 : product.variants?.[0];
 setSelectedVariant(variantWithStock || defaultVariant);
 }, [product.id, availableVariants, defaultVariant]);

 useEffect(() => {
 if (hasTrackedViewRef.current) return;
 const observer = new IntersectionObserver(
 (entries) => {
 entries.forEach((entry) => {
 if (entry.isIntersecting && !hasTrackedViewRef.current) {
 hasTrackedViewRef.current = true;
 // @ts-ignore
 if (window.__trackProductView) {
 // @ts-ignore
 window.__trackProductView(product.id, product.name);
 }
 }
 });
 },
 { threshold: 0.5 }
 );
 const cardElement = document.querySelector(`[data-product-id="${product.id}"]`);
 if (cardElement) observer.observe(cardElement);
 return () => { if (cardElement) observer.unobserve(cardElement); };
 }, [product.id, product.name]);

 const handleAddToCart = () => {
 if (hasVariants && availableVariants.length > 1) {
 setModalSelectedVariant(availableVariants[0]);
 setShowVariantModal(true);
 } else {
 onAddToCart(product, selectedVariant);
 }
 };

 const handleConfirmAddFromModal = () => {
 if (modalSelectedVariant) {
 onAddToCart(product, modalSelectedVariant);
 setShowVariantModal(false);
 }
 };

 const handleNotify = () => { if (onNotify) onNotify(); };

 const currentPrice = selectedVariant?.price || product.price;
 const promoPrice = (product.promotionalPrice && product.promotionalPrice > 0 && product.promotionalPrice < currentPrice)
 ? product.promotionalPrice : null;
 const discountPct = promoPrice ? Math.round((1 - promoPrice / currentPrice) * 100) : 0;
 const currentStock = selectedVariant?.stock ?? product.variants?.[0]?.stock ?? product.stock ?? 0;
 const hasStock = currentStock > 0;
 const isLowStock = hasStock && currentStock <= 5;
 const displayName = selectedVariant?.name ? `${product.name} - ${selectedVariant.name}` : product.name;

 return (
 <div
 data-product-id={product.id}
 className="bg-surface-raised rounded-2xl overflow-hidden border border-border-default shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group flex flex-col"
 style={{ animationDelay: `${index * 50}ms` }}
 >
 {/* Imagem */}
 <Link to={`/loja/produto/${product.slug}`} className="block relative overflow-hidden flex-shrink-0">
 <div className={`relative w-full ${isMobile ? 'h-40' : 'h-52'} bg-surface-raised`}>
 {(() => {
 const imageUrl = getVariantImage(selectedVariant, product);
 return imageUrl && !imageUrl.includes('placeholder') ? (
 <img
 src={imageUrl}
 alt={displayName}
 className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out"
 loading="lazy"
 onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
 />
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 <Package className="w-14 h-14 opacity-20" style={{ color: 'var(--brand-600)' }} />
 </div>
 );
 })()}

 {/* Badge de desconto — circular, canto superior esquerdo */}
 {promoPrice ? (
 <div
 className="absolute top-3 left-3 w-11 h-11 rounded-full flex flex-col items-center justify-center shadow-md text-white leading-none"
 style={{ background: '#e53e3e' }}
 >
 <span className="text-[11px] font-black">{discountPct}%</span>
 <span className="text-[9px] font-bold tracking-wide">OFF</span>
 </div>
 ) : showFeaturedBadge && (
 <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-amber-900 text-[10px] font-bold shadow-sm bg-amber-400">
 <Star className="w-2.5 h-2.5 fill-current" />
 Destaque
 </div>
 )}

 {/* Badge categoria — canto superior direito */}
 {product.category && (
 <span
 className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm border bg-surface-raised/90 backdrop-blur-sm"
 style={{ color: 'var(--brand-700, var(--brand-600))', borderColor: 'color-mix(in srgb, var(--brand-600) 20%, transparent)' }}
 >
 {product.category}
 </span>
 )}

 {/* Stock overlay e badges */}
 {!hasStock && (
 <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
 <span className="text-white font-bold text-sm px-4 py-2 bg-red-600/95 rounded-full shadow-lg tracking-wide">Esgotado</span>
 </div>
 )}
 {isLowStock && (
 <div className="absolute bottom-2 left-0 right-0 flex justify-center">
 <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-orange-500/90 text-white shadow">Últimas {currentStock} unidade{currentStock !== 1 ? 's' : ''}</span>
 </div>
 )}
 </div>
 </Link>

 {/* Conteúdo */}
 <div className={`${isMobile ? 'p-3' : 'p-4'} flex flex-col flex-1`}>
 {/* Nome */}
 <Link to={`/loja/produto/${product.slug}`} className="block transition-colors mb-1" style={{ color: 'inherit' }}>
 <h3 className={`${isMobile ? 'text-sm' : 'text-sm sm:text-base'} font-semibold text-content-primary truncate leading-snug hover:opacity-80 transition-opacity`}>
 {product.name}
 </h3>
 </Link>

 {/* Rating + Vendas */}
 <div className="flex items-center justify-between mb-1.5">
 <button
 type="button"
 onClick={() => setShowReviewModal(true)}
 className="flex items-center gap-1 w-fit p-0 border-0 bg-transparent"
 aria-label="Ver avaliações"
 >
 <StarRating value={ratingStats.average} size="sm" />
 <span className="text-[11px] text-content-muted hover:opacity-80 transition-opacity">
 {ratingStats.total > 0 ? `(${ratingStats.total})` : 'Avaliar'}
 </span>
 </button>
 {(product.totalSold || 0) > 0 && (
 <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
 <TrendingUp className="w-3 h-3" />
 {product.totalSold! >= 1000 ? `${(product.totalSold! / 1000).toFixed(1)}k` : product.totalSold} vendas
 </span>
 )}
 </div>

 {/* Descrição — flex-1 garante que absorve o espaço extra,
 mantendo preço+botão sempre no fundo independente do texto */}
 <div className="flex-1 min-h-[2rem]">
 {product.description && (
 <p className={`text-content-muted leading-relaxed ${isMobile ? 'text-[11px] line-clamp-2' : 'text-xs line-clamp-2'}`}>
 {product.description}
 </p>
 )}
 </div>

 {/* Preço + Botão — sempre ancorado no fundo */}
 <div className="pt-2 flex flex-col gap-2.5">
 {/* Preços na mesma linha: original riscado + promo em destaque */}
 <div className="flex items-baseline gap-2 flex-wrap">
 {promoPrice ? (
 <>
 <span className="text-xs sm:text-sm line-through font-medium text-red-500">
 {currentPrice.toFixed(2)} MT
 </span>
 <span
 className={`${isMobile ? 'text-sm' : 'text-base sm:text-lg'} font-extrabold`}
 style={{ color: 'var(--brand-600)' }}
 >
 {promoPrice.toFixed(2)} MT
 </span>
 </>
 ) : (
 <span
 className={`${isMobile ? 'text-sm' : 'text-base sm:text-lg'} font-extrabold`}
 style={{ color: 'var(--brand-600)' }}
 >
 {currentPrice.toFixed(2)} MT
 </span>
 )}
 </div>

 {/* Botão largura total */}
 {hasStock ? (
 <button
 onClick={handleAddToCart}
 className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold uppercase tracking-wide transition-all duration-150 active:scale-95 shadow-sm hover:opacity-90"
 style={{ background: 'var(--brand-600)' }}
 >
 <ShoppingCart className="w-4 h-4 flex-shrink-0" />
 {isMobile ? 'Comprar' : 'Adicionar ao carrinho'}
 </button>
 ) : (
 <button
 onClick={handleNotify}
 className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-content-muted text-xs sm:text-sm font-bold uppercase tracking-wide border border-border-default bg-surface-base transition-all duration-150 hover:border-brand-300 cursor-not-allowed opacity-60"
 >
 <Bell className="w-4 h-4 flex-shrink-0" />
 Esgotado
 </button>
 )}
 </div>
 </div>

 {/* Modal de variante — Portal */}
 {showVariantModal && typeof document !== 'undefined' && createPortal(
 <>
 <div
 className="fixed inset-0 min-h-screen min-w-full z-[100] modal-overlay"
 onClick={() => setShowVariantModal(false)}
 aria-hidden="true"
 />
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
 <div
 className="relative w-full max-w-sm max-h-[90vh] overflow-hidden rounded-2xl bg-surface-raised shadow-xl flex flex-col border border-border-default"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-between p-4 border-b border-border-default">
 <h3 className="text-lg font-semibold text-content-primary">Escolher variante</h3>
 <button
 onClick={() => setShowVariantModal(false)}
 className="p-2 rounded-lg text-content-muted hover:bg-surface-base transition-colors"
 aria-label="Fechar"
 >
 <X className="h-5 w-5" />
 </button>
 </div>
 <div className="p-4 overflow-y-auto">
 <div className="flex gap-4 mb-4">
 <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-surface-base">
 {(() => {
 const imgUrl = getVariantImage(modalSelectedVariant, product);
 return imgUrl && !imgUrl.includes('placeholder') ? (
 <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" />
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 <Package className="w-8 h-8 text-content-muted" />
 </div>
 );
 })()}
 </div>
 <div className="flex-1 min-w-0">
 <h4 className="font-medium text-content-primary truncate">{product.name}</h4>
 </div>
 </div>
 <p className="text-sm text-content-muted mb-3">Selecione a opção desejada:</p>
 <div className="space-y-2">
 {availableVariants.map((v) => (
 <button
 key={v.id}
 onClick={() => setModalSelectedVariant(v)}
 className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors border-2 ${
 modalSelectedVariant?.id === v.id
 ? 'text-content-primary'
 : 'border-border-default bg-surface-base hover:bg-surface-raised text-content-secondary'
 }`}
 style={modalSelectedVariant?.id === v.id ? {
 borderColor: 'var(--brand-600)',
 background: 'color-mix(in srgb, var(--brand-600) 8%, transparent)'
 } : undefined}
 >
 <span className="font-medium">{v.name}</span>
 <span className="text-sm font-semibold" style={{ color: 'var(--brand-600)' }}>
 {v.price.toFixed(2)} MT
 </span>
 </button>
 ))}
 </div>
 </div>
 <div className="p-4 border-t border-border-default flex gap-3">
 <button
 onClick={() => setShowVariantModal(false)}
 className="flex-1 px-4 py-2.5 rounded-xl border border-border-default text-content-secondary font-medium hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 <button
 onClick={handleConfirmAddFromModal}
 disabled={!modalSelectedVariant}
 className="flex-1 px-4 py-2.5 rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
 style={{ background: 'var(--brand-600)' }}
 >
 <ShoppingCart className="h-4 w-4" />
 Adicionar ao carrinho
 </button>
 </div>
 </div>
 </div>
 </>,
 document.body
 )}

 {/* Modal de avaliações */}
 {showReviewModal && (
 <ReviewModal
 productId={product.id}
 productName={product.name}
 currentUserName={currentUserName}
 onClose={() => setShowReviewModal(false)}
 onStatsChange={setRatingStats}
 />
 )}
 </div>
 );
};

export const ProductCard = memo(ProductCardComponent, (prevProps, nextProps) => {
 const prevStock = prevProps.product.variants?.reduce((s, v) => s + (v.stock ?? 0), 0) ?? prevProps.product.stock ?? 0;
 const nextStock = nextProps.product.variants?.reduce((s, v) => s + (v.stock ?? 0), 0) ?? nextProps.product.stock ?? 0;
 return (
 prevProps.product.id === nextProps.product.id &&
 prevProps.product.price === nextProps.product.price &&
 prevProps.product.promotionalPrice === nextProps.product.promotionalPrice &&
 prevStock === nextStock &&
 prevProps.isMobile === nextProps.isMobile &&
 prevProps.showFeaturedBadge === nextProps.showFeaturedBadge &&
 prevProps.onAddToCart === nextProps.onAddToCart
 );
});
