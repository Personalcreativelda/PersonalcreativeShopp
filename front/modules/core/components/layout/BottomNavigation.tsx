import React, { memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, User, Tv, ShoppingBag } from 'lucide-react';

interface BottomNavigationProps {
 activePage?: 'home' | 'shop' | 'categories' | 'cart' | 'profile' | 'series';
 onNavigate?: (page: 'home' | 'shop' | 'categories' | 'cart' | 'profile' | 'series') => void;
 cartItemCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
 activePage: propActivePage,
 onNavigate: propOnNavigate,
 cartItemCount = 0
}) => {
 const navigate = useNavigate();
 const location = useLocation();
 
 // Determinar página ativa baseado na rota se não fornecida
 const getActivePage = (): 'home' | 'shop' | 'categories' | 'cart' | 'profile' | 'series' => {
 if (propActivePage) return propActivePage;
 const path = location.pathname;
 if (path === '/loja') return 'shop';
 if (path === '/series' || path.startsWith('/series/')) return 'series';
 if (path === '/sobre-nos') return 'home';
 return 'home';
 };
 
 const activePage = getActivePage();
 
 const handleNavigate = (page: 'home' | 'shop' | 'categories' | 'cart' | 'profile' | 'series') => {
 if (propOnNavigate) {
 propOnNavigate(page);
 } else {
 if (page === 'home') {
 navigate('/');
 } else if (page === 'shop') {
 navigate('/loja');
 } else if (page === 'series') {
 navigate('/series');
 }
 // categories, cart, profile são ações locais, não rotas
 }
 };
 const navItems = [
 {
 id: 'home' as const,
 label: 'Início',
 icon: Home
 },
 {
 id: 'shop' as const,
 label: 'Loja',
 icon: ShoppingBag
 },
 // {
 // id: 'cart' as const,
 // label: 'Carrinho',
 // icon: ShoppingCart,
 // badge: cartItemCount > 0 ? cartItemCount : undefined
 // },
 {
 id: 'series' as const,
 label: 'Oportunidades',
 icon: Tv
 },
 {
 id: 'profile' as const,
 label: 'Perfil',
 icon: User
 }
 ];

 return (
 <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-raised/95 backdrop-blur-xl border-t border-border-default shadow-lg">
 {/* Safe area padding para dispositivos com notch */}
 <div
 className="flex items-center justify-around px-2 py-2"
 style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
 >
 {navItems.map((item) => {
 const Icon = item.icon;
 const isActive = activePage === item.id;

 return (
 <button
 key={item.id}
 onClick={() => handleNavigate(item.id)}
 className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all relative ${isActive
 ? 'text-brand-600 dark:text-brand-400'
 : 'text-content-muted'
 }`}
 aria-label={item.label}
 >
 <div className="relative">
 <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : ''}`} />
 {item.badge !== undefined && item.badge > 0 && (
 <span className="absolute -top-2 -right-2 bg-brand-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg animate-pulse">
 {item.badge > 99 ? '99+' : item.badge}
 </span>
 )}
 </div>
 <span className={`text-[10px] font-medium transition-colors ${isActive
 ? 'text-brand-600 dark:text-brand-400'
 : 'text-content-muted'
 }`}>
 {item.label}
 </span>
 {isActive && (
 <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-brand-600 dark:bg-brand-400 rounded-full" />
 )}
 </button>
 );
 })}
 </div>
 </nav>
 );
};

// Memoizar BottomNavigation para evitar re-renders desnecessários
export default memo(BottomNavigation);


