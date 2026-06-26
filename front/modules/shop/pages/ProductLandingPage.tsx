import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ShoppingCart, Heart, Star, Truck, Shield,
    RotateCcw, Check, Loader2, Package, ArrowLeft,
} from 'lucide-react';
import { Product, ProductVariant } from '../../core/types/types';
import { productService } from '../../products/services/productService';
import { getVariantImage } from '../../core/utils/productUtils';
import { useShopContext } from '../../../contexts/ShopContext';
import {
    getProductRating,
    getProductReviews,
    ProductReview,
    RatingStats,
} from '../../products/services/reviewService';
import uploadService from '../../../services/uploadService';
import { ProductCarousel } from '../components/ProductCarousel';

interface CartItem {
    productId: string;
    productName: string;
    variantId?: string;
    variantName?: string;
    quantity: number;
    price: number;
    unit: string;
    image?: string;
}

export const ProductLandingPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
    const [quantity, setQuantity] = useState(1);
    const [selectedTab, setSelectedTab] = useState<'description' | 'benefits' | 'usage' | 'ingredients'>('description');
    const [selectedImage, setSelectedImage] = useState('');
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
    const [wishlist, setWishlist] = useState(false);
    const [cartFeedback, setCartFeedback] = useState<'success' | 'error' | null>(null);

    const navigate = useNavigate();
    const shopContext = useShopContext();

    useEffect(() => {
        const loadProduct = async () => {
            if (!slug) return;
            setLoading(true);
            try {
                const p = await productService.getProductBySlug(slug);
                if (p) {
                    setProduct(p);
                    const defaultV = p.variants?.find(v => v.isDefault) || p.variants?.[0];
                    setSelectedVariant(defaultV);
                    setSelectedImage(getVariantImage(defaultV, p));
                    const [stats, reviewList, allProducts] = await Promise.all([
                        getProductRating(p.id),
                        getProductReviews(p.id),
                        productService.getProducts(),
                    ]);
                    setRatingStats(stats);
                    setReviews(reviewList.slice(0, 5));
                    const related = allProducts
                        .filter(pr => pr.id !== p.id && pr.category === p.category && pr.showInShop)
                        .slice(0, 4);
                    setRelatedProducts(related);
                }
            } catch {
                console.error('Erro ao carregar produto');
            } finally {
                setLoading(false);
            }
        };
        loadProduct();
    }, [slug]);

    const handleAddToCart = useCallback(() => {
        if (!product) return;
        const variantToUse = selectedVariant || product.variants?.find(v => v.isDefault) || product.variants?.[0];
        const price = variantToUse?.price ?? product.price;
        const stock = variantToUse?.stock ?? product.stock ?? 0;
        const unit = variantToUse?.unit || product.unit || '';
        const variantId = variantToUse?.id;
        const variantName = variantToUse?.name;

        if (stock <= 0) {
            setCartFeedback('error');
            setTimeout(() => setCartFeedback(null), 2000);
            return;
        }

        const savedCart: CartItem[] = JSON.parse(localStorage.getItem('shop_cart') || '[]');
        const existingItem = savedCart.find(
            item => item.productId === product.id && item.variantId === variantId
        );

        let updatedCart: CartItem[];
        if (existingItem) {
            if (existingItem.quantity + quantity > stock) {
                setCartFeedback('error');
                setTimeout(() => setCartFeedback(null), 2000);
                return;
            }
            updatedCart = savedCart.map(item =>
                item.productId === product.id && item.variantId === variantId
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
            );
        } else {
            updatedCart = [...savedCart, {
                productId: product.id,
                productName: product.name,
                variantId,
                variantName,
                quantity,
                price,
                unit,
                image: product.image,
            }];
        }

        localStorage.setItem('shop_cart', JSON.stringify(updatedCart));
        shopContext.setCartItemCount(updatedCart.reduce((s, i) => s + i.quantity, 0));
        setCartFeedback('success');
        setTimeout(() => setCartFeedback(null), 2000);
    }, [product, selectedVariant, quantity, shopContext]);

    const displayPrice = (selectedVariant?.price ?? product?.price ?? 0).toFixed(2);
    const basePrice = selectedVariant?.price ?? product?.price ?? 0;
    const promoPrice = product?.promotionalPrice && product.promotionalPrice > 0 && product.promotionalPrice < basePrice
        ? product.promotionalPrice : null;
    const promoPct = promoPrice ? Math.round((1 - promoPrice / basePrice) * 100) : 0;

    const galleryImages: string[] = product
        ? [
            getVariantImage(selectedVariant, product),
            product.image,
            product.image2,
            product.image3,
            product.image4,
            ...(product.variants?.map(v => v.image).filter((img): img is string => Boolean(img)) ?? []),
        ].filter((img, i, arr) => Boolean(img) && arr.indexOf(img) === i && !img.includes('placeholder'))
        : [];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-base">
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--brand-600)' }} />
            </div>
        );
    }

    if (!product) return null;

    return (
        <div className="min-h-screen bg-surface-base">
            {/* Breadcrumb / Voltar */}
            <div className="max-w-7xl mx-auto px-4 pt-5 pb-0">
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-1.5 text-sm text-content-muted transition-colors group hover:opacity-80"
                    style={{ color: undefined }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-600)')}
                    onMouseLeave={e => (e.currentTarget.style.color = '')}
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    Voltar à Loja
                </button>
            </div>

            {/* Product Section */}
            <section className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Gallery */}
                    <div>
                        <div className="bg-white rounded-xl overflow-hidden shadow-md mb-4 aspect-square flex items-center justify-center border border-border-default">
                            <img
                                src={selectedImage ? uploadService.getPublicUrl(selectedImage) : (galleryImages[0] ? uploadService.getPublicUrl(galleryImages[0]) : 'https://via.placeholder.com/600?text=Sem+Imagem')}
                                alt={product.name}
                                className="w-full h-full object-contain p-6"
                            />
                        </div>
                        {galleryImages.length > 1 && (
                            <div className="flex gap-3 flex-wrap">
                                {galleryImages.slice(0, 4).map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedImage(img)}
                                        className="w-20 h-20 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 bg-white"
                                        style={selectedImage === img
                                            ? { borderColor: 'var(--brand-600)' }
                                            : { borderColor: 'var(--border-default, #e5e7eb)' }
                                        }
                                    >
                                        <img src={uploadService.getPublicUrl(img)} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product Info */}
                    <div>
                        {/* Category badge */}
                        <span
                            className="inline-block px-3 py-1 rounded-full text-sm mb-3 font-medium"
                            style={{
                                background: 'color-mix(in srgb, var(--brand-600) 12%, transparent)',
                                color: 'var(--brand-600)',
                            }}
                        >
                            {product.category || 'Natural'}
                        </span>

                        <h1 className="text-4xl text-content-primary mb-3 leading-tight font-bold">{product.name}</h1>

                        {/* Stars */}
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex items-center">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <Star
                                        key={star}
                                        className={`w-5 h-5 ${star <= Math.round(ratingStats?.average ?? 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                                    />
                                ))}
                            </div>
                            <span className="text-content-muted text-sm">
                                {ratingStats && ratingStats.total > 0
                                    ? `${ratingStats.average.toFixed(1)} (${ratingStats.total} avaliações)`
                                    : 'Sem avaliações ainda'}
                            </span>
                        </div>

                        {/* Price */}
                        <div className="flex flex-wrap items-center gap-3 mb-5">
                            {promoPrice ? (
                                <>
                                    <span className="text-5xl font-bold" style={{ color: 'var(--brand-600)' }}>
                                        {promoPrice.toFixed(2)}
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="text-xl text-red-500 font-semibold line-through">{displayPrice} MT</span>
                                        <span className="text-sm font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full w-fit">-{promoPct}%</span>
                                    </div>
                                    <span className="text-2xl text-content-muted">MT</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-5xl font-bold" style={{ color: 'var(--brand-600)' }}>{displayPrice}</span>
                                    <span className="text-2xl text-content-muted">MT</span>
                                </>
                            )}
                        </div>

                        {/* Stock status indicator */}
                        {(() => {
                            const stock = selectedVariant?.stock ?? product.stock ?? 0;
                            if (stock <= 0) return (
                                <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                    <span className="text-sm font-semibold text-red-700 dark:text-red-400">Produto Esgotado</span>
                                </div>
                            );
                            if (stock <= 5) return (
                                <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                                    <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">Últimas {stock} unidade{stock !== 1 ? 's' : ''} disponíveis</span>
                                </div>
                            );
                            return (
                                <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
                                    <span className="text-sm font-semibold text-green-700 dark:text-green-400">Em stock ({stock} disponíveis)</span>
                                </div>
                            );
                        })()}

                        <p className="text-content-secondary leading-relaxed mb-6">{product.description}</p>

                        {/* Variants */}
                        {product.variants && product.variants.length > 0 && (
                            <div className="mb-6">
                                <p className="text-content-primary mb-3 font-medium">Escolha a variação:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {product.variants.map(v => {
                                        const variantStock = v.stock ?? 0;
                                        const hasVStock = variantStock > 0;
                                        const variantImage = v.image || product.image;
                                        const variantImageUrl = variantImage ? uploadService.getPublicUrl(variantImage) : '';
                                        const isSelected = selectedVariant?.id === v.id;

                                        return (
                                            <button
                                                key={v.id}
                                                onClick={() => {
                                                    if (hasVStock) {
                                                        setSelectedVariant(v);
                                                        setSelectedImage(getVariantImage(v, product));
                                                    }
                                                }}
                                                disabled={!hasVStock}
                                                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                                                    !hasVStock ? 'border-border-default bg-surface-base opacity-60 cursor-not-allowed' : ''
                                                }`}
                                                style={isSelected
                                                    ? { borderColor: 'var(--brand-600)', background: 'color-mix(in srgb, var(--brand-600) 8%, transparent)' }
                                                    : hasVStock
                                                        ? { borderColor: 'var(--border-default, #e5e7eb)' }
                                                        : undefined
                                                }
                                            >
                                                {variantImage && (
                                                    <div className="w-16 h-16 rounded-md overflow-hidden bg-surface-base flex-shrink-0">
                                                        <img
                                                            src={variantImageUrl}
                                                            alt={v.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex-1 text-left">
                                                    <p className="font-medium text-content-primary">{v.name}</p>
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--brand-600)' }}>
                                                        {v.price ? `${v.price.toFixed(2)} MT` : `${product.price.toFixed(2)} MT`}
                                                        {v.unit && ` / ${v.unit}`}
                                                    </p>
                                                    <p className={`text-xs mt-0.5 font-medium ${!hasVStock ? 'text-red-500' : variantStock <= 5 ? 'text-orange-500' : 'text-green-600 dark:text-green-400'}`}>
                                                        {!hasVStock ? 'Esgotado' : variantStock <= 5 ? `Últimas ${variantStock}` : `${variantStock} disponíveis`}
                                                    </p>
                                                </div>
                                                {isSelected && (
                                                    <Check className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--brand-600)' }} />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Quantity + Add to Cart */}
                        <div className="border-t border-b border-border-default py-6 mb-6">
                            <div className="flex items-center gap-4 mb-4">
                                <span className="text-content-primary font-medium">Quantidade:</span>
                                <div className="flex items-center border border-border-default rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                        className="px-4 py-2 hover:bg-surface-base transition-colors text-content-primary font-bold"
                                    >
                                        -
                                    </button>
                                    <span className="px-6 py-2 border-x border-border-default text-content-primary">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(q => q + 1)}
                                        className="px-4 py-2 hover:bg-surface-base transition-colors text-content-primary font-bold"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                {(() => {
                                    const currentStock = selectedVariant?.stock ?? product.stock ?? 0;
                                    const hasStock = currentStock > 0;
                                    return hasStock ? (
                                        <button
                                            onClick={handleAddToCart}
                                            disabled={cartFeedback !== null}
                                            className="flex-1 py-4 rounded-lg flex items-center justify-center gap-2 font-semibold shadow-md transition-all text-white"
                                            style={{
                                                background: cartFeedback === 'error' ? '#ef4444' : 'var(--brand-600)',
                                                opacity: cartFeedback !== null ? 0.9 : 1,
                                            }}
                                        >
                                            {cartFeedback === 'success' ? (
                                                <><Check className="w-5 h-5" /> Adicionado!</>
                                            ) : cartFeedback === 'error' ? (
                                                <><Package className="w-5 h-5" /> Stock insuficiente</>
                                            ) : (
                                                <><ShoppingCart className="w-5 h-5" /> Adicionar ao Carrinho</>
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            disabled
                                            className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 py-4 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed font-semibold border border-red-200 dark:border-red-800"
                                        >
                                            <Package className="w-5 h-5" />
                                            Produto Esgotado
                                        </button>
                                    );
                                })()}
                                <button
                                    onClick={() => setWishlist(w => !w)}
                                    className="border-2 p-4 rounded-lg transition-colors"
                                    style={wishlist
                                        ? { borderColor: '#f87171', background: '#fef2f2', color: '#ef4444' }
                                        : { borderColor: 'var(--brand-600)', color: 'var(--brand-600)' }
                                    }
                                >
                                    <Heart className={`w-5 h-5 ${wishlist ? 'fill-current' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Benefit boxes */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {[
                                { icon: Truck, title: 'Entrega Rápida', sub: 'Todo o país' },
                                { icon: Shield, title: '100% Natural', sub: 'Certificado' },
                                { icon: RotateCcw, title: 'Garantia', sub: '30 dias' },
                            ].map(({ icon: Icon, title, sub }) => (
                                <div
                                    key={title}
                                    className="text-center p-4 rounded-lg"
                                    style={{ background: 'color-mix(in srgb, var(--brand-600) 8%, transparent)' }}
                                >
                                    <Icon className="w-6 h-6 mx-auto mb-1" style={{ color: 'var(--brand-600)' }} />
                                    <p className="text-xs font-medium text-content-primary">{title}</p>
                                    <p className="text-xs text-content-muted">{sub}</p>
                                </div>
                            ))}
                        </div>

                        {/* Product info checklist */}
                        <div className="bg-surface-raised rounded-lg p-5 border border-border-default">
                            <h3 className="text-base font-semibold text-content-primary mb-3">Informações do Produto</h3>
                            <ul className="space-y-2">
                                {([
                                    '100% natural e sem aditivos artificiais',
                                    'Selecionado e testado com rigor de qualidade',
                                    'Produção sustentável e responsável',
                                    `Categoria: ${product.category || 'Natural'}`,
                                    product.variants && product.variants.length > 0
                                        ? `${product.variants.length} variantes disponíveis`
                                        : null,
                                ] as (string | null)[])
                                    .filter((item): item is string => item !== null)
                                    .map((item, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--brand-600)' }} />
                                            <span className="text-content-secondary text-sm">{item}</span>
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tabs Section */}
            <section className="max-w-7xl mx-auto px-4 py-10">
                <div className="bg-surface-raised rounded-lg shadow-sm overflow-hidden border border-border-default">
                    <div className="border-b border-border-default flex flex-wrap">
                        {(
                            [
                                { key: 'description', label: 'Descrição' },
                                { key: 'benefits', label: 'Características' },
                                { key: 'usage', label: 'Aplicação' },
                                { key: 'ingredients', label: 'Especificações' },
                            ] as const
                        ).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setSelectedTab(key)}
                                className="px-7 py-4 text-sm transition-colors font-medium"
                                style={selectedTab === key
                                    ? { borderBottom: '2px solid var(--brand-600)', color: 'var(--brand-600)', marginBottom: '-1px' }
                                    : { color: 'var(--text-secondary, #4b5563)' }
                                }
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="p-8">
                        {selectedTab === 'description' && (
                            <p className="text-content-secondary leading-relaxed whitespace-pre-line">
                                {(product as any).descriptionLong || (product as any).description || 'Sem descrição disponível.'}
                            </p>
                        )}
                        {selectedTab === 'benefits' && (
                            (product as any).benefits ? (
                                <div className="space-y-3">
                                    {((product as any).benefits as string).split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--brand-600)' }} />
                                            <span className="text-content-secondary text-sm">{line.trim()}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-content-muted text-sm">Sem informação de características disponível.</p>
                            )
                        )}
                        {selectedTab === 'usage' && (
                            (product as any).howToUse ? (
                                <ol className="space-y-4">
                                    {((product as any).howToUse as string).split('\n').filter((l: string) => l.trim()).map((step: string, i: number) => (
                                        <li key={i} className="flex gap-4 items-start">
                                            <span
                                                className="flex-shrink-0 w-8 h-8 text-white rounded-full flex items-center justify-center text-sm font-bold"
                                                style={{ background: 'var(--brand-600)' }}
                                            >
                                                {i + 1}
                                            </span>
                                            <p className="text-content-secondary pt-1 text-sm leading-relaxed">{step.trim()}</p>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <p className="text-content-muted text-sm">Sem informações de aplicação disponíveis.</p>
                            )
                        )}
                        {selectedTab === 'ingredients' && (
                            (product as any).ingredients ? (
                                <p className="text-content-secondary leading-relaxed whitespace-pre-line">
                                    {(product as any).ingredients}
                                </p>
                            ) : (
                                <p className="text-content-muted text-sm">Sem especificações técnicas disponíveis.</p>
                            )
                        )}
                    </div>
                </div>
            </section>

            {/* Reviews Section */}
            <section className="max-w-7xl mx-auto px-4 py-10">
                <div className="bg-surface-raised rounded-lg shadow-sm p-8 border border-border-default">
                    <h2 className="text-2xl font-semibold text-content-primary mb-6">Avaliações de Clientes</h2>
                    {ratingStats && ratingStats.total > 0 ? (
                        <>
                            <div className="flex flex-col sm:flex-row items-start gap-8 mb-8 pb-8 border-b border-border-default">
                                <div className="text-center flex-shrink-0">
                                    <div className="text-5xl font-bold text-content-primary mb-1">{ratingStats.average.toFixed(1)}</div>
                                    <div className="flex justify-center mb-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <Star key={star} className={`w-4 h-4 ${star <= Math.round(ratingStats.average) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                        ))}
                                    </div>
                                    <p className="text-content-muted text-xs">{ratingStats.total} avaliações</p>
                                </div>
                                <div className="flex-1 w-full">
                                    {[5, 4, 3, 2, 1].map(star => {
                                        const count = reviews.filter(r => r.rating === star).length;
                                        const pct = ratingStats.total > 0 ? Math.round((count / ratingStats.total) * 100) : 0;
                                        return (
                                            <div key={star} className="flex items-center gap-3 mb-1.5">
                                                <span className="text-xs text-content-muted w-6">{star}★</span>
                                                <div className="flex-1 h-2 bg-surface-base rounded-full overflow-hidden">
                                                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="text-xs text-content-muted w-5">{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="space-y-6">
                                {reviews.map((review, i) => (
                                    <div key={review.id || i} className="border-b border-border-default pb-5 last:border-0">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white"
                                                    style={{ background: 'var(--brand-600)' }}
                                                >
                                                    {(review.user_name?.[0] ?? '?').toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-content-primary text-sm">{review.user_name}</p>
                                                    <div className="flex">
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <Star key={star} className={`w-3.5 h-3.5 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs text-content-muted">{new Date(review.created_at).toLocaleDateString('pt-PT')}</span>
                                        </div>
                                        <p className="text-content-secondary text-sm leading-relaxed pl-13">{review.comment}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-10">
                            <Package className="w-12 h-12 text-content-muted mx-auto mb-3 opacity-40" />
                            <p className="text-content-muted">Ainda não há avaliações para este produto.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Related Products */}
            {relatedProducts.length > 0 && (
                <section className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
                    <ProductCarousel
                        title="Produtos Relacionados"
                        products={relatedProducts}
                        onAddToCart={(p, v) => shopContext.onAddToCart?.(p, v, 1)}
                    />
                </section>
            )}
        </div>
    );
};
