import { useEffect } from 'react';
import { useAdminTracking } from '../../core/hooks/useAdminTracking';

interface TrackedPageProps {
  children: React.ReactNode;
  pagePath: string;
  pageTitle?: string;
  enabled?: boolean;
}

/**
 * Componente wrapper que adiciona tracking automé¡tico a pé¡ginas administrativas
 * Use este componente para envolver pé¡ginas que devem ser rastreadas
 */
export const TrackedPage: React.FC<TrackedPageProps> = ({
  children,
  pagePath,
  pageTitle,
  enabled = true
}) => {
  const { trackAction } = useAdminTracking({
    pagePath,
    pageTitle,
    enabled
  });

  // Expor trackAction globalmente para uso em handlers de açéµes
  useEffect(() => {
    if (enabled && typeof window !== 'undefined') {
      (window as any).__trackAction = trackAction;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__trackAction;
      }
    };
  }, [trackAction, enabled]);

  return <>{children}</>;
};

/**
 * Hook helper para rastrear açéµes facilmente em componentes
 */
export const useTrackAction = () => {
  if (typeof window !== 'undefined' && (window as any).__trackAction) {
    return (window as any).__trackAction;
  }
  return () => { }; // No-op se néo disponé­vel
};

