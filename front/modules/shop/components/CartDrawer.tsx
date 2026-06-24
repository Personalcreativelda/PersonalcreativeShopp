import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShoppingCart, Plus, Minus, Package, ArrowRight } from 'lucide-react';
import { useMobile } from '../../core/hooks/useMobile';
import uploadService from '../../../services/uploadService';

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

const CART_KEY = 'shop_cart';

const readCart = (): CartItem[] => {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
};

const writeCart = (items: CartItem[]) => {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
};

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCartCountChange?: (count: number) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ open, onClose, onCartCountChange }) => {
  const navigate = useNavigate();
  const isMobile = useMobile(768);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Reload from storage whenever drawer opens
  useEffect(() => {
    if (open) {
      setCart(readCart());
    }
  }, [open]);

  // Sync when another tab / Shop.tsx changes storage
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) {
        const updated = readCart();
        setCart(updated);
        onCartCountChange?.(updated.reduce((s, i) => s + i.quantity, 0));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [onCartCountChange]);

  const updateQuantity = useCallback((productId: string, variantId: string | undefined, delta: number) => {
    setCart(prev => {
      const updated = prev.map(item => {
        if (item.productId === productId && item.variantId === variantId) {
          const q = item.quantity + delta;
          return q <= 0 ? null : { ...item, quantity: q };
        }
        return item;
      }).filter(Boolean) as CartItem[];
      writeCart(updated);
      onCartCountChange?.(updated.reduce((s, i) => s + i.quantity, 0));
      return updated;
    });
  }, [onCartCountChange]);

  const removeItem = useCallback((productId: string, variantId: string | undefined) => {
    setCart(prev => {
      const updated = prev.filter(i => !(i.productId === productId && i.variantId === variantId));
      writeCart(updated);
      onCartCountChange?.(updated.reduce((s, i) => s + i.quantity, 0));
      return updated;
    });
  }, [onCartCountChange]);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleCheckout = () => {
    onClose();
    navigate('/loja', { state: { openCart: true } });
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex ${isMobile ? 'items-end' : 'items-stretch justify-end'}`}
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Drawer */}
      <div
        className={`relative flex flex-col bg-surface-raised shadow-2xl
          ${isMobile
            ? 'w-full max-h-[90vh] rounded-t-2xl animate-slide-in-up'
            : 'w-full max-w-md h-full animate-slide-in-right'
          }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-default flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-content-primary">Carrinho</h2>
            <p className="text-sm text-content-muted mt-0.5">
              {cart.length} {cart.length === 1 ? 'item' : 'itens'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-content-muted hover:text-gray-600 dark:hover:text-gray-300 hover:bg-surface-overlay transition-colors"
            aria-label="Fechar carrinho"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' as any }}>
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 py-16">
              <div className="w-20 h-20 rounded-full bg-surface-overlay flex items-center justify-center mb-4">
                <ShoppingCart className="h-10 w-10 text-content-muted" />
              </div>
              <p className="text-lg font-medium text-content-primary mb-1">Carrinho vazio</p>
              <p className="text-sm text-content-muted text-center max-w-xs">
                Adicione produtos ao carrinho para começar as compras
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {cart.map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 bg-surface-base rounded-xl p-4 border border-border-default"
                >
                  {/* Imagem */}
                  <div className="flex-shrink-0">
                    {item.image ? (
                      <img
                        src={uploadService.getPublicUrl(item.image)}
                        alt={item.productName}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-surface-overlay dark:bg-white/[0.1] rounded-lg flex items-center justify-center">
                        <Package className="h-8 w-8 text-content-muted" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-content-primary text-sm line-clamp-2 mb-0.5">
                      {item.productName}
                    </h3>
                    {item.variantName && (
                      <p className="text-xs text-content-muted mb-1">{item.variantName}</p>
                    )}
                    <p className="text-sm font-semibold mb-2" style={{ color: 'var(--brand-600)' }}>
                      {item.price.toFixed(2)} MT
                    </p>

                    {/* Quantidade + remover */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center bg-surface-raised rounded-lg border border-border-default">
                        <button
                          onClick={() => updateQuantity(item.productId, item.variantId, -1)}
                          className="p-1.5 text-content-muted hover:text-gray-900 dark:hover:text-white hover:bg-surface-overlay rounded-l-lg transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center font-semibold text-content-primary text-sm">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.variantId, 1)}
                          className="p-1.5 text-content-muted hover:text-gray-900 dark:hover:text-white hover:bg-surface-overlay rounded-r-lg transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div
            className="border-t border-border-default p-5 space-y-4 flex-shrink-0 bg-surface-raised"
            style={isMobile ? { paddingBottom: `max(1.25rem, calc(env(safe-area-inset-bottom) + 1.25rem))` } : {}}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-content-primary">Total</span>
              <span className="text-2xl font-bold" style={{ color: 'var(--brand-600)' }}>{total.toFixed(2)} MT</span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full text-white py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:scale-[1.02] shadow-md"
              style={{ background: 'var(--brand-600)' }}
            >
              <ShoppingCart className="h-5 w-5" />
              Finalizar Pedido
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes cart-slide-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes cart-slide-up    { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-in-right { animation: cart-slide-right 0.28s ease-out; }
        .animate-slide-in-up    { animation: cart-slide-up    0.28s ease-out; }
      `}} />
    </div>
  );
};
