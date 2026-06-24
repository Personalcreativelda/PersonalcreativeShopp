import React, { createContext, useContext, ReactNode } from 'react';

/**
 * Contexto de "local" em modo no-op: sistema de um único contexto (Loja Quinta Nicy).
 * Não carrega locais nem expõe seletor; mantido para compatibilidade com useLocation().
 */
interface LocationContextType {
 selectedLocationId: string | 'all' | null;
 availableLocations: { id: string; name: string }[];
 setSelectedLocation: (locationId: string | 'all') => void;
 isLoading: boolean;
 currentUser: null;
 refreshLocations: () => Promise<void>;
}

const value: LocationContextType = {
 selectedLocationId: null,
 availableLocations: [],
 setSelectedLocation: () => {},
 isLoading: false,
 currentUser: null,
 refreshLocations: async () => {},
};

const LocationContext = createContext<LocationContextType>(value);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
 <LocationContext.Provider value={value}>
 {children}
 </LocationContext.Provider>
);

export const useLocation = (): LocationContextType => {
 const context = useContext(LocationContext);
 return context ?? value;
};
