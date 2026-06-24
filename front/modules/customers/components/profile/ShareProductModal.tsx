import React, { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, MessageCircle } from 'lucide-react';
import { dataService } from '../../../core/services/dataService';
import { customerProfileService } from '../../services/customerProfileService';
import { Product } from '../../../core/types/types';
import { Toast } from '../ui/Toast';

interface ShareProductModalProps {
 customerId: string;
 onClose: () => void;
 onSuccess: () => void;
 showToast?: (message: string, type: Toast['type'], duration?: number) => void;
}

export const ShareProductModal: React.FC<ShareProductModalProps> = ({
 customerId,
 onClose,
 onSuccess,
 showToast
}) => {
 const [products, setProducts] = useState<Product[]>([]);
 const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
 const [selectedPlatform, setSelectedPlatform] = useState<'whatsapp' | 'facebook' | 'instagram' | 'twitter' | 'other'>('whatsapp');
 const [isLoading, setIsLoading] = useState(false);
 const [linkCopied, setLinkCopied] = useState(false);

 useEffect(() => {
 loadProducts();
 }, []);

 const loadProducts = async () => {
 try {
 const allProducts = await dataService.getProducts();
 setProducts(allProducts.filter(p => p.stock > 0)); // Apenas produtos com stock
 } catch (error) {
 console.error('Erro ao carregar produtos:', error);
 showToast?.('Erro ao carregar produtos', 'error');
 }
 };

 const getProductUrl = (product: Product) => {
 const baseUrl = window.location.origin;
 return `${baseUrl}/shop?product=${product.id}`;
 };

 const copyToClipboard = (text: string) => {
 navigator.clipboard.writeText(text);
 setLinkCopied(true);
 setTimeout(() => setLinkCopied(false), 2000);
 };

 const shareOnWhatsApp = (product: Product) => {
 const url = getProductUrl(product);
 const message = `Confira este produto: ${product.name} - ${url}`;
 const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
 window.open(whatsappUrl, '_blank');
 };

 const shareOnFacebook = (product: Product) => {
 const url = getProductUrl(product);
 const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
 window.open(facebookUrl, '_blank');
 };

 const handleShare = async () => {
 if (!selectedProduct) {
 showToast?.('Selecione um produto para partilhar', 'warning');
 return;
 }

 setIsLoading(true);
 try {
 const result = await customerProfileService.shareProduct(
 customerId,
 selectedProduct.id,
 selectedPlatform,
 10
 );

 if (result) {
 showToast?.('Produto partilhado! Ganhou 10 pontos.', 'success');
 onSuccess();
 onClose();
 } else {
 showToast?.('Erro ao partilhar produto. Tente novamente.', 'error');
 }
 } catch (error: any) {
 console.error('Erro ao partilhar produto:', error);
 showToast?.(error?.message || 'Erro ao partilhar produto. Tente novamente.', 'error');
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <div className="fixed inset-0 min-h-screen min-w-full modal-overlay z-50 flex items-center justify-center p-4 animate-fadeIn">
 <div className="bg-surface-raised rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-border-default">
 <h2 className="text-2xl font-bold text-content-primary">
 Partilhar Produto
 </h2>
 <button
 onClick={onClose}
 className="p-2 rounded-lg hover:bg-surface-base transition-colors"
 >
 <X className="w-5 h-5 text-content-muted" />
 </button>
 </div>

 {/* Content */}
 <div className="p-6 space-y-6">
 {/* Product Selection */}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Selecione um Produto *
 </label>
 <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
 {products.map(product => (
 <button
 key={product.id}
 onClick={() => setSelectedProduct(product)}
 className={`p-4 rounded-lg border-2 text-left transition-all ${selectedProduct?.id === product.id
 ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
 : 'border-border-default hover:border-green-300'
 }`}
 >
 <div className="flex items-center justify-between">
 <div>
 <p className="font-semibold text-content-primary">{product.name}</p>
 <p className="text-sm text-content-secondary">
 {product.price.toFixed(2)} MT â€¢ Stock: {product.stock}
 </p>
 </div>
 </div>
 </button>
 ))}
 </div>
 </div>

 {/* Platform Selection */}
 {selectedProduct && (
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Plataforma
 </label>
 <div className="grid grid-cols-2 gap-3">
 {[
 { value: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
 { value: 'facebook' as const, label: 'Facebook', icon: Share2 },
 { value: 'instagram' as const, label: 'Instagram', icon: Share2 },
 { value: 'other' as const, label: 'Outro', icon: Share2 }
 ].map(platform => {
 const Icon = platform.icon;
 return (
 <button
 key={platform.value}
 onClick={() => setSelectedPlatform(platform.value)}
 className={`p-4 rounded-lg border-2 transition-all ${selectedPlatform === platform.value
 ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
 : 'border-border-default hover:border-green-300'
 }`}
 >
 <Icon className="w-5 h-5 mx-auto mb-2 text-content-secondary" />
 <p className="text-sm font-medium text-content-primary">{platform.label}</p>
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* Quick Share Actions */}
 {selectedProduct && (
 <div className="bg-surface-base/50 p-4 rounded-lg">
 <p className="text-sm font-medium text-content-secondary mb-3">Link do Produto:</p>
 <div className="flex items-center space-x-2">
 <input
 type="text"
 value={getProductUrl(selectedProduct)}
 readOnly
 className="flex-1 px-3 py-2 bg-surface-raised border border-border-default rounded-lg text-sm"
 />
 <button
 onClick={() => copyToClipboard(getProductUrl(selectedProduct))}
 className="p-2 bg-surface-base rounded-lg hover:bg-surface-base transition-colors"
 >
 {linkCopied ? (
 <Check className="w-5 h-5 text-green-600" />
 ) : (
 <Copy className="w-5 h-5 text-content-secondary" />
 )}
 </button>
 {selectedPlatform === 'whatsapp' && (
 <button
 onClick={() => shareOnWhatsApp(selectedProduct)}
 className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
 >
 <MessageCircle className="w-5 h-5" />
 </button>
 )}
 {selectedPlatform === 'facebook' && (
 <button
 onClick={() => shareOnFacebook(selectedProduct)}
 className="p-2 bg-brand-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
 >
 <Share2 className="w-5 h-5" />
 </button>
 )}
 </div>
 </div>
 )}

 {/* Reward info */}
 <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
 <p className="text-sm text-green-800 dark:text-green-300">
 ðŸŽ <strong>Recompensa:</strong> Ao partilhar um produto, vocéª ganharé¡ <strong>10 pontos</strong>!
 </p>
 </div>

 {/* Actions */}
 <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border-default">
 <button
 type="button"
 onClick={onClose}
 className="px-5 py-2 border border-border-default rounded-lg text-content-secondary hover:bg-surface-base transition-colors"
 >
 Cancelar
 </button>
 <button
 onClick={handleShare}
 disabled={!selectedProduct || isLoading}
 className="px-5 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center space-x-2"
 >
 {isLoading ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
 <span>Partilhando...</span>
 </>
 ) : (
 <>
 <Share2 className="w-4 h-4" />
 <span>Partilhar e Ganhar Pontos</span>
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};



