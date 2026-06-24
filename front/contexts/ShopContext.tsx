import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode, useRef } from 'react';

interface ShopContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  cartItemCount: number;
  setCartItemCount: (count: number) => void;
  onCartClick?: () => void;
  setOnCartClick: (handler: () => void) => void;
  onAddToCart?: (product: any, variant?: any, quantity?: number) => void;
  setOnAddToCart: (handler: (product: any, variant?: any, quantity?: number) => void) => void;
  onProfileClick?: () => void;
  setOnProfileClick: (handler: () => void) => void;
  onLoginClick?: () => void;
  setOnLoginClick: (handler: () => void) => void;
  darkMode: boolean;
  setDarkMode: (mode: boolean) => void;
  toggleTheme?: () => void;
  setToggleTheme: (handler: () => void) => void;
  onFilterClick?: () => void;
  setOnFilterClick: (handler: () => void) => void;
  hasActiveFilters: boolean;
  setHasActiveFilters: (active: boolean) => void;
}

export const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cartItemCount, setCartItemCount] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Usar refs para callbacks para evitar re-renders do contexto
  const onCartClickRef = useRef<(() => void) | undefined>(undefined);
  const onAddToCartRef = useRef<((product: any, variant?: any, quantity?: number) => void) | undefined>(undefined);
  const onProfileClickRef = useRef<(() => void) | undefined>(undefined);
  const onLoginClickRef = useRef<(() => void) | undefined>(undefined);
  const toggleThemeRef = useRef<(() => void) | undefined>(undefined);
  const onFilterClickRef = useRef<(() => void) | undefined>(undefined);

  // Wrappers estáveis para os handlers que serão expostos no contexto
  // Estes wrappers nunca mudam, então não causam re-renders dos consumidores
  const contextOnCartClick = useCallback(() => {
    if (onCartClickRef.current) onCartClickRef.current();
  }, []);

  const contextOnAddToCart = useCallback((product: any, variant?: any, quantity: number = 1) => {
    if (onAddToCartRef.current) onAddToCartRef.current(product, variant, quantity);
  }, []);

  const contextOnProfileClick = useCallback(() => {
    if (onProfileClickRef.current) onProfileClickRef.current();
  }, []);

  const contextOnLoginClick = useCallback(() => {
    if (onLoginClickRef.current) onLoginClickRef.current();
  }, []);

  const contextToggleTheme = useCallback(() => {
    if (toggleThemeRef.current) toggleThemeRef.current();
  }, []);

  const contextOnFilterClick = useCallback(() => {
    if (onFilterClickRef.current) onFilterClickRef.current();
  }, []);

  // Setters estáveis que apenas atualizam os refs
  const setOnCartClick = useCallback((handler: () => void) => {
    onCartClickRef.current = handler;
  }, []);

  const setOnAddToCart = useCallback((handler: (product: any, variant?: any, quantity?: number) => void) => {
    onAddToCartRef.current = handler;
  }, []);

  const setOnProfileClick = useCallback((handler: () => void) => {
    onProfileClickRef.current = handler;
  }, []);

  const setOnLoginClick = useCallback((handler: () => void) => {
    onLoginClickRef.current = handler;
  }, []);

  const setToggleTheme = useCallback((handler: () => void) => {
    toggleThemeRef.current = handler;
  }, []);

  const setOnFilterClick = useCallback((handler: () => void) => {
    onFilterClickRef.current = handler;
  }, []);

  // Memoizar o valor do contexto - note que os handlers e setters são todos estáveis agora
  const contextValue = useMemo(() => ({
    searchTerm,
    setSearchTerm,
    cartItemCount,
    setCartItemCount,
    onCartClick: contextOnCartClick,
    setOnCartClick,
    onProfileClick: contextOnProfileClick,
    setOnProfileClick,
    onLoginClick: contextOnLoginClick,
    setOnLoginClick,
    darkMode,
    setDarkMode,
    toggleTheme: contextToggleTheme,
    setToggleTheme,
    onFilterClick: contextOnFilterClick,
    setOnFilterClick,
    hasActiveFilters,
    setHasActiveFilters,
    onAddToCart: contextOnAddToCart,
    setOnAddToCart
  }), [
    searchTerm,
    cartItemCount,
    darkMode,
    hasActiveFilters,
    contextOnCartClick,
    setOnCartClick,
    contextOnProfileClick,
    setOnProfileClick,
    contextOnLoginClick,
    setOnLoginClick,
    contextToggleTheme,
    setToggleTheme,
    contextOnFilterClick,
    setOnFilterClick,
    contextOnAddToCart,
    setOnAddToCart
  ]);

  return (
    <ShopContext.Provider value={contextValue}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShopContext = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShopContext must be used within ShopProvider');
  }
  return context;
};

// Hook que retorna null se o contexto não estiver disponível (não lança erro)
export const useShopContextSafe = () => {
  const context = useContext(ShopContext);
  return context || null;
};
