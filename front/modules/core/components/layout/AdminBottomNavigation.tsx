import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, ShoppingCart, TrendingUp, Menu, BarChart3, Store } from 'lucide-react';
import { usePermissions } from '../../../core/hooks/usePermissions';
import { User } from '../../../core/types/types';

interface AdminBottomNavigationProps {
 activePage: string;
 onNavigate: (page: string) => void;
 onOpenMenu: () => void;
 currentUser: User;
}

export const AdminBottomNavigation: React.FC<AdminBottomNavigationProps> = ({
 activePage,
 onNavigate,
 onOpenMenu,
 currentUser
}) => {
 const { hasPermission } = usePermissions(currentUser);
 const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set());

 // Carregar mé³dulos habilitados do local storage (consistente com Sidebar)
 useEffect(() => {
 const loadEnabledModules = () => {
 try {
 const stored = localStorage.getItem('system_modules_config');
 if (stored) {
 const config = JSON.parse(stored);
 // Convert object { "modId": true } to Set for easier lookup
 const enabledSet = new Set<string>();
 Object.keys(config).forEach(key => {
 if (config[key]) enabledSet.add(key);
 });
 setEnabledModules(enabledSet);
 } else {
 // Default fallback logic? Or assume all?
 // For now, let's behave like sidebar: empty = all? 
 // Better to assume empty set if we want strict control, OR all if uninitialized.
 // But since 'ModuleSettings' initializes with all true, users effectively see all.
 // Let's assume consistent with Sidebar: check explicit false.
 // However, BottomNav uses Set.has(). We need to populate it.
 // If nothing in storage, let's assume ALL basic modules are active for safety, 
 // OR wait for a save. Let's assume ALL for safety if unconfigured.
 const allDefault = new Set(['dashboard', 'orders', 'sales', 'stock-management']);
 setEnabledModules(allDefault);
 }
 } catch (e) {
 console.warn('Erro config mobile', e);
 }
 };

 loadEnabledModules();

 const handleUpdate = () => loadEnabledModules();
 window.addEventListener('modules_updated', handleUpdate);
 return () => window.removeEventListener('modules_updated', handleUpdate);

 }, []);

 // Interface para tipagem correta
 interface PriorityItem {
 id: string;
 label: string;
 icon: React.ComponentType<{ className?: string }>;
 permission: string;
 skipModuleCheck?: boolean;
 isMenuButton?: boolean;
 }

 // Itens prioritários para o bottom navigation (máx 4 + Menu)
 const priorityItems: PriorityItem[] = [
 { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view', skipModuleCheck: true },
 { id: 'pos', label: 'Caixa', icon: Store, permission: 'sales.view', skipModuleCheck: true },
 { id: 'orders', label: 'Pedidos', icon: ShoppingCart, permission: 'orders.view', skipModuleCheck: true },
 { id: 'sales', label: 'Vendas', icon: TrendingUp, permission: 'sales.view', skipModuleCheck: true },
 ];

 // Filtrar navItems baseado em enabledModules e permisséµes
 const filteredNavItems = useMemo(() => {
 const availableItems = priorityItems.filter(item => {
 // Dashboard sempre disponé­vel (se tiver permissão)
 if (item.id === 'dashboard') {
 return hasPermission(item.permission);
 }

 // Itens que néo precisam verificar mé³dulo
 if (item.skipModuleCheck) {
 return hasPermission(item.permission);
 }

 // Outros: verificar se esté¡ habilitado no local E tem permissão
 return enabledModules.has(item.id) && hasPermission(item.permission);
 });

 // Adicionar botéo Menu no final
 return [...availableItems, { id: 'menu', label: 'Menu', icon: Menu, isMenuButton: true }];
 }, [enabledModules, hasPermission]);

 const navItems = filteredNavItems;

 return (
 <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-raised/95 backdrop-blur-xl border-t border-border-default shadow-lg">
 <div
 className="flex items-center justify-around px-2 py-2"
 style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
 >
 {navItems.map((item) => {
 const Icon = item.icon;
 const isActive = activePage === item.id;

 if (item.isMenuButton) {
 return (
 <button
 key={item.id}
 onClick={onOpenMenu}
 className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all relative text-content-muted"
 aria-label={item.label}
 >
 <Icon className="w-6 h-6" />
 <span className="text-[10px] font-medium">{item.label}</span>
 </button>
 );
 }

 return (
 <button
 key={item.id}
 onClick={() => onNavigate(item.id)}
 className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all relative ${isActive
 ? 'text-brand-600 dark:text-brand-400'
 : 'text-content-muted'
 }`}
 aria-label={item.label}
 >
 <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : ''}`} />
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


