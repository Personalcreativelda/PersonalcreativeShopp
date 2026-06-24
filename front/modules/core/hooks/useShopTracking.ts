import { useEffect, useRef, useState } from 'react';
import { trackingService } from '../../core/services/trackingService';
import { authService } from '../../auth/services/authService';

interface UseShopTrackingOptions {
  enabled?: boolean;
  trackPageChanges?: boolean;
}

/**
 * Hook para rastrear visitas na loja online com duraçéo e açéµes
 */
export const useShopTracking = (options: UseShopTrackingOptions = {}) => {
  const { enabled = true, trackPageChanges = true } = options;
  const startTimeRef = useRef<number>(Date.now());
  const visitIdRef = useRef<string | null>(null);
  const lastPageRef = useRef<string>(window.location.pathname);
  const actionsRef = useRef<Array<{ type: string; timestamp: string; data?: any }>>([]);
  const productsViewedRef = useRef<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Carregar usué¡rio uma vez (apenas na montagem)
  const hasLoadedUser = useRef(false);
  useEffect(() => {
    if (!enabled || hasLoadedUser.current) return;
    
    hasLoadedUser.current = true;
    const loadUser = async () => {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
    };
    loadUser();
  }, [enabled]);

  // Rastrear visita inicial
  useEffect(() => {
    if (!enabled) return;

    startTimeRef.current = Date.now();
    lastPageRef.current = window.location.pathname;

    // Rastrear duraçéo e criar visita final ao sair
    return () => {
      const trackFinalVisit = async () => {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (duration > 0) {
          try {
            const user = currentUser || await authService.getCurrentUser();
            const customerId = user?.customerId;

            // Criar visita final com duraçéo e todas as açéµes acumuladas
            await trackingService.trackShopVisit({
              pagePath: lastPageRef.current,
              pageTitle: document.title,
              customerId: customerId || undefined,
              userId: user?.id || undefined,
              productsViewed: Array.from(productsViewedRef.current),
              actions: actionsRef.current,
              visitDuration: duration,
              metadata: {
                entryPoint: window.location.pathname,
                exitPoint: window.location.pathname,
                referrer: document.referrer || 'direct',
                totalActions: actionsRef.current.length,
                totalProductsViewed: productsViewedRef.current.size,
                sessionEnd: true
              }
            });
          } catch (error) {
            console.error('Erro ao rastrear visita final:', error);
          }
        }
      };

      // Usar sendBeacon se disponé­vel para garantir envio mesmo ao fechar a pé¡gina
      if (navigator.sendBeacon) {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const data = JSON.stringify({
          duration,
          actions: actionsRef.current.length,
          products: productsViewedRef.current.size,
          pagePath: lastPageRef.current
        });
        // Nota: sendBeacon requer um endpoint no servidor, por enquanto vamos usar a chamada normal
        trackFinalVisit();
      } else {
        trackFinalVisit();
      }
    };
    // Remover currentUser das dependências para evitar loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Rastrear mudanças de pé¡gina
  useEffect(() => {
    if (!enabled || !trackPageChanges) return;

    const handleLocationChange = () => {
      const currentPath = window.location.pathname;
      if (currentPath !== lastPageRef.current) {
        // Registrar açéo de mudança de pé¡gina
        trackAction('page_view', {
          from: lastPageRef.current,
          to: currentPath
        });
        lastPageRef.current = currentPath;
      }
    };

    // Usar MutationObserver para detectar mudanças no histé³rico
    const observer = new MutationObserver(handleLocationChange);
    observer.observe(document.body, { childList: true, subtree: true });

    // També©m escutar eventos popstate (voltar/avançar)
    window.addEventListener('popstate', handleLocationChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, [enabled, trackPageChanges]);

  /**
   * Rastrear uma açéo do usué¡rio
   */
  const trackAction = (actionType: string, data?: any) => {
    if (!enabled) return;

    const action = {
      type: actionType,
      timestamp: new Date().toISOString(),
      data: data || {}
    };

    actionsRef.current.push(action);

    // Enviar açéo imediatamente para o servidor
    trackingService.trackShopAction(actionType, data).catch(error => {
      console.error('Erro ao rastrear açéo:', error);
    });
  };

  /**
   * Rastrear visualizaçéo de produto
   */
  const trackProductView = (productId: string, productName?: string) => {
    if (!enabled) return;

    productsViewedRef.current.add(productId);
    trackAction('product_view', {
      productId,
      productName
    });
  };

  /**
   * Rastrear adiçéo ao carrinho
   */
  const trackAddToCart = (productId: string, productName: string, quantity: number, price: number) => {
    if (!enabled) return;

    trackAction('add_to_cart', {
      productId,
      productName,
      quantity,
      price,
      total: quantity * price
    });
  };

  /**
   * Rastrear iné­cio de checkout
   */
  const trackCheckoutStart = (cartItems: any[], total: number) => {
    if (!enabled) return;

    trackAction('checkout_start', {
      itemCount: cartItems.length,
      total,
      items: cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
      }))
    });
  };

  /**
   * Rastrear conclusão de pedido
   */
  const trackOrderComplete = (orderId: string, total: number, items: any[]) => {
    if (!enabled) return;

    trackAction('order_complete', {
      orderId,
      total,
      itemCount: items.length,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }))
    });
  };

  /**
   * Rastrear busca
   */
  const trackSearch = (searchTerm: string, resultsCount: number) => {
    if (!enabled) return;

    trackAction('search', {
      term: searchTerm,
      resultsCount
    });
  };

  return {
    trackAction,
    trackProductView,
    trackAddToCart,
    trackCheckoutStart,
    trackOrderComplete,
    trackSearch
  };
};


