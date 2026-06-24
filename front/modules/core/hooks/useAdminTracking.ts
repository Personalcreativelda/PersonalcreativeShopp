import { useEffect, useRef } from 'react';
import { trackingService } from '../../core/services/trackingService';
import { authService } from '../../auth/services/authService';
import { User } from '../../core/types/types';

interface UseAdminTrackingOptions {
  pagePath: string;
  pageTitle?: string;
  enabled?: boolean;
}

/**
 * Hook para rastrear automaticamente atividades administrativas
 * Registra visualizações de página e pode ser usado para rastrear ações específicas
 * OTIMIZADO: Executa tracking em segundo plano para não bloquear renderização
 */
export const useAdminTracking = (options: UseAdminTrackingOptions) => {
  const { pagePath, pageTitle, enabled = true } = options;
  const startTimeRef = useRef<number>(Date.now());
  const userRef = useRef<User | null>(null);
  const hasTrackedRef = useRef(false);
  const lastTrackedPathRef = useRef<string>('');

  useEffect(() => {
    if (!enabled) return;
    
    // Evitar tracking duplicado do mesmo path
    if (lastTrackedPathRef.current === pagePath) return;

    // Usar requestIdleCallback ou setTimeout para tracking não-bloqueante
    // Isso permite que a página renderize primeiro antes de fazer chamadas ao servidor
    const scheduleTracking = () => {
      const trackPageView = async () => {
        try {
          // Verificar se já foi tracked para evitar duplicados
          if (lastTrackedPathRef.current === pagePath) return;
          
          const user = await authService.getCurrentUser();
          if (!user) return; // Silencioso - não interromper UX

          userRef.current = user;
          startTimeRef.current = Date.now();

          // Registrar visualização da página em segundo plano
          await trackingService.trackAdminActivity({
            userId: user.id,
            pagePath,
            pageTitle: pageTitle || document.title,
            actionType: 'view',
            actionDetails: {
              entity: 'page',
              entityId: pagePath
            }
          });

          hasTrackedRef.current = true;
          lastTrackedPathRef.current = pagePath;
        } catch (error) {
          // Silencioso - tracking não deve interromper a experiência do utilizador
          console.debug('Tracking error:', error);
        }
      };

      trackPageView();
    };

    // Usar requestIdleCallback se disponível, senão setTimeout
    // Isto garante que o tracking só executa quando o browser está idle
    let timeoutId: number;
    if ('requestIdleCallback' in window) {
      const idleId = (window as any).requestIdleCallback(scheduleTracking, { timeout: 2000 });
      return () => (window as any).cancelIdleCallback(idleId);
    } else {
      // Fallback: pequeno delay para não bloquear render inicial
      timeoutId = window.setTimeout(scheduleTracking, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [pagePath, pageTitle, enabled]);

  /**
   * Função para rastrear uma ação específica
   */
  const trackAction = async (
    actionType: 'create' | 'update' | 'delete' | 'export' | 'login' | 'logout' | string,
    actionDetails?: {
      entity?: string;
      entityId?: string;
      changes?: any;
      [key: string]: any;
    }
  ) => {
    if (!enabled) return;

    // Executar em segundo plano
    setTimeout(async () => {
      try {
        const user = userRef.current || await authService.getCurrentUser();
        if (!user) return;

        await trackingService.trackAdminActivity({
          userId: user.id,
          pagePath,
          pageTitle: pageTitle || document.title,
          actionType,
          actionDetails: actionDetails || {}
        });
      } catch (error) {
        console.debug('Tracking action error:', error);
      }
    }, 0);
  };

  return { trackAction };
};
