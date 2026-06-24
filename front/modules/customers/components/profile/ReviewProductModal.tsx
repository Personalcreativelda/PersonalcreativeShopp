import React, { useState, useEffect } from 'react';
import { X, Star, Save } from 'lucide-react';
import { dataService } from '../../../core/services/dataService';
import { customerProfileService } from '../../services/customerProfileService';
import { Product, Order } from '../../../core/types/types';
import { Toast } from '../ui/Toast';

interface ReviewProductModalProps {
 customerId: string;
 onClose: () => void;
 onSuccess: () => void;
 showToast?: (message: string, type: Toast['type'], duration?: number) => void;
}

export const ReviewProductModal: React.FC<ReviewProductModalProps> = ({
 customerId,
 onClose,
 onSuccess,
 showToast
}) => {
 const [products, setProducts] = useState<Product[]>([]);
 const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
 const [rating, setRating] = useState(5);
 const [comment, setComment] = useState('');
 const [isLoading, setIsLoading] = useState(false);

 useEffect(() => {
 loadPurchasedProducts();
 }, []);

 const loadPurchasedProducts = async () => {
 try {
 // Buscar pedidos do cliente
 const orders = await dataService.getOrders();
 const customerOrders = orders.filter(
 o => o.customerId === customerId || o.customerPhone === customerId
 );

 // Extrair produtos éºnicos dos pedidos
 const purchasedProductIds = new Set<string>();
 customerOrders.forEach(order => {
 if (order.items) {
 order.items.forEach((item: any) => {
 if (item.productId) {
 purchasedProductIds.add(item.productId);
 }
 });
 }
 });

 // Buscar produtos
 const allProducts = await dataService.getProducts();
 const purchasedProducts = allProducts.filter(p =>
 purchasedProductIds.has(p.id)
 );

 setProducts(purchasedProducts);
 } catch (error) {
 console.error('Erro ao carregar produtos comprados:', error);
 // Fallback: mostrar todos os produtos se néo conseguir filtrar
 dataService.getProducts().then(ps => setProducts(ps));
 showToast?.('Carregando produtos disponé­veis...', 'info');
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!selectedProduct) {
 showToast?.('Selecione um produto para avaliar', 'warning');
 return;
 }

 if (rating < 1 || rating > 5) {
 showToast?.('Avaliaçéo deve ser entre 1 e 5 estrelas', 'warning');
 return;
 }

 setIsLoading(true);
 try {
 // Criar review
 const reviewResult = await customerProfileService.createReview(
 customerId,
 selectedProduct.id,
 rating,
 comment
 );

 if (reviewResult) {
 // Registrar açéo de avaliar produto
 const actionResult = await customerProfileService.recordAction(
 customerId,
 'avaliar_produto',
 20,
 { productId: selectedProduct.id, rating, reviewId: reviewResult.id }
 );

 if (actionResult) {
 showToast?.('Avaliaçéo enviada! Ganhou 20 pontos.', 'success');
 onSuccess();
 onClose();
 } else {
 showToast?.('Avaliaçéo criada, mas houve erro ao registrar pontos. Tente novamente.', 'warning');
 onSuccess();
 onClose();
 }
 } else {
 showToast?.('Erro ao criar avaliaçéo. Tente novamente.', 'error');
 }
 } catch (error: any) {
 console.error('Erro ao avaliar produto:', error);
 showToast?.(error?.message || 'Erro ao avaliar produto. Tente novamente.', 'error');
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
 Avaliar Produto
 </h2>
 <button
 onClick={onClose}
 className="p-2 rounded-lg hover:bg-surface-base transition-colors"
 >
 <X className="w-5 h-5 text-content-muted" />
 </button>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="p-6 space-y-6">
 {/* Product Selection */}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Selecione um Produto *
 </label>
 <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto">
 {products.length > 0 ? (
 products.map(product => (
 <button
 key={product.id}
 type="button"
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
 {product.price.toFixed(2)} MT
 </p>
 </div>
 </div>
 </button>
 ))
 ) : (
 <p className="text-center text-content-muted py-8">
 Nenhum produto comprado encontrado. Vocéª precisa comprar produtos antes de avaliar.
 </p>
 )}
 </div>
 </div>

 {/* Rating */}
 {selectedProduct && (
 <>
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Avaliaçéo *
 </label>
 <div className="flex items-center space-x-2">
 {[1, 2, 3, 4, 5].map(star => (
 <button
 key={star}
 type="button"
 onClick={() => setRating(star)}
 className={`transition-transform hover:scale-110 ${star <= rating
 ? 'text-yellow-400'
 : 'text-content-muted'
 }`}
 >
 <Star
 className={`w-8 h-8 ${star <= rating ? 'fill-current' : ''
 }`}
 />
 </button>
 ))}
 <span className="ml-3 text-sm text-content-secondary">
 {rating} de 5 estrelas
 </span>
 </div>
 </div>

 {/* Comment */}
 <div>
 <label className="block text-sm font-medium text-content-secondary mb-2">
 Comenté¡rio (opcional)
 </label>
 <textarea
 value={comment}
 onChange={(e) => setComment(e.target.value)}
 className="w-full px-4 py-2 border border-border-default rounded-lg bg-surface-raised text-content-primary focus:ring-2 focus:ring-green-500 focus:border-transparent"
 placeholder="Compartilhe sua opiniéo sobre este produto..."
 rows={4}
 />
 </div>
 </>
 )}

 {/* Reward info */}
 <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
 <p className="text-sm text-green-800 dark:text-green-300">
 ðŸŽ <strong>Recompensa:</strong> Ao avaliar um produto, vocéª ganharé¡ <strong>20 pontos</strong>!
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
 type="submit"
 disabled={!selectedProduct || isLoading || rating < 1}
 className="px-5 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center space-x-2"
 >
 {isLoading ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
 <span>Enviando...</span>
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 <span>Enviar Avaliaçéo e Ganhar Pontos</span>
 </>
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
};



