import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
 LayoutDashboard, ShoppingCart, TrendingUp, Truck, Users, CreditCard,
 Package, ShoppingBag, BarChart3, Activity, DollarSign, Warehouse,
 Egg, ArrowRight, FileText, ArrowLeftRight, Wallet, Download, Upload,
 Repeat, UserCheck, Award, Share2, Target, Megaphone, Eye, Settings,
 LucideIcon, Shield, MapPin, Image, User as UserIcon, ChevronLeft, ChevronRight
} from 'lucide-react';
import { User, UserRole } from '../../../core/types/types';
import { useLanguage } from '../../../core/contexts/LanguageContext';
import { usePermissions } from '../../../core/hooks/usePermissions';

interface MenuItem {
 id: string;
 label: string;
 icon: LucideIcon;
 permission: string;
}

interface MenuModule {
 id: string;
 label: string;
 icon: LucideIcon;
 items: MenuItem[];
 permission?: string;
}

interface HorizontalMenuProps {
 currentUser: User;
 activePage: string;
 onNavigate: (page: string) => void;
}

export const HorizontalMenu: React.FC<HorizontalMenuProps> = ({
 currentUser,
 activePage,
 onNavigate
}) => {
 const { t } = useLanguage();
 const { hasPermission } = usePermissions(currentUser);
 const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set());
 const menuRef = useRef<HTMLDivElement>(null);
 const navRef = useRef<HTMLElement>(null);
 const [canScrollLeft, setCanScrollLeft] = useState(false);
 const [canScrollRight, setCanScrollRight] = useState(false);

 // Módulos habilitados globalmente (system_modules_config), sem locais
 useEffect(() => {
 const loadEnabledModules = () => {
 try {
 const stored = localStorage.getItem('system_modules_config');
 if (stored) {
 const config = JSON.parse(stored);
 const enabledSet = new Set<string>();
 Object.keys(config).forEach(key => {
 if (config[key]) enabledSet.add(key);
 });
 setEnabledModules(enabledSet);
 } else {
 setEnabledModules(new Set());
 }
 } catch (e) {
 console.warn('Erro ao carregar config de módulos', e);
 setEnabledModules(new Set());
 }
 };

 loadEnabledModules();
 const handleUpdate = () => loadEnabledModules();
 window.addEventListener('modules_updated', handleUpdate);
 return () => window.removeEventListener('modules_updated', handleUpdate);
 }, []);


 // Estrutura de mé³dulos
 const allModules: MenuModule[] = [
 {
 id: 'dashboard',
 label: 'Dashboard',
 icon: LayoutDashboard,
 items: [
 { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard, permission: 'dashboard.view' },
 ]
 },
 {
 id: 'vendas',
 label: 'Vendas',
 icon: TrendingUp,
 items: [
 { id: 'orders', label: t.nav.orders, icon: ShoppingCart, permission: 'orders.view' },
 { id: 'sales', label: t.nav.sales, icon: TrendingUp, permission: 'sales.view' },
 ]
 },
 {
 id: 'loja',
 label: 'Loja',
 icon: ShoppingBag,
 items: [
 { id: 'customers', label: t.nav.customers, icon: Users, permission: 'customers.view' },
 { id: 'products', label: t.nav.products, icon: Package, permission: 'products.view' },
 { id: 'purchases', label: 'Compras', icon: ShoppingBag, permission: 'purchases.view' },
 { id: 'stock-management', label: 'Stock', icon: BarChart3, permission: 'products.view' },
 ]
 },
 {
 id: 'producao',
 label: 'Produçéo',
 icon: Activity,
 items: [
 { id: 'production-activities', label: 'Atividades', icon: Activity, permission: 'production.view' },
 { id: 'production-expenses', label: 'Despesas', icon: DollarSign, permission: 'production.view' },
 { id: 'production-warehouse', label: 'Armazé©m', icon: Warehouse, permission: 'production.view' },
 { id: 'production-animals', label: 'Animais', icon: Users, permission: 'production.view' },
 { id: 'production-consumption', label: 'Consumo Dié¡rio', icon: Package, permission: 'production.view' },
 { id: 'production-outputs', label: 'Saé­das', icon: ArrowRight, permission: 'production.view' },
 { id: 'incubator', label: 'Incubadora', icon: Egg, permission: 'production.view' },
 ]
 },
 {
 id: 'administracao',
 label: 'Administraçéo',
 icon: Settings,
 items: [
 { id: 'users', label: 'Usué¡rios', icon: Users, permission: 'users.view' },
 { id: 'roles', label: 'Roles e Permisséµes', icon: Shield, permission: 'users.manage_roles' },

 { id: 'media', label: 'Mé­dia', icon: Image, permission: 'media.view' },
 { id: 'tracking', label: 'Rastreamento', icon: Activity, permission: 'users.view' },
 { id: 'profile', label: 'Meu Perfil', icon: UserIcon, permission: '' },
 ]
 },
 ];

 // Mé³dulos administrativos que sempre aparecem para admins (mesmo com "all" selecionado)
 const adminModules = new Set(['users', 'roles', 'tracking', 'profile']);

 // Filtrar mé³dulos e itens baseado nas permisséµes
 const filteredModules = useMemo(() => {
 return allModules
 .map(module => {
 const filteredItems = module.items.filter(item => {
 // Verificar mé³dulos habilitados (config global em system_modules_config)
 if (enabledModules.size > 0 && !enabledModules.has(item.id)) {
 // Exceçéo: mé³dulos administrativos podem aparecer mesmo se néo estiverem habilitados no local
 // mas sé³ para usué¡rios com permisséµes administrativas
 if (adminModules.has(item.id)) {
 if (item.id === 'locations-management') {
 const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.roles?.includes('ADMIN');
 const hasLocationPermission = hasPermission('locations.manage');
 return isAdmin || hasLocationPermission;
 }
 if (item.id === 'profile') {
 return true; // Perfil sempre disponé­vel
 }
 // Outros mé³dulos administrativos: verificar permisséµes
 if (!item.permission || item.permission === '') {
 return currentUser.role === UserRole.ADMIN || currentUser.roles?.includes('ADMIN');
 }
 return hasPermission(item.permission);
 }
 return false;
 }

 if (item.id === 'locations-management') {
 const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.roles?.includes('ADMIN');
 const hasLocationPermission = hasPermission('locations.manage');
 return isAdmin || hasLocationPermission;
 }

 // Profile sempre disponé­vel para usué¡rios logados
 if (item.id === 'profile') {
 return true;
 }

 if (!item.permission || item.permission === '') {
 return currentUser.role === UserRole.ADMIN || currentUser.roles?.includes('ADMIN');
 }

 return hasPermission(item.permission);
 });

 return {
 ...module,
 items: filteredItems
 };
 })
 .filter(module => module.items.length > 0);
 }, [currentUser, hasPermission, enabledModules, t]);

 // Coletar todos os itens de todos os mé³dulos em uma lista plana
 const allMenuItems = useMemo(() => {
 const items: Array<MenuItem & { moduleId: string; moduleLabel: string }> = [];
 filteredModules.forEach(module => {
 module.items.forEach(item => {
 items.push({
 ...item,
 moduleId: module.id,
 moduleLabel: module.label
 });
 });
 });
 return items;
 }, [filteredModules]);

 const handleItemClick = (itemId: string) => {
 onNavigate(itemId);
 };

 // Verificar se pode fazer scroll
 const checkScrollability = () => {
 if (!navRef.current) return;
 const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
 setCanScrollLeft(scrollLeft > 0);
 setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
 };

 // Scroll para esquerda
 const scrollLeft = () => {
 if (!navRef.current) return;
 navRef.current.scrollBy({ left: -200, behavior: 'smooth' });
 };

 // Scroll para direita
 const scrollRight = () => {
 if (!navRef.current) return;
 navRef.current.scrollBy({ left: 200, behavior: 'smooth' });
 };

 // Scroll infinito com mouse wheel e verificar scrollability
 useEffect(() => {
 const nav = navRef.current;
 if (!nav) return;

 const handleWheel = (e: WheelEvent) => {
 // Prevenir scroll vertical padréo e converter para horizontal
 if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
 e.preventDefault();
 nav.scrollBy({ left: e.deltaY, behavior: 'auto' });
 }
 };

 nav.addEventListener('wheel', handleWheel, { passive: false });

 // Verificar scrollability inicial e apé³s mudanças
 checkScrollability();
 nav.addEventListener('scroll', checkScrollability);

 // Verificar quando o tamanho muda
 const resizeObserver = new ResizeObserver(checkScrollability);
 resizeObserver.observe(nav);

 return () => {
 nav.removeEventListener('wheel', handleWheel);
 nav.removeEventListener('scroll', checkScrollability);
 resizeObserver.disconnect();
 };
 }, [allMenuItems]);

 return (
 <>
 <style>{`
 .horizontal-menu-scroll::-webkit-scrollbar {
 display: none;
 }
 .horizontal-menu-scroll {
 -ms-overflow-style: none;
 scrollbar-width: none;
 }
 `}</style>
 <div className="hidden md:flex items-center relative w-full max-w-full" ref={menuRef}>
 {/* Botéo Scroll Esquerda */}
 {canScrollLeft && (
 <button
 onClick={scrollLeft}
 className="absolute left-0 z-10 p-1.5 bg-surface-raised/90 backdrop-blur-sm hover:bg-surface-raised rounded-lg shadow-md border border-border-default transition-all"
 aria-label="Scroll esquerda"
 >
 <ChevronLeft className="w-4 h-4 text-content-secondary" />
 </button>
 )}

 <nav
 ref={navRef}
 className="flex items-center space-x-1 overflow-x-auto horizontal-menu-scroll w-full justify-center flex-1 px-2"
 style={{
 paddingLeft: canScrollLeft ? '2.5rem' : '0.5rem',
 paddingRight: canScrollRight ? '2.5rem' : '0.5rem'
 }}
 >
 {allMenuItems.length === 0 ? (
 <div className="text-sm text-content-muted px-4">
 Carregando menu...
 </div>
 ) : (
 allMenuItems.map((item, index) => {
 const ItemIcon = item.icon;
 const isItemActive = activePage === item.id;
 const prevItem = index > 0 ? allMenuItems[index - 1] : null;
 const showSeparator = prevItem && prevItem.moduleId !== item.moduleId;

 return (
 <React.Fragment key={item.id}>
 {showSeparator && (
 <div className="h-6 w-px bg-surface-base mx-1" />
 )}
 <button
 onClick={() => handleItemClick(item.id)}
 className={`
 flex items-center space-x-2 px-4 py-2.5 rounded-lg transition-all duration-200 whitespace-nowrap
 ${isItemActive
 ? 'bg-brand-50 dark:bg-brand-600/20 text-brand-700 dark:text-brand-400'
 : 'text-content-secondary hover:bg-surface-base'
 }
 `}
 title={item.label}
 >
 <ItemIcon className={`w-5 h-5 flex-shrink-0 ${isItemActive ? 'text-brand-600 dark:text-brand-400' : 'text-content-muted'}`} />
 <span className="text-sm font-medium">{item.label}</span>
 </button>
 </React.Fragment>
 );
 })
 )}
 </nav>

 {/* Botéo Scroll Direita */}
 {canScrollRight && (
 <button
 onClick={scrollRight}
 className="absolute right-0 z-10 p-1.5 bg-surface-raised/90 backdrop-blur-sm hover:bg-surface-raised rounded-lg shadow-md border border-border-default transition-all"
 aria-label="Scroll direita"
 >
 <ChevronRight className="w-4 h-4 text-content-secondary" />
 </button>
 )}
 </div>
 </>
 );
};


