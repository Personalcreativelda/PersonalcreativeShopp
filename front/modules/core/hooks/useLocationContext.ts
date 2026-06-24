import { User } from '../../core/types/types';

interface UseLocationContextReturn {
  canAccessLocation: (locationId: string) => boolean;
  getUserLocations: () => string[];
  currentUser: User | null;
  allLocations: { id: string; name: string }[];
  isLoadingLocations: boolean;
  refreshLocations: () => Promise<void>;
}

/**
 * No-op: sistema usa um único contexto (Loja Quinta Nicy). Mantido para compatibilidade.
 */
export const useLocationContext = (currentUser: User | null): UseLocationContextReturn => ({
  canAccessLocation: () => true,
  getUserLocations: () => [],
  currentUser,
  allLocations: [],
  isLoadingLocations: false,
  refreshLocations: async () => {}
});
