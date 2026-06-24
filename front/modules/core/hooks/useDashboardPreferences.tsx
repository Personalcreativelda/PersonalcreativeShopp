import React, { createContext, useContext, useState, useEffect } from 'react';

export interface DashboardCard {
 id: string;
 label: string;
 visible: boolean;
 order: number;
 category: 'vendas' | 'loja' | 'producao' | 'financeiro' | 'estoque' | 'geral';
 essential?: boolean;
 linkTo?: string;
}

interface DashboardPreferencesContextType {
 // Original properties
 preferences: DashboardCard[];
 updatePreferences: (newPreferences: DashboardCard[]) => void;
 isCardVisible: (cardId: string) => boolean;
 getVisibleCards: () => DashboardCard[];
 isConfigOpen: boolean;
 setIsConfigOpen: (isOpen: boolean) => void;
 resetPreferences: () => void;

 // Aliases for compatibility with DashboardSettings.tsx
 cards: DashboardCard[];
 toggleCardVisibility: (cardId: string) => void;
 resetToDefault: () => void;
 savePreferences: (cards: DashboardCard[]) => void;
}

const DEFAULT_CARDS: DashboardCard[] = [
 // Banner KPI topo
 { id: 'kpi-banner', label: 'Cards de Topo (Receita / POS / A Receber / Encomendas)', visible: false, order: -1, category: 'financeiro' },

 // Financeiro
 { id: 'total-purchases', label: 'Compras do Período', visible: false, order: 0, category: 'financeiro', essential: true },

 // Vendas e Pedidos
 { id: 'total-sales', label: 'Vendas do Período', visible: true, order: 1, category: 'vendas', essential: true },
 { id: 'total-orders', label: 'Pedidos do Período', visible: true, order: 2, category: 'vendas', essential: true },
 { id: 'avg-ticket', label: 'Ticket Médio do Período', visible: true, order: 3, category: 'vendas', essential: true },
 { id: 'completion-rate', label: 'Taxa de Conclusão do Período', visible: true, order: 4, category: 'vendas', essential: true },
 { id: 'active-orders', label: 'Pedidos Ativos no Período', visible: false, order: 5, category: 'vendas', essential: true },

 // Clientes
 { id: 'customers-in-period', label: 'Clientes no Período', visible: false, order: 6, category: 'vendas' },
 { id: 'new-customers', label: 'Novos Clientes no Período', visible: false, order: 7, category: 'vendas' },

 // Listas e Analytics
 { id: 'top-customers', label: 'Clientes Mais Valiosos', visible: false, order: 8, category: 'vendas' },
 { id: 'low-stock', label: 'Stock Baixo', visible: true, order: 9, category: 'estoque', linkTo: '/admin/stock/alertas' },
 { id: 'stock-forecast', label: 'Previsão Semanal', visible: true, order: 10, category: 'estoque', linkTo: '/admin/stock/alertas' },
 { id: 'top-products', label: 'Produtos Mais Vendidos', visible: false, order: 11, category: 'estoque' },
 { id: 'products-sold-list', label: 'Lista Produtos Vendidos', visible: false, order: 12, category: 'vendas' },
 { id: 'products-purchased-list', label: 'Lista Produtos Comprados', visible: false, order: 13, category: 'financeiro' },

 // Gráficos
 { id: 'orders-chart', label: 'Gráfico de Pedidos', visible: true, order: 14, category: 'geral' },
 { id: 'sales-chart', label: 'Gráfico de Vendas', visible: true, order: 15, category: 'geral' },

 // Entregas e Pagamentos
 { id: 'delivery-stats', label: 'Pedidos com Entrega no Período', visible: false, order: 16, category: 'vendas' },
 { id: 'payment-status', label: 'Valor Pendente no Período', visible: false, order: 17, category: 'vendas' }
];

const PREFERENCES_KEY = 'naturerva_dashboard_preferences_v1';

const DashboardPreferencesContext = createContext<DashboardPreferencesContextType | undefined>(undefined);

export const DashboardPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [preferences, setPreferences] = useState<DashboardCard[]>(DEFAULT_CARDS);
 const [isConfigOpen, setIsConfigOpen] = useState(false);

 useEffect(() => {
 const stored = localStorage.getItem(PREFERENCES_KEY);
 if (stored) {
 try {
 const parsed = JSON.parse(stored);
 // Remove duplicatas do localStorage (manter apenas a primeira ocorrência de cada ID)
 const uniqueParsed = parsed.filter((card: DashboardCard, index: number, self: DashboardCard[]) => 
 index === self.findIndex((c: DashboardCard) => c.id === card.id)
 );
 // Merge with defaults to ensure all new cards are present
 const merged = DEFAULT_CARDS.map(defaultCard => {
 const storedCard = uniqueParsed.find((c: DashboardCard) => c.id === defaultCard.id);
 return storedCard ? { ...defaultCard, ...storedCard } : defaultCard;
 });
 setPreferences(merged);
 // Salvar de volta para limpar duplicatas do localStorage
 localStorage.setItem(PREFERENCES_KEY, JSON.stringify(merged));
 } catch {
 setPreferences(DEFAULT_CARDS);
 }
 }
 }, []);

 const updatePreferences = (newPreferences: DashboardCard[]) => {
 setPreferences(newPreferences);
 localStorage.setItem(PREFERENCES_KEY, JSON.stringify(newPreferences));
 };

 const isCardVisible = (cardId: string) => {
 return preferences.find(c => c.id === cardId)?.visible ?? true;
 };

 const getVisibleCards = () => {
 return preferences.filter(c => c.visible).sort((a, b) => a.order - b.order);
 };

 const resetPreferences = () => {
 setPreferences(DEFAULT_CARDS);
 localStorage.removeItem(PREFERENCES_KEY);
 };

 const toggleCardVisibility = (cardId: string) => {
 const newPreferences = preferences.map(card =>
 card.id === cardId ? { ...card, visible: !card.visible } : card
 );
 updatePreferences(newPreferences);
 };

 return (
 <DashboardPreferencesContext.Provider value={{
 preferences,
 updatePreferences,
 isCardVisible,
 getVisibleCards,
 isConfigOpen,
 setIsConfigOpen,
 resetPreferences,

 // Aliases
 cards: preferences,
 toggleCardVisibility,
 resetToDefault: resetPreferences,
 savePreferences: updatePreferences
 }}>
 {children}
 </DashboardPreferencesContext.Provider>
 );
};

export const useDashboardPreferences = () => {
 const context = useContext(DashboardPreferencesContext);
 if (context === undefined) {
 throw new Error('useDashboardPreferences must be used within a DashboardPreferencesProvider');
 }
 return context;
};

